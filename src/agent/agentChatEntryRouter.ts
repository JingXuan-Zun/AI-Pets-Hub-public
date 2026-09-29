import { type ChatMessage, type PetConfig } from '../types';
import {
  createAgentPlannerAvailableToolLines,
} from './agentToolRegistry';

export type AgentChatEntryRouteMode = 'agent' | 'chat';

export interface AgentChatEntryRouteDecision {
  confidence?: number | null;
  mode: AgentChatEntryRouteMode;
  reason: string;
  rewrittenGoal?: string | null;
}

export interface AgentChatEntryRouteModelRequest {
  settings: PetConfig['settings'];
  systemInstruction: string;
  userInput: string;
}

export type AgentChatEntryRouteModelCaller = (
  request: AgentChatEntryRouteModelRequest,
) => Promise<string>;

export interface ResolveAgentChatEntryRouteOptions {
  historyMessages?: ChatMessage[];
  maxHistoryMessages?: number;
  modelCaller?: AgentChatEntryRouteModelCaller;
  settings: PetConfig['settings'];
  sourceText: string;
}

export interface ShouldUseAgentChatEntryRouterOptions {
  historyMessages?: ChatMessage[];
  maxHistoryMessages?: number;
  sourceText: string;
}

const AGENT_CHAT_ENTRY_ROUTER_SYSTEM_INSTRUCTION = [
  'You are the entry router for a desktop pet chat app.',
  'Your only job is to decide whether the current user message should continue as normal character chat or enter AgentSessionV2.',
  'Return exactly one JSON object. Do not return markdown.',
  '',
  'Allowed JSON shape:',
  '{ "route": "chat" | "agent", "reason": "short reason", "rewrittenGoal": "optional concise user goal for AgentSessionV2", "confidence": 0.0 }',
  '',
  'Routing principles:',
  '- Choose "agent" only when the user wants the app to observe, inspect, open, focus, launch, move, organize, remember, change, run, or otherwise operate on the local computer, local apps, local files, desktop icons, screens, voice controls, or a local project.',
  '- Choose "agent" when the user asks whether the pet can see, observe, or recognize the current screen/window/game content. This is a live local observation test, not ordinary capability chat.',
  '- Choose "agent" when the user asks the pet to watch or summarize a video from the current screen/window/browser, or from a provided URL. If the video source is unclear, AgentSessionV2 may ask for the source.',
  '- Choose "chat" only for abstract capability questions such as whether the app supports vision in general, when the user is not asking about the current screen/window/game.',
  '- Choose "agent" when fulfilling the request would require a permission check before touching the computer.',

  '- Choose "chat" for normal conversation, companionship, roleplay, opinions, explanations, brainstorming, and ordinary knowledge questions that do not need local computer tools.',
  '- Choose "chat" for pure web/info questions unless the user specifically wants the local browser/app to be opened, focused, controlled, or used as part of the desktop task.',
  '- If the message is ambiguous, choose "chat" rather than guessing a computer action.',
  '- Do not select a specific tool here. AgentSessionV2 will choose tools later after it reads your route.',
  '- Do not route by keyword matching. Infer the actual user need and success criteria.',
  '- Keep rewrittenGoal faithful to the user. Do not add app names, screen targets, paths, or actions the user did not say.',
  '',
  'AgentSessionV2 available capabilities are represented by these registered tools:',
  ...createAgentPlannerAvailableToolLines(),
].join('\n');

export function shouldUseAgentChatEntryRouter({
  sourceText,
}: ShouldUseAgentChatEntryRouterOptions) {
  const trimmedSourceText = sourceText.trim();
  if (!trimmedSourceText) {
    return false;
  }

  if (trimmedSourceText.startsWith('/')) {
    return false;
  }

  return true;
}

const SAFE_NORMAL_CHAT_PATTERNS = [
  /^(?:现在|当前|请问)?(?:几点|什么时间|时间多少|几号|星期几)(?:了|呢|啊|呀)?[？?。!！]?$/iu,
  /^(?:今天|明天|昨天)?(?:是星期几|星期几)(?:呢|啊|呀)?[？?。!！]?$/iu,
  /^(?:你好|嗨|在吗|陪我聊聊|讲个故事|你觉得|你认为|为什么|怎么理解|能解释一下|帮我想想)/iu,
];

const EXPLICIT_LOCAL_AGENT_PATTERN = /(?:查看|观察|读取|检测|识别|截图|看看).{0,12}(?:桌面|屏幕|窗口|电脑|图标)|(?:打开|关闭|启动|聚焦|点击|输入|移动|整理|操作).{0,18}(?:浏览器|窗口|应用|文件|桌面|图标|电脑)|(?:帮我|请你).{0,12}(?:操作电脑|整理桌面|查看屏幕)/iu;

function isObviousNormalChat(sourceText: string) {
  const compactText = sourceText.trim().replace(/\s+/gu, ' ');
  return SAFE_NORMAL_CHAT_PATTERNS.some((pattern) => pattern.test(compactText))
    && !EXPLICIT_LOCAL_AGENT_PATTERN.test(compactText);
}

function normalizeRouterText(value: string) {
  return value.trim().replace(/^```(?:json)?/iu, '').replace(/```$/u, '').trim();
}

function clampConfidence(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(1, value));
}

function parseRouteMode(value: unknown): AgentChatEntryRouteMode | null {
  if (value === 'agent' || value === 'chat') {
    return value;
  }

  return null;
}

function tryParseAgentChatEntryRouteJson(text: string): AgentChatEntryRouteDecision | null {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const mode = parseRouteMode(parsed.route ?? parsed.mode);
    if (!mode) {
      return null;
    }

    return {
      confidence: clampConfidence(parsed.confidence),
      mode,
      reason: typeof parsed.reason === 'string' && parsed.reason.trim()
        ? parsed.reason.trim()
        : mode === 'agent'
          ? 'The user request needs local desktop Agent capabilities.'
          : 'The user request can be answered as normal chat.',
      rewrittenGoal: typeof parsed.rewrittenGoal === 'string' && parsed.rewrittenGoal.trim()
        ? parsed.rewrittenGoal.trim()
        : null,
    };
  } catch {
    return null;
  }
}

export function parseAgentChatEntryRouteDecision(text: string): AgentChatEntryRouteDecision | null {
  const normalizedText = normalizeRouterText(text);
  const directParse = tryParseAgentChatEntryRouteJson(normalizedText);
  if (directParse) {
    return directParse;
  }

  const startIndex = normalizedText.indexOf('{');
  const endIndex = normalizedText.lastIndexOf('}');
  if (startIndex < 0 || endIndex <= startIndex) {
    return null;
  }

  return tryParseAgentChatEntryRouteJson(normalizedText.slice(startIndex, endIndex + 1));
}

function compactRouterSnippet(value: string, maxLength = 320) {
  const normalizedText = value.replace(/\s+/gu, ' ').trim();
  if (normalizedText.length <= maxLength) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function formatRouterHistoryMessage(message: ChatMessage) {
  const speaker = message.role === 'user'
    ? 'user'
    : message.petName || message.role;
  return `${speaker}: ${compactRouterSnippet(message.text, 220)}`;
}

export function createAgentChatEntryRouterInput(options: {
  historyMessages?: ChatMessage[];
  maxHistoryMessages?: number;
  sourceText: string;
}) {
  const maxHistoryMessages = options.maxHistoryMessages ?? 6;
  const recentHistory = (options.historyMessages ?? [])
    .filter((message) => message.text.trim())
    .slice(-maxHistoryMessages)
    .map(formatRouterHistoryMessage);

  return [
    'Recent chat context:',
    recentHistory.length ? recentHistory.join('\n') : 'none',
    '',
    `Current user message: ${options.sourceText.trim()}`,
    '',
    'Decide the route now.',
  ].join('\n');
}

async function defaultAgentChatEntryRouteModelCaller(request: AgentChatEntryRouteModelRequest) {
  const { getAgentPlannerResponse } = await import('../services/geminiService');

  return getAgentPlannerResponse(
    request.userInput,
    request.systemInstruction,
    request.settings,
  );
}

export async function resolveAgentChatEntryRoute({
  historyMessages,
  maxHistoryMessages,
  modelCaller = defaultAgentChatEntryRouteModelCaller,
  settings,
  sourceText,
}: ResolveAgentChatEntryRouteOptions): Promise<AgentChatEntryRouteDecision> {
  const trimmedSourceText = sourceText.trim();
  if (!trimmedSourceText) {
    return {
      confidence: 1,
      mode: 'chat',
      reason: 'Empty input should not enter Agent.',
      rewrittenGoal: null,
    };
  }

  // Keep deterministic, ordinary questions in the character-chat path. This
  // prevents a router-model misunderstanding such as treating “现在几点”
  // as a request to inspect the desktop. Explicit local-computer requests
  // still take priority through the Agent route.
  if (isObviousNormalChat(trimmedSourceText)) {
    return {
      confidence: 1,
      mode: 'chat',
      reason: 'The message is an ordinary conversation or knowledge question and does not request local computer access.',
      rewrittenGoal: null,
    };
  }

  const modelResponse = await modelCaller({
    settings,
    systemInstruction: AGENT_CHAT_ENTRY_ROUTER_SYSTEM_INSTRUCTION,
    userInput: createAgentChatEntryRouterInput({
      historyMessages,
      maxHistoryMessages,
      sourceText: trimmedSourceText,
    }),
  });
  const decision = parseAgentChatEntryRouteDecision(modelResponse);
  if (!decision) {
    return {
      confidence: 0,
      mode: 'chat',
      reason: 'Entry router did not return valid JSON, so the message stays in normal chat.',
      rewrittenGoal: null,
    };
  }

  if (decision.mode === 'chat') {
    return {
      ...decision,
      rewrittenGoal: null,
    };
  }

  return {
    ...decision,
    rewrittenGoal: decision.rewrittenGoal || trimmedSourceText,
  };
}
