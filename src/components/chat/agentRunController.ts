import {
  assessAgentCommandResult,
  buildAgentPermissionRoute,
  createAgentDuplicateApprovalBlockedResult,
  createAgentContextFromResult,
  createAgentDecisionSummary,
  createAgentWorkingMemorySnapshot,
  isAgentPermissionRouteSilentReadOnly,
  resolveAgentRuntimePendingFollowUpApproval,
  resolveAgentResultFollowUpActions,
  createAgentStaleOuterApprovalSkippedResult,
  cancelAgentProductionRuntime,
  AGENT_RUNTIME_DEFAULT_APPROVAL_CONTINUATION_LIMIT,
  runAgentToolTransaction,
  runAgentProductionRuntime,
  runAgentProductionApprovedAction,
  runAgentProductionApprovalContinuations,
  getAgentCanonicalEventJournal,
  getOrCreateAgentCanonicalEventJournal,
  releaseAgentCanonicalEventJournal,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentChatCommandHandler,
  type AgentChatFollowUpAction,
  type AgentRuntimeProgressHandler,
  type AgentRuntimeProgressEvent,
  type AgentProductionSessionResult,
  type AgentRuntimeToolExecutor,
  type AgentRuntimeToolResultEntry,
  type AgentStructuredToolEvidence,
  type AgentExecutionPlan,
} from '../../agent';
import { loadEnabledAgentImportedSkills } from '../../agent/agentImportedSkillRuntime';
import { resolveAgentFollowUpContinuationCommand } from '../../agent/agentFollowUpContinuation';
import { desktopPetChatStore } from '../../chatStore';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import {
  publishAgentRuntimeWorldProgress,
  publishAgentRuntimeWorldResult,
  publishAgentRuntimeWorldTaskStarted,
} from '../../runtime-world/agentRuntimeWorldBridge';
import {
  type ChatAgentApprovalDecision,
  type ChatAgentCorePlanSummary,
  type ChatAgentExecutionReceipt,
  type ChatAgentApproval,
  type ChatAgentApprovalSummary,
  type ChatAgentApprovalStatus,
  type ChatAgentRunStatus,
  type ChatAgentRunTraceItem,
  type ChatAgentRunTraceStatus,
  type ChatAgentWorkStage,
  type ChatAgentWorkStageId,
  type ChatAgentWorkStageStatus,
  type ChatMessage,
  type DesktopPetChatMode,
  type PetConfig,
} from '../../types';
import {
  finalizeChatSendRequest,
  type ChatSendTargetSlot,
} from './chatMessageSendUtils';
import { type PreparedChatSendRequest } from './chatMessageSendFlowUtils';
import {
  createAgentMcpApprovalSummaryWithSchema,
} from './agentMcpApprovalSummary';
import { type PlayVoiceTextOptions } from './chatVoicePlaybackTypes';
import { resolveChatAgentRuntimeContinuation } from './chatAgentRuntimeCompatibility';
import { createChatMessageId, resolveActiveChatSlot, resolveChatTargetSlots } from './multiPetChat';
import {
  mergeAgentApprovalMessageIntoExistingMessage,
  updateAgentApprovalMessage,
  updateAgentRunMessage,
} from './agentApprovalMessageStore';
import { runChatAgentApprovalContinuations } from './agentApprovalContinuationExecution';
import {
  abortAgentRunController,
  registerAgentRunAbortController,
} from './agentRunAbortRegistry';
import {
  getAgentTaskRuntimeRunStatus,
  isAgentTaskRuntimeWaitingApproval,
  resolveAgentApprovalUiStatus,
} from './agentRuntimeUiStatusProjection';
import {
  isStoppedAgentRunMessage,
  resolveAgentStopTarget,
} from './agentRunStopPolicy';
import {
  isStoppableAgentApprovalStatus,
  isStoppableAgentRunStatus,
  updateAgentProgressMessage,
} from './agentProgressMessageProjection';
import { updateGroupTaskConversationEvent } from './group/task/groupTaskConversationEvent';
import type { GroupTaskCandidate } from './group/task/groupTaskBridge';
import {
  completeGroupTaskMessageLifecycle,
  publishGroupTaskEvent,
  publishPreparedGroupTaskEvent,
  runGroupTaskExplanationLifecycle,
  updatePreparedGroupTaskEvent,
  type GroupTaskLifecycleCallbacks,
} from './group/task/groupTaskApprovalLifecycle';
import { resolveGroupTaskContinuationOutcome } from './group/task/groupTaskContinuationPolicy';
import { buildPersonaBehaviorContractInstruction } from '../../services/personaRulePolicy';

type AgentRunPetResponseTurn = (
  targetSlot: ChatSendTargetSlot,
  options: {
    chatMode: import('../../types').DesktopPetChatMode;
    historyMessages: import('../../types').ChatMessage[];
    participantNames: string[];
    promptText: string;
    shouldAutoSpeakReply: boolean;
    playbackToken: number;
    requestToken: number;
    browserSearchMode?: 'allow' | 'block' | 'force';
    outputMessageId?: string | null;
  },
) => Promise<{ cancelled: boolean; finalResponse: string }>;

type AgentPlayVoiceText = (text: string, options?: PlayVoiceTextOptions) => Promise<void>;

type AgentRunControllerAutoContinuationStartEvent = {
  action: Extract<AgentChatFollowUpAction, { kind: 'run-command' }>;
  initialResult: AgentChatCommandResult;
  plan: AgentExecutionPlan;
};

function createSkippedStaleOuterApprovalResult(command: AgentChatCommand): AgentChatCommandResult {
  const responseText = [
    '已跳过重复的外层桌面动作。',
    '同一次任务里已经有桌面执行证据，后续又回流到刚批准过的打开或聚焦请求。',
    '这通常是旧外层动作没有消费最新证据，不应再次要求用户批准，也不应重复执行打开/聚焦。',
  ].join(' ');

  return createAgentStaleOuterApprovalSkippedResult({
    command,
    responseText,
  });
}

function createRepeatedApprovalLoopResult(
  command: AgentChatCommand,
  executedResult?: AgentChatCommandResult | null,
): AgentChatCommandResult {
  const toolName = command.toolCall?.name ?? command.kind;
  const executedSummary = executedResult
    ? formatAgentCommandResultForTrace(executedResult)
    : null;
  const responseText = [
    '已停止重复的批准请求。',
    `刚刚批准的本机动作已经执行过：${toolName}，后续流程又请求了完全相同的批准。`,
    '不会让你继续反复点允许；当前应查看上一次执行证据，判断是输入无效、目标未确认，还是验证没有消费结果。',
    executedSummary ? `上一次执行结果：${executedSummary}` : '',
  ].filter(Boolean).join(' ');

  return createAgentDuplicateApprovalBlockedResult({
    command,
    previousExecutionResult: executedResult,
    previousExecutionSummary: executedSummary,
    responseText,
  });
}

interface RunPreparedAgentProductionSessionOptions {
  activeChatRequestTokenRef: { current: number };
  approvedToolResult?: AgentRuntimeToolResultEntry | null;
  instruction: string;
  groupTaskLifecycle?: GroupTaskLifecycleCallbacks;
  onRuntimeResult?: (event: {
    implementation: import('../../agent/runtime/agentRuntimeContract').AgentRuntimeImplementation;
    result: AgentProductionSessionResult;
  }) => void;
  onAgentChatCommand?: AgentChatCommandHandler;
  playVoiceText: AgentPlayVoiceText;
  preparedRequest: PreparedChatSendRequest;
  runPetResponseTurn: AgentRunPetResponseTurn;
  warmLocalReplyVoice: (settings: PetConfig['settings']) => void;
}

interface ResolveAgentApprovalRequestOptions {
  activeChatRequestTokenRef: { current: number };
  configRef: { current: PetConfig };
  decision: ChatAgentApprovalDecision;
  getPlaybackToken: () => number;
  groupTaskLifecycle?: GroupTaskLifecycleCallbacks;
  groupChatContinuationEnabledRef: { current: boolean };
  messageId: string;
  onAgentChatCommand?: AgentChatCommandHandler;
  playVoiceText: AgentPlayVoiceText;
  runPetResponseTurn: AgentRunPetResponseTurn;
  stopGroupChat: (options?: { immediate?: boolean; announce?: boolean; cancelActiveRequest?: boolean }) => void;
  stopPetSpeech: () => void;
  warmLocalReplyVoice: (settings: PetConfig['settings']) => void;
}

const AGENT_APPROVAL_DECISION_PUNCTUATION_PATTERN = /[\s,，.。!！?？、;；:："“”'‘’()[\]{}<>《》【】\-—_~～]+/gu;

const AGENT_APPROVAL_APPROVE_TEXTS = new Set([
  'y',
  'yes',
  'ok',
  'okay',
  'approve',
  'approved',
  'confirm',
  'confirmed',
  'goahead',
  '可以',
  '可以了',
  '可以执行',
  '允许',
  '准了',
  '批准',
  '同意',
  '确认',
  '确认执行',
  '好',
  '好的',
  '好吧',
  '行',
  '行的',
  '没问题',
  '继续',
  '继续吧',
  '继续执行',
  '开始',
  '开始吧',
  '执行',
  '执行吧',
  '执行计划',
  '运行',
  '运行吧',
  '做吧',
  '去做吧',
  '处理吧',
  '整理吧',
  '打开吧',
  '关掉吧',
  '关闭吧',
  '移动吧',
  '保存吧',
]);

const AGENT_APPROVAL_DENY_TEXTS = new Set([
  'n',
  'no',
  'deny',
  'cancel',
  'stop',
  '不',
  '不要',
  '不用',
  '不用了',
  '不行',
  '不可以',
  '别',
  '别动',
  '先别',
  '先别动',
  '先不要',
  '先不用',
  '取消',
  '拒绝',
  '停止',
  '停下',
  '停',
  '算了',
  '不要执行',
  '别执行',
  '先别执行',
]);

const AGENT_APPROVAL_APPROVE_PATTERN = /^(?:(?:就)?(?:按|照)?(?:这个|这样|刚才|刚刚|计划)?(?:做|执行|运行|开始|继续|处理|整理|打开|关闭|关掉|移动|保存|改)(?:吧|呀|啦|了)?|(?:就)?(?:按|照)(?:这个|这样|刚才的计划|刚刚的计划|计划)(?:做|执行|来|处理)(?:吧|呀|啦)?|(?:goahead|approved?|confirm(?:ed)?|yes|ok|okay))$/iu;
const AGENT_APPROVAL_DENY_PATTERN = /^(?:不(?:要|用|行|可以)?|别|先别|取消|拒绝|停止|停下|停|算了|别动|不要执行|别执行|先不要|先不用|先别执行|no|cancel|deny|stop)(?:了|吧|啦)?$/iu;
const AGENT_STOPPED_VISIBLE_TEXT = '\u5df2\u7ec8\u6b62\u5f53\u524d Agent \u6267\u884c\u3002';
const AGENT_STOPPED_DETAIL_TEXT = '\u7528\u6237\u5df2\u7ec8\u6b62\u5f53\u524d Agent \u6267\u884c\uff0c\u540e\u7eed\u5de5\u5177\u8c03\u7528\u548c\u56de\u590d\u5df2\u505c\u6b62\u3002';
const AGENT_STOPPED_RECEIPT_TITLE = '\u6267\u884c\u56de\u6267';
function normalizeAgentApprovalDecisionText(text: string) {
  return text
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/^\/\s*(?:agent|助手|智能体|代理)\s*/iu, '')
    .replace(AGENT_APPROVAL_DECISION_PUNCTUATION_PATTERN, '');
}

export function resolveAgentApprovalDecisionFromText(text: string): ChatAgentApprovalDecision | null {
  const normalizedText = normalizeAgentApprovalDecisionText(text);
  if (!normalizedText || normalizedText.length > 18) {
    return null;
  }

  if (AGENT_APPROVAL_DENY_TEXTS.has(normalizedText) || AGENT_APPROVAL_DENY_PATTERN.test(normalizedText)) {
    return 'deny';
  }

  if (AGENT_APPROVAL_APPROVE_TEXTS.has(normalizedText) || AGENT_APPROVAL_APPROVE_PATTERN.test(normalizedText)) {
    return 'approve';
  }

  return null;
}

export function findLatestPendingAgentApprovalMessage(
  messages: ChatMessage[],
  options: {
    activePetId?: string | null;
    chatMode?: DesktopPetChatMode | null;
  } = {},
) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message?.id || message.agentApproval?.status !== 'pending') {
      continue;
    }

    if (options.chatMode && message.chatMode && message.chatMode !== options.chatMode) {
      continue;
    }

    if (options.chatMode === 'single' && message.petId === null) {
      continue;
    }

    if (options.activePetId && message.petId && message.petId !== options.activePetId) {
      continue;
    }

    return message;
  }

  return null;
}

function resolveAgentReceiptStatus(result: AgentChatCommandResult): ChatAgentExecutionReceipt['status'] {
  if (result.receipt?.status) {
    return result.receipt.status;
  }

  if (result.ok === false) {
    return 'failed';
  }

  if (result.assessment?.status === 'failed') {
    return 'failed';
  }

  if (result.assessment?.status === 'unverified') {
    return 'unverified';
  }

  if (result.assessment?.status === 'needs-user') {
    return 'unverified';
  }

  return result.ok === true || result.verification || result.observations?.length
    ? 'success'
    : 'unverified';
}

function getAgentRuntimeCoreEvidenceLines(result: AgentChatCommandResult) {
  const lines = [
    ...(result.receipt?.evidenceLines ?? []),
    ...(result.observations ?? []),
  ];
  const seen = new Set<string>();

  return lines.filter((line) => {
    const text = line.trim();
    if (!text.startsWith('RuntimeCore:') || seen.has(text)) {
      return false;
    }

    seen.add(text);
    return true;
  });
}

function mergeAgentReceiptEvidenceLines(primaryLines: string[], runtimeCoreLines: string[]) {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const line of [
    ...runtimeCoreLines.slice(0, 4),
    ...primaryLines,
    ...runtimeCoreLines.slice(4),
  ]) {
    const text = line.trim();
    if (!text || seen.has(text)) {
      continue;
    }

    seen.add(text);
    merged.push(text);
  }

  return merged.slice(0, 8);
}

function createAgentExecutionReceipt(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
): ChatAgentExecutionReceipt {
  const runtimeCoreLines = getAgentRuntimeCoreEvidenceLines(result);
  const stateEvidenceLines = [
    result.stateSummary?.observedState?.length ? `observedState: ${result.stateSummary.observedState.slice(0, 3).join(' | ')}` : '',
    result.stateSummary?.changedState?.length ? `changedState: ${result.stateSummary.changedState.slice(0, 3).join(' | ')}` : '',
    result.stateSummary?.verificationEvidence?.length ? `verificationEvidence: ${result.stateSummary.verificationEvidence.slice(0, 3).join(' | ')}` : '',
    result.stateSummary?.missingEvidence?.length ? `missingEvidence: ${result.stateSummary.missingEvidence.slice(0, 3).join(' | ')}` : '',
    result.stateSummary?.recommendedRecovery?.length ? `recommendedRecovery: ${result.stateSummary.recommendedRecovery.slice(0, 3).join(' | ')}` : '',
  ].filter(Boolean);

  if (result.receipt) {
    return {
      evidenceLines: mergeAgentReceiptEvidenceLines([
        ...(result.receipt.evidenceLines?.filter(Boolean) ?? []),
        ...stateEvidenceLines,
      ], runtimeCoreLines),
      status: result.receipt.status,
      stateSummary: result.stateSummary ?? result.receipt.stateSummary ?? null,
      summaryLines: result.receipt.summaryLines.filter(Boolean).slice(0, 6),
      title: result.receipt.title,
      toolName: result.receipt.toolName ?? command.toolCall?.name ?? command.kind,
      verification: result.receipt.verification ?? result.verification ?? null,
    };
  }

  const toolName = command.toolCall?.name ?? command.kind;
  return {
    evidenceLines: mergeAgentReceiptEvidenceLines([
      result.verification ? `verification: ${result.verification}` : '',
      ...(result.observations ?? []).map((observation) => `observation: ${observation}`),
      ...stateEvidenceLines,
    ].filter(Boolean), runtimeCoreLines),
    status: resolveAgentReceiptStatus(result),
    stateSummary: result.stateSummary ?? null,
    summaryLines: [
      `tool: ${toolName}`,
      result.ok === false ? 'result: failed' : 'result: tool returned data',
      result.responseText ? `evidence: ${result.responseText.slice(0, 160)}` : '',
    ].filter(Boolean),
    title: 'Execution receipt',
    toolName,
    verification: result.verification ?? null,
  };
}

function createDeniedAgentExecutionReceipt(command: AgentChatCommand): ChatAgentExecutionReceipt {
  const toolName = command.toolCall?.name ?? command.kind;

  return {
    evidenceLines: ['User denied this Agent permission request before execution.'],
    status: 'blocked',
    summaryLines: [
      `tool: ${toolName}`,
      'result: user denied, tool was not executed',
    ],
    title: 'Execution receipt',
    toolName,
    verification: 'Permission was denied by the user.',
  };
}

function createStoppedAgentExecutionReceipt(command: AgentChatCommand): ChatAgentExecutionReceipt {
  const toolName = command.toolCall?.name ?? command.kind;

  return {
    evidenceLines: [AGENT_STOPPED_DETAIL_TEXT],
    status: 'blocked',
    summaryLines: [
      `tool: ${toolName}`,
      'result: user stopped current Agent execution',
    ],
    title: AGENT_STOPPED_RECEIPT_TITLE,
    toolName,
    verification: AGENT_STOPPED_DETAIL_TEXT,
  };
}

function formatAgentCommandResultForTrace(result: AgentChatCommandResult) {
  const followUpActions = resolveAgentResultFollowUpActions(result);
  const runtimeCoreLines = getAgentRuntimeCoreEvidenceLines(result).slice(0, 6);
  const receiptStatus = resolveAgentReceiptStatus(result);
  const statusLine = result.ok === false
    ? 'status: failed or needs more info'
    : receiptStatus === 'unverified'
      ? 'status: executed but still needs verification'
      : 'status: completed';
  const lines = [
    statusLine,
    result.responseText,
    result.assessment ? `assessment: ${result.assessment.summary}` : '',
    result.verification ? `verification: ${result.verification}` : '',
    result.errorText && result.ok === false ? `error: ${result.errorText}` : '',
    result.followUp ? `next: ${result.followUp}` : '',
    runtimeCoreLines.length ? `runtimeCore: ${runtimeCoreLines.join(' | ')}` : '',
    followUpActions.length ? `actions: ${followUpActions.map((action) => action.label).join(' | ')}` : '',
    result.observations?.length ? `observations: ${result.observations.slice(0, 4).join(' | ')}` : '',
  ].filter(Boolean);

  return lines.join('\n');
}

function stripAgentRunLoopSummaryFromText(text?: string | null) {
  const sourceText = text?.trim() ?? '';
  if (!sourceText) {
    return '';
  }

  // Some Agent skill/runtime adapters accidentally return their progress
  // envelope as finalAnswer. Never expose that envelope in a character bubble.
  // Keep the first human-facing bracketed answer when one is present.
  const internalProgressMarker = /(?:Runtime diagnosis|详细阶段|执行评估|工具计划|Agent runtime progress|Character reply|Decide next step|Summarize result|observedState|verificationEvidence)/iu;
  if (internalProgressMarker.test(sourceText)) {
    const answerMatch = sourceText.match(/【[^】\r\n]{1,120}】\s*([\s\S]*?)(?=\n(?:完成|详细阶段|执行评估|工具计划|$))/u);
    if (answerMatch?.[1]?.trim()) {
      return answerMatch[1].trim();
    }

    const finalAnswerMatch = sourceText.match(/(?:finalAnswer|Character reply)\s*[:：]?\s*([\s\S]*?)(?=\n(?:详细阶段|执行评估|工具计划|执行事件|$))/iu);
    if (finalAnswerMatch?.[1]?.trim()) {
      return finalAnswerMatch[1].trim();
    }

    return '';
  }

  const blockStart = sourceText.indexOf('\nExecution rounds:');
  if (blockStart >= 0) {
    return sourceText.slice(0, blockStart).trim();
  }

  return sourceText.startsWith('Execution rounds:')
    ? ''
    : sourceText;
}

function compactAgentPersonaPromptText(text?: string | null, maxLength = 180) {
  const normalizedText = stripAgentRunLoopSummaryFromText(text)
    .replace(/\s+/gu, ' ')
    .trim();

  if (normalizedText.length <= maxLength) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, Math.max(0, maxLength - 3))}...`;
}

const AGENT_INTERNAL_FALLBACK_TEXT_PATTERN = /(?:AgentSessionV2|AgentProductionSession|Agent V2|JSON|工具调用|结构化决策|local tool executor|tool executor adapter|no local tool executor|model did not return valid|completed without an additional tool result)/iu;

function createAgentSafeVisibleFallbackText(text?: string | null, maxLength = 160) {
  const compactText = compactAgentPersonaPromptText(text, maxLength);
  if (!compactText || AGENT_INTERNAL_FALLBACK_TEXT_PATTERN.test(compactText)) {
    return '';
  }

  return compactText;
}

const AGENT_PERSONA_RESULT_STYLE_RULES = [
  '角色回复硬性规则：',
  '你就是当前角色本人，不是 Agent 系统播报员、客服或任务总结器。',
  '以下是 Agent 的默认回复建议；如果人格提示词明确要求其他口吻、长度、结构或格式，必须以人格提示词为准。',
  '除非人格提示词明确要求，不要说“帮用户分析”“提醒用户”“根据工具结果”“任务已完成”“我会继续观察”这类系统化、计划化句子。',
  '把工具证据消化成角色自然对白；需要用户确认时，只问一句短问题，除非人格提示词另有要求。',
  '默认成功回复应落到一条具体结果或可验证细节；人格提示词有其他输出结构时，保留其结构。',
  '默认失败、缺信息、需要确认时都要短；人格提示词明确要求的格式、字段和段落不得省略。',
  '优先遵守人格提示词里的称呼、口癖、括号动作、情绪描写和回复格式。',
].join('\n');

const AGENT_PERSONA_SYSTEM_TONE_PATTERNS = [
  { label: '帮用户分析', pattern: /帮(?:你|用户)?分析/u },
  { label: '提醒用户', pattern: /提醒(?:你|用户)/u },
  { label: '根据工具结果', pattern: /根据(?:工具|执行|分析|以上).{0,8}(?:结果|信息|内容)/u },
  { label: '任务已完成', pattern: /(?:任务|操作|执行).{0,4}(?:已|已经)?完成/u },
  { label: '继续观察', pattern: /我会继续(?:观察|分析|关注)/u },
  { label: 'AI/Agent 身份', pattern: /作为(?:一个)?(?:AI|助手|Agent|智能体)/iu },
  { label: '工具播报', pattern: /工具(?:显示|返回|结果|证据)/u },
  { label: '内部流程名', pattern: /(?:AgentSessionV2|AgentProductionSession|Agent V2|JSON|工具调用|结构化决策|本机能力执行器)/iu },
  { label: '空泛完成句', pattern: /^(?:处理好了|完成了|搞定了|好了|已经处理好了)[。.!！]*$/u },
  { label: '整理结果套话', pattern: /(?:把|将).{0,6}结果.{0,8}整理给(?:你|用户)/u },
];

function findAgentPersonaReplyStyleIssues(text: string) {
  const normalizedText = text.replace(/\s+/gu, ' ').trim();
  if (!normalizedText) {
    return [];
  }

  return AGENT_PERSONA_SYSTEM_TONE_PATTERNS
    .filter(({ pattern }) => pattern.test(normalizedText))
    .map(({ label }) => label);
}

function shouldRetryAgentPersonaReply(text: string) {
  return findAgentPersonaReplyStyleIssues(text).length > 0;
}

function buildAgentPersonaReplyRewritePrompt(options: {
  basePrompt: string;
  issues: string[];
  previousReply: string;
}) {
  const {
    basePrompt,
    issues,
    previousReply,
  } = options;

  return [
    basePrompt,
    '上一句回复仍然像系统播报，需要重写一次。',
    `命中的问题：${issues.join('、') || '系统化口吻'}`,
    `上一句回复：${compactAgentPersonaPromptText(previousReply, 520)}`,
    '请重写成当前角色本人对用户说的话，只输出重写后的角色对白。',
    '不要只说“处理好了”“搞定了”；成功要给一个具体结果，失败要给一个短原因，需要补充时只问一个问题。',
    '不要解释重写过程，不要提工具、系统、Agent、JSON、API，也不要使用上面命中的系统化话术。',
  ].join('\n\n');
}

function createAgentFallbackVisibleReply(result: AgentChatCommandResult) {
  if (result.ok === false) {
    return createAgentSafeVisibleFallbackText(result.errorText ?? result.responseText, 120)
      || '这一步没走通，我先停下。';
  }

  if (result.assessment?.status === 'needs-user' && result.followUp) {
    return createAgentSafeVisibleFallbackText(result.followUp, 120)
      || '这里还差一点信息，你补一句我就接着来。';
  }

  const visibleResult = createAgentSafeVisibleFallbackText(result.responseText, 140);
  if (visibleResult) {
    return visibleResult;
  }

  const verification = createAgentSafeVisibleFallbackText(result.verification, 120);
  return verification || '这一段有结果了。';
}

function formatAgentResultEvidenceForPersonaPrompt(result: AgentChatCommandResult) {
  const observations = (result.observations ?? [])
    .map((observation) => compactAgentPersonaPromptText(observation, 260))
    .filter(Boolean)
    .slice(0, 5);
  const stateSummary = result.stateSummary;
  const stateLines = [
    ...(stateSummary?.observedState ?? []).slice(0, 4).map((item) => `observedState: ${item}`),
    ...(stateSummary?.changedState ?? []).slice(0, 3).map((item) => `changedState: ${item}`),
    ...(stateSummary?.verificationEvidence ?? []).slice(0, 4).map((item) => `verificationEvidence: ${item}`),
    ...(stateSummary?.missingEvidence ?? []).slice(0, 3).map((item) => `missingEvidence: ${item}`),
  ]
    .map((line) => compactAgentPersonaPromptText(line, 260))
    .filter(Boolean)
    .slice(0, 8);

  return [
    ...observations.map((line) => `observation: ${line}`),
    ...stateLines.map((line) => `state: ${line}`),
  ].join('\n');
}

function formatAgentCommandResultForPersonaPrompt(result: AgentChatCommandResult) {
  const followUpActions = resolveAgentResultFollowUpActions(result);
  const visibleResult = compactAgentPersonaPromptText(result.responseText);
  const assessmentSummary = compactAgentPersonaPromptText(result.assessment?.summary);
  const verification = compactAgentPersonaPromptText(result.verification);
  const errorText = compactAgentPersonaPromptText(result.errorText);
  const followUp = compactAgentPersonaPromptText(result.followUp);
  const evidence = formatAgentResultEvidenceForPersonaPrompt(result);

  return [
    `status: ${result.ok === false ? 'failed-or-needs-user' : 'success-or-completed'}`,
    visibleResult ? `result: ${visibleResult}` : '',
    assessmentSummary ? `assessment: ${assessmentSummary}` : '',
    verification ? `verification: ${verification}` : '',
    evidence,
    errorText ? `error: ${errorText}` : '',
    followUp ? `next: ${followUp}` : '',
    followUpActions.length ? `actions: ${followUpActions.map((action) => action.label).join(' | ')}` : '',
  ].filter(Boolean).join('\n');
}

function getAgentResultRunStatus(result: AgentChatCommandResult, blocked: boolean) {
  if (blocked) {
    return 'blocked' as const;
  }

  return result.ok === false ? 'failed' as const : 'completed' as const;
}

function createAgentCommandPersonaStatusGuidance(result: AgentChatCommandResult) {
  const assessmentStatus = result.assessment?.status ?? null;
  const replyStatus = result.ok === false || assessmentStatus === 'failed'
    ? 'failed'
    : assessmentStatus === 'needs-user'
      ? 'needs-user'
      : assessmentStatus === 'unverified'
        ? 'unverified'
        : assessmentStatus === 'can-continue'
          ? 'can-continue'
          : 'completed';

  switch (replyStatus) {
    case 'failed':
      return '本次结果状态：没有完成。回复时用角色口吻说清最近的失败原因，只给一个可行下一步；不要把它说成已经完成。';
    case 'needs-user':
      return '本次结果状态：还需要用户补充。回复时只问一个最关键的问题，不要列流程清单。';
    case 'unverified':
      return '本次结果状态：已有结果但未完全复核。回复时说“我看到了什么/还不能确认什么”，不要夸大成完成。';
    case 'can-continue':
      return '本次结果状态：已有阶段性结果，还可以继续。回复时先说当前具体发现，再自然给一个下一步选择。';
    default:
      return '本次结果状态：已有可用结果。回复时说对用户有用的具体结果，至少带一个证据细节；不要只说“处理好了”。';
  }
}

function buildAgentCommandPersonaPrompt(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
) {
  return [
    'You just handled a desktop-side task for the current character. Tell the user what matters naturally.',
    'Keep the current character personality and tone. Do not mention internal tools, JSON, APIs, or system prompts.',
    AGENT_PERSONA_RESULT_STYLE_RULES,
    createAgentCommandPersonaStatusGuidance(result),
    '除非人格提示词另有要求，回复通常一到两句话；不要复述计划、轮次、坐标清单或完整日志。',
    'Unless the persona instructions specify otherwise, keep the reply short. Do not repeat full plans, coordinates, or logs.',
    'If the action failed, explain the reason and one possible next step in character voice.',
    `user text: ${command.sourceText}`,
    `operation result:\n${formatAgentCommandResultForPersonaPrompt(result)}`,
  ].join('\n\n');
}

function formatAgentPlanToolSummary(plan: AgentExecutionPlan) {
  if (!plan.steps.length) {
    return 'no local tool steps';
  }

  const labels = plan.steps.map((step) => step.summary);
  return labels.length > 2
    ? `${labels.slice(0, 2).join(' | ')}; plus ${labels.length - 2} more action(s)`
    : labels.join(' | ');
}

function formatAgentPlanPermissionDetails(plan: AgentExecutionPlan) {
  return plan.steps.map((step) => [
    step.summary,
    `permission: ${step.decision.mode}`,
    step.decision.reason,
  ].filter(Boolean).join(' | '));
}

function createAgentWorkStages(
  plan: AgentExecutionPlan,
  options: {
    blockedStepId?: string | null;
    needsApproval?: boolean;
    status?: ChatAgentWorkStageStatus;
  } = {},
): ChatAgentWorkStage[] {
  const createdAt = Date.now();
  const toolStepCount = plan.steps.length;
  const blockedStep = options.blockedStepId
    ? plan.steps.find((step) => step.id === options.blockedStepId)
    : null;
  const permissionSummary = options.blockedStepId
    ? `Permission blocked: ${blockedStep?.summary ?? options.blockedStepId}`
    : options.needsApproval
      ? 'Some actions require user approval'
      : 'Permission policy allows continuing';

  return [
    {
      completedAt: createdAt,
      details: [plan.instruction],
      id: 'understand-request',
      startedAt: createdAt,
      status: 'completed',
      summary: `goal: ${plan.goal}`,
      title: 'Understand request',
    },
    {
      completedAt: createdAt,
      details: plan.steps.flatMap((step) => [step.summary, ...(step.details ?? [])]),
      id: 'plan-actions',
      startedAt: createdAt,
      status: 'completed',
      summary: `prepared ${toolStepCount} action(s): ${formatAgentPlanToolSummary(plan)}`,
      title: 'Plan actions',
    },
    {
      completedAt: options.needsApproval ? undefined : createdAt,
      details: formatAgentPlanPermissionDetails(plan),
      id: 'permission-check',
      startedAt: createdAt,
      status: options.blockedStepId ? 'blocked' : 'completed',
      summary: permissionSummary,
      title: 'Permission check',
    },
    ...(options.needsApproval
      ? [{
          details: ['Waiting for user approval or denial.'],
          id: 'await-approval' as const,
          startedAt: createdAt,
          status: 'running' as const,
          summary: 'Waiting for user approval',
          title: 'Await approval',
        }]
      : []),
    {
      details: plan.steps.map((step) => step.summary),
      id: 'execute-tools',
      startedAt: options.blockedStepId || options.needsApproval ? undefined : createdAt,
      status: options.blockedStepId
        ? 'blocked'
        : options.needsApproval
          ? 'pending'
          : options.status ?? 'running',
      summary: options.blockedStepId
        ? 'Not executed'
        : options.needsApproval
          ? 'Will execute after approval'
          : `Calling local tools: ${formatAgentPlanToolSummary(plan)}`,
      title: 'Execute tools',
    },
    {
      id: 'verify-result',
      status: 'pending',
      summary: 'Waiting for execution result',
      title: 'Verify result',
    },
    {
      id: 'decide-next-step',
      status: 'pending',
      summary: 'Waiting to decide next step after verification',
      title: 'Decide next step',
    },
    {
      id: 'persona-reply',
      status: 'pending',
      summary: 'Waiting for character reply',
      title: 'Character reply',
    },
  ];
}

function updateAgentWorkStage(
  stages: ChatAgentWorkStage[] | undefined,
  stageId: ChatAgentWorkStageId,
  status: ChatAgentWorkStageStatus,
  summary?: string | null,
  details?: string[],
) {
  const now = Date.now();
  return (stages ?? []).map((stage) => (
    stage.id === stageId
      ? {
          ...stage,
          completedAt: status === 'completed' || status === 'failed' || status === 'blocked'
            ? now
            : stage.completedAt,
          details: details ?? stage.details,
          startedAt: stage.startedAt ?? now,
          status,
          summary: summary ?? stage.summary,
        }
      : stage
  ));
}

function markAgentWorkStageToolsRunning(stages: ChatAgentWorkStage[] | undefined) {
  return updateAgentWorkStage(
    stages,
    'execute-tools',
    'running',
    '正在调用本机能力',
  );
}

function completeAgentWorkStagesWithResult(
  stages: ChatAgentWorkStage[] | undefined,
  result: AgentChatCommandResult,
  autoContinuation?: AgentRunControllerAutoContinuationStartEvent | null,
) {
  const receiptStatus = resolveAgentReceiptStatus(result);
  const toolStageStatus = receiptStatus === 'blocked' || receiptStatus === 'failed'
    ? 'failed'
    : 'completed';
  const verifyStageStatus = receiptStatus === 'blocked'
    ? 'blocked'
    : result.ok === false || result.assessment?.status === 'failed'
      ? 'failed'
      : receiptStatus === 'unverified'
        ? 'running'
      : 'completed';
  const toolStageSummary = toolStageStatus === 'failed'
    ? 'Tool could not complete'
    : receiptStatus === 'unverified'
      ? 'Tool executed but still needs verification'
      : 'Execution completed';
  const waitingForVerification = receiptStatus === 'unverified';
  const verifyStageSummary = receiptStatus === 'unverified'
    ? 'Waiting for target window or verification evidence'
    : result.assessment?.summary
      || result.verification
      || (result.ok === false ? result.errorText ?? result.responseText : 'Tool returned a successful result');
  const followUpActions = resolveAgentResultFollowUpActions(result);
  const resultSummary = verifyStageSummary;
  const resultDetails = [
    autoContinuation
      ? `auto-continue: ${autoContinuation.action.label} (${autoContinuation.plan.steps.length} read-only action(s))`
      : '',
    result.assessment?.evidence.length ? `assessment evidence: ${result.assessment.evidence.join(' | ')}` : '',
    result.responseText,
    result.followUp ? `next: ${result.followUp}` : '',
    result.observations?.length ? `observations: ${result.observations.slice(0, 4).join(' | ')}` : '',
  ].filter(Boolean);

  return updateAgentWorkStage(
    updateAgentWorkStage(
      updateAgentWorkStage(stages, 'execute-tools', toolStageStatus, toolStageSummary),
      'verify-result',
      verifyStageStatus,
      resultSummary,
      resultDetails,
    ),
    'decide-next-step',
    waitingForVerification ? 'pending' : 'completed',
    waitingForVerification
      ? 'Waiting for verification before deciding next step'
      : createAgentDecisionSummary(result, followUpActions),
    followUpActions.length ? followUpActions.map((action) => action.label) : undefined,
  );
}

function finalizePersonaWorkStage(stages: ChatAgentWorkStage[] | undefined) {
  return updateAgentWorkStage(stages, 'persona-reply', 'completed', '角色回复完成');
}

function createAgentRunTrace(
  plan: AgentExecutionPlan,
  options: {
    blockedStepId?: string | null;
    needsApproval?: boolean;
    status?: ChatAgentRunTraceStatus;
  } = {},
): ChatAgentRunTraceItem[] {
  const createdAt = Date.now();
  return [
    {
      detail: plan.instruction,
      id: 'understand-request',
      label: 'Understand request',
      status: 'completed',
      timestamp: createdAt,
    },
    {
      detail: `${plan.steps.length} step(s)`,
      id: 'build-plan',
      label: 'Build plan',
      status: 'completed',
      timestamp: createdAt,
    },
    {
      detail: options.blockedStepId
        ? 'Permission policy blocked this run'
        : options.needsApproval
          ? 'Contains approval-required actions'
          : 'Permission policy allows continuing',
      id: 'check-permission',
      label: 'Permission check',
      status: options.blockedStepId ? 'blocked' : 'completed',
      timestamp: createdAt,
    },
    ...(options.needsApproval ? [{
      id: 'wait-for-approval',
      label: 'Waiting for user approval',
      status: 'running' as const,
      timestamp: createdAt,
    }] : []),
    ...plan.steps.map((step, index) => ({
      detail: step.decision.reason,
      id: `step-${step.id}`,
      label: step.summary,
      status: options.blockedStepId === step.id
        ? 'blocked'
        : index === 0 && !options.needsApproval && !options.blockedStepId
          ? options.status ?? 'running'
          : 'pending',
      timestamp: undefined,
    } satisfies ChatAgentRunTraceItem)),
    {
      id: 'summarize-result',
      label: 'Summarize result',
      status: 'pending',
    },
    {
      id: 'decide-next-step',
      label: 'Decide next step',
      status: 'pending',
    },
    {
      id: 'persona-reply',
      label: 'Character reply',
      status: 'pending',
    },
  ];
}

function updateAgentRunTraceItem(
  trace: ChatAgentRunTraceItem[] | undefined,
  itemId: string,
  status: ChatAgentRunTraceStatus,
  detail?: string | null,
) {
  return (trace ?? []).map((item) => (
    item.id === itemId
      ? {
          ...item,
          detail: detail ?? item.detail,
          status,
          timestamp: Date.now(),
        }
      : item
  ));
}

function markAgentRunTraceToolSteps(
  trace: ChatAgentRunTraceItem[] | undefined,
  status: ChatAgentRunTraceStatus,
  detail?: string | null,
) {
  return (trace ?? []).map((item) => (
    item.id.startsWith('step-')
      ? {
          ...item,
          detail: detail ?? item.detail,
          status,
          timestamp: Date.now(),
        }
      : item
  ));
}

function resolveAgentCommandToolLabel(command: AgentChatCommand) {
  return command.toolCall?.name ?? command.kind;
}

function updateAgentToolExecutionProgressMessage(options: {
  autoContinuation?: AgentRunControllerAutoContinuationStartEvent | null;
  command: AgentChatCommand;
  messageId: string | null;
  phase: 'started' | 'completed' | 'failed';
  result?: AgentChatCommandResult | null;
}) {
  const { autoContinuation = null, command, messageId, phase, result } = options;
  if (!messageId) {
    return;
  }

  const toolLabel = resolveAgentCommandToolLabel(command);
  const statusText = phase === 'started'
    ? `正在调用工具：${toolLabel}`
    : phase === 'failed'
      ? `工具调用失败：${toolLabel}`
      : `工具调用完成：${toolLabel}`;
  const traceStatus: ChatAgentRunTraceStatus = phase === 'started'
    ? 'running'
    : phase === 'failed'
      ? 'failed'
      : 'completed';
  const receiptStatus = result?.receipt?.status ?? null;
  const traceDetail = phase === 'started'
    ? `Starting tool ${toolLabel}.`
    : result
      ? formatAgentCommandResultForTrace(result)
      : statusText;
  const progressDetailLines = result
    ? [
        ...(result.observations ?? []).filter((line) => /^Step \d+\//u.test(line)).slice(0, 6),
        ...(result.receipt?.summaryLines ?? []).slice(0, 4),
        ...(result.receipt?.evidenceLines ?? []).filter((line) => /^Step \d+\//u.test(line)).slice(0, 6),
        ...(result.observations ?? []).slice(0, 4),
      ]
    : [];

  updateAgentRunMessage(messageId, (message) => {
    const canUpdateRun = Boolean(message.agentRun && isStoppableAgentRunStatus(message.agentRun.status));
    const canUpdateApproval = Boolean(message.agentApproval && isStoppableAgentApprovalStatus(message.agentApproval.status));
    if (!canUpdateRun && !canUpdateApproval) {
      return message;
    }

    const nextStages = (stages: ChatAgentWorkStage[] | undefined) => updateAgentWorkStage(
      stages,
      'execute-tools',
      phase === 'started' || receiptStatus === 'unverified' ? 'running' : traceStatus === 'failed' ? 'failed' : 'completed',
      statusText,
      progressDetailLines.length ? [...new Set(progressDetailLines)].slice(0, 10) : undefined,
    );
    const nextTrace = (trace: ChatAgentRunTraceItem[] | undefined) => markAgentRunTraceToolSteps(
      trace,
      traceStatus,
      traceDetail,
    );

    return {
      ...message,
      text: statusText,
      agentApproval: canUpdateApproval && message.agentApproval
        ? {
            ...message.agentApproval,
            stages: nextStages(message.agentApproval.stages),
            trace: nextTrace(message.agentApproval.trace),
          }
        : message.agentApproval ?? null,
      agentRun: canUpdateRun && message.agentRun
        ? {
            ...message.agentRun,
            stages: nextStages(message.agentRun.stages),
            status: 'running',
            trace: nextTrace(message.agentRun.trace),
          }
        : message.agentRun ?? null,
    };
  });
}

async function runAgentToolExecutorWithLiveProgress(options: {
  command: AgentChatCommand;
  executor: AgentRuntimeToolExecutor;
  messageId: string | null;
  signal?: AbortSignal | null;
}) {
  updateAgentToolExecutionProgressMessage({
    command: options.command,
    messageId: options.messageId,
    phase: 'started',
  });

  try {
    const petId = desktopPetChatStore.getState().messages.find((message) => message.id === options.messageId)?.petId ?? null;
    const result = await options.executor(options.command, { petId, signal: options.signal ?? null });
    updateAgentToolExecutionProgressMessage({
      command: options.command,
      messageId: options.messageId,
      phase: result.ok === false ? 'failed' : 'completed',
      result,
    });
    return result;
  } catch (error) {
    const errorText = error instanceof Error ? error.message : String(error);
    const result = assessAgentCommandResult(options.command, {
      errorText,
      ok: false,
      responseText: errorText,
    });
    updateAgentToolExecutionProgressMessage({
      command: options.command,
      messageId: options.messageId,
      phase: 'failed',
      result,
    });
    throw error;
  }
}

async function runAgentControllerToolTransactionWithLiveProgress(options: {
  command: AgentChatCommand;
  executor: AgentRuntimeToolExecutor;
  messageId: string | null;
  signal?: AbortSignal | null;
}) {
  const transaction = await runAgentToolTransaction({
    appendTraceEvent: () => undefined,
    command: options.command,
    executeCommand: (command) => runAgentToolExecutorWithLiveProgress({
      command,
      executor: options.executor,
      messageId: options.messageId,
      signal: options.signal ?? null,
    }),
    getTimingDetail: (command) => {
      const action = command.toolCall?.input?.action;
      return typeof action === 'string' && action.trim()
        ? action.trim()
        : command.toolCall?.name ?? command.kind;
    },
    resolveTimingStatus: (result) => (
      options.signal?.aborted
        ? 'cancelled'
        : result.ok === false
          ? 'failed'
          : 'success'
    ),
    source: 'agent-run-controller',
    stepIndex: 0,
    timingTracker: {
      beginEntry: (kind, label, stepIndex, detail) => ({
        detail,
        id: `controller-tool-${Date.now()}`,
        kind,
        label,
        startedAt: Date.now(),
        status: 'running',
        stepIndex,
      }),
      finishEntry: (entry, status, detail) => ({
        ...entry,
        detail: detail ?? entry.detail ?? null,
        durationMs: Math.max(0, Date.now() - entry.startedAt),
        endedAt: Date.now(),
        status,
      }),
    },
  });

  return transaction.result;
}

function resolveAgentRunControllerStructuredEvidence(
  result: AgentChatCommandResult,
): AgentStructuredToolEvidence | null {
  return result.stateSummary?.structuredEvidence
    ?? result.receipt?.stateSummary?.structuredEvidence
    ?? null;
}

function completeAgentRunTrace(
  trace: ChatAgentRunTraceItem[] | undefined,
  resultText: string,
  options: {
    keepPendingVerification?: boolean;
  } = {},
) {
  return (trace ?? []).map((item) => {
    if (item.id === 'summarize-result') {
      return {
        ...item,
        detail: resultText,
        status: 'completed' as const,
        timestamp: Date.now(),
      };
    }

    if (item.id === 'persona-reply') {
      return {
        ...item,
        status: options.keepPendingVerification ? 'pending' as const : 'running' as const,
        timestamp: Date.now(),
      };
    }

    if (options.keepPendingVerification && (item.id === 'verify-result' || item.id === 'decide-next-step')) {
      return {
        ...item,
        detail: item.id === 'verify-result' ? resultText : item.detail,
        status: item.id === 'verify-result' ? 'running' as const : 'pending' as const,
        timestamp: item.timestamp ?? Date.now(),
      };
    }

    if (item.status === 'pending' || item.status === 'running') {
      return {
        ...item,
        status: 'completed' as const,
        timestamp: item.timestamp ?? Date.now(),
      };
    }

    return item;
  });
}

function completeAgentRunTraceWithResult(
  trace: ChatAgentRunTraceItem[] | undefined,
  result: AgentChatCommandResult,
  autoContinuation?: AgentRunControllerAutoContinuationStartEvent | null,
) {
  const decisionSummary = createAgentDecisionSummary(result, resolveAgentResultFollowUpActions(result));
  const receiptStatus = resolveAgentReceiptStatus(result);
  const keepPendingVerification = receiptStatus === 'unverified';
  const resultText = autoContinuation
    ? [
        `auto continuation: ${autoContinuation.action.label}`,
        formatAgentCommandResultForTrace(result),
      ].join('\n')
    : formatAgentCommandResultForTrace(result);
  const completedTrace = updateAgentRunTraceItem(
    completeAgentRunTrace(trace, resultText, { keepPendingVerification }),
    'decide-next-step',
    keepPendingVerification ? 'pending' : 'completed',
    decisionSummary,
  );
  if (result.ok !== false || result.receipt?.status === 'unverified') {
    return completedTrace;
  }

  return updateAgentRunTraceItem(
    completedTrace,
    'summarize-result',
    'failed',
    formatAgentCommandResultForTrace(result),
  );
}

function finalizePersonaReplyTrace(trace: ChatAgentRunTraceItem[] | undefined) {
  return updateAgentRunTraceItem(trace, 'persona-reply', 'completed');
}

function stopPendingAgentWorkStages(stages: ChatAgentWorkStage[] | undefined) {
  const now = Date.now();

  return (stages ?? []).map((stage) => (
    stage.status === 'pending' || stage.status === 'running'
      ? {
          ...stage,
          completedAt: now,
          details: stage.details,
          startedAt: stage.startedAt ?? now,
          status: 'blocked' as const,
          summary: AGENT_STOPPED_DETAIL_TEXT,
        }
      : stage
  ));
}

function stopPendingAgentRunTrace(trace: ChatAgentRunTraceItem[] | undefined) {
  const now = Date.now();

  return (trace ?? []).map((item) => (
    item.status === 'pending' || item.status === 'running'
      ? {
          ...item,
          detail: AGENT_STOPPED_DETAIL_TEXT,
          status: 'blocked' as const,
          timestamp: now,
        }
      : item
  ));
}

function getApprovalCommandDesktopOrganization(command: AgentChatCommand) {
  if (command.desktopOrganization) {
    return command.desktopOrganization;
  }

  if (command.toolCall?.name !== 'organize_desktop_icons') {
    return null;
  }

  const input = command.toolCall.input;
  const displayTarget = input.targetDisplay === 'primary'
    || input.targetDisplay === 'secondary'
    || input.targetDisplay === 'current'
    || input.targetDisplay === 'all'
    ? input.targetDisplay
    : input.displayTarget === 'primary'
      || input.displayTarget === 'secondary'
      || input.displayTarget === 'current'
      || input.displayTarget === 'all'
      ? input.displayTarget
      : undefined;
  const sourceDisplay = input.sourceDisplay === 'primary'
    || input.sourceDisplay === 'secondary'
    || input.sourceDisplay === 'current'
    || input.sourceDisplay === 'all'
    ? input.sourceDisplay
    : undefined;
  const scope = input.sourceScope === 'all-icons' || input.sourceScope === 'display-icons'
    ? input.sourceScope
    : input.scope === 'all-icons' || input.scope === 'display-icons'
      ? input.scope
      : undefined;
  return {
    displayTarget,
    groupBy: input.groupBy === 'none'
      || input.groupBy === 'kind'
      || input.groupBy === 'category'
      || input.groupBy === 'extension'
      ? input.groupBy
      : undefined,
    mode: input.mode === 'preview' || input.mode === 'execute'
      ? input.mode
      : undefined,
    scope,
    sourceDisplay,
    sourceScope: scope,
    targetDisplay: displayTarget,
  } satisfies NonNullable<AgentChatCommand['desktopOrganization']>;
}

function findLatestDesktopOrganizationPreviewSummary(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const context = messages[index]?.agentRun?.context ?? messages[index]?.agentApproval?.context ?? null;
    const organization = context?.desktopOrganization;
    if (context?.kind === 'desktop-organization' && organization?.previewSummaryLines?.length) {
      return {
        lines: organization.previewSummaryLines,
        warning: organization.previewWarning ?? null,
      };
    }
  }

  return null;
}

function createFallbackAgentApprovalSummary(plan: AgentExecutionPlan): ChatAgentApprovalSummary {
  return {
    lines: [
      `goal: ${plan.goal}`,
      `will execute ${plan.steps.length} local action(s): ${formatAgentPlanToolSummary(plan)}`,
      ...plan.steps
        .flatMap((step) => step.details ?? [])
        .filter(Boolean)
        .slice(0, 3),
    ],
    title: 'Confirm before execution',
    warning: null,
  };
}

function normalizeAgentApprovalActionName(value: unknown) {
  return typeof value === 'string'
    ? value.trim().replace(/[-\s]+/gu, '_')
    : '';
}

function getAgentApprovalRecordString(
  record: Record<string, unknown>,
  key: string,
) {
  const value = record[key];
  return typeof value === 'string' ? value.trim() : '';
}

function parseAgentApprovalDesktopSequenceSteps(command: AgentChatCommand) {
  if (command.toolCall?.name !== 'execute_desktop_sequence') {
    return [];
  }

  const stepsJson = command.toolCall.input?.stepsJson;
  if (typeof stepsJson !== 'string' || !stepsJson.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(stepsJson) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((step): step is Record<string, unknown> => (
        Boolean(step)
        && typeof step === 'object'
        && !Array.isArray(step)
      ))
      .map((step) => {
        const rawArgs = step.args ?? step.input;
        const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
          ? rawArgs as Record<string, unknown>
          : {};
        return {
          args,
          reason: getAgentApprovalRecordString(step, 'reason'),
          tool: getAgentApprovalRecordString(step, 'tool') || 'unknown',
        };
      });
  } catch {
    return [];
  }
}

function describeAgentApprovalDesktopSequenceStep(
  step: ReturnType<typeof parseAgentApprovalDesktopSequenceSteps>[number],
  index: number,
) {
  const action = normalizeAgentApprovalActionName(
    step.args.action ?? step.args.operation ?? step.args.desktopAction,
  );
  const target = [
    getAgentApprovalRecordString(step.args, 'target'),
    getAgentApprovalRecordString(step.args, 'query'),
    getAgentApprovalRecordString(step.args, 'url'),
    getAgentApprovalRecordString(step.args, 'targetDisplay')
      || getAgentApprovalRecordString(step.args, 'displayId')
      || getAgentApprovalRecordString(step.args, 'display'),
  ].find(Boolean);
  const label = action || step.tool;
  const targetText = target ? ` -> ${compactAgentPersonaPromptText(target, 56)}` : '';
  const reasonText = step.reason ? ` (${compactAgentPersonaPromptText(step.reason, 64)})` : '';

  return `${index + 1}. ${label}${targetText}${reasonText}`;
}

function createAgentDesktopSequenceApprovalSummary(
  command: AgentChatCommand,
  plan: AgentExecutionPlan,
): ChatAgentApprovalSummary | null {
  const sequenceSteps = parseAgentApprovalDesktopSequenceSteps(command);
  if (!sequenceSteps.length) {
    return null;
  }

  return {
    lines: [
      `One approval will run ${sequenceSteps.length} desktop step(s) in order.`,
      `goal: ${plan.goal}`,
      ...sequenceSteps.slice(0, 5).map(describeAgentApprovalDesktopSequenceStep),
    ],
    title: 'Confirm grouped desktop operation',
    warning: sequenceSteps.length > 5
      ? `${sequenceSteps.length - 5} more step(s) are hidden here; expand details before approving if needed.`
      : null,
  };
}

async function createAgentApprovalSummary(
  command: AgentChatCommand,
  plan: AgentExecutionPlan,
  preparedRequest: PreparedChatSendRequest,
): Promise<ChatAgentApprovalSummary> {
  const organization = getApprovalCommandDesktopOrganization(command);
  if (organization?.mode === 'execute') {
    const previewSummary = findLatestDesktopOrganizationPreviewSummary(desktopPetChatStore.getState().messages)
      ?? findLatestDesktopOrganizationPreviewSummary(preparedRequest.promptHistoryMessages);
    if (previewSummary) {
      return {
        lines: previewSummary.lines,
        title: 'Execute previous desktop organization plan',
        warning: previewSummary.warning,
      };
    }

    return {
      lines: [
        'This will execute the latest generated desktop organization plan.',
        ...createFallbackAgentApprovalSummary(plan).lines.slice(1),
      ],
      title: 'Execute desktop organization plan',
      warning: 'No previous preview summary was found in chat context. Re-observe first if the desktop changed.',
    };
  }

  const sequenceSummary = createAgentDesktopSequenceApprovalSummary(command, plan);
  if (sequenceSummary) {
    return sequenceSummary;
  }

  const mcpSummary = await createAgentMcpApprovalSummaryWithSchema(command, plan);
  if (mcpSummary) {
    return mcpSummary;
  }

  return createFallbackAgentApprovalSummary(plan);
}

async function createAgentApprovalMessage(options: {
  agentRuntime?: NonNullable<ChatMessage['agentApproval']>['agentRuntime'];
  command: AgentChatCommand;
  corePlanSummary?: ChatAgentCorePlanSummary | null;
  plan: AgentExecutionPlan;
  preparedRequest: PreparedChatSendRequest;
  text?: string;
}): Promise<ChatMessage> {
  const { agentRuntime = null, command, corePlanSummary = null, plan, preparedRequest, text } = options;
  const targetSlot = resolvePreparedAgentTargetSlot(preparedRequest);
  const messageId = createChatMessageId('agent-approval');
  const approvalSummary = await createAgentApprovalSummary(command, plan, preparedRequest);

  return {
    id: messageId,
    role: 'model',
    text: text ?? 'I need your approval before taking this Agent action.',
    agentApproval: {
      approvalSummary,
      agentRuntime,
      command,
      corePlanSummary,
      groupTaskEvent: preparedRequest.groupTaskConversationEvent ?? null,
      id: messageId,
      plan,
      stages: createAgentWorkStages(plan, {
        needsApproval: true,
      }),
      status: 'pending',
      trace: createAgentRunTrace(plan, {
        needsApproval: true,
      }),
    },
    chatMode: preparedRequest.currentChatState.chatMode,
    groupTaskEvent: preparedRequest.groupTaskConversationEvent ?? null,
    petId: targetSlot?.id ?? null,
    petName: targetSlot?.personality.name ?? null,
  };
}

function createAgentProductionSessionPlaceholderCommand(
  instruction: string,
  sourceText: string,
): AgentChatCommand {
  return {
    instruction,
    kind: 'tool-call',
    sourceText,
  };
}

function createAgentProductionSessionDisplayPlan(
  instruction: string,
  sourceText: string,
): AgentExecutionPlan {
  return {
    commandKind: 'tool-call',
    goal: instruction,
    instruction: sourceText,
    steps: [
      {
        action: {
          kind: 'observe-windows-and-apps',
          label: 'Agent runtime progress',
          risk: 'read',
          userInitiated: true,
        },
        decision: {
          allowed: true,
          mode: 'silent',
          reason: 'Agent runtime will report model and tool progress as it executes.',
        },
        details: ['Live progress container for the current Agent run.'],
        id: 'agent-runtime-progress',
        summary: 'Agent runtime progress',
      },
    ],
  };
}

function createInitialAgentProductionSessionState(
  instruction: string,
  sourceText: string,
): NonNullable<ChatMessage['agentRun']>['agentRuntime'] {
  return {
    historyLines: [],
    sourceText,
    steps: [],
    traceEvents: [],
    toolResults: [],
    userGoal: instruction,
  };
}

function formatAgentVisibleGoal(goal: string, maxLength = 54) {
  const compactGoal = compactAgentPersonaPromptText(goal, maxLength);
  return compactGoal ? `“${compactGoal}”` : '这一步';
}

function createAgentProductionSessionInitialVisibleText() {
  return '我先看清楚，再一步步来。';
}

function createAgentProductionSessionProgressVisibleText(event: AgentRuntimeProgressEvent) {
  switch (event.type) {
    case 'model-thinking':
      return event.continuation.steps.length
        ? '我在看刚才的结果，判断下一步。'
        : '我在理解你的需求，先判断要看哪些信息。';
    case 'model-decision':
      if (event.continuation.steps[event.continuation.steps.length - 1]?.action === 'tool_calls') {
        return '我先并行看几项只读信息，这样会快一点。';
      }

      if (event.continuation.steps[event.continuation.steps.length - 1]?.action === 'tool_call') {
        return '我选好了下一步，正在准备执行。';
      }

      return '我已经判断出下一步，正在整理结果。';
    case 'tools-running': {
      const commandCount = event.commands?.length ?? (event.command ? 1 : 0);
      if (commandCount > 1) {
        return `我正在并行读取 ${commandCount} 项本机状态。`;
      }

      return '我正在执行这一步。';
    }
    case 'tool-result':
      return '这一步有结果了，我继续判断。';
    default:
      return event.message || '我正在继续处理。';
  }
}

function createAgentProductionSessionResultVisibleText(result: AgentProductionSessionResult) {
  switch (result.status) {
    case 'budget-exceeded':
      return '这次跑太久了，我先停下，别让它一直卡着。';
    case 'needs-approval':
      return '我已经准备好要执行的操作了，确认后会直接继续。';
    case 'needs-user':
      return '这里还差一点信息，你补一句我就接着来。';
    case 'completed':
      return '这一段有结果了。';
    default:
      return '这一步没走通，我先停下，免得乱动。';
  }
}

function createAgentPendingApprovalVisibleText(goal: string) {
  return `已准备好执行${formatAgentVisibleGoal(goal)}，确认后会直接操作电脑并继续。`;
}

function createAgentApprovalDeniedVisibleText() {
  return '好，这次我不动。';
}

function createAgentApprovalAcceptedVisibleText() {
  return '好，我继续。';
}

function createAgentUnsupportedApprovalVisibleText() {
  return '这张旧确认卡已经接不上了，重新用 / 发我一次吧。';
}

function createAgentApprovalContinuationVisibleText(result: AgentProductionSessionResult) {
  return isAgentTaskRuntimeWaitingApproval(result)
    ? '已准备好下一步，确认后会直接继续。'
    : '这一步处理完了。';
}

function createAgentApprovalNextStepVisibleText(goal: string) {
  return `已准备好继续执行${formatAgentVisibleGoal(goal)}，确认后会直接操作电脑。`;
}

function createAgentApprovalFailureVisibleText(errorText: string) {
  return `这一步没走通：${compactAgentPersonaPromptText(errorText, 140)}`;
}

function createAgentProductionSessionRunMessage(options: {
  instruction: string;
  preparedRequest: PreparedChatSendRequest;
}): ChatMessage {
  const { instruction, preparedRequest } = options;
  const sourceText = preparedRequest.outgoingText;
  const targetSlot = resolvePreparedAgentTargetSlot(preparedRequest);
  const messageId = createChatMessageId('agent-v2-run');
  const plan = createAgentProductionSessionDisplayPlan(instruction, sourceText);

  return {
    id: messageId,
    role: 'model',
    text: createAgentProductionSessionInitialVisibleText(),
    agentRun: {
      agentRuntime: createInitialAgentProductionSessionState(instruction, sourceText),
      command: createAgentProductionSessionPlaceholderCommand(instruction, sourceText),
      id: messageId,
      plan,
      stages: createAgentWorkStages(plan, {
        status: 'running',
      }),
      status: 'running',
      trace: createAgentRunTrace(plan, {
        status: 'running',
      }),
    },
    chatMode: preparedRequest.currentChatState.chatMode,
    petId: targetSlot?.id ?? null,
    petName: targetSlot?.personality.name ?? null,
  };
}

function resolvePreparedAgentTargetSlot(preparedRequest: PreparedChatSendRequest) {
  const candidate = preparedRequest.groupTaskCandidate;
  const taskRoleId = candidate?.collaborationPlan?.executorRoleId ?? candidate?.sourceRoleIds[0];
  return preparedRequest.targetSlots.find((slot) => slot.id === taskRoleId)
    ?? preparedRequest.targetSlots[0]
    ?? null;
}

function updateAgentProductionSessionProgressMessage(
  messageId: string | null,
  event: AgentRuntimeProgressEvent,
) {
  updateAgentProgressMessage({
    event,
    messageId,
    visibleText: createAgentProductionSessionProgressVisibleText(event),
  });
}

export function stopAgentRunMessage(messageId?: string | null) {
  const messages = desktopPetChatStore.getState().messages;
  const targetMessage = resolveAgentStopTarget(messages, messageId);
  const targetMessageId = targetMessage?.id ?? null;

  if (!targetMessageId) {
    return false;
  }

  const canStopRun = targetMessage.agentRun && isStoppableAgentRunStatus(targetMessage.agentRun.status);
  const canStopApproval = targetMessage.agentApproval && isStoppableAgentApprovalStatus(targetMessage.agentApproval.status);

  if (!canStopRun && !canStopApproval) {
    return false;
  }

  abortAgentRunController(targetMessageId);
  let cancelledTaskState: { phase?: string | null; taskId?: string | null } | null = null;

  desktopPetChatStore.updateMessage(targetMessageId, (message) => {
    const continuation = resolveChatAgentRuntimeContinuation(message.agentRun)
      ?? resolveChatAgentRuntimeContinuation(message.agentApproval);
    const cancelledContinuation = continuation
      ? cancelAgentProductionRuntime({
          canonicalEventJournal: getAgentCanonicalEventJournal(targetMessageId),
          continuation,
        }).continuation
      : null;
    cancelledTaskState = cancelledContinuation?.taskState ?? null;

    return {
      ...message,
      text: AGENT_STOPPED_VISIBLE_TEXT,
      agentApproval: message.agentApproval && isStoppableAgentApprovalStatus(message.agentApproval.status)
        ? {
            ...message.agentApproval,
            agentRuntime: cancelledContinuation,
            errorText: AGENT_STOPPED_DETAIL_TEXT,
            followUpAction: null,
            followUpActions: null,
            followUpText: null,
            receipt: createStoppedAgentExecutionReceipt(message.agentApproval.command),
            resultText: AGENT_STOPPED_DETAIL_TEXT,
            stages: stopPendingAgentWorkStages(message.agentApproval.stages),
            status: 'blocked',
            stoppedByUser: true,
            trace: stopPendingAgentRunTrace(message.agentApproval.trace),
          }
        : message.agentApproval ?? null,
      agentRun: message.agentRun && isStoppableAgentRunStatus(message.agentRun.status)
        ? {
            ...message.agentRun,
            agentRuntime: cancelledContinuation,
            errorText: AGENT_STOPPED_DETAIL_TEXT,
            followUpAction: null,
            followUpActions: null,
            followUpText: null,
            receipt: createStoppedAgentExecutionReceipt(message.agentRun.command),
            resultText: AGENT_STOPPED_DETAIL_TEXT,
            stages: stopPendingAgentWorkStages(message.agentRun.stages),
            status: 'blocked',
            stoppedByUser: true,
            trace: stopPendingAgentRunTrace(message.agentRun.trace),
          }
        : message.agentRun ?? null,
    };
  });

  pushFrontendRuntimeLog('agent-run', 'user stopped current agent run', {
    messageId: targetMessageId,
  });
  publishAgentRuntimeWorldResult({
    status: 'cancelled',
    taskState: cancelledTaskState,
  });
  releaseAgentCanonicalEventJournal(targetMessageId);

  return true;
}

function snapshotChatMessageIds() {
  return new Set(
    desktopPetChatStore.getState().messages
      .map((message) => message.id)
      .filter((messageId): messageId is string => typeof messageId === 'string' && messageId.length > 0),
  );
}

function findNewTargetModelMessageId(
  beforeMessageIds: Set<string>,
  targetSlot: ChatSendTargetSlot,
  chatMode: DesktopPetChatMode,
) {
  const messages = desktopPetChatStore.getState().messages;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      message
      && typeof message.id === 'string'
      && !beforeMessageIds.has(message.id)
      && message.role === 'model'
      && message.petId === targetSlot.id
      && message.chatMode === chatMode
    ) {
      return message.id;
    }
  }

  return null;
}

function getChatMessageText(messageId: string | null) {
  if (!messageId) {
    return '';
  }

  return desktopPetChatStore.getState().messages.find((message) => message.id === messageId)?.text ?? '';
}

function playDeferredAgentPersonaVoice(options: {
  playVoiceText: AgentPlayVoiceText;
  shouldAutoSpeakReply: boolean;
  targetSlot: ChatSendTargetSlot;
  text: string;
}) {
  const {
    playVoiceText,
    shouldAutoSpeakReply,
    targetSlot,
    text,
  } = options;
  const voiceText = text.trim();
  if (!shouldAutoSpeakReply || !voiceText) {
    return;
  }

  void playVoiceText(voiceText, {
    petId: targetSlot.id,
    source: 'reply',
  });
}

function moveAgentPersonaReplyIntoExistingMessage(options: {
  compactReplyIntoMessageId?: string | null;
  finalResponse: string;
  generatedMessageId: string | null;
}) {
  const {
    compactReplyIntoMessageId,
    finalResponse,
    generatedMessageId,
  } = options;
  const generatedText = getChatMessageText(generatedMessageId);
  const replyText = (generatedText || finalResponse).trim();

  if (compactReplyIntoMessageId && replyText) {
    desktopPetChatStore.updateMessage(compactReplyIntoMessageId, (message) => ({
      ...message,
      text: replyText,
    }));

    if (generatedMessageId && generatedMessageId !== compactReplyIntoMessageId) {
      desktopPetChatStore.removeMessage(generatedMessageId);
    }
  }

  return replyText;
}

async function runAgentPersonaResponseTurnWithStyleRetry(options: {
  browserSearchMode?: 'allow' | 'block' | 'force';
  chatMode: DesktopPetChatMode;
  compactReplyIntoMessageId?: string | null;
  historyMessages: ChatMessage[];
  participantNames: string[];
  playbackToken: number;
  playVoiceText: AgentPlayVoiceText;
  promptText: string;
  requestToken: number;
  runPetResponseTurn: AgentRunPetResponseTurn;
  shouldAutoSpeakReply: boolean;
  targetSlot: ChatSendTargetSlot;
}) {
  const {
    browserSearchMode = 'block',
    chatMode,
    compactReplyIntoMessageId = null,
    historyMessages,
    participantNames,
    playbackToken,
    playVoiceText,
    promptText,
    requestToken,
    runPetResponseTurn,
    shouldAutoSpeakReply,
    targetSlot,
  } = options;

  const beforeFirstMessageIds = snapshotChatMessageIds();
  const firstResponse = await runPetResponseTurn(targetSlot, {
    chatMode,
    historyMessages,
    participantNames,
    promptText,
    shouldAutoSpeakReply: false,
    playbackToken,
    requestToken,
    browserSearchMode,
    outputMessageId: compactReplyIntoMessageId,
  });
  const firstModelMessageId = findNewTargetModelMessageId(beforeFirstMessageIds, targetSlot, chatMode);

  if (firstResponse.cancelled) {
    return firstResponse;
  }

  const styleIssues = findAgentPersonaReplyStyleIssues(firstResponse.finalResponse);
  if (styleIssues.length === 0) {
    const replyText = moveAgentPersonaReplyIntoExistingMessage({
      compactReplyIntoMessageId,
      finalResponse: firstResponse.finalResponse,
      generatedMessageId: firstModelMessageId,
    });
    playDeferredAgentPersonaVoice({
      playVoiceText,
      shouldAutoSpeakReply,
      targetSlot,
      text: replyText,
    });
    return firstResponse;
  }

  if (firstModelMessageId) {
    desktopPetChatStore.removeMessage(firstModelMessageId);
  }

  pushFrontendRuntimeLog('agent-run', 'persona result reply retried for character voice', {
    issues: styleIssues,
    petId: targetSlot.id,
    petName: targetSlot.personality.name,
  });

  const beforeRetryMessageIds = snapshotChatMessageIds();
  const retryResponse = await runPetResponseTurn(targetSlot, {
    chatMode,
    historyMessages,
    participantNames,
    promptText: buildAgentPersonaReplyRewritePrompt({
      basePrompt: promptText,
      issues: styleIssues,
      previousReply: firstResponse.finalResponse,
    }),
    shouldAutoSpeakReply: false,
    playbackToken,
    requestToken,
    browserSearchMode,
    outputMessageId: compactReplyIntoMessageId,
  });

  if (!retryResponse.cancelled && retryResponse.finalResponse.trim()) {
    const retryModelMessageId = findNewTargetModelMessageId(beforeRetryMessageIds, targetSlot, chatMode);
    const replyText = moveAgentPersonaReplyIntoExistingMessage({
      compactReplyIntoMessageId,
      finalResponse: retryResponse.finalResponse,
      generatedMessageId: retryModelMessageId,
    });
    playDeferredAgentPersonaVoice({
      playVoiceText,
      shouldAutoSpeakReply,
      targetSlot,
      text: replyText,
    });
  }

  return retryResponse;
}

async function speakAgentResult(options: {
  command: AgentChatCommand;
  onPersonaReplyCompleted?: () => void;
  playVoiceText: AgentPlayVoiceText;
  preparedRequest: PreparedChatSendRequest;
  result: AgentChatCommandResult;
  runPetResponseTurn: AgentRunPetResponseTurn;
  targetSlot: ChatSendTargetSlot | null;
  warmLocalReplyVoice: (settings: PetConfig['settings']) => void;
}) {
  const {
    command,
    onPersonaReplyCompleted,
    playVoiceText,
    preparedRequest,
    result,
    runPetResponseTurn,
    targetSlot,
    warmLocalReplyVoice,
  } = options;

  if (!targetSlot) {
    desktopPetChatStore.addMessage({
      id: createChatMessageId('model'),
      role: 'model',
      text: createAgentFallbackVisibleReply(result),
      chatMode: preparedRequest.currentChatState.chatMode,
      petId: null,
      petName: null,
    });
    onPersonaReplyCompleted?.();
    return;
  }

  const participantNames = preparedRequest.targetSlots.map((slot) => slot.personality.name);
  const shouldAutoSpeakReply = !preparedRequest.isGroupMode;

  if (shouldAutoSpeakReply) {
    warmLocalReplyVoice(preparedRequest.currentConfig.settings);
  }

  const response = await runAgentPersonaResponseTurnWithStyleRetry({
    chatMode: preparedRequest.currentChatState.chatMode,
    historyMessages: preparedRequest.promptHistoryMessages,
    participantNames,
    playVoiceText,
    promptText: buildAgentCommandPersonaPrompt(command, result),
    playbackToken: preparedRequest.playbackToken,
    requestToken: preparedRequest.requestToken,
    runPetResponseTurn,
    shouldAutoSpeakReply,
    targetSlot,
    browserSearchMode: 'block',
  });
  if (response.cancelled) {
    onPersonaReplyCompleted?.();
    return;
  }

  if (!response.finalResponse.trim()) {
    desktopPetChatStore.addMessage({
      id: createChatMessageId(`model-${targetSlot.id}`),
      role: 'model',
      text: createAgentFallbackVisibleReply(result),
      chatMode: preparedRequest.currentChatState.chatMode,
      petId: targetSlot.id,
      petName: targetSlot.personality.name,
    });
  }

  onPersonaReplyCompleted?.();
}

function formatAgentProductionSessionResultForPersonaPrompt(result: AgentProductionSessionResult) {
  const toolEvidence = result.toolResults.flatMap(({ command, result: toolResult }) => [
    `tool: ${command.toolCall?.name ?? command.kind}`,
    toolResult.responseText ? `result: ${compactAgentPersonaPromptText(toolResult.responseText, 260)}` : '',
    toolResult.errorText ? `error: ${compactAgentPersonaPromptText(toolResult.errorText, 220)}` : '',
    toolResult.verification ? `verification: ${compactAgentPersonaPromptText(toolResult.verification, 220)}` : '',
    ...(toolResult.receipt?.evidenceLines ?? []).slice(0, 3).map((line) => (
      `evidence: ${compactAgentPersonaPromptText(line, 220)}`
    )),
  ]).filter(Boolean);
  const stepLines = result.steps.map((step) => [
    `${step.index}. ${step.action}`,
    step.understanding?.userNeed ? `need=${compactAgentPersonaPromptText(step.understanding.userNeed, 120)}` : '',
    step.understanding?.successCriteria ? `success=${compactAgentPersonaPromptText(step.understanding.successCriteria, 120)}` : '',
    step.understanding?.capabilityGap ? `gap=${compactAgentPersonaPromptText(step.understanding.capabilityGap, 120)}` : '',
    step.tool ? `tool=${step.tool}` : '',
    step.ok === undefined ? '' : `ok=${step.ok}`,
    step.errorText ? `error=${compactAgentPersonaPromptText(step.errorText, 160)}` : '',
    step.summary ? `summary=${compactAgentPersonaPromptText(step.summary, 220)}` : '',
  ].filter(Boolean).join(' | '));

  return [
    `status: ${result.status}`,
    `finalAnswer: ${compactAgentPersonaPromptText(result.finalAnswer, 360)}`,
    stepLines.length ? `loopSteps:\n${stepLines.join('\n')}` : '',
    toolEvidence.length ? `toolEvidence:\n${toolEvidence.slice(0, 10).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');
}

function createAgentProductionSessionPersonaStatusGuidance(result: AgentProductionSessionResult) {
  switch (result.status) {
    case 'budget-exceeded':
      return '本次结果状态：达到运行预算保护上限。回复要短，说我先停下避免卡住，并给一个最小下一步。';
    case 'completed':
      return '本次结果状态：已得到可用答案。回复必须说出具体结果或具体观察，不要只说“处理好了”。';
    case 'needs-approval':
      return '本次结果状态：下一步会操作用户电脑，需要用户确认。回复只问一句是否允许，不要解释完整流程。';
    case 'needs-user':
      return '本次结果状态：缺少关键信息。回复只问一个最关键的问题，不要连续追问。';
    case 'max-steps':
      return '本次结果状态：已经到达步数保护上限。回复要说明我先停下避免循环，并给一个最小下一步。';
    default:
      return '本次结果状态：没有完成。回复要说清最近失败原因和一个可选下一步，不要说成已经完成。';
  }
}

function buildAgentProductionSessionPersonaPrompt(
  instruction: string,
  result: AgentProductionSessionResult,
) {
  return [
    'You just handled a desktop-side task for the current character. Tell the user the result only.',
    'Keep the current character personality and tone. Do not mention internal JSON, tools, APIs, or system prompts.',
    AGENT_PERSONA_RESULT_STYLE_RULES,
    createAgentProductionSessionPersonaStatusGuidance(result),
    '除非人格提示词另有要求，回复通常一到两句话；不要复述计划、轮次、坐标清单或完整日志。',
    'Unless the persona instructions specify otherwise, keep the reply short. If more user input is needed, ask naturally.',
    'If tool evidence conflicts with the final answer, trust the tool evidence. Do not claim unverified work is complete.',
    `user text: ${result.sourceText}`,
    `user goal: ${instruction}`,
    `execution result:\n${formatAgentProductionSessionResultForPersonaPrompt(result)}`,
  ].join('\n\n');
}

function createAgentProductionSessionFallbackVisibleReply(result: AgentProductionSessionResult) {
  const visibleAnswer = createAgentSafeVisibleFallbackText(result.finalAnswer, 160);
  if (visibleAnswer) {
    return visibleAnswer;
  }

  switch (result.status) {
    case 'budget-exceeded':
      return '我先停下，避免一直卡住。';
    case 'completed':
      return '这一段有结果了。';
    case 'needs-approval':
      return '这一步需要你确认后我再动。';
    case 'needs-user':
      return '这里还差一点信息，你补一句我就接着来。';
    case 'max-steps':
      return '我先停下，避免一直重复试。';
    default:
      return '这次没有执行成功，我先停下了。';
  }
}

async function speakAgentProductionSessionResult(options: {
  compactReplyIntoMessageId?: string | null;
  instruction: string;
  participantNames: string[];
  playVoiceText: AgentPlayVoiceText;
  preparedRequest: PreparedChatSendRequest;
  result: AgentProductionSessionResult;
  runPetResponseTurn: AgentRunPetResponseTurn;
  shouldAutoSpeakReply: boolean;
  targetSlot: ChatSendTargetSlot | null;
}) {
  const {
    compactReplyIntoMessageId = null,
    instruction,
    participantNames,
    playVoiceText,
    preparedRequest,
    result,
    runPetResponseTurn,
    shouldAutoSpeakReply,
    targetSlot,
  } = options;
  if (!targetSlot) {
    return;
  }
  const acceptedRuntimeReply = createAgentSafeVisibleFallbackText(result.finalAnswer, 900);
  if (acceptedRuntimeReply) {
    pushFrontendRuntimeLog('agent-run', 'displaying accepted runtime final answer without a second model call', {
      replyLength: acceptedRuntimeReply.length,
      status: result.status,
    });
    if (compactReplyIntoMessageId) {
      desktopPetChatStore.updateMessage(compactReplyIntoMessageId, (message) => ({
        ...message,
        text: acceptedRuntimeReply,
      }));
    } else {
      desktopPetChatStore.addMessage({
        id: createChatMessageId(`model-${targetSlot.id}`),
        role: 'model',
        text: acceptedRuntimeReply,
        chatMode: preparedRequest.currentChatState.chatMode,
        petId: targetSlot.id,
        petName: targetSlot.personality.name,
      });
    }
    playDeferredAgentPersonaVoice({
      playVoiceText,
      shouldAutoSpeakReply,
      targetSlot,
      text: acceptedRuntimeReply,
    });
    return;
  }

  let response: Awaited<ReturnType<typeof runAgentPersonaResponseTurnWithStyleRetry>>;
  try {
    response = await runAgentPersonaResponseTurnWithStyleRetry({
      chatMode: preparedRequest.currentChatState.chatMode,
      compactReplyIntoMessageId,
      historyMessages: preparedRequest.promptHistoryMessages,
      participantNames,
      playVoiceText,
      promptText: buildAgentProductionSessionPersonaPrompt(instruction, result),
      playbackToken: preparedRequest.playbackToken,
      requestToken: preparedRequest.requestToken,
      runPetResponseTurn,
      shouldAutoSpeakReply,
      targetSlot,
      browserSearchMode: 'block',
    });
  } catch (error) {
    const fallbackText = createAgentProductionSessionFallbackVisibleReply(result);
    pushFrontendRuntimeLog('agent-run', 'persona reply failed; displaying verified session result', {
      error: error instanceof Error ? error.message : String(error),
      fallbackLength: fallbackText.length,
      status: result.status,
    });
    if (compactReplyIntoMessageId) {
      desktopPetChatStore.updateMessage(compactReplyIntoMessageId, (message) => ({
        ...message,
        text: fallbackText,
      }));
    } else {
      desktopPetChatStore.addMessage({
        id: createChatMessageId(`model-${targetSlot.id}`),
        role: 'model',
        text: fallbackText,
        chatMode: preparedRequest.currentChatState.chatMode,
        petId: targetSlot.id,
        petName: targetSlot.personality.name,
      });
    }
    return;
  }

  if (response.cancelled) {
    return;
  }

  if (!response.finalResponse.trim()) {
    const fallbackText = createAgentProductionSessionFallbackVisibleReply(result);
    if (compactReplyIntoMessageId) {
      desktopPetChatStore.updateMessage(compactReplyIntoMessageId, (message) => ({
        ...message,
        text: fallbackText,
      }));
    } else {
      desktopPetChatStore.addMessage({
        id: createChatMessageId(`model-${targetSlot.id}`),
        role: 'model',
        text: fallbackText,
        chatMode: preparedRequest.currentChatState.chatMode,
        petId: targetSlot.id,
        petName: targetSlot.personality.name,
      });
    }
  }
}

async function speakGroupTaskProductionResult(options: {
  groupTaskLifecycle?: GroupTaskLifecycleCallbacks;
  speakOptions: Parameters<typeof speakAgentProductionSessionResult>[0];
}) {
  const event = options.speakOptions.preparedRequest.groupTaskConversationEvent;
  const request = options.speakOptions.preparedRequest;
  const reporterRoleId = request.groupTaskCandidate?.collaborationPlan?.reporterRoleId;
  const reporterSlot = request.targetSlots.find((slot) => slot.id === reporterRoleId);
  const speakOptions = reporterSlot ? { ...options.speakOptions, targetSlot: reporterSlot } : options.speakOptions;
  const roleId = speakOptions.targetSlot?.id;
  await runGroupTaskExplanationLifecycle({
    callbacks: options.groupTaskLifecycle,
    event,
    execute: () => speakAgentProductionSessionResult(speakOptions),
    roleId,
  });
}

export async function runPreparedAgentProductionSession({
  activeChatRequestTokenRef,
  approvedToolResult,
  groupTaskLifecycle,
  instruction,
  onRuntimeResult,
  onAgentChatCommand,
  playVoiceText,
  preparedRequest,
  runPetResponseTurn,
  warmLocalReplyVoice,
}: RunPreparedAgentProductionSessionOptions) {
  const targetSlot = resolvePreparedAgentTargetSlot(preparedRequest);
  if (!targetSlot) {
    return;
  }

  const participantNames = preparedRequest.targetSlots.map((slot) => slot.personality.name);
  const shouldAutoSpeakReply = !preparedRequest.isGroupMode;
  const workingMemory = createAgentWorkingMemorySnapshot(preparedRequest.promptHistoryMessages);
  const initialCommand = resolveAgentFollowUpContinuationCommand(
    preparedRequest.outgoingText,
    preparedRequest.promptHistoryMessages,
  );
  const importedSkills = loadEnabledAgentImportedSkills({ petId: targetSlot.id });

  if (shouldAutoSpeakReply) {
    warmLocalReplyVoice(preparedRequest.currentConfig.settings);
  }

  const runMessage = createAgentProductionSessionRunMessage({
    instruction,
    preparedRequest,
  });
  const runMessageId = runMessage.id ?? null;
  const canonicalEventJournal = getOrCreateAgentCanonicalEventJournal(
    runMessageId ?? `request-${preparedRequest.requestToken}`,
  );
  desktopPetChatStore.addMessage(runMessage);
  const persistGroupTaskEvent = () => {
    const event = preparedRequest.groupTaskConversationEvent;
    if (!event || !runMessageId) {
      return;
    }
    updateAgentRunMessage(runMessageId, (message) => ({ ...message, groupTaskEvent: event }));
  };
  publishAgentRuntimeWorldTaskStarted();

  pushFrontendRuntimeLog('agent-session-v2', 'session started', {
    instruction,
    sourceText: preparedRequest.outgoingText,
    taskId: null,
    stateRevision: null,
  });

  const missingExecutorResult = {
    errorText: '当前没有可用的本机执行器。',
    ok: false,
    responseText: '当前没有可用的本机执行器。',
  } satisfies AgentChatCommandResult;

  const abortController = new AbortController();
  const unregisterAbortController = registerAgentRunAbortController(runMessageId, abortController);
  const toolExecutor: AgentRuntimeToolExecutor = async (command) => {
    if (
      abortController.signal.aborted
      || preparedRequest.requestToken !== activeChatRequestTokenRef.current
      || isStoppedAgentRunMessage(runMessageId)
    ) {
      return assessAgentCommandResult(command, {
        errorText: AGENT_STOPPED_DETAIL_TEXT,
        ok: false,
        responseText: AGENT_STOPPED_DETAIL_TEXT,
        receipt: createStoppedAgentExecutionReceipt(command),
      });
    }

    if (!onAgentChatCommand) {
      return missingExecutorResult;
    }

    return runAgentToolExecutorWithLiveProgress({
      command,
      executor: onAgentChatCommand,
      messageId: runMessageId,
      signal: abortController.signal,
    });
  };
  let result: AgentProductionSessionResult;
  let runtimeRoute = 'stable';
  try {
    const onProgress: AgentRuntimeProgressHandler = (event) => {
      if (
        abortController.signal.aborted
        || preparedRequest.requestToken !== activeChatRequestTokenRef.current
        || isStoppedAgentRunMessage(runMessageId)
      ) {
        return;
      }

      publishAgentRuntimeWorldProgress(event);
      updateAgentProductionSessionProgressMessage(runMessageId, event);
    };

    const routedResult = await runAgentProductionRuntime({
      approvedToolResult,
      canonicalEventJournal,
      initialCommand,
      cancellationSignal: abortController.signal,
      onProgress,
      importedSkills,
      personaBehaviorContract: buildPersonaBehaviorContractInstruction(targetSlot.personality),
      settings: preparedRequest.currentConfig.settings,
      sourceText: preparedRequest.outgoingText,
      toolExecutor,
      userGoal: instruction,
      workingMemory,
      workingMemoryText: workingMemory.summaryText,
    });
    runtimeRoute = routedResult.implementation;
    if (!routedResult.result) {
      throw new Error(routedResult.reason);
    }
    result = routedResult.result;

  } catch (error) {
    releaseAgentCanonicalEventJournal(runMessageId ?? `request-${preparedRequest.requestToken}`);
    throw error;
  } finally {
    unregisterAbortController();
  }

  if (preparedRequest.requestToken !== activeChatRequestTokenRef.current || isStoppedAgentRunMessage(runMessageId)) {
    return;
  }

  pushFrontendRuntimeLog('agent-session-v2', 'session completed', {
    runtimeRoute,
    status: result.status,
    stepCount: result.steps.length,
    toolResultCount: result.toolResults.length,
    taskId: result.taskState?.taskId ?? null,
    stateRevision: result.taskState?.revision ?? null,
  });
  publishAgentRuntimeWorldResult(result);
  onRuntimeResult?.({ implementation: runtimeRoute as import('../../agent/runtime/agentRuntimeContract').AgentRuntimeImplementation, result });
  persistGroupTaskEvent();
  publishPreparedGroupTaskEvent(groupTaskLifecycle, preparedRequest);

  const fallbackCommand = createAgentProductionSessionPlaceholderCommand(instruction, preparedRequest.outgoingText);
  const displayResult = createAgentProductionSessionDisplayResult(result, fallbackCommand);
  const runStatus = getAgentTaskRuntimeRunStatus(result);
  const pendingRunFollowUpApproval = resolveAgentRuntimePendingFollowUpApproval({
    command: displayResult.command,
    result: displayResult.result,
    runtimeResult: result,
    sourceText: preparedRequest.outgoingText,
    userGoal: instruction,
  });

  if (runMessageId) {
    const shouldHideRunFollowUps = isAgentTaskRuntimeWaitingApproval(result) || Boolean(pendingRunFollowUpApproval);

    updateAgentRunMessage(runMessageId, (message) => ({
      ...message,
      text: createAgentProductionSessionResultVisibleText(result),
      agentRun: message.agentRun
        ? {
            ...message.agentRun,
            agentRuntime: result.continuation,
            assessment: displayResult.result.assessment ?? null,
            context: createAgentContextFromResult(displayResult.command, displayResult.result),
            errorText: result.status === 'failed' || result.status === 'max-steps' || result.status === 'budget-exceeded'
              ? displayResult.result.errorText ?? result.finalAnswer
              : null,
            followUpAction: shouldHideRunFollowUps ? null : displayResult.result.followUpAction ?? null,
            followUpActions: shouldHideRunFollowUps ? null : resolveAgentResultFollowUpActions(displayResult.result),
            followUpText: shouldHideRunFollowUps
              ? null
              : result.status === 'needs-user' ? result.finalAnswer : displayResult.result.followUp ?? null,
            receipt: createAgentExecutionReceipt(displayResult.command, displayResult.result),
            resultText: result.finalAnswer,
            stages: completeAgentWorkStagesWithResult(
              message.agentRun.stages,
              displayResult.result,
            ),
            status: runStatus,
            trace: completeAgentRunTraceWithResult(
              message.agentRun.trace,
              displayResult.result,
            ),
          }
        : null,
    }));
  }

  if (isAgentTaskRuntimeWaitingApproval(result) && result.pendingApproval) {
    const approvalMessage = await createAgentApprovalMessage({
      agentRuntime: result.continuation,
      command: result.pendingApproval.command,
      plan: result.pendingApproval.plan,
      preparedRequest,
      text: createAgentPendingApprovalVisibleText(result.pendingApproval.plan.goal),
    });
    if (runMessageId) {
      updateAgentRunMessage(runMessageId, (message) => (
        mergeAgentApprovalMessageIntoExistingMessage(message, approvalMessage)
      ));
    } else {
      desktopPetChatStore.addMessage(approvalMessage);
    }
    return;
  }

  if (pendingRunFollowUpApproval) {
    const approvedScopeCommand = createAgentProductionSessionPlaceholderCommand(instruction, preparedRequest.outgoingText);
    const approvedScopePlan = createAgentProductionSessionDisplayPlan(instruction, preparedRequest.outgoingText);

    if (onAgentChatCommand) {
      const continuationRun = await runAgentProductionApprovalContinuations({
        approvedCommand: approvedScopeCommand,
        approvedPlan: approvedScopePlan,
        canonicalEventJournal,
        cancellationSignal: abortController.signal,
        createSkippedResult: createSkippedStaleOuterApprovalResult,
        executeApprovedCommand: (command) => runAgentControllerToolTransactionWithLiveProgress({
          command,
          executor: onAgentChatCommand,
          messageId: runMessageId,
          signal: abortController.signal,
        }),
        initialPendingApproval: pendingRunFollowUpApproval,
        initialResult: result,
        isCancelled: () => (
          abortController.signal.aborted
          || preparedRequest.requestToken !== activeChatRequestTokenRef.current
          || isStoppedAgentRunMessage(runMessageId)
        ),
        onIteration: (context) => {
          pushFrontendRuntimeLog('agent-run', 'initial task-scoped follow-up approval continuation executing', {
            count: context.count,
            decision: context.decision,
            goal: context.pendingPlan.goal,
            tool: context.pendingCommand.toolCall?.name ?? context.pendingCommand.kind,
          });
        },
        settings: preparedRequest.currentConfig.settings,
        personaBehaviorContract: buildPersonaBehaviorContractInstruction(targetSlot.personality),
        toolExecutor,
      });
      if (continuationRun.count === 0) {
        pushFrontendRuntimeLog('agent-run', 'initial task-scoped follow-up approval continuation not consumed', {
          decision: continuationRun.stop?.decision ?? null,
          goal: pendingRunFollowUpApproval.plan.goal,
          tool: pendingRunFollowUpApproval.command.toolCall?.name ?? pendingRunFollowUpApproval.command.kind,
        });
      } else {
        result = continuationRun.result;
        publishAgentRuntimeWorldResult(result);
        onRuntimeResult?.({ implementation: runtimeRoute as import('../../agent/runtime/agentRuntimeContract').AgentRuntimeImplementation, result });
        persistGroupTaskEvent();
        publishPreparedGroupTaskEvent(groupTaskLifecycle, preparedRequest);
        if (
          continuationRun.outcome.kind === 'duplicate-blocked'
          || continuationRun.outcome.kind === 'limit-reached'
          || continuationRun.outcome.kind === 'pending-user-approval'
          || continuationRun.outcome.kind === 'stale-context'
        ) {
          pushFrontendRuntimeLog('agent-run', 'initial task-scoped approval continuation stopped', {
            count: continuationRun.count,
            decision: continuationRun.outcome.decision,
            limit: AGENT_RUNTIME_DEFAULT_APPROVAL_CONTINUATION_LIMIT,
          });
        }

        updateAgentRunMessage(runMessageId, (message) => ({
          ...message,
          text: createAgentProductionSessionResultVisibleText(result),
          agentRun: message.agentRun
            ? {
                ...message.agentRun,
                agentRuntime: result.continuation,
                resultText: result.finalAnswer,
                status: getAgentTaskRuntimeRunStatus(result),
              }
            : null,
        }));
        if (!isAgentTaskRuntimeWaitingApproval(result)) {
          await speakGroupTaskProductionResult({
            groupTaskLifecycle,
            speakOptions: {
              instruction,
              participantNames,
              playVoiceText,
              preparedRequest,
              compactReplyIntoMessageId: runMessageId,
              result,
              runPetResponseTurn,
              shouldAutoSpeakReply,
              targetSlot,
            },
          });
          releaseAgentCanonicalEventJournal(runMessageId ?? `request-${preparedRequest.requestToken}`);
          return;
        }
        if (result.pendingApproval) {
          const approvalMessage = await createAgentApprovalMessage({
            agentRuntime: result.continuation,
            command: result.pendingApproval.command,
            plan: result.pendingApproval.plan,
            preparedRequest,
            text: createAgentApprovalNextStepVisibleText(result.pendingApproval.plan.goal),
          });
          if (runMessageId) {
            updateAgentRunMessage(runMessageId, (message) => (
              mergeAgentApprovalMessageIntoExistingMessage(message, approvalMessage)
            ));
          } else {
            desktopPetChatStore.addMessage(approvalMessage);
          }
          return;
        }
      }
    } else {
      pushFrontendRuntimeLog('agent-run', 'initial task-scoped follow-up approval continuation not consumed', {
        decision: null,
        reason: 'missing-executor',
        goal: pendingRunFollowUpApproval.plan.goal,
        tool: pendingRunFollowUpApproval.command.toolCall?.name ?? pendingRunFollowUpApproval.command.kind,
      });
    }

    const approvalMessage = await createAgentApprovalMessage({
      agentRuntime: result.continuation,
      command: pendingRunFollowUpApproval.command,
      plan: pendingRunFollowUpApproval.plan,
      preparedRequest,
      text: createAgentApprovalNextStepVisibleText(pendingRunFollowUpApproval.plan.goal),
    });
    if (runMessageId) {
      updateAgentRunMessage(runMessageId, (message) => (
        mergeAgentApprovalMessageIntoExistingMessage(message, approvalMessage)
      ));
    } else {
      desktopPetChatStore.addMessage(approvalMessage);
    }
    return;
  }

  await speakGroupTaskProductionResult({
    groupTaskLifecycle,
    speakOptions: {
      instruction,
      participantNames,
      playVoiceText,
      preparedRequest,
      compactReplyIntoMessageId: runMessageId,
      result,
      runPetResponseTurn,
      shouldAutoSpeakReply,
      targetSlot,
    },
  });
  releaseAgentCanonicalEventJournal(runMessageId ?? `request-${preparedRequest.requestToken}`);
}

function createAgentProductionSessionDisplayResult(
  sessionResult: AgentProductionSessionResult,
  fallbackCommand: AgentChatCommand,
): {
  command: AgentChatCommand;
  result: AgentChatCommandResult;
} {
  if (sessionResult.status !== 'completed') {
    const incompleteToolResult = [...sessionResult.toolResults].reverse().find((entry) => (
      entry.result.ok === false
      || entry.result.receipt?.status === 'failed'
      || entry.result.receipt?.status === 'blocked'
      || entry.result.receipt?.status === 'unverified'
      || entry.result.assessment?.status === 'failed'
      || entry.result.assessment?.status === 'unverified'
      || Boolean(entry.result.stateSummary?.missingEvidence?.length)
    ));
    if (incompleteToolResult) {
      return incompleteToolResult;
    }
  }

  const latestToolResult = sessionResult.toolResults[sessionResult.toolResults.length - 1] ?? null;
  if (latestToolResult) {
    return latestToolResult;
  }

  return {
    command: fallbackCommand,
    result: assessAgentCommandResult(fallbackCommand, {
      ok: sessionResult.status !== 'failed',
      responseText: sessionResult.finalAnswer,
      verification: sessionResult.status === 'completed'
        ? '已经得到最终回复，没有额外工具结果。'
        : null,
    }),
  };
}

export async function resolveAgentApprovalRequest({
  activeChatRequestTokenRef,
  configRef,
  decision,
  getPlaybackToken,
  groupTaskLifecycle,
  groupChatContinuationEnabledRef,
  messageId,
  onAgentChatCommand,
  playVoiceText,
  runPetResponseTurn,
  stopGroupChat,
  stopPetSpeech,
  warmLocalReplyVoice,
}: ResolveAgentApprovalRequestOptions) {
  const approvalMessage = desktopPetChatStore.getState().messages.find((message) => message.id === messageId);
  const approval = approvalMessage?.agentApproval ?? null;

  if (!approval || approval.status !== 'pending') {
    return;
  }

  const approvalRuntime = resolveChatAgentRuntimeContinuation(approval);
  const canonicalEventJournal = getAgentCanonicalEventJournal(messageId);

  if (decision === 'deny') {
    if (canonicalEventJournal && approvalRuntime?.taskState) {
      canonicalEventJournal.append({
        payload: { reason: 'user-denied' },
        runId: approvalRuntime.taskState.runId ?? approvalRuntime.taskState.taskId,
        taskId: approvalRuntime.taskState.taskId,
        type: 'task_cancelled',
      });
    }
    const deniedGroupTaskEvent = updateGroupTaskConversationEvent({
      event: approval.groupTaskEvent ?? approvalMessage?.groupTaskEvent,
      outcome: 'failed',
      summary: 'User denied execution.',
    });
    updateAgentApprovalMessage(messageId, (message) => ({
      ...message,
      groupTaskEvent: deniedGroupTaskEvent,
      text: createAgentApprovalDeniedVisibleText(),
      agentApproval: message.agentApproval
        ? {
            ...message.agentApproval,
            groupTaskEvent: deniedGroupTaskEvent,
            receipt: createDeniedAgentExecutionReceipt(approval.command),
            status: 'denied',
            resultText: 'User denied execution.',
            stages: updateAgentWorkStage(
              message.agentApproval.stages,
              'await-approval',
              'blocked',
              'User denied execution.',
            ),
            trace: updateAgentRunTraceItem(
              message.agentApproval.trace,
              'wait-for-approval',
              'blocked',
              'User denied this operation.',
            ),
          }
        : null,
      agentRun: message.agentRun
        ? {
            ...message.agentRun,
            groupTaskEvent: deniedGroupTaskEvent,
            errorText: 'User denied execution.',
            followUpAction: null,
            followUpActions: null,
            followUpText: null,
            receipt: createDeniedAgentExecutionReceipt(approval.command),
            resultText: 'User denied execution.',
            status: 'blocked',
          }
        : null,
    }));
    pushFrontendRuntimeLog('agent-run', 'approval denied', {
      goal: approval.plan.goal,
    });
    publishAgentRuntimeWorldResult({
      status: 'cancelled',
      taskState: approvalRuntime?.taskState ?? null,
    });
    publishGroupTaskEvent(groupTaskLifecycle, deniedGroupTaskEvent);
    completeGroupTaskMessageLifecycle(
      groupTaskLifecycle,
      deniedGroupTaskEvent,
      approvalMessage.petId,
    );
    releaseAgentCanonicalEventJournal(messageId);
    return;
  }

  const currentChatState = desktopPetChatStore.getState();
  const targetSlot = resolveActiveChatSlot(
    configRef.current,
    approvalMessage.petId ?? currentChatState.activePetId,
  );
  const requestToken = activeChatRequestTokenRef.current + 1;
  activeChatRequestTokenRef.current = requestToken;
  groupChatContinuationEnabledRef.current = false;
  if (!(approval.groupTaskEvent ?? approvalMessage.groupTaskEvent)) {
    stopGroupChat({ immediate: true, cancelActiveRequest: false });
  }
  stopPetSpeech();

  desktopPetChatStore.setTyping(true);
  desktopPetChatStore.setTypingPetId(targetSlot?.id ?? null);
  updateAgentApprovalMessage(messageId, (message) => ({
    ...message,
    text: createAgentApprovalAcceptedVisibleText(),
      agentApproval: message.agentApproval
        ? {
            ...message.agentApproval,
            stages: markAgentWorkStageToolsRunning(
            updateAgentWorkStage(
              message.agentApproval.stages,
              'await-approval',
              'completed',
              'User approved execution.',
            ),
          ),
          status: 'running',
          trace: markAgentRunTraceToolSteps(
            updateAgentRunTraceItem(
              message.agentApproval.trace,
              'wait-for-approval',
              'completed',
              'User approved execution.',
            ),
            'running',
            'Calling local tool executor.',
            ),
          }
        : null,
      agentRun: message.agentRun
        ? {
            ...message.agentRun,
            agentRuntime: approvalRuntime ?? resolveChatAgentRuntimeContinuation(message.agentRun),
            status: 'running',
          }
        : null,
  }));
  pushFrontendRuntimeLog('agent-run', 'approval accepted', {
    goal: approval.plan.goal,
  });

  const abortController = new AbortController();
  const unregisterAbortController = registerAgentRunAbortController(messageId, abortController);

  try {
    if (!approvalRuntime) {
      const result = assessAgentCommandResult(approval.command, {
        errorText: 'Legacy Agent approval is no longer supported by the active entry path.',
        ok: false,
        responseText: 'Legacy Agent approval is no longer supported by the active entry path.',
      });
      updateAgentApprovalMessage(messageId, (message) => ({
        ...message,
        text: createAgentUnsupportedApprovalVisibleText(),
          agentApproval: message.agentApproval
            ? {
                ...message.agentApproval,
                assessment: result.assessment ?? null,
              context: createAgentContextFromResult(approval.command, result),
              errorText: result.errorText ?? result.responseText,
              receipt: createAgentExecutionReceipt(approval.command, result),
              resultText: result.responseText,
              stages: completeAgentWorkStagesWithResult(message.agentApproval.stages, result),
              status: 'failed',
                trace: completeAgentRunTraceWithResult(message.agentApproval.trace, result),
              }
            : null,
          agentRun: message.agentRun
            ? {
                ...message.agentRun,
                assessment: result.assessment ?? null,
                context: createAgentContextFromResult(approval.command, result),
                errorText: result.errorText ?? result.responseText,
                followUpAction: null,
                followUpActions: null,
                followUpText: null,
                receipt: createAgentExecutionReceipt(approval.command, result),
                resultText: result.responseText,
                status: 'failed',
              }
            : null,
      }));
      return;
    }

    const chatMode = approvalMessage.chatMode ?? currentChatState.chatMode;
    const preparedRequest: PreparedChatSendRequest = {
      browserSearchMode: 'block',
      currentChatState: {
        ...currentChatState,
        chatMode,
      },
      currentConfig: configRef.current,
      groupTaskConversationEvent: approval.groupTaskEvent ?? approvalMessage.groupTaskEvent ?? undefined,
      isGroupMode: chatMode === 'group',
      outgoingText: approvalRuntime.sourceText,
      playbackToken: getPlaybackToken(),
      promptHistoryMessages: desktopPetChatStore.getState().messages,
      requestToken,
      targetSlots: chatMode === 'group'
        ? resolveChatTargetSlots(configRef.current, chatMode, currentChatState.activePetId)
        : (targetSlot ? [targetSlot] : []),
      userMessage: approvalMessage,
    };
    const taskEvent = approval.groupTaskEvent ?? approvalMessage.groupTaskEvent;
    if (taskEvent?.collaborationPlan && taskEvent.requestedCapability && taskEvent.summary) {
      preparedRequest.groupTaskCandidate = {
        taskId: taskEvent.taskId,
        groupSessionId: taskEvent.groupSessionId,
        topicId: taskEvent.topicId,
        sourceRoleIds: taskEvent.sourceRoleIds ?? [approvalMessage.petId ?? 'primary'],
        summary: taskEvent.summary,
        requestedCapability: taskEvent.requestedCapability,
        status: 'pending-arbitration',
        collaborationPlan: taskEvent.collaborationPlan,
      } satisfies GroupTaskCandidate;
    }
    const missingExecutorResult = {
      errorText: '当前没有可用的本机执行器。',
      ok: false,
      responseText: '当前没有可用的本机执行器。',
    } satisfies AgentChatCommandResult;
    const onProgress: AgentRuntimeProgressHandler = (event) => {
      if (
        abortController.signal.aborted
        || requestToken !== activeChatRequestTokenRef.current
        || isStoppedAgentRunMessage(messageId)
      ) {
        return;
      }

      publishAgentRuntimeWorldProgress(event);
      updateAgentProductionSessionProgressMessage(messageId, event);
    };
    const toolExecutor: AgentRuntimeToolExecutor = async (command) => {
      if (abortController.signal.aborted || requestToken !== activeChatRequestTokenRef.current || isStoppedAgentRunMessage(messageId)) {
        return assessAgentCommandResult(command, {
          errorText: AGENT_STOPPED_DETAIL_TEXT,
          ok: false,
          responseText: AGENT_STOPPED_DETAIL_TEXT,
          receipt: createStoppedAgentExecutionReceipt(command),
        });
      }

      if (!onAgentChatCommand) {
        return missingExecutorResult;
      }

      return runAgentToolExecutorWithLiveProgress({
        command,
        executor: onAgentChatCommand,
        messageId,
        signal: abortController.signal,
      });
    };
    const consumeTaskScopedApprovedContinuations = (
      initialSessionResult: AgentProductionSessionResult,
      options: { logLabel: string },
    ) => runChatAgentApprovalContinuations({
        approvedCommand: approval.command,
        approvedPlan: approval.plan,
        canonicalEventJournal,
        cancellationSignal: abortController.signal,
        createSkippedResult: createSkippedStaleOuterApprovalResult,
        executeApprovedCommand: async (command) => onAgentChatCommand
          ? runAgentControllerToolTransactionWithLiveProgress({
              command,
              executor: onAgentChatCommand,
              messageId,
              signal: abortController.signal,
            })
          : missingExecutorResult,
        initialResult: initialSessionResult,
        isCancelled: () => (
          abortController.signal.aborted
          || requestToken !== activeChatRequestTokenRef.current
          || isStoppedAgentRunMessage(messageId)
        ),
        logLabel: options.logLabel,
        onProgress,
        settings: configRef.current.settings,
        toolExecutor,
      });
    const routedResult = await runAgentProductionApprovedAction({
      canonicalEventJournal,
      approval: {
        command: approval.command,
        plan: approval.plan,
        reason: 'User approved execution.',
        routeSummary: 'Approved by user.',
        runId: approvalRuntime.taskState?.runId ?? null,
        surfaceGeneration: approvalRuntime.taskState?.surface?.generation ?? null,
        surfaceId: approvalRuntime.taskState?.surface?.surfaceId ?? null,
        taskId: approvalRuntime.taskState?.taskId ?? null,
      },
      cancellationSignal: abortController.signal,
      continuation: approvalRuntime,
      executeApprovedCommand: (command) => onAgentChatCommand
        ? runAgentControllerToolTransactionWithLiveProgress({
            command,
            executor: onAgentChatCommand,
            messageId,
            signal: abortController.signal,
          })
        : Promise.resolve(missingExecutorResult),
      onProgress,
      personaBehaviorContract: targetSlot
        ? buildPersonaBehaviorContractInstruction(targetSlot.personality)
        : undefined,
      settings: configRef.current.settings,
      toolExecutor,
    });
    if (!routedResult.result) {
      throw new Error(routedResult.reason);
    }
    let sessionResult = routedResult.result;

    if (abortController.signal.aborted || requestToken !== activeChatRequestTokenRef.current || isStoppedAgentRunMessage(messageId)) {
      return;
    }

    const taskScopedApprovedContinuation = await consumeTaskScopedApprovedContinuations(sessionResult, {
      logLabel: 'task-scoped approval continuation executing',
    });
    sessionResult = taskScopedApprovedContinuation.result;
    publishAgentRuntimeWorldResult(sessionResult);

    pushFrontendRuntimeLog('agent-session-v2', 'approved session routed continuation', {
      runtimeRoute: routedResult.implementation,
      status: sessionResult.status,
      stepCount: sessionResult.steps.length,
      toolResultCount: sessionResult.toolResults.length,
      taskScopedApprovedContinuationCount: taskScopedApprovedContinuation.count,
      taskId: sessionResult.taskState?.taskId ?? null,
      stateRevision: sessionResult.taskState?.revision ?? null,
    });

    const displayResult = createAgentProductionSessionDisplayResult(sessionResult, approval.command);
    const taskRunStatus = getAgentTaskRuntimeRunStatus(sessionResult);
    const approvalRunStatus = resolveAgentApprovalUiStatus(taskRunStatus);
    const shouldHideApprovalFollowUps = isAgentTaskRuntimeWaitingApproval(sessionResult);
    const pendingReadOnlyFollowUpApproval = resolveAgentRuntimePendingFollowUpApproval({
      command: displayResult.command,
      result: displayResult.result,
      runtimeResult: sessionResult,
      sourceText: approvalRuntime.sourceText,
      userGoal: approvalRuntime.userGoal,
    });
    const nextGroupTaskEvent = updatePreparedGroupTaskEvent({
      callbacks: groupTaskLifecycle,
      event: approval.groupTaskEvent ?? approvalMessage.groupTaskEvent,
      outcome: resolveGroupTaskContinuationOutcome({
        hasPendingFollowUp: Boolean(pendingReadOnlyFollowUpApproval),
        runStatus: taskRunStatus,
      }),
      preparedRequest,
      summary: sessionResult.finalAnswer,
    });
    updateAgentApprovalMessage(messageId, (message) => ({
      ...message,
      groupTaskEvent: nextGroupTaskEvent,
      text: createAgentApprovalContinuationVisibleText(sessionResult),
      agentApproval: message.agentApproval
        ? {
            ...message.agentApproval,
            assessment: displayResult.result.assessment ?? null,
            agentRuntime: sessionResult.continuation,
            context: createAgentContextFromResult(displayResult.command, displayResult.result),
            errorText: displayResult.result.ok === false
              ? displayResult.result.errorText ?? displayResult.result.responseText
              : null,
            followUpAction: shouldHideApprovalFollowUps ? null : displayResult.result.followUpAction ?? null,
            followUpActions: shouldHideApprovalFollowUps ? null : resolveAgentResultFollowUpActions(displayResult.result),
            followUpText: shouldHideApprovalFollowUps ? null : displayResult.result.followUp ?? null,
            groupTaskEvent: nextGroupTaskEvent,
            receipt: createAgentExecutionReceipt(displayResult.command, displayResult.result),
            resultText: sessionResult.finalAnswer,
            stages: completeAgentWorkStagesWithResult(
              message.agentApproval.stages,
              displayResult.result,
            ),
            status: approvalRunStatus,
            trace: completeAgentRunTraceWithResult(
              message.agentApproval.trace,
              displayResult.result,
            ),
          }
        : null,
      agentRun: message.agentRun
        ? {
            ...message.agentRun,
            agentRuntime: sessionResult.continuation,
            assessment: displayResult.result.assessment ?? null,
            context: createAgentContextFromResult(displayResult.command, displayResult.result),
            errorText: displayResult.result.ok === false
              ? displayResult.result.errorText ?? displayResult.result.responseText
              : null,
            followUpAction: shouldHideApprovalFollowUps ? null : displayResult.result.followUpAction ?? null,
            followUpActions: shouldHideApprovalFollowUps ? null : resolveAgentResultFollowUpActions(displayResult.result),
            followUpText: shouldHideApprovalFollowUps ? null : displayResult.result.followUp ?? null,
            groupTaskEvent: nextGroupTaskEvent,
            receipt: createAgentExecutionReceipt(displayResult.command, displayResult.result),
            resultText: sessionResult.finalAnswer,
            status: taskRunStatus,
          }
        : null,
    }));

    const pendingReadOnlyContinuationRun = pendingReadOnlyFollowUpApproval && onAgentChatCommand
      ? await runAgentProductionApprovalContinuations({
          approvedCommand: approval.command,
          approvedPlan: approval.plan,
          canonicalEventJournal,
          cancellationSignal: abortController.signal,
          createSkippedResult: createSkippedStaleOuterApprovalResult,
          executeApprovedCommand: (command) => runAgentControllerToolTransactionWithLiveProgress({
            command,
            executor: onAgentChatCommand,
            messageId,
            signal: abortController.signal,
          }),
          initialPendingApproval: pendingReadOnlyFollowUpApproval,
          initialResult: sessionResult,
          isCancelled: () => (
            abortController.signal.aborted
            || requestToken !== activeChatRequestTokenRef.current
            || isStoppedAgentRunMessage(messageId)
          ),
          maxContinuations: 1,
          onIteration: (context) => {
            pushFrontendRuntimeLog('agent-run', 'task-scoped read-only follow-up approval continuation executing', {
              goal: context.pendingPlan.goal,
              tool: context.pendingCommand.toolCall?.name ?? context.pendingCommand.kind,
            });
          },
          onProgress,
          personaBehaviorContract: targetSlot
            ? buildPersonaBehaviorContractInstruction(targetSlot.personality)
            : undefined,
          settings: configRef.current.settings,
          toolExecutor,
        })
      : null;

    if (isAgentTaskRuntimeWaitingApproval(sessionResult) && sessionResult.pendingApproval) {
      if (taskScopedApprovedContinuation.outcome.kind === 'duplicate-blocked') {
        const duplicateResult = createRepeatedApprovalLoopResult(
          sessionResult.pendingApproval.command,
          displayResult.result,
        );
        updateAgentApprovalMessage(messageId, (message) => ({
          ...message,
          text: duplicateResult.responseText,
          agentApproval: message.agentApproval
            ? {
                ...message.agentApproval,
                assessment: duplicateResult.assessment ?? null,
                agentRuntime: sessionResult.continuation,
                context: createAgentContextFromResult(sessionResult.pendingApproval!.command, duplicateResult),
                errorText: duplicateResult.errorText ?? duplicateResult.responseText,
                followUpAction: null,
                followUpActions: null,
                followUpText: null,
                receipt: createAgentExecutionReceipt(sessionResult.pendingApproval!.command, duplicateResult),
                resultText: duplicateResult.responseText,
                stages: completeAgentWorkStagesWithResult(message.agentApproval.stages, duplicateResult),
                status: 'blocked',
                trace: completeAgentRunTraceWithResult(message.agentApproval.trace, duplicateResult),
              }
            : null,
          agentRun: message.agentRun
            ? {
                ...message.agentRun,
                agentRuntime: sessionResult.continuation,
                assessment: duplicateResult.assessment ?? null,
                context: createAgentContextFromResult(sessionResult.pendingApproval!.command, duplicateResult),
                errorText: duplicateResult.errorText ?? duplicateResult.responseText,
                followUpAction: null,
                followUpActions: null,
                followUpText: null,
                receipt: createAgentExecutionReceipt(sessionResult.pendingApproval!.command, duplicateResult),
                resultText: duplicateResult.responseText,
                status: 'blocked',
              }
            : null,
        }));
        pushFrontendRuntimeLog('agent-run', 'duplicate approval blocked', {
          goal: sessionResult.pendingApproval.plan.goal,
          tool: sessionResult.pendingApproval.command.toolCall?.name ?? sessionResult.pendingApproval.command.kind,
        });
      } else {
        const approvalMessage = await createAgentApprovalMessage({
          agentRuntime: sessionResult.continuation,
          command: sessionResult.pendingApproval.command,
          plan: sessionResult.pendingApproval.plan,
          preparedRequest,
          text: createAgentApprovalNextStepVisibleText(sessionResult.pendingApproval.plan.goal),
        });
        updateAgentApprovalMessage(messageId, (message) => (
          mergeAgentApprovalMessageIntoExistingMessage(message, approvalMessage)
        ));
      }
    } else if (pendingReadOnlyContinuationRun?.count) {
      let continuationSessionResult = pendingReadOnlyContinuationRun.result;
      const taskScopedReadOnlyContinuation = await consumeTaskScopedApprovedContinuations(continuationSessionResult, {
        logLabel: 'task-scoped approval continuation executing after read-only follow-up',
      });
      continuationSessionResult = taskScopedReadOnlyContinuation.result;

      if (abortController.signal.aborted || requestToken !== activeChatRequestTokenRef.current || isStoppedAgentRunMessage(messageId)) {
        return;
      }

      const continuationStatus = getAgentTaskRuntimeRunStatus(continuationSessionResult);
      const continuationGroupTaskEvent = updatePreparedGroupTaskEvent({
        callbacks: groupTaskLifecycle,
        event: preparedRequest.groupTaskConversationEvent,
        outcome: resolveGroupTaskContinuationOutcome({ runStatus: continuationStatus }),
        preparedRequest,
        summary: continuationSessionResult.finalAnswer,
      });

      updateAgentApprovalMessage(messageId, (message) => ({
        ...message,
        groupTaskEvent: continuationGroupTaskEvent,
        text: createAgentProductionSessionResultVisibleText(continuationSessionResult),
        agentApproval: message.agentApproval
          ? {
              ...message.agentApproval,
              agentRuntime: continuationSessionResult.continuation,
              groupTaskEvent: continuationGroupTaskEvent,
              resultText: continuationSessionResult.finalAnswer,
              status: continuationStatus === 'awaiting-approval'
                ? 'awaiting-approval'
                : continuationStatus === 'completed'
                  ? 'completed'
                  : continuationStatus === 'blocked'
                    ? 'blocked'
                    : 'failed',
            }
          : null,
        agentRun: message.agentRun
          ? {
              ...message.agentRun,
              agentRuntime: continuationSessionResult.continuation,
              groupTaskEvent: continuationGroupTaskEvent,
              resultText: continuationSessionResult.finalAnswer,
              status: continuationStatus,
            }
          : null,
      }));
      if (continuationStatus !== 'awaiting-approval') {
        await speakGroupTaskProductionResult({
          groupTaskLifecycle,
          speakOptions: {
            instruction: approvalRuntime.userGoal,
            participantNames: preparedRequest.targetSlots.map((slot) => slot.personality.name),
            playVoiceText,
            preparedRequest,
            compactReplyIntoMessageId: messageId,
            result: continuationSessionResult,
            runPetResponseTurn,
            shouldAutoSpeakReply: !preparedRequest.isGroupMode,
            targetSlot,
          },
        });
      }
    } else if (pendingReadOnlyFollowUpApproval) {
      if (pendingReadOnlyContinuationRun?.outcome.kind === 'duplicate-blocked') {
        const duplicateResult = createRepeatedApprovalLoopResult(
          pendingReadOnlyFollowUpApproval.command,
          displayResult.result,
        );
        updateAgentApprovalMessage(messageId, (message) => ({
          ...message,
          text: duplicateResult.responseText,
          agentApproval: message.agentApproval
            ? {
                ...message.agentApproval,
                assessment: duplicateResult.assessment ?? null,
                agentRuntime: sessionResult.continuation,
                context: createAgentContextFromResult(pendingReadOnlyFollowUpApproval.command, duplicateResult),
                errorText: duplicateResult.errorText ?? duplicateResult.responseText,
                followUpAction: null,
                followUpActions: null,
                followUpText: null,
                receipt: createAgentExecutionReceipt(pendingReadOnlyFollowUpApproval.command, duplicateResult),
                resultText: duplicateResult.responseText,
                stages: completeAgentWorkStagesWithResult(message.agentApproval.stages, duplicateResult),
                status: 'blocked',
                trace: completeAgentRunTraceWithResult(message.agentApproval.trace, duplicateResult),
              }
            : null,
          agentRun: message.agentRun
            ? {
                ...message.agentRun,
                agentRuntime: sessionResult.continuation,
                assessment: duplicateResult.assessment ?? null,
                context: createAgentContextFromResult(pendingReadOnlyFollowUpApproval.command, duplicateResult),
                errorText: duplicateResult.errorText ?? duplicateResult.responseText,
                followUpAction: null,
                followUpActions: null,
                followUpText: null,
                receipt: createAgentExecutionReceipt(pendingReadOnlyFollowUpApproval.command, duplicateResult),
                resultText: duplicateResult.responseText,
                status: 'blocked',
              }
            : null,
        }));
        pushFrontendRuntimeLog('agent-run', 'duplicate follow-up approval blocked', {
          goal: pendingReadOnlyFollowUpApproval.plan.goal,
          tool: pendingReadOnlyFollowUpApproval.command.toolCall?.name ?? pendingReadOnlyFollowUpApproval.command.kind,
        });
      } else {
        const approvalMessage = await createAgentApprovalMessage({
          agentRuntime: sessionResult.continuation,
          command: pendingReadOnlyFollowUpApproval.command,
          plan: pendingReadOnlyFollowUpApproval.plan,
          preparedRequest,
          text: createAgentApprovalNextStepVisibleText(pendingReadOnlyFollowUpApproval.plan.goal),
        });
        updateAgentApprovalMessage(messageId, (message) => (
          mergeAgentApprovalMessageIntoExistingMessage(message, approvalMessage)
        ));
      }
    } else {
      if (!preparedRequest.isGroupMode) {
        warmLocalReplyVoice(configRef.current.settings);
      }

      await speakGroupTaskProductionResult({
        groupTaskLifecycle,
        speakOptions: {
          instruction: approvalRuntime.userGoal,
          participantNames: preparedRequest.targetSlots.map((slot) => slot.personality.name),
          playVoiceText,
          preparedRequest,
          compactReplyIntoMessageId: messageId,
          result: sessionResult,
          runPetResponseTurn,
          shouldAutoSpeakReply: !preparedRequest.isGroupMode,
          targetSlot,
        },
      });
    }

    if (!isAgentTaskRuntimeWaitingApproval(sessionResult)) {
      releaseAgentCanonicalEventJournal(messageId);
    }

    pushFrontendRuntimeLog('agent-session-v2', 'approved session continued', {
      status: sessionResult.status,
      stepCount: sessionResult.steps.length,
      toolResultCount: sessionResult.toolResults.length,
      taskId: sessionResult.taskState?.taskId ?? null,
      stateRevision: sessionResult.taskState?.revision ?? null,
    });
  } catch (error) {
    if (abortController.signal.aborted || requestToken !== activeChatRequestTokenRef.current || isStoppedAgentRunMessage(messageId)) {
      return;
    }

    const errorText = error instanceof Error ? error.message : String(error);
    if (canonicalEventJournal && approvalRuntime?.taskState) {
      canonicalEventJournal.append({
        payload: { reason: 'approval-continuation-error' },
        runId: approvalRuntime.taskState.runId ?? approvalRuntime.taskState.taskId,
        taskId: approvalRuntime.taskState.taskId,
        type: 'task_failed',
      });
    }
    releaseAgentCanonicalEventJournal(messageId);
    publishAgentRuntimeWorldResult({
      status: 'failed',
      taskState: approvalRuntime?.taskState ?? null,
    });
    const result = assessAgentCommandResult(approval.command, {
      errorText,
      ok: false,
      responseText: createAgentApprovalFailureVisibleText(errorText),
    });
    const failedGroupTaskEvent = updateGroupTaskConversationEvent({
      event: approval.groupTaskEvent ?? approvalMessage.groupTaskEvent,
      outcome: 'failed',
      summary: errorText,
    });
    updateAgentApprovalMessage(messageId, (message) => ({
      ...message,
      groupTaskEvent: failedGroupTaskEvent,
      text: createAgentApprovalFailureVisibleText(errorText),
      agentApproval: message.agentApproval
        ? {
            ...message.agentApproval,
            assessment: result.assessment ?? null,
            context: createAgentContextFromResult(approval.command, result),
            errorText,
            followUpAction: result.followUpAction ?? null,
            followUpActions: resolveAgentResultFollowUpActions(result),
            followUpText: result.followUp ?? null,
            groupTaskEvent: failedGroupTaskEvent,
            receipt: createAgentExecutionReceipt(approval.command, result),
            stages: updateAgentWorkStage(
              updateAgentWorkStage(
                updateAgentWorkStage(message.agentApproval.stages, 'execute-tools', 'failed', errorText),
                'verify-result',
                'failed',
                result.assessment?.summary ?? errorText,
                result.assessment?.evidence,
              ),
              'decide-next-step',
              'completed',
              createAgentDecisionSummary(result, resolveAgentResultFollowUpActions(result)),
            ),
            status: 'failed',
            trace: updateAgentRunTraceItem(
              updateAgentRunTraceItem(
                markAgentRunTraceToolSteps(message.agentApproval.trace, 'failed', errorText),
                'summarize-result',
                'failed',
                errorText,
              ),
              'decide-next-step',
              'completed',
              createAgentDecisionSummary(result, resolveAgentResultFollowUpActions(result)),
            ),
          }
        : null,
      agentRun: message.agentRun
        ? {
            ...message.agentRun,
            assessment: result.assessment ?? null,
            context: createAgentContextFromResult(approval.command, result),
            errorText,
            followUpAction: result.followUpAction ?? null,
            followUpActions: resolveAgentResultFollowUpActions(result),
            followUpText: result.followUp ?? null,
            groupTaskEvent: failedGroupTaskEvent,
            receipt: createAgentExecutionReceipt(approval.command, result),
            resultText: result.responseText,
            status: 'failed',
          }
        : null,
    }));
    publishGroupTaskEvent(groupTaskLifecycle, failedGroupTaskEvent);
    completeGroupTaskMessageLifecycle(
      groupTaskLifecycle,
      failedGroupTaskEvent,
      approvalMessage.petId,
    );
    pushFrontendRuntimeLog('agent-run', 'approved run failed', {
      goal: approval.plan.goal,
      error: errorText,
    });
  } finally {
    unregisterAbortController();
    finalizeChatSendRequest(
      requestToken,
      activeChatRequestTokenRef,
      groupChatContinuationEnabledRef,
    );
  }
}

export const agentRunController = {
  resolveAgentApprovalRequest,
  runPreparedAgentProductionSession,
  stopAgentRunMessage,
};
