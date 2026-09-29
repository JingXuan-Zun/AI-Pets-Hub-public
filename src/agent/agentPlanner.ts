import { type PetConfig } from '../types';
import {
  type AgentChatCommand,
  type AgentDesktopIconPlacementDirection,
  type AgentPlannerCommandStep,
  type AgentToolStateSummary,
  type AgentToolCallName,
} from './agentChatCommand';
import { resolveAgentCharacterAnimationSkillCommand } from './agentCharacterSkillIntent';
import type {
  AgentCoreRecoveryRequest,
  AgentCoreReplanDecision,
  AgentCoreReplanRequest,
} from './agentCore';
import { type AgentWorkingMemorySnapshot } from './agentChatContext';
import {
  getAgentLegacyPlannerRelevanceKeywords,
  matchesAgentLegacyPlannerToolRelevance,
} from './agentPlannerRelevance';
import {
  createAgentPlannerAvailableToolLines,
  createAgentPlannerToolUnionText,
  AGENT_TOOL_REGISTRY,
  formatAgentToolLifecycleMetadata,
  isAgentToolName,
  type AgentToolDefinition,
} from './agentToolRegistry';
import {
  createAgentRuntimeCoreOpenMoveSequenceInput,
  shouldAgentRuntimeCoreTargetOpenAsResource,
} from './agentRuntimeCore';
import { resolveSafeDesktopOrganizationScope } from './desktopOrganizationScopePolicy';
import { resolveAgentExplicitDisplayRoleFromText } from './runtime/agentDisplayTargetIntent';

type AgentPlannerIntent = 'tool' | 'chat' | 'clarify' | 'unsupported';

interface AgentPlannerToolStep {
  args?: Record<string, unknown>;
  reason?: string;
  tool?: string | null;
}

interface AgentPlannerDecision {
  args?: Record<string, unknown>;
  confidence?: number;
  goal?: string;
  intent?: AgentPlannerIntent;
  message?: string;
  reason?: string;
  steps?: AgentPlannerToolStep[];
  tool?: string | null;
}

export interface AgentPlannerContextOptions {
  workingMemory?: AgentWorkingMemorySnapshot | null;
}

const PLANNER_SYSTEM_INSTRUCTION = [
  'You are a desktop Agent request planner inside a desktop pet app.',
  'Your job is to decide whether the user is asking for a local computer tool call.',
  'Return only one JSON object. No markdown, no commentary.',
  '',
  'JSON schema:',
  '{',
  '  "intent": "tool" | "chat" | "clarify" | "unsupported",',
  `  "tool": ${createAgentPlannerToolUnionText()},`,
  '  "args": {},',
  '  "goal": "short user-facing goal in Chinese",',
  '  "confidence": 0.0,',
  '  "steps": [{ "tool": "optional tool name", "args": {}, "reason": "why" }],',
  '  "message": "short Chinese clarification or unsupported reason"',
  '}',
  '',
  'Available tools:',
  ...createAgentPlannerAvailableToolLines(),
  '',
  'Rules:',
  '- If the request asks about this computer, desktop, apps, screen, local files/icons, or wants the pet to operate the computer, choose a tool.',
  '- Do not answer local computer facts from memory. If the user asks computer config or screen info, choose get_system_info or get_display_info.',
  '- If the user asks how a local folder/project/program runs and provides a path, choose inspect_local_project.',
  '- If the user asks to run/start one of the suggested project actions, choose run_local_project_action. This tool requires confirmation later; do not choose it for analysis-only questions.',
  '- If the user asks to search the web, open a search page, visit a website, or open the browser for a specific query/URL, choose browser_search with query. If they only ask to open the browser app, choose launch_local_app.',
  '- If the user asks to watch or summarize a video, do not turn that into browser_search unless they explicitly asked to search/find videos. If the video source is missing, clarify whether it is on the current screen or ask for the URL.',
  '- If the user asks about desktop pet settings, configuration, or a setting value, choose get_pet_settings. Use query for discovery or path for an exact field.',
  '- If the user asks to change, enable, or disable a desktop pet setting, first use get_pet_settings unless the exact path and correctly typed value are established; then choose update_pet_settings with changesJson. Desktop pet settings are in-process configuration: do not use screen-location or desktop-input tools to find a setting. If the intended value is missing, read the current setting and ask one short question for it.',
  '- If the user asks about voice settings/status, choose get_voice_status.',
  '- If the user asks to switch voice playback provider, choose switch_tts_provider with provider browser/api/local.',
  '- If the user asks to warm up/preload local voice, choose warmup_local_voice.',
  '- If the user asks to enable/disable microphone voice input, choose set_voice_input.',
  '- If the user asks to start listening now, start recording, or begin a microphone session, choose start_voice_input_session.',
  '- If the user asks to stop listening now or end recording, choose stop_voice_input_session.',
  '- If a required argument is missing, use intent "clarify" and ask for the missing detail.',
  '- You may include "steps" for multi-step reasoning, but "tool" must be the first concrete tool to call now. The app will verify and continue through its run loop.',
  '- If Agent working memory is provided, use it only to resolve references like "刚才那个", "第二个", "按刚才执行", or prior candidate actions. It may be stale; observe again for current computer facts.',
  '- Never invent tool names or arguments outside the listed schemas.',
  '- For desktop organization, default to mode "preview" unless the user is clearly confirming a previously shown plan.',
  '- For desktop organization custom placement, preserve the open-ended user request in placementIntent instead of turning it into rigid A/B choices. placementIntent is evidence for preview/verification, not a fixed tool chain.',
  '- Do not synthesize unsupported fixed corner/area execution arguments for desktop organization. If exact placement cannot be represented safely, still preview the closest supported plan with placementIntent and let the result expose capability gaps.',
  '- Do not ask "choose option 1 or 2" for desktop organization unless the available evidence proves there are exactly two safe supported actions. Prefer a tool preview/approval step or one open clarification question.',
  '- If the request is normal conversation that does not need local computer action/state, use intent "chat".',
  '- If the request asks for deletion, overwriting, arbitrary command execution, credential access, or unsupported control, use intent "unsupported".',
  '- Prefer existing/focused app windows for launch_local_app unless the user explicitly asks to open a new one.',
].join('\n');

const TOOL_LIFECYCLE_SYSTEM_INSTRUCTION = [
  'Tool lifecycle metadata:',
  '- observes = state the tool can inspect.',
  '- mutates = state the tool can change.',
  '- verifies = evidence the tool can prove after execution.',
  '- recoversWith = preferred tools after failed or uncertain results.',
  '- Choose observation/verification tools whose observes/verifies fields match the missing evidence before retrying mutating tools.',
].join('\n');

const REPLAN_SYSTEM_INSTRUCTION = [
  PLANNER_SYSTEM_INSTRUCTION,
  TOOL_LIFECYCLE_SYSTEM_INSTRUCTION,
  '',
  'You are replanning after the Agent has already executed one or more observation tools.',
  'Use the observation summary as ground truth. Do not repeat completed observation unless the observation is failed or insufficient.',
  'When structured tool state is provided, treat observedState, verificationEvidence, missingEvidence, and recommendedRecovery as higher priority than free-form response text.',
  'If missingEvidence is present, choose a tool whose observes/verifies can produce that evidence before selecting a mutating tool.',
  'Choose the next single useful tool, or intent "chat" if no more local action is needed.',
  'If the next tool changes files, moves icons, launches apps, records audio, warms local runtime, or runs project actions, still return it as a tool; the app will request user approval before execution.',
].join('\n');

const RECOVERY_SYSTEM_INSTRUCTION = [
  PLANNER_SYSTEM_INSTRUCTION,
  TOOL_LIFECYCLE_SYSTEM_INSTRUCTION,
  '',
  'You are deciding recovery after an Agent tool result was failed, unverified, or needs user input.',
  'Use the result summary as ground truth. Do not claim success unless the result summary proves it.',
  'When structured tool state is provided, prioritize it over free-form result text.',
  'Use missingEvidence to decide what must be observed or verified next.',
  'Use recommendedRecovery as candidate tools, but still choose only one registered tool that matches the missing evidence and risk.',
  'Prefer a read-only verification/observation tool when it can clarify the state.',
  'If recovery would change files, move icons, launch apps, record audio, warm local runtime, or run project actions, still return it as a tool; the app will request user approval before execution.',
  'If no registered tool can help, return intent "chat" with a short message.',
].join('\n');

function normalizePlannerText(value: string) {
  return value.trim().replace(/^```(?:json)?/iu, '').replace(/```$/u, '').trim();
}

function createAgentPlannerInput(
  text: string,
  options: AgentPlannerContextOptions = {},
) {
  const sourceText = text.trim();
  const memoryText = options.workingMemory?.summaryText?.trim();
  if (!memoryText || memoryText === 'none') {
    return sourceText;
  }

  return [
    'Agent working memory from previous turns:',
    memoryText,
    '',
    'Current user request:',
    sourceText,
    '',
    'Use working memory to resolve references, but choose observation tools again for fresh computer facts.',
  ].join('\n');
}

function createAgentStructuredStateSummaryText(stateSummary?: AgentToolStateSummary | null) {
  if (!stateSummary) {
    return 'none';
  }

  const lines = [
    stateSummary.observedState?.length ? `observedState: ${stateSummary.observedState.join(' | ')}` : '',
    stateSummary.changedState?.length ? `changedState: ${stateSummary.changedState.join(' | ')}` : '',
    stateSummary.verificationEvidence?.length ? `verificationEvidence: ${stateSummary.verificationEvidence.join(' | ')}` : '',
    stateSummary.missingEvidence?.length ? `missingEvidence: ${stateSummary.missingEvidence.join(' | ')}` : '',
    stateSummary.recommendedRecovery?.length ? `recommendedRecovery: ${stateSummary.recommendedRecovery.join(' | ')}` : '',
    stateSummary.actionEvidence ? `actionEvidence: ${JSON.stringify(stateSummary.actionEvidence)}` : '',
    stateSummary.structuredEvidence ? `structuredEvidence: ${JSON.stringify(stateSummary.structuredEvidence)}` : '',
  ].filter(Boolean);

  return lines.length ? lines.join('\n') : 'none';
}

function extractPlannerJson(text: string): AgentPlannerDecision | null {
  const normalizedText = normalizePlannerText(text);
  const directParse = tryParsePlannerJson(normalizedText);
  if (directParse) {
    return directParse;
  }

  const startIndex = normalizedText.indexOf('{');
  const endIndex = normalizedText.lastIndexOf('}');
  if (startIndex < 0 || endIndex <= startIndex) {
    return null;
  }

  return tryParsePlannerJson(normalizedText.slice(startIndex, endIndex + 1));
}

function tryParsePlannerJson(text: string): AgentPlannerDecision | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as AgentPlannerDecision
      : null;
  } catch {
    return null;
  }
}

function normalizePlannerIntent(value: unknown): AgentPlannerIntent {
  return value === 'tool' || value === 'chat' || value === 'clarify' || value === 'unsupported'
    ? value
    : 'unsupported';
}

function normalizePlannerSourceText(value: string) {
  return value.trim().replace(/\s+/gu, ' ');
}

function compactPlannerSourceText(value: string) {
  return normalizePlannerSourceText(value).replace(/\s+/gu, '').toLowerCase();
}

const PLANNER_OPEN_VERB_PATTERN = /(?:open|launch|start|run|visit|search|find|look\s+up|\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c|\u8bbf\u95ee|\u5f00\u542f|\u641c\u7d22|\u67e5\u627e|\u67e5\u8be2|\u67e5\u4e00\u4e0b)/iu;
const PLANNER_MOVE_VERB_PATTERN = /(?:move|put|place|send|\u653e(?:\u5230|\u5728)?|\u79fb(?:\u5230|\u52a8\u5230)?|\u79fb\u81f3|\u62d6(?:\u5230|\u8fc7\u53bb)?|\u663e\u793a(?:\u5230|\u5728)?)/iu;

export function normalizePlannerDisplayMoveTarget(text: string) {
  const explicitRole = resolveAgentExplicitDisplayRoleFromText(text);
  if (explicitRole) {
    return explicitRole;
  }

  const normalizedText = text.normalize('NFKC').toLowerCase();

  if (/(?:副屏|副显示器|第二屏|第二个屏|扩展屏|外接屏|2号屏|二号屏|secondary|second\s*(?:screen|display|monitor))/iu.test(normalizedText)) {
    return 'secondary';
  }

  if (/(?:主屏|主显示器|第一屏|第一个屏|1号屏|一号屏|primary|main\s*(?:screen|display|monitor))/iu.test(normalizedText)) {
    return 'primary';
  }

  return '';
}

function trimPlannerOpenAndMoveTargetCandidate(value: string) {
  return value
    .trim()
    .replace(/^[\s"'“”‘’「」『』]+/gu, '')
    .replace(/[\s"'“”‘’「」『』，。！？；:：,.!?;]+$/gu, '')
    .trim();
}

export function extractPlannerExistingWindowMoveTargetFromText(text: string) {
  const normalizedText = stripAgentCommandPrefix(text).normalize('NFKC').trim();
  const patterns = [
    /(?:\u628a|\u5c06)?\s*(?:(?:\u5f53\u524d|\u5df2\u7ecf|\u5df2|\u6b63\u5728)\s*(?:\u6253\u5f00|\u8fd0\u884c|\u542f\u52a8)(?:\u7740)?\s*\u7684?|(?:\u6253\u5f00|\u8fd0\u884c|\u542f\u52a8)(?:\u7740)?\s*\u7684)\s*["'\u201c\u201d\u2018\u2019\u300c\u300d\u300e\u300f]?(.+?)["'\u201c\u201d\u2018\u2019\u300c\u300d\u300e\u300f]?\s*(?:\u7a97\u53e3|\u5e94\u7528|\u8f6f\u4ef6|\u7a0b\u5e8f)?\s*(?:\u79fb\u52a8\u5230|\u79fb\u5230|\u79fb\u81f3|\u653e\u5230|\u653e\u5728|\u62d6\u5230|\u632a\u5230).{0,18}(?:\u526f\u5c4f|\u526f\u663e\u793a\u5668|\u7b2c\u4e8c(?:\u4e2a)?(?:\u5c4f|\u663e\u793a\u5668)|\u4e3b\u5c4f|\u4e3b\u663e\u793a\u5668|\u7b2c\u4e00(?:\u4e2a)?(?:\u5c4f|\u663e\u793a\u5668))/iu,
    /(?:move|put|place|send)\s+(?:the\s+)?(?:currently\s+|already\s+)?(?:open|running)\s+["']?(.+?)["']?(?:\s+(?:window|app|application|program))?\s+(?:to|on|onto)\s+(?:the\s+)?(?:secondary|primary|main|second)(?:\s+(?:screen|display|monitor))?/iu,
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    const target = match?.[1]
      ? trimPlannerOpenAndMoveTargetCandidate(match[1])
        .replace(/^\u7684/gu, '')
        .replace(/(?:\u7a97\u53e3|\u5e94\u7528|\u8f6f\u4ef6|\u7a0b\u5e8f)$/gu, '')
        .trim()
      : '';
    if (target) {
      return target;
    }
  }

  return '';
}

export function extractPlannerOpenAndMoveTargetFromText(text: string) {
  const normalizedText = stripAgentCommandPrefix(text).normalize('NFKC').trim();
  const boundedOpenMovePatterns = [
    /(?:\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c|\u8bbf\u95ee|\u5f00\u542f)\s*["'\u201c\u201d\u2018\u2019\u300c\u300d\u300e\u300f]?(.+?)["'\u201c\u201d\u2018\u2019\u300c\u300d\u300e\u300f]?(?=\s*(?:\uff0c|,)?\s*(?:\u5e76(?:\u5c06|\u628a)?|\u7136\u540e|\u518d)?\s*(?:\u5c06|\u628a)?(?:\u8be5|\u8fd9\u4e2a)?(?:\u6d4f\u89c8\u5668|\u5e94\u7528|\u8f6f\u4ef6|\u7a0b\u5e8f|\u7a97\u53e3|\u6d4f\u89c8\u5668\u7a97\u53e3)?\s*(?:\u7a97\u53e3)?\s*(?:\u79fb\u52a8\u5230|\u79fb\u5230|\u79fb\u81f3|\u653e\u5230|\u653e\u5728|\u62d6\u5230|\u632a\u5230))/iu,
    /(?:open|launch|start|run|visit)\s+["']?(.+?)["']?(?=\s*(?:,|and|then)?\s*(?:move|put|place|send)\s+(?:it|the\s+(?:browser|app|application|program|window))?\s*(?:to|on|onto))/iu,
  ];
  for (const pattern of boundedOpenMovePatterns) {
    const match = normalizedText.match(pattern);
    const target = match?.[1]
      ? trimPlannerOpenAndMoveTargetCandidate(match[1])
      : '';
    if (target) {
      return target;
    }
  }

  const directOpenMovePattern = new RegExp(
    '(?:open|launch|start|run|visit|\\u6253\\u5f00|\\u542f\\u52a8|\\u8fd0\\u884c|\\u8bbf\\u95ee|\\u5f00\\u542f)\\s*[\\u0022\\u0027\\u201c\\u201d\\u2018\\u2019\\u300c\\u300d\\u300e\\u300f]?(.+?)[\\u0022\\u0027\\u201c\\u201d\\u2018\\u2019\\u300c\\u300d\\u300e\\u300f]?\\s*(?:and|then|,|\\u002c|\\u003b|\\u7136\\u540e|\\u518d|\\u4e4b\\u540e)?.{0,24}(?:move|put|place|send|\\u653e(?:\\u5230|\\u5728)?|\\u79fb(?:\\u5230|\\u52a8\\u5230)?|\\u79fb\\u81f3|\\u62d6(?:\\u5230|\\u8fc7\\u53bb)?|\\u663e\\u793a(?:\\u5230|\\u5728)?).{0,18}(?:secondary|primary|main|second|\\u526f\\u5c4f|\\u526f\\u663e\\u793a\\u5668|\\u4e3b\\u5c4f|\\u4e3b\\u663e\\u793a\\u5668|\\u7b2c[\\u4e00\\u4e8c](?:\\u4e2a)?(?:\\u5c4f|\\u663e\\u793a\\u5668)|[12]\\s*(?:screen|display|monitor))',
    'iu',
  );
  const directOpenMoveMatch = normalizedText.match(directOpenMovePattern);
  const directOpenMoveTarget = directOpenMoveMatch?.[1]
    ? trimPlannerOpenAndMoveTargetCandidate(directOpenMoveMatch[1])
    : '';
  if (directOpenMoveTarget) {
    return directOpenMoveTarget;
  }

  const patterns = [
    /(?:open|launch|start|run|visit|\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c|\u8bbf\u95ee|\u5f00\u542f)\s*["'“”‘’「」『』]?(.+?)["'“”‘’「」『』]?\s*(?:and|then|,|，|;|；|\u7136\u540e|\u518d|\u4e4b\u540e)?.{0,24}(?:move|put|place|send|\u653e(?:\u5230|\u5728)?|\u79fb(?:\u5230|\u52a8\u5230)?|\u79fb\u81f3|\u62d6(?:\u5230|\u8fc7\u53bb)?|\u663e\u793a(?:\u5230|\u5728)?).{0,18}(?:secondary|primary|main|second|\u526f\u5c4f|\u526f\u663e\u793a\u5668|\u4e3b\u5c4f|\u4e3b\u663e\u793a\u5668|\u7b2c[\u4e00\u4e8c](?:\u4e2a)?(?:\u5c4f|\u663e\u793a\u5668)|[12]\s*(?:screen|display|monitor))/iu,
    /(?:打开|启动|运行|访问|开启|帮我打开|帮我启动)\s*[「"“']?(.+?)[」"”']?\s*(?:并|然后|再|之后|,|，)?.{0,24}(?:放到|移到|移动到|挪到|拖到|显示到|放在|移至|move\s+(?:it\s+)?to|put\s+(?:it\s+)?on).{0,12}(?:副屏|副显示器|第二屏|第二个屏|扩展屏|外接屏|2号屏|二号屏|主屏|主显示器|第一屏|第一个屏|1号屏|一号屏|secondary|primary|main\s*(?:screen|display|monitor)|second\s*(?:screen|display|monitor))/iu,
    /(?:open|launch|start|run|visit)\s+(.+?)\s+(?:and\s+)?(?:move|put|place)\s+(?:it\s+)?(?:to|on|onto)\s+(?:the\s+)?(?:secondary|primary|main|second)\s*(?:screen|display|monitor)?/iu,
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    const target = match?.[1]?.trim().replace(/[，,。.!！?？;；]+$/u, '');
    if (target) {
      return target;
    }
  }

  return '';
}

function shouldPlannerTargetOpenAsResource(target: string) {
  return shouldAgentRuntimeCoreTargetOpenAsResource(target);
}

function shouldPlannerToolOpenOrSearchTarget(toolName: AgentToolCallName) {
  return toolName === 'launch_local_app'
    || toolName === 'open_resource'
    || toolName === 'browser_search'
    || toolName === 'search_web'
    || toolName === 'execute_desktop_action'
    || toolName === 'execute_desktop_sequence';
}

function createPlannerOpenAndMoveSequenceInput(options: {
  forceNew?: boolean;
  sourceText: string;
  target: string;
  targetDisplay: string;
  toolName?: AgentToolCallName;
}) {
  return createAgentRuntimeCoreOpenMoveSequenceInput(options);
}

function normalizeToolName(value: unknown): AgentToolCallName | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedName = value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
  return isAgentToolName(normalizedName)
    ? normalizedName as AgentToolCallName
    : null;
}

function resolvePrimaryPlannerToolStep(decision: AgentPlannerDecision) {
  const step = decision.steps?.find((candidate) => normalizeToolName(candidate.tool)) ?? null;
  if (!step) {
    return null;
  }

  return {
    args: step.args && typeof step.args === 'object' && !Array.isArray(step.args)
      ? step.args
      : {},
    toolName: normalizeToolName(step.tool),
  };
}

function inferPlannerCommandStepPhase(
  toolName: AgentToolCallName,
  reason: string | undefined,
): AgentPlannerCommandStep['phase'] {
  const normalizedReason = reason?.trim().toLowerCase() ?? '';
  if (/(verify|验证|复查|确认结果|检查结果)/iu.test(normalizedReason)) {
    return 'verify';
  }
  if (/(recover|重试|恢复|失败后|重新)/iu.test(normalizedReason)) {
    return 'recover';
  }

  if (
    toolName === 'get_system_info'
    || toolName === 'get_display_info'
    || toolName === 'get_voice_status'
    || toolName === 'inspect_local_project'
  ) {
    return 'observe';
  }

  if (toolName === 'organize_desktop_icons') {
    return 'plan';
  }

  return 'execute';
}

function normalizePlannerCommandSteps(
  sourceText: string,
  decision: AgentPlannerDecision,
): AgentPlannerCommandStep[] {
  const rawSteps = decision.steps?.length
    ? decision.steps
    : decision.tool
      ? [{
          args: decision.args,
          reason: decision.reason,
          tool: decision.tool,
        }]
      : [];

  return rawSteps
    .map((step, rawIndex): AgentPlannerCommandStep | null => {
      const toolName = normalizeToolName(step.tool);
      if (!toolName) {
        return null;
      }

      const rawArgs = step.args && typeof step.args === 'object' && !Array.isArray(step.args)
        ? step.args
        : {};
      return {
        args: normalizePlannerToolArgs(sourceText, toolName, rawArgs),
        index: rawIndex + 1,
        phase: inferPlannerCommandStepPhase(toolName, step.reason),
        reason: step.reason?.trim() || null,
        tool: toolName,
      } satisfies AgentPlannerCommandStep;
    })
    .filter((step): step is AgentPlannerCommandStep => Boolean(step));
}

function withPlannerCommandSteps(
  command: AgentChatCommand,
  plannerSteps: AgentPlannerCommandStep[],
) {
  return plannerSteps.length
    ? {
        ...command,
        plannerSteps,
      }
    : command;
}

function shouldComposePlannerStepsIntoDesktopSequence(
  plannerSteps: AgentPlannerCommandStep[],
) {
  return plannerSteps.length >= 2
    && plannerSteps.every((step) => (
      step.tool === 'execute_desktop_action'
      || step.tool === 'execute_desktop_input'
    ));
}

function createPlannerStepsDesktopSequenceInput(
  plannerSteps: AgentPlannerCommandStep[],
  goal?: string,
) {
  return {
    postVerify: true,
    postVerifyQuery: goal?.trim() || undefined,
    stepsJson: JSON.stringify(plannerSteps.map((step) => ({
      args: step.args,
      reason: step.reason ?? undefined,
      tool: step.tool,
    }))),
    stopOnError: true,
  };
}

function getStringArg(args: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function getBooleanArg(args: Record<string, unknown>, key: string) {
  return typeof args[key] === 'boolean' ? args[key] : undefined;
}

function getNumberArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.trim())
      : NaN;

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function extractAbsoluteLocalPathCandidate(text: string) {
  const quotedMatch = text.match(/["“]([a-zA-Z]:\\[^"”\r\n]+)["”]/u);
  if (quotedMatch?.[1]) {
    return quotedMatch[1].trim().replace(/[\s"'“”]+$/gu, '');
  }

  const rawMatch = text.match(/([a-zA-Z]:\\[^\r\n]+)/u);
  return rawMatch?.[1]
    ? rawMatch[1].trim().replace(/[\s"'“”，。.!！?？]+$/gu, '')
    : '';
}

function stripAgentCommandPrefix(value: string) {
  return value
    .trim()
    .replace(/^\/\s*(?:agent|助手|智能体|代理)\s*/iu, '')
    .trim();
}

const PLANNER_VIDEO_SOURCE_PATTERN = /(?:\b(?:video|clip|youtube|bilibili|bili|shorts?|stream|movie)\b|\u89c6\u9891|\u5f71\u7247|\u77ed\u7247|\u756a\u5267|\u5f71\u50cf)/iu;
const PLANNER_VIDEO_SUMMARY_PATTERN = /(?:\b(?:watch|summari[sz]e|summary|recap|describe|explain)\b|\u770b|\u89c2\u770b|\u603b\u7ed3|\u6982\u62ec|\u6982\u8981|\u5206\u6790|\u8bb2\u4e86\u4ec0\u4e48|\u5185\u5bb9)/iu;
const PLANNER_EXPLICIT_VIDEO_SEARCH_PATTERN = /(?:\b(?:search|find|lookup|look\s*up)\b|\u641c\u7d22|\u641c|\u67e5\u627e|\u627e\u4e00\u4e0b|\u627e\u51e0\u4e2a)/iu;

function normalizePlannerVideoIntentText(text: string) {
  return stripAgentCommandPrefix(text)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}

function isPlannerVideoSummaryIntentWithoutSearch(text: string) {
  const normalizedText = normalizePlannerVideoIntentText(text);
  return PLANNER_VIDEO_SOURCE_PATTERN.test(normalizedText)
    && PLANNER_VIDEO_SUMMARY_PATTERN.test(normalizedText)
    && !PLANNER_EXPLICIT_VIDEO_SEARCH_PATTERN.test(normalizedText);
}

function normalizeDirection(value: unknown): AgentDesktopIconPlacementDirection | null {
  if (value === 'above' || value === 'below' || value === 'left-of' || value === 'right-of') {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const compactValue = value.trim().toLowerCase();
  if (/上|above|top/u.test(compactValue)) {
    return 'above';
  }
  if (/下|below|bottom/u.test(compactValue)) {
    return 'below';
  }
  if (/左|left/u.test(compactValue)) {
    return 'left-of';
  }
  if (/右|right/u.test(compactValue)) {
    return 'right-of';
  }

  return null;
}

function normalizeDesktopItemGroupBy(value: unknown) {
  return value === 'none' || value === 'kind' || value === 'category' || value === 'extension'
    ? value
    : undefined;
}

const OBSERVATION_ONLY_PLANNER_FALLBACK_TOOLS = new Set<AgentToolCallName>([
  'get_display_info',
  'get_system_info',
  'get_voice_status',
  'observe_windows_and_apps',
  'inspect_local_project',
]);

function isObservationOnlyPlannerFallbackTool(toolName: AgentToolCallName) {
  return OBSERVATION_ONLY_PLANNER_FALLBACK_TOOLS.has(toolName);
}

function scorePlannerToolDefinition(text: string, definition: AgentToolDefinition) {
  if (!isObservationOnlyPlannerFallbackTool(definition.name)) {
    return 0;
  }

  const compactText = compactPlannerSourceText(text);
  const relevanceKeywords = getAgentLegacyPlannerRelevanceKeywords(definition.name);
  let score = relevanceKeywords.reduce((total, keyword) => (
    compactText.includes(keyword.toLowerCase()) ? total + 1 : total
  ), 0);

  if (definition.name === 'get_display_info' && /(?:屏幕|显示器|分辨率|缩放|主屏|副屏|第二屏|工作区)/u.test(compactText)) {
    score += 4;
  }
  if (definition.name === 'get_system_info' && /(?:电脑|本机|系统|硬件|配置|cpu|gpu|内存|处理器|显卡)/iu.test(compactText)) {
    score += 4;
  }
  if (definition.name === 'inspect_local_project' && extractAbsoluteLocalPathCandidate(text) && /(?:怎么运行|如何运行|运行方式|启动方式|入口|分析|项目|程序|文件夹|目录)/u.test(compactText)) {
    score += 5;
  }
  if (definition.name === 'get_voice_status' && /(?:语音|朗读|播报|说话|麦克风|听写|识别|tts|stt|voice|音色).{0,12}(?:状态|设置|能力|现在|当前|是不是|是什么|怎么样|能不能|可用|健康)/iu.test(compactText)) {
    score += 5;
  }

  return score;
}

function resolvePlannerFallbackToolName(text: string): AgentToolCallName | null {
  const scoredTools = AGENT_TOOL_REGISTRY
    .map((definition) => ({
      definition,
      score: scorePlannerToolDefinition(text, definition),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  return scoredTools[0]?.definition.name ?? null;
}

function createUnsupportedPlannerCommand(sourceText: string, message?: string): AgentChatCommand {
  return {
    instruction: sourceText,
    kind: 'unsupported',
    plannerMessage: message?.trim() || undefined,
    sourceText,
  };
}

function createAgentCommandFromPlannerFallback(
  sourceText: string,
  options: {
    goal?: string;
    message?: string;
  } = {},
): AgentChatCommand | null {
  const toolName = resolvePlannerFallbackToolName(sourceText);
  if (!toolName) {
    return createUnsupportedPlannerCommand(
      sourceText,
      options.message ?? '我没能从这句话里推断出可靠的 Agent 工具。',
    );
  }

  if (!isObservationOnlyPlannerFallbackTool(toolName)) {
    return createUnsupportedPlannerCommand(
      sourceText,
      options.message ?? 'Agent planner 没有明确选中可执行工具；为了避免把自然语言当固定指令执行，我先停下等待重新规划。',
    );
  }

  return createAgentCommandFromPlannerDecision(sourceText, {
    args: normalizePlannerToolArgs(sourceText, toolName, {}),
    confidence: 0.4,
    goal: options.goal,
    intent: 'tool',
    message: options.message,
    tool: toolName,
  });
}

function createToolCallCommand(
  sourceText: string,
  toolName: AgentToolCallName,
  input: Record<string, unknown>,
  goal?: string,
): AgentChatCommand {
  const capabilityId = toolName === 'execute_memory_action'
    ? 'agent-memory'
    : toolName === 'launch_local_app'
      || toolName === 'browser_search'
      || toolName === 'observe_windows_and_apps'
      || toolName === 'execute_desktop_action'
      || toolName === 'execute_desktop_input'
      || toolName === 'control_browser'
      || toolName === 'remember_local_app'
    ? 'app-launcher'
    : toolName === 'execute_file_management_action' || toolName === 'execute_local_file_action'
      ? 'local-file-system'
    : toolName === 'analyze_game_screen' || toolName === 'manage_game_companion_loop'
      ? 'game-companion'
    : toolName === 'locate_screen_elements'
      ? 'desktop-observation'
    : toolName === 'inspect_local_project' || toolName === 'run_local_project_action'
      ? 'local-project-inspector'
    : toolName === 'organize_desktop_icons' || toolName === 'place_desktop_icon'
      ? 'desktop-organization'
    : toolName === 'get_voice_status'
      || toolName === 'switch_tts_provider'
      || toolName === 'warmup_local_voice'
      || toolName === 'set_voice_input'
      || toolName === 'start_voice_input_session'
      || toolName === 'stop_voice_input_session'
      ? 'voice-control'
      : 'system-inspector';

  return {
    capabilityId,
    instruction: sourceText,
    kind: 'tool-call',
    sourceText,
    toolCall: {
      goal: goal?.trim() || undefined,
      input,
      name: toolName,
    },
  };
}

function normalizePlannerToolArgs(
  sourceText: string,
  toolName: AgentToolCallName,
  args: Record<string, unknown>,
) {
  if (toolName === 'browser_search' || toolName === 'search_web') {
    return {
      ...args,
      forceNewPage: getBooleanArg(args, 'forceNewPage') || undefined,
      query: getStringArg(args, ['query', 'keyword', 'keywords', 'url', 'website', 'site', 'target']),
    };
  }

  if (toolName === 'launch_local_app') {
    return {
      ...args,
      forceNew: getBooleanArg(args, 'forceNew') || undefined,
      query: getStringArg(args, ['query', 'appName', 'name']),
    };
  }

  if (toolName === 'execute_desktop_sequence') {
    const targetDisplay = normalizePlannerDisplayMoveTarget(sourceText);
    const target = extractPlannerOpenAndMoveTargetFromText(sourceText)
      || getStringArg(args, ['target', 'query', 'appName', 'name', 'url', 'website', 'site']);
    if (targetDisplay && target) {
      return {
        ...args,
        ...createPlannerOpenAndMoveSequenceInput({
          forceNew: getBooleanArg(args, 'forceNew'),
          sourceText,
          target,
          targetDisplay,
        }),
      };
    }

    return args;
  }

  if (toolName === 'remember_local_app') {
    return {
      ...args,
      alias: getStringArg(args, ['alias', 'name']),
      path: getStringArg(args, ['path', 'appPath']),
    };
  }

  if (toolName === 'execute_memory_action') {
    return {
      ...args,
      action: getStringArg(args, ['action', 'memoryAction', 'operation']),
      category: getStringArg(args, ['category', 'type', 'topic']) || undefined,
      key: getStringArg(args, ['key', 'name', 'preferenceKey']) || undefined,
      query: getStringArg(args, ['query', 'keyword', 'keywords', 'target']) || undefined,
      value: getStringArg(args, ['value', 'content', 'text', 'fact', 'preference']) || undefined,
    };
  }

  if (toolName === 'execute_file_management_action') {
    return {
      ...args,
      action: getStringArg(args, ['action', 'fileAction', 'operation']),
      destinationDirectory: getStringArg(args, [
        'destinationDirectory',
        'targetDirectory',
        'folderPath',
        'directoryPath',
        'parentPath',
      ]) || undefined,
      destinationPath: getStringArg(args, ['destinationPath', 'targetPath', 'newPath', 'destination', 'dest', 'to']) || undefined,
      desktopPath: getStringArg(args, ['desktopPath', 'desktop', 'desktopDirectory', 'desktopFolder']) || undefined,
      groupBy: getStringArg(args, ['groupBy', 'group', 'grouping', 'groupStrategy']) || undefined,
      includeDirectories: getBooleanArg(args, 'includeDirectories') || undefined,
      includeHidden: getBooleanArg(args, 'includeHidden') || undefined,
      includeShortcuts: getBooleanArg(args, 'includeShortcuts') || undefined,
      intendedAction: getStringArg(args, ['intendedAction', 'previewAction', 'targetAction', 'operationType']) || undefined,
      limit: getNumberArg(args, 'limit') || undefined,
      mode: getStringArg(args, ['mode']) || undefined,
      newName: getStringArg(args, ['newName', 'name', 'fileName', 'folderName']) || undefined,
      sourcePath: getStringArg(args, ['sourcePath', 'path', 'source', 'from', 'query']) || undefined,
    };
  }

  if (toolName === 'analyze_game_screen') {
    return {
      ...args,
      focus: getStringArg(args, ['focus', 'analysisFocus', 'topic']) || undefined,
      forceRefresh: getBooleanArg(args, 'forceRefresh') || undefined,
      gameHint: getStringArg(args, ['gameHint', 'gameName', 'game']) || undefined,
      query: getStringArg(args, ['query', 'target', 'sourceName', 'name', 'windowTitle', 'title']) || undefined,
      question: getStringArg(args, ['question', 'goal', 'prompt']) || sourceText,
      sourceId: getStringArg(args, ['sourceId', 'id']) || undefined,
      sourceType: getStringArg(args, ['sourceType', 'captureSourceTypes', 'type']) || undefined,
    };
  }

  if (toolName === 'place_desktop_icon') {
    return {
      ...args,
      anchorName: getStringArg(args, ['anchorName', 'anchor']),
      direction: normalizeDirection(args.direction) ?? undefined,
      targetName: getStringArg(args, ['targetName', 'target']),
    };
  }

  if (toolName === 'organize_desktop_icons') {
    const displayTarget = getStringArg(args, ['targetDisplay', 'displayTarget', 'display']);
    const sourceDisplay = getStringArg(args, ['sourceDisplay', 'sourceDisplayTarget']);
    const groupBy = getStringArg(args, ['groupBy', 'group', 'grouping', 'groupStrategy']);
    const mode = getStringArg(args, ['mode', 'actionMode']);
    const placementIntent = getStringArg(args, ['placementIntent', 'layoutIntent', 'placementGoal', 'arrangementIntent', 'intent']) || sourceText;
    const scope = getStringArg(args, ['sourceScope', 'scope', 'iconScope']);
    const normalizedDisplayTarget = displayTarget;
    const requestedScope = scope;
    const structuredIntent = Boolean(args.targetDisplay || args.sourceDisplay || args.sourceScope);
    const safeScope = resolveSafeDesktopOrganizationScope({
      displayTarget: normalizedDisplayTarget === 'primary'
        || normalizedDisplayTarget === 'secondary'
        || normalizedDisplayTarget === 'current'
        || normalizedDisplayTarget === 'all'
        ? normalizedDisplayTarget
        : undefined,
      requestedScope: requestedScope === 'all-icons' || requestedScope === 'display-icons'
        ? requestedScope
        : undefined,
      sourceText,
      structuredIntent,
    });
    return {
      ...args,
      displayTarget: normalizedDisplayTarget,
      groupBy: normalizeDesktopItemGroupBy(groupBy),
      mode: mode || 'preview',
      placementIntent,
      scope: safeScope,
      sourceDisplay,
      sourceScope: safeScope,
      targetDisplay: normalizedDisplayTarget,
    };
  }

  if (toolName === 'get_system_info') {
    return {
      ...args,
      includeDisplays: args.includeDisplays !== false,
    };
  }

  if (toolName === 'get_voice_status') {
    return {
      ...args,
      includeLocalHealth: args.includeLocalHealth !== false,
    };
  }

  if (toolName === 'switch_tts_provider') {
    return {
      ...args,
      autoSpeak: getBooleanArg(args, 'autoSpeak'),
      enableVoice: getBooleanArg(args, 'enableVoice'),
      provider: getStringArg(args, ['provider', 'ttsProvider']) || undefined,
    };
  }

  if (toolName === 'set_voice_input') {
    return {
      ...args,
      enabled: getBooleanArg(args, 'enabled'),
    };
  }

  if (toolName === 'start_voice_input_session') {
    return {
      ...args,
      agentPrefix: getBooleanArg(args, 'agentPrefix'),
    };
  }

  if (toolName === 'inspect_local_project') {
    return {
      ...args,
      path: getStringArg(args, ['path', 'projectPath', 'folderPath', 'filePath', 'query']) || extractAbsoluteLocalPathCandidate(sourceText),
      question: getStringArg(args, ['question']) || sourceText,
    };
  }

  if (toolName === 'run_local_project_action') {
    return {
      ...args,
      actionIndex: getNumberArg(args, 'actionIndex') ?? getNumberArg(args, 'index'),
      command: getStringArg(args, ['command']),
      label: getStringArg(args, ['label']),
      path: getStringArg(args, ['path', 'projectPath', 'folderPath', 'filePath', 'query']) || undefined,
      question: getStringArg(args, ['question']) || sourceText,
    };
  }

  return args;
}

export function shouldUseAgentPlanner(text: string, deterministicCommand: AgentChatCommand | null) {
  const sourceText = text.trim();
  if (!sourceText) {
    return false;
  }

  if (deterministicCommand && deterministicCommand.kind !== 'unsupported') {
    return false;
  }

  if (sourceText.startsWith('/')) {
    return true;
  }

  return matchesAgentLegacyPlannerToolRelevance(sourceText);
}

export function createAgentCommandFromPlannerDecision(
  sourceText: string,
  decision: AgentPlannerDecision | null,
): AgentChatCommand | null {
  if (!decision) {
    return createAgentCommandFromPlannerFallback(sourceText, {
      message: '我没能把这句话规划成可靠的 Agent 工具调用。',
    });
  }

  const intent = normalizePlannerIntent(decision.intent);
  if (intent === 'chat') {
    return null;
  }

  if (intent === 'clarify') {
    return createUnsupportedPlannerCommand(sourceText, decision.message || '这里还缺少一个必要信息，我需要你再说具体一点。');
  }

  if (intent !== 'tool') {
    return createUnsupportedPlannerCommand(sourceText, decision.message || decision.reason || '这个请求暂时没有可用的安全工具。');
  }

  const primaryStep = resolvePrimaryPlannerToolStep(decision);
  const toolName = normalizeToolName(decision.tool)
    ?? primaryStep?.toolName;
  const rawArgs = decision.args && typeof decision.args === 'object' && !Array.isArray(decision.args)
    ? decision.args
    : primaryStep?.args ?? {};

  if (!toolName) {
    return createUnsupportedPlannerCommand(sourceText, 'Agent planner 没有选中已注册的本机工具，也没有从请求里推断出可靠工具。');
  }

  const args = normalizePlannerToolArgs(sourceText, toolName, rawArgs);
  const plannerSteps = normalizePlannerCommandSteps(sourceText, decision);
  const displayMoveTarget = normalizePlannerDisplayMoveTarget(sourceText);
  const openAndMoveTarget = getStringArg(args, ['target', 'query', 'appName', 'name', 'url', 'website', 'site'])
    || extractPlannerOpenAndMoveTargetFromText(sourceText);
  const createPlannedToolCallCommand = (
    selectedToolName: AgentToolCallName,
    input: Record<string, unknown>,
    goal?: string,
  ) => withPlannerCommandSteps(
    createToolCallCommand(sourceText, selectedToolName, input, goal),
    plannerSteps,
  );

  if (
    shouldComposePlannerStepsIntoDesktopSequence(plannerSteps)
    && toolName !== 'execute_desktop_sequence'
  ) {
    return createPlannedToolCallCommand(
      'execute_desktop_sequence',
      createPlannerStepsDesktopSequenceInput(plannerSteps, decision.goal),
      decision.goal,
    );
  }

  const shouldComposeOpenAndMoveDisplaySequence = Boolean(
    displayMoveTarget
      && openAndMoveTarget
      && shouldPlannerToolOpenOrSearchTarget(toolName)
      && PLANNER_OPEN_VERB_PATTERN.test(sourceText)
      && PLANNER_MOVE_VERB_PATTERN.test(sourceText),
  );

  if (shouldComposeOpenAndMoveDisplaySequence) {
    return createPlannedToolCallCommand('execute_desktop_sequence', createPlannerOpenAndMoveSequenceInput({
      forceNew: getBooleanArg(args, 'forceNew'),
      sourceText,
      target: openAndMoveTarget,
      targetDisplay: displayMoveTarget,
      toolName,
    }), decision.goal);
  }

  if (
    displayMoveTarget
    && openAndMoveTarget
    && shouldPlannerToolOpenOrSearchTarget(toolName)
    && /(?:打开|启动|运行|访问|开启|open|launch|start|run|visit)/iu.test(sourceText)
    && /(?:放到|移到|移动到|挪到|拖到|显示到|放在|移至|move|put|place)/iu.test(sourceText)
  ) {
    return createPlannedToolCallCommand('execute_desktop_sequence', createPlannerOpenAndMoveSequenceInput({
      forceNew: getBooleanArg(args, 'forceNew'),
      sourceText,
      target: openAndMoveTarget,
      targetDisplay: displayMoveTarget,
      toolName,
    }), decision.goal);
  }

  if (
    (toolName === 'browser_search' || toolName === 'search_web')
    && isPlannerVideoSummaryIntentWithoutSearch(sourceText)
  ) {
    return createUnsupportedPlannerCommand(
      sourceText,
      '我需要先知道视频来源：当前屏幕上的视频，还是你提供的视频链接；不能把“总结视频”自动当成搜索视频。',
    );
  }

  if (toolName === 'browser_search' || toolName === 'search_web') {
    const query = getStringArg(args, ['query', 'keyword', 'keywords', 'url', 'website', 'site', 'target']);
    if (!query) {
      return createUnsupportedPlannerCommand(sourceText, '要用浏览器搜索或访问网页的话，我还需要知道搜索内容或网址。');
    }

    return createPlannedToolCallCommand(toolName, {
      forceNewPage: getBooleanArg(args, 'forceNewPage'),
      query,
    }, decision.goal);
  }

  if (toolName === 'launch_local_app') {
    const query = getStringArg(args, ['query', 'appName', 'name']);
    if (!query) {
      return createUnsupportedPlannerCommand(sourceText, '要打开应用的话，我还需要知道应用名称。');
    }

    return createPlannedToolCallCommand(toolName, {
      forceNew: getBooleanArg(args, 'forceNew'),
      query,
    }, decision.goal);
  }

  if (toolName === 'remember_local_app') {
    const alias = getStringArg(args, ['alias', 'name']);
    const path = getStringArg(args, ['path', 'appPath']);
    if (!alias || !path) {
      return createUnsupportedPlannerCommand(sourceText, '要记住应用位置，需要同时给我应用别名和本机路径。');
    }

    return createPlannedToolCallCommand(toolName, { alias, path }, decision.goal);
  }

  if (toolName === 'place_desktop_icon') {
    const targetName = getStringArg(args, ['targetName', 'target']);
    const anchorName = getStringArg(args, ['anchorName', 'anchor']);
    const direction = normalizeDirection(args.direction);
    if (!targetName || !anchorName || !direction) {
      return createUnsupportedPlannerCommand(sourceText, '移动单个桌面图标时，需要目标图标、参照图标和上下左右方向。');
    }

    return createPlannedToolCallCommand(toolName, {
      anchorName,
      direction,
      targetName,
    }, decision.goal);
  }

  if (toolName === 'get_system_info') {
    return createPlannedToolCallCommand(toolName, {
      includeDisplays: args.includeDisplays !== false,
    }, decision.goal);
  }

  if (toolName === 'organize_desktop_icons') {
    const displayTarget = getStringArg(args, ['targetDisplay', 'displayTarget', 'display']);
    const sourceDisplay = getStringArg(args, ['sourceDisplay', 'sourceDisplayTarget']);
    const groupBy = getStringArg(args, ['groupBy', 'group', 'grouping', 'groupStrategy']);
    const mode = getStringArg(args, ['mode', 'actionMode']);
    const placementIntent = getStringArg(args, ['placementIntent', 'layoutIntent', 'placementGoal', 'arrangementIntent', 'intent']) || sourceText;
    const scope = getStringArg(args, ['sourceScope', 'scope', 'iconScope']);
    const normalizedDisplayTarget = displayTarget === 'primary' || displayTarget === 'secondary' || displayTarget === 'current' || displayTarget === 'all'
      ? displayTarget
      : undefined;
    const normalizedScope = scope === 'all-icons' || scope === 'display-icons'
      ? scope
      : undefined;
    const safeScope = resolveSafeDesktopOrganizationScope({
      displayTarget: normalizedDisplayTarget,
      requestedScope: normalizedScope,
      sourceText,
      structuredIntent: Boolean(args.targetDisplay || args.sourceDisplay || args.sourceScope),
    });
    return createPlannedToolCallCommand(toolName, {
      displayTarget: normalizedDisplayTarget,
      groupBy: normalizeDesktopItemGroupBy(groupBy),
      mode: mode === 'execute' || mode === 'preview'
        ? mode
        : 'preview',
      placementIntent,
      scope: safeScope,
      sourceDisplay,
      sourceScope: safeScope,
      targetDisplay: normalizedDisplayTarget,
    }, decision.goal);
  }

  if (toolName === 'get_pet_settings') {
    return createPlannedToolCallCommand(toolName, {
      path: getStringArg(args, ['path']),
      query: getStringArg(args, ['query']),
    }, decision.goal);
  }

  if (toolName === 'update_pet_settings') {
    const changes = args.changesJson ?? args.changes ?? args.updates;
    const changesJson = typeof changes === 'string'
      ? changes
      : changes && typeof changes === 'object' && !Array.isArray(changes)
        ? JSON.stringify(changes)
        : '';
    if (!changesJson) {
      return createUnsupportedPlannerCommand(sourceText, '修改桌宠设置需要提供一个以配置路径为键、JSON 值为值的变更对象。可以先读取设置确定路径。');
    }
    return createPlannedToolCallCommand(toolName, { changesJson }, decision.goal);
  }

  if (toolName === 'get_voice_status') {
    return createPlannedToolCallCommand(toolName, {
      includeLocalHealth: args.includeLocalHealth !== false,
    }, decision.goal);
  }

  if (toolName === 'switch_tts_provider') {
    const provider = getStringArg(args, ['provider', 'ttsProvider']);
    if (provider !== 'browser' && provider !== 'api' && provider !== 'local') {
      return createUnsupportedPlannerCommand(sourceText, '要切换语音播报来源，需要说明使用 Edge-TTS 本地、API 语音，还是本地语音。');
    }

    return createPlannedToolCallCommand(toolName, {
      autoSpeak: getBooleanArg(args, 'autoSpeak'),
      enableVoice: getBooleanArg(args, 'enableVoice'),
      provider,
    }, decision.goal);
  }

  if (toolName === 'warmup_local_voice') {
    return createPlannedToolCallCommand(toolName, {}, decision.goal);
  }

  if (toolName === 'set_voice_input') {
    const enabled = getBooleanArg(args, 'enabled');
    if (typeof enabled !== 'boolean') {
      return createUnsupportedPlannerCommand(sourceText, '要调整语音输入，需要明确是开启还是关闭。');
    }

    return createPlannedToolCallCommand(toolName, { enabled }, decision.goal);
  }

  if (toolName === 'start_voice_input_session') {
    return createPlannedToolCallCommand(toolName, {
      agentPrefix: getBooleanArg(args, 'agentPrefix') ?? false,
    }, decision.goal);
  }

  if (toolName === 'stop_voice_input_session') {
    return createPlannedToolCallCommand(toolName, {}, decision.goal);
  }

  if (toolName === 'inspect_local_project') {
    const localPath = getStringArg(args, ['path', 'projectPath', 'folderPath', 'filePath', 'query']);
    if (!localPath) {
      return createUnsupportedPlannerCommand(sourceText, '要分析文件夹或程序怎么运行，需要先给我一个本机绝对路径。');
    }

    return createPlannedToolCallCommand(toolName, {
      path: localPath,
      question: getStringArg(args, ['question']) || sourceText,
    }, decision.goal);
  }

  if (toolName === 'run_local_project_action') {
    const localPath = getStringArg(args, ['path', 'projectPath', 'folderPath', 'filePath', 'query']);
    return createPlannedToolCallCommand(toolName, {
      actionIndex: getNumberArg(args, 'actionIndex') ?? getNumberArg(args, 'index'),
      command: getStringArg(args, ['command']),
      label: getStringArg(args, ['label']),
      path: localPath || undefined,
      question: getStringArg(args, ['question']) || sourceText,
    }, decision.goal);
  }

  return createPlannedToolCallCommand(toolName, args, decision.goal);
}

export async function resolveAgentChatCommandWithPlanner(
  text: string,
  settings: PetConfig['settings'],
  options: AgentPlannerContextOptions = {},
) {
  const characterSkillCommand = resolveAgentCharacterAnimationSkillCommand(text);
  if (characterSkillCommand) {
    return characterSkillCommand;
  }

  try {
    const { getAgentPlannerResponse } = await import('../services/geminiService');
    const plannerInput = createAgentPlannerInput(text, options);
    const plannerResponse = await getAgentPlannerResponse(
      plannerInput,
      [
        PLANNER_SYSTEM_INSTRUCTION,
        TOOL_LIFECYCLE_SYSTEM_INSTRUCTION,
      ].join('\n\n'),
      settings,
    );

    return createAgentCommandFromPlannerDecision(text.trim(), extractPlannerJson(plannerResponse));
  } catch (error) {
    return createAgentCommandFromPlannerFallback(text.trim(), {
      message: `Agent planner 调用失败：${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

function createAgentReplanPlannerInput(
  request: AgentCoreReplanRequest,
  options: AgentPlannerContextOptions = {},
) {
  const remainingStepsText = request.remainingPlannerSteps.length
    ? request.remainingPlannerSteps.map((step) => (
        `${step.index}. ${step.tool} args=${JSON.stringify(step.args)} reason=${step.reason ?? ''}`
      )).join('\n')
    : 'none';
  const workingMemoryText = options.workingMemory?.summaryText?.trim();

  return [
    workingMemoryText && workingMemoryText !== 'none'
      ? [
          'Agent working memory from previous turns:',
          workingMemoryText,
          '',
        ].join('\n')
      : '',
    `Original user request: ${request.originalCommand.sourceText}`,
    `Current goal: ${request.corePlan.goal ?? request.originalCommand.instruction}`,
    `Completed tool: ${request.currentCommand.toolCall?.name ?? request.currentCommand.kind}`,
    'Structured tool state:',
    createAgentStructuredStateSummaryText(request.stateSummary),
    '',
    'Observation summary:',
    request.observationSummary,
    '',
    'Remaining planner steps from the previous plan:',
    remainingStepsText,
    '',
    'Return the next tool JSON now. If the observation already answers the user and no further local action is needed, return {"intent":"chat","message":"done"}.',
  ].join('\n');
}

export async function resolveAgentReplanCommandWithPlanner(
  request: AgentCoreReplanRequest,
  settings: PetConfig['settings'],
  options: AgentPlannerContextOptions = {},
): Promise<AgentCoreReplanDecision | null> {
  try {
    const { getAgentPlannerResponse } = await import('../services/geminiService');
    const plannerInput = createAgentReplanPlannerInput(request, options);
    const plannerResponse = await getAgentPlannerResponse(
      plannerInput,
      REPLAN_SYSTEM_INSTRUCTION,
      settings,
    );
    const command = createAgentCommandFromPlannerDecision(
      request.originalCommand.sourceText,
      extractPlannerJson(plannerResponse),
    );

    return command
      ? {
          command,
          reason: 'Planner replanned after observing current computer state.',
        }
      : null;
  } catch {
    return null;
  }
}

function createAgentRecoveryPlannerInput(
  request: AgentCoreRecoveryRequest,
  options: AgentPlannerContextOptions = {},
) {
  const workingMemoryText = options.workingMemory?.summaryText?.trim();

  return [
    workingMemoryText && workingMemoryText !== 'none'
      ? [
          'Agent working memory from previous turns:',
          workingMemoryText,
          '',
        ].join('\n')
      : '',
    `Original user request: ${request.originalCommand.sourceText}`,
    `Current goal: ${request.corePlan.goal ?? request.originalCommand.instruction}`,
    `Completed tool: ${request.currentCommand.toolCall?.name ?? request.currentCommand.kind}`,
    request.currentCommand.toolCall?.name
      ? `Completed tool lifecycle: ${formatAgentToolLifecycleMetadata(request.currentCommand.toolCall.name)}`
      : '',
    'Structured tool state:',
    createAgentStructuredStateSummaryText(request.stateSummary),
    '',
    'Result summary:',
    request.resultSummary,
    '',
    'Return the next recovery tool JSON now. If no local tool should run, return {"intent":"chat","message":"done"}.',
  ].join('\n');
}

export async function resolveAgentRecoveryCommandWithPlanner(
  request: AgentCoreRecoveryRequest,
  settings: PetConfig['settings'],
  options: AgentPlannerContextOptions = {},
): Promise<AgentCoreReplanDecision | null> {
  try {
    const { getAgentPlannerResponse } = await import('../services/geminiService');
    const plannerInput = createAgentRecoveryPlannerInput(request, options);
    const plannerResponse = await getAgentPlannerResponse(
      plannerInput,
      RECOVERY_SYSTEM_INSTRUCTION,
      settings,
    );
    const command = createAgentCommandFromPlannerDecision(
      request.originalCommand.sourceText,
      extractPlannerJson(plannerResponse),
    );

    return command
      ? {
          command,
          reason: 'Planner selected a recovery action after assessing the tool result.',
        }
      : null;
  } catch {
    return null;
  }
}
