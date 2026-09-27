import { Fragment, memo, useEffect, useRef, useState } from 'react';
import { Brain, Check, ChevronDown, ChevronUp, Copy, Loader2, MessageSquareText, Play, StopCircle, Volume2, X } from 'lucide-react';
import { type DesktopPetChatSendOptions } from '../../chatState';
import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../../multiPetRoster';
import {
  type ChatAgentApprovalDecision,
  type ChatAgentExecutionReceipt,
  type ChatAgentRunLoopRound,
  type ChatAgentRunTraceItem,
  type ChatAgentWorkStage,
  type ChatMessage,
  type ChatMessageContentSegment,
  type ChatMessageExpressionContentSegment,
  type ChatMessageImageAttachment,
  type PetConfig,
} from '../../types';
import { Button } from '../../../components/ui/button';
import { type ChatMemorySaveTarget } from './chatMemorySaveUtils';
import { resolveChatMessageTextStyle, resolveChatBubbleBackgroundStyle } from '../../chatAppearanceSettings';
import {
  resolveChatAvatarDisplaySize,
  resolveChatMessageAvatarUrl,
  resolveChatUserDisplayName,
} from './chatAppearanceUtils';
import { resolveChatAgentRuntimeContinuation } from './chatAgentRuntimeCompatibility';
import { resolveConversationMessageLabel } from './petChatConversationMessageUtils';
import { GroupMemorySaveButton } from './group/memory/GroupMemorySaveButton';
import { GroupMemoryCandidateSaveButton } from './group/memory/GroupMemoryCandidateSaveButton';
import { StoryNarrativeText } from './story/StoryNarrativeText';
import { expressionLibraryBridge } from '../../expression/expressionLibraryBridge';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';

interface PetChatConversationMessageBubbleProps {
  chatBracketOuterTextColor: string;
  config: PetConfig;
  embeddedStoryNarration?: boolean;
  message: ChatMessage;
  messageKey: string;
  onPlayMessageVoice?: (text: string) => void | Promise<void>;
  onResolveAgentApproval?: (messageId: string, decision: ChatAgentApprovalDecision) => void | Promise<void>;
  onSaveMessageToMemory?: (
    message: ChatMessage, target: ChatMemorySaveTarget, groupId?: string,
  ) => void;
  onSendMessage: (
    textOverride?: string,
    options?: DesktopPetChatSendOptions,
  ) => void | Promise<void>;
  onStopAgentRun?: (messageId?: string | null) => void;
  showVoiceOutputStatus?: boolean;
}

type MessageTextSegment = {
  isBracketContent: boolean;
  text: string;
};

type MemoryMenuPosition = {
  x: number;
  y: number;
};

const OPENING_BRACKETS = new Set(['(', '（', '[', '【']);
const CLOSING_BRACKETS = new Set([')', '）', ']', '】']);
const MEMORY_MENU_WIDTH = 188;
const MEMORY_MENU_HEIGHT = 44;
const MEMORY_MENU_OFFSET = 10;

function splitMessageTextByBrackets(text: string) {
  const segments: MessageTextSegment[] = [];
  let buffer = '';
  let bracketDepth = 0;

  const pushBuffer = (isBracketContent: boolean) => {
    if (!buffer) {
      return;
    }

    segments.push({ isBracketContent, text: buffer });
    buffer = '';
  };

  for (const character of text) {
    if (OPENING_BRACKETS.has(character)) {
      pushBuffer(bracketDepth > 0);
      bracketDepth += 1;
      buffer += character;
      continue;
    }

    if (CLOSING_BRACKETS.has(character)) {
      buffer += character;
      pushBuffer(true);
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    buffer += character;
  }

  pushBuffer(bracketDepth > 0);
  return segments;
}

function clampMemoryMenuPosition(x: number, y: number): MemoryMenuPosition {
  return {
    x: Math.max(8, Math.min(x + MEMORY_MENU_OFFSET, window.innerWidth - MEMORY_MENU_WIDTH - 8)),
    y: Math.max(8, Math.min(y + MEMORY_MENU_OFFSET, window.innerHeight - MEMORY_MENU_HEIGHT - 8)),
  };
}

function isPointInsideElement(element: HTMLElement | null, x: number, y: number) {
  if (!element) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function resolveAvatarFallbackText(message: ChatMessage, config: PetConfig) {
  if (message.role === 'user') {
    return resolveChatUserDisplayName(config);
  }

  return message.petName?.trim() || '桌宠';
}

function resolveModelMessagePetId(message: ChatMessage) {
  return message.petId ?? PRIMARY_DESKTOP_PET_SLOT_ID;
}

function isPromiseLike<T>(value: Promise<T> | T | void): value is Promise<T> {
  return Boolean(value) && typeof (value as Promise<T>).then === 'function';
}

function VoicePlaybackDots() {
  return (
    <span className="ml-0.5 inline-flex text-2xs leading-none" aria-hidden>
      {Array.from({ length: 6 }).map((_, index) => (
        <span
          key={`voice-dot-${index}`}
          className="inline-block animate-pulse"
          style={{
            animationDelay: `${index * 120}ms`,
            animationDuration: '1s',
          }}
        >
          .
        </span>
      ))}
    </span>
  );
}

function PetChatConversationVoiceUnavailableStatus() {
  return (
    <span className="inline-flex h-6 max-w-[150px] items-center rounded-full border border-border bg-muted px-2 text-2xs font-medium tracking-normal text-muted-foreground">
      <span className="truncate whitespace-nowrap">语音不可用</span>
    </span>
  );
}

function resolveAgentApprovalStatusText(status: NonNullable<ChatMessage['agentApproval']>['status']) {
  switch (status) {
    case 'pending':
      return '等待确认';
    case 'running':
      return '执行中';
    case 'awaiting-approval':
      return '待确认';
    case 'completed':
      return '已完成';
    case 'denied':
      return '已拒绝';
    case 'failed':
      return '失败';
    case 'blocked':
      return '\u5df2\u7ec8\u6b62';
    case 'approved':
      return '已允许';
    default:
      return '待处理';
  }
}

function resolveAgentRunStatusText(status: NonNullable<ChatMessage['agentRun']>['status']) {
  switch (status) {
    case 'planned':
      return '已规划';
    case 'running':
      return '执行中';
    case 'awaiting-approval':
      return '待确认';
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    case 'blocked':
      return '已拦截';
    default:
      return '待处理';
  }
}

function resolveAgentApprovalPermissionText(mode: string) {
  if (mode === 'silent') {
    return '自动';
  }

  if (mode === 'notify') {
    return '提示';
  }

  if (mode === 'confirm') {
    return '确认';
  }

  return '禁止';
}

type ChatAgentProcessPanelSource = NonNullable<ChatMessage['agentRun']> | NonNullable<ChatMessage['agentApproval']>;
type ChatAgentSessionV2Process = NonNullable<ChatAgentProcessPanelSource['agentRuntime']>;
type ChatAgentSessionV2ProcessStep = ChatAgentSessionV2Process['steps'][number];
type ChatAgentSessionV2TraceEvent = ChatAgentSessionV2Process['traceEvents'][number];
type ChatAgentRuntimeDiagnostic = NonNullable<ChatAgentSessionV2Process['diagnostics']>[number];
type ChatAgentSessionV2ToolResultEntry = ChatAgentSessionV2Process['toolResults'][number];
type ChatAgentSessionV2StuckSignalTone = 'amber' | 'rose' | 'sky';

interface ChatAgentSessionV2StuckSignalSummary {
  detail: string;
  id: string;
  label: string;
  tone: ChatAgentSessionV2StuckSignalTone;
}

function resolveLatestAgentRuntimeDiagnosticEvent(
  session: ChatAgentSessionV2Process,
): ChatAgentSessionV2TraceEvent | null {
  const diagnostic = [...(session.diagnostics ?? [])]
    .reverse()
    .find((candidate: ChatAgentRuntimeDiagnostic) => (
      candidate.category === 'runtime-shadow'
      || candidate.category === 'approval-continuation'
    ));
  if (diagnostic) {
    return {
      details: diagnostic.payload.details ?? undefined,
      id: `diagnostic-${diagnostic.source}-${diagnostic.timestamp}`,
      status: diagnostic.payload.status ?? null,
      stepIndex: session.steps.length + 1,
      summary: diagnostic.payload.summary,
      timestamp: diagnostic.timestamp,
      tool: diagnostic.payload.tool ?? null,
      type: 'runtime_shadow',
    };
  }

  return [...(session.traceEvents ?? [])]
    .reverse()
    .find((event) => event.type === 'runtime_shadow') ?? null;
}

interface ChatAgentSessionV2PerformanceSignalSummary {
  detail: string;
  id: string;
  label: string;
  tone: ChatAgentSessionV2StuckSignalTone;
}

interface ChatAgentVisualObservation {
  companionCue?: string | null;
  confidence?: string | null;
  contentLines: string[];
  key: string;
  ok: boolean;
  recoveryLines: string[];
  source?: string | null;
  summary?: string | null;
  toolName: string;
  uncertaintyLines: string[];
  visibleTextLines: string[];
}

interface ChatAgentCompactTimelineItem {
  detail?: string | null;
  id: string;
  label: string;
  status: ChatAgentRunTraceItem['status'];
}

function resolveAgentProcessStageClassName(status: ChatAgentWorkStage['status']) {
  switch (status) {
    case 'running':
      return 'border-border bg-muted text-primary';
    case 'completed':
      return 'border-emerald-100 bg-emerald-50 text-emerald-700';
    case 'failed':
      return 'border-rose-100 bg-rose-50 text-rose-700';
    case 'blocked':
      return 'border-amber-100 bg-amber-50 text-amber-700';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

function resolveAgentProcessStageDotClassName(status: ChatAgentWorkStage['status']) {
  switch (status) {
    case 'running':
      return 'border-primary/40 bg-white text-primary';
    case 'completed':
      return 'border-emerald-200 bg-emerald-500 text-white';
    case 'failed':
      return 'border-rose-200 bg-rose-500 text-white';
    case 'blocked':
      return 'border-amber-200 bg-amber-500 text-white';
    default:
      return 'border-border bg-white text-muted-foreground';
  }
}

function resolveAgentProcessCurrentStage(stages?: ChatAgentWorkStage[]) {
  if (!stages?.length) {
    return null;
  }

  return stages.find((stage) => stage.status === 'failed' || stage.status === 'blocked')
    ?? stages.find((stage) => stage.status === 'running')
    ?? stages.find((stage) => stage.status === 'pending')
    ?? stages[stages.length - 1]
    ?? null;
}

function resolveAgentProcessLatestTrace(trace?: ChatAgentRunTraceItem[]) {
  if (!trace?.length) {
    return null;
  }

  return trace.find((item) => item.status === 'running')
    ?? [...trace].reverse().find((item) => item.status !== 'pending')
    ?? trace[0]
    ?? null;
}

function compactAgentPanelText(text?: string | null, maxLength = 132) {
  const normalizedText = text?.replace(/\s+/gu, ' ').trim() ?? '';
  if (normalizedText.length <= maxLength) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, Math.max(0, maxLength - 3))}...`;
}

function resolveAgentSessionV2LatestUnderstanding(session?: ChatAgentSessionV2Process | null) {
  const steps = session?.steps ?? [];
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const understanding = steps[index]?.understanding ?? null;
    if (
      understanding?.userNeed
      || understanding?.neededCapability
      || understanding?.successCriteria
      || understanding?.capabilityGap
    ) {
      return understanding;
    }
  }

  return null;
}

function resolveAgentSessionV2ActionText(action: ChatAgentSessionV2ProcessStep['action']) {
  switch (action) {
    case 'tool_call':
      return '选择工具';
    case 'tool_calls':
      return '并行观察';
    case 'tool_result':
      return '读取结果';
    case 'ask_user':
      return '需要补充';
    case 'final_answer':
      return '完成回答';
    default:
      return '处理';
  }
}

function resolveAgentSessionV2StepTitle(step: ChatAgentSessionV2ProcessStep) {
  const actionText = resolveAgentSessionV2ActionText(step.action);
  return step.tool ? `${actionText}: ${step.tool}` : actionText;
}

function resolveAgentSessionV2StepStatusText(step: ChatAgentSessionV2ProcessStep) {
  if (step.action === 'tool_result') {
    return step.ok === false ? '失败' : '已返回';
  }

  if (step.action === 'ask_user') {
    return '待补充';
  }

  if (step.action === 'final_answer') {
    return '完成';
  }

  return '已决定';
}

function resolveAgentSessionV2StepClassName(step: ChatAgentSessionV2ProcessStep) {
  if (step.action === 'tool_result' && step.ok === false) {
    return 'border-rose-100 bg-rose-50 text-rose-700';
  }

  if (step.action === 'ask_user') {
    return 'border-amber-100 bg-amber-50 text-amber-700';
  }

  if (step.action === 'final_answer') {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }

  return 'border-border bg-muted text-primary';
}

function formatAgentSessionV2TimingDuration(ms?: number | null) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) {
    return '0ms';
  }

  if (ms >= 1000) {
    const seconds = ms / 1000;
    return `${seconds >= 10 ? Math.round(seconds) : seconds.toFixed(1)}s`;
  }

  return `${Math.max(0, Math.round(ms))}ms`;
}

function stringifyAgentSessionV2TraceValue(value: unknown) {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function stringifyAgentSessionV2TraceDetailValue(key: string, value: unknown) {
  if (key === 'durationMs' && typeof value === 'number') {
    return formatAgentSessionV2TimingDuration(value);
  }

  return stringifyAgentSessionV2TraceValue(value);
}

function stableAgentSessionV2PanelJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableAgentSessionV2PanelJson).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => (
      `${JSON.stringify(key)}:${stableAgentSessionV2PanelJson(record[key])}`
    )).join(',')}}`;
  }

  return JSON.stringify(value);
}

function resolveAgentSessionV2TraceTypeText(type: ChatAgentSessionV2TraceEvent['type']) {
  switch (type) {
    case 'approval_required':
      return 'Approval';
    case 'decision_parsed':
      return 'Decision';
    case 'decision_rejected':
      return 'Rejected';
    case 'final_answer':
      return 'Final';
    case 'model_output':
      return 'Model';
    case 'permission_routed':
      return 'Permission';
    case 'runtime_shadow':
      return 'Runtime Shadow';
    case 'trace_compacted':
      return 'Compacted';
    case 'tool_finished':
      return 'Tool done';
    case 'tool_started':
      return 'Tool start';
    default:
      return 'Trace';
  }
}

function resolveAgentSessionV2TraceClassName(event: ChatAgentSessionV2TraceEvent) {
  const status = event.status ?? '';
  if (
    event.type === 'decision_rejected'
    || /(?:fail|invalid|blocked|rejected|error)/iu.test(status)
  ) {
    return 'border-rose-100 bg-rose-50 text-rose-700';
  }

  if (event.type === 'approval_required' || /approval|pending/iu.test(status)) {
    return 'border-amber-100 bg-amber-50 text-amber-700';
  }

  if (event.type === 'tool_started' || /running/iu.test(status)) {
    return 'border-border bg-muted text-primary';
  }

  if (event.type === 'runtime_shadow' && status !== 'verified_success') {
    return /failed|blocked|unverified|without_dispatch|no_tool/iu.test(status)
      ? 'border-rose-100 bg-rose-50 text-rose-700'
      : 'border-amber-100 bg-amber-50 text-amber-700';
  }

  if (/success|completed|parsed|silent|approved-result/iu.test(status)) {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }

  return 'border-border bg-muted text-muted-foreground';
}

function resolveAgentSessionV2TraceDetailPairs(event: ChatAgentSessionV2TraceEvent) {
  const details = event.details ?? {};
  const preferredKeys = [
    'classification',
    'state',
    'eventKinds',
    'notes',
    'approvalContinuationReason',
    'approvalContinuationTool',
    'approvalContinuationAllowed',
    'approvalContinuationCount',
    'approvalContinuationLimit',
    'scopeMatched',
    'hardGate',
    'eligibleTool',
    'desktopSafe',
    'totalElapsedMs',
    'slowestToolName',
    'slowestToolDurationMs',
    'actionOutcome',
    'receiptStatus',
    'timingStatus',
    'cacheHit',
    'routeSummary',
    'errorText',
    'responseText',
    'reason',
    'verification',
    'visualActionReadiness',
    'visualActionBlocker',
    'launcherReason',
    'coveredByTool',
    'coverageReason',
    'actionTarget',
    'actionDiff',
    'durationMs',
    'timingDetail',
    'source',
    'compactedEventCount',
    'typeCounts',
  ];

  return preferredKeys
    .map((key) => [key, stringifyAgentSessionV2TraceDetailValue(key, details[key])] as const)
    .filter(([, value]) => value)
    .slice(0, 4);
}

function getAgentSessionV2PanelActionEvidence(entry: ChatAgentSessionV2ToolResultEntry) {
  return entry.result.stateSummary?.actionEvidence
    ?? entry.result.receipt?.stateSummary?.actionEvidence
    ?? null;
}

function createAgentSessionV2PanelToolSignature(entry: ChatAgentSessionV2ToolResultEntry) {
  const toolName = entry.command.toolCall?.name;
  if (!toolName) {
    return null;
  }

  return `${toolName}:${stableAgentSessionV2PanelJson(entry.command.toolCall?.input ?? {})}`;
}

function resolveAgentSessionV2StuckSignalClassName(tone: ChatAgentSessionV2StuckSignalTone) {
  switch (tone) {
    case 'rose':
      return 'border-rose-100 bg-rose-50 text-rose-700';
    case 'sky':
      return 'border-border bg-muted text-primary';
    default:
      return 'border-amber-100 bg-amber-50 text-amber-700';
  }
}

function resolveAgentSessionV2TraceStuckSignals(
  session: ChatAgentSessionV2Process,
): ChatAgentSessionV2StuckSignalSummary[] {
  const signals: ChatAgentSessionV2StuckSignalSummary[] = [];
  const recentTraceEvents = (session.traceEvents ?? []).slice(-12);
  const recentToolResults = (session.toolResults ?? []).slice(-6);
  const incompleteActionEntry = [...recentToolResults].reverse().find((entry) => {
    const actionEvidence = getAgentSessionV2PanelActionEvidence(entry);
    return actionEvidence?.outcome === 'no-op'
      || actionEvidence?.outcome === 'uncertain'
      || actionEvidence?.outcome === 'blocked';
  });

  if (incompleteActionEntry) {
    const actionEvidence = getAgentSessionV2PanelActionEvidence(incompleteActionEntry);
    const toolName = incompleteActionEntry.command.toolCall?.name ?? incompleteActionEntry.command.kind;
    signals.push({
      detail: [
        `tool=${toolName}`,
        actionEvidence?.outcome ? `outcome=${actionEvidence.outcome}` : '',
        actionEvidence?.targetRef?.label ? `target=${actionEvidence.targetRef.label}` : '',
        actionEvidence?.diff?.summary ? `diff=${compactAgentPanelText(actionEvidence.diff.summary, 120)}` : '',
      ].filter(Boolean).join(' | '),
      id: 'recent_action_evidence_not_completed',
      label: 'recent_action_evidence_not_completed',
      tone: actionEvidence?.outcome === 'blocked' ? 'rose' : 'amber',
    });
  }

  const signatureCounts = new Map<string, {
    count: number;
    entry: ChatAgentSessionV2ToolResultEntry;
  }>();
  for (const entry of recentToolResults) {
    if (entry.result.ok !== false) {
      continue;
    }

    const signature = createAgentSessionV2PanelToolSignature(entry);
    if (!signature) {
      continue;
    }

    const current = signatureCounts.get(signature);
    signatureCounts.set(signature, {
      count: (current?.count ?? 0) + 1,
      entry,
    });
  }
  const repeatedFailed = [...signatureCounts.entries()]
    .filter(([, value]) => value.count >= 2)
    .sort(([, a], [, b]) => b.count - a.count)[0] ?? null;
  if (repeatedFailed) {
    const [, value] = repeatedFailed;
    const toolName = value.entry.command.toolCall?.name ?? value.entry.command.kind;
    signals.push({
      detail: [
        `tool=${toolName}`,
        `repeat=${value.count}`,
        value.entry.result.errorText ? `error=${compactAgentPanelText(value.entry.result.errorText, 120)}` : '',
      ].filter(Boolean).join(' | '),
      id: 'repeated_failed_tool_signature',
      label: 'repeated_failed_tool_signature',
      tone: 'rose',
    });
  }

  const latestRejected = [...recentTraceEvents].reverse().find((event) => (
    event.type === 'decision_rejected'
    || /(?:invalid|blocked|rejected|failed|permission-blocked)/iu.test(event.status ?? '')
  ));
  if (latestRejected) {
    signals.push({
      detail: [
        latestRejected.tool ? `tool=${latestRejected.tool}` : '',
        latestRejected.status ? `status=${latestRejected.status}` : '',
        compactAgentPanelText(latestRejected.summary, 140),
      ].filter(Boolean).join(' | '),
      id: 'recent_trace_rejection',
      label: 'recent_trace_rejection',
      tone: latestRejected.status === 'invalid-tool-input' ? 'amber' : 'rose',
    });
  }

  const permissionBlocked = [...recentTraceEvents].reverse().find((event) => (
    event.type === 'permission_routed'
    && event.status === 'blocked'
  ));
  if (permissionBlocked) {
    signals.push({
      detail: [
        permissionBlocked.tool ? `tool=${permissionBlocked.tool}` : '',
        compactAgentPanelText(permissionBlocked.summary, 140),
      ].filter(Boolean).join(' | '),
      id: 'permission_route_blocked',
      label: 'permission_route_blocked',
      tone: 'rose',
    });
  }

  const recentStartedTools = recentTraceEvents.filter((event) => event.type === 'tool_started');
  const recentFinishedTools = recentTraceEvents.filter((event) => event.type === 'tool_finished');
  if (recentStartedTools.length >= 2 && recentFinishedTools.length === 0) {
    const latestStarted = recentStartedTools[recentStartedTools.length - 1];
    signals.push({
      detail: [
        latestStarted?.tool ? `tool=${latestStarted.tool}` : '',
        'no recent tool_finished event',
      ].filter(Boolean).join(' | '),
      id: 'tool_started_without_recent_finish',
      label: 'tool_started_without_recent_finish',
      tone: 'sky',
    });
  }

  const seen = new Set<string>();
  return signals.filter((signal) => {
    if (seen.has(signal.id)) {
      return false;
    }

    seen.add(signal.id);
    return true;
  }).slice(0, 4);
}

function countAgentSessionV2TimingEntries(
  session: ChatAgentSessionV2Process,
  status: string,
) {
  return (session.timing?.entries ?? []).filter((entry) => entry.status === status).length;
}

function resolveAgentSessionV2PerformanceSignals(
  session: ChatAgentSessionV2Process,
): ChatAgentSessionV2PerformanceSignalSummary[] {
  const timing = session.timing ?? null;
  if (!timing) {
    return [];
  }

  const elapsedMs = Math.max(1, timing.elapsedMs);
  const modelShare = timing.modelDurationMs / elapsedMs;
  const toolShare = timing.toolDurationMs / elapsedMs;
  const signals: ChatAgentSessionV2PerformanceSignalSummary[] = [];
  const slowestTimingEntry = timing.entries
    .filter((entry) => typeof entry.durationMs === 'number')
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))[0] ?? null;
  const cachedCount = countAgentSessionV2TimingEntries(session, 'cached');
  const dedupedCount = countAgentSessionV2TimingEntries(session, 'deduped');
  const toolCount = timing.entries.filter((entry) => entry.kind === 'tool').length;
  const recentObservationToolCount = (session.toolResults ?? []).slice(-8).filter((entry) => (
    /(?:observe|screenshot|vision|locate|window)/iu.test(entry.command.toolCall?.name ?? entry.command.kind)
  )).length;

  if (modelShare >= 0.55 && timing.modelCallCount > 0) {
    signals.push({
      detail: [
        `model=${formatAgentSessionV2TimingDuration(timing.modelDurationMs)}`,
        `total=${formatAgentSessionV2TimingDuration(timing.elapsedMs)}`,
        `calls=${timing.modelCallCount}`,
      ].join(' | '),
      id: 'model_time_dominant',
      label: 'model_time_dominant',
      tone: 'sky',
    });
  }

  if (toolShare >= 0.45 && timing.toolCallCount > 0) {
    signals.push({
      detail: [
        `tool=${formatAgentSessionV2TimingDuration(timing.toolDurationMs)}`,
        `total=${formatAgentSessionV2TimingDuration(timing.elapsedMs)}`,
        `calls=${timing.toolCallCount}`,
      ].join(' | '),
      id: 'tool_time_dominant',
      label: 'tool_time_dominant',
      tone: 'amber',
    });
  }

  if (slowestTimingEntry && (slowestTimingEntry.durationMs ?? 0) >= 1000) {
    signals.push({
      detail: [
        `entry=${slowestTimingEntry.label}`,
        `kind=${slowestTimingEntry.kind}`,
        `status=${slowestTimingEntry.status}`,
        `duration=${formatAgentSessionV2TimingDuration(slowestTimingEntry.durationMs)}`,
      ].join(' | '),
      id: 'slowest_entry_over_1s',
      label: 'slowest_entry_over_1s',
      tone: slowestTimingEntry.kind === 'tool' ? 'amber' : 'sky',
    });
  }

  if (toolCount >= 3 && cachedCount === 0) {
    signals.push({
      detail: `toolEntries=${toolCount} | cached=0`,
      id: 'no_readonly_cache_hits',
      label: 'no_readonly_cache_hits',
      tone: 'amber',
    });
  }

  if (dedupedCount > 0) {
    signals.push({
      detail: `deduped=${dedupedCount}`,
      id: 'parallel_observation_deduped',
      label: 'parallel_observation_deduped',
      tone: 'sky',
    });
  }

  if (recentObservationToolCount >= 3) {
    signals.push({
      detail: `recentObservationTools=${recentObservationToolCount}`,
      id: 'repeated_recent_observation_tools',
      label: 'repeated_recent_observation_tools',
      tone: 'amber',
    });
  }

  return signals.slice(0, 4);
}

function createAgentSessionV2TraceDebugSummary(
  session: ChatAgentSessionV2Process,
  stuckSignals: ChatAgentSessionV2StuckSignalSummary[],
) {
  const performanceSignals = resolveAgentSessionV2PerformanceSignals(session);
  const latestRuntimeShadow = resolveLatestAgentRuntimeDiagnosticEvent(session);
  const recentTraceEvents = (session.traceEvents ?? []).slice(-12);
  const recentToolResults = (session.toolResults ?? []).slice(-6);
  const compactedTraceEventCount = (session.traceEvents ?? []).reduce((count, event) => (
    event.type === 'trace_compacted'
      ? count + Number(event.details?.compactedEventCount ?? 0)
      : count
  ), 0);
  const actionEvidenceLines = recentToolResults
    .map((entry, index) => {
      const actionEvidence = getAgentSessionV2PanelActionEvidence(entry);
      if (!actionEvidence) {
        return '';
      }

      const toolName = entry.command.toolCall?.name ?? entry.command.kind;
      return [
        `${index + 1}. tool=${toolName}`,
        `outcome=${actionEvidence.outcome}`,
        actionEvidence.action ? `action=${actionEvidence.action}` : '',
        actionEvidence.targetRef?.label ? `target=${actionEvidence.targetRef.label}` : '',
        typeof actionEvidence.diff?.changed === 'boolean' ? `changed=${actionEvidence.diff.changed}` : '',
        actionEvidence.diff?.summary ? `diff=${compactAgentPanelText(actionEvidence.diff.summary, 180)}` : '',
      ].filter(Boolean).join(' | ');
    })
    .filter(Boolean);
  const traceLines = recentTraceEvents.map((event, index) => [
    `${index + 1}. type=${event.type}`,
    event.tool ? `tool=${event.tool}` : '',
    event.status ? `status=${event.status}` : '',
    `step=${event.stepIndex}`,
    `summary=${compactAgentPanelText(event.summary, 180)}`,
  ].filter(Boolean).join(' | '));
  const stuckLines = stuckSignals.map((signal, index) => (
    `${index + 1}. ${signal.label}: ${compactAgentPanelText(signal.detail, 220)}`
  ));
  const performanceLines = performanceSignals.map((signal, index) => (
    `${index + 1}. ${signal.label}: ${compactAgentPanelText(signal.detail, 220)}`
  ));
  const runtimeShadowLines = latestRuntimeShadow
    ? [
        `status=${latestRuntimeShadow.status ?? ''}`,
        `summary=${compactAgentPanelText(latestRuntimeShadow.summary, 220)}`,
        ...resolveAgentSessionV2TraceDetailPairs(latestRuntimeShadow).map(([key, value]) => (
          `${key}=${compactAgentPanelText(value, 220)}`
        )),
      ].filter(Boolean)
    : [];
  const latestToolLines = recentToolResults.map((entry, index) => {
    const toolName = entry.command.toolCall?.name ?? entry.command.kind;
    const resultText = entry.result.ok === false
      ? entry.result.errorText ?? entry.result.responseText
      : entry.result.responseText;
    return [
      `${index + 1}. tool=${toolName}`,
      `ok=${entry.result.ok === false ? 'false' : 'true'}`,
      entry.result.receipt?.status ? `receipt=${entry.result.receipt.status}` : '',
      resultText ? `result=${compactAgentPanelText(resultText, 180)}` : '',
    ].filter(Boolean).join(' | ');
  });

  return [
    'AgentSessionV2 trace debug summary',
    `steps=${session.steps.length}`,
    `toolResults=${session.toolResults.length}`,
    `traceEvents=${session.traceEvents.length}`,
    compactedTraceEventCount ? `compactedTraceEvents=${compactedTraceEventCount}` : '',
    '',
    'Stuck signals:',
    stuckLines.length ? stuckLines.join('\n') : 'none',
    '',
    'Performance signals:',
    performanceLines.length ? performanceLines.join('\n') : 'none',
    '',
    'Runtime shadow:',
    runtimeShadowLines.length ? runtimeShadowLines.join('\n') : 'none',
    '',
    'Recent action evidence:',
    actionEvidenceLines.length ? actionEvidenceLines.join('\n') : 'none',
    '',
    'Recent tool results:',
    latestToolLines.length ? latestToolLines.join('\n') : 'none',
    '',
    'Recent trace events:',
    traceLines.length ? traceLines.join('\n') : 'none',
  ].join('\n');
}

function PetChatAgentSessionV2TracePanel({
  session,
}: {
  session: ChatAgentSessionV2Process;
}) {
  const traceEvents = session.traceEvents ?? [];
  const stuckSignals = resolveAgentSessionV2TraceStuckSignals(session);
  const performanceSignals = resolveAgentSessionV2PerformanceSignals(session);
  const latestRuntimeShadow = resolveLatestAgentRuntimeDiagnosticEvent(session);
  const [copyStatus, setCopyStatus] = useState<'copied' | 'failed' | 'idle'>('idle');
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyResetTimerRef.current) {
      clearTimeout(copyResetTimerRef.current);
    }
  }, []);

  if (!traceEvents.length && !latestRuntimeShadow) {
    return null;
  }

  const setTemporaryCopyStatus = (status: 'copied' | 'failed') => {
    setCopyStatus(status);
    if (copyResetTimerRef.current) {
      clearTimeout(copyResetTimerRef.current);
    }

    copyResetTimerRef.current = setTimeout(() => {
      setCopyStatus('idle');
      copyResetTimerRef.current = null;
    }, 1600);
  };
  const handleCopyTraceDebugSummary = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setTemporaryCopyStatus('failed');
      return;
    }

    void navigator.clipboard.writeText(
      createAgentSessionV2TraceDebugSummary(session, stuckSignals),
    ).then(() => {
      setTemporaryCopyStatus('copied');
    }).catch(() => {
      setTemporaryCopyStatus('failed');
    });
  };
  const copyButtonClassName = copyStatus === 'failed'
    ? 'border-rose-100 text-rose-600 hover:bg-rose-50'
    : copyStatus === 'copied'
      ? 'border-emerald-100 text-emerald-600 hover:bg-emerald-50'
      : 'border-border text-muted-foreground hover:bg-white';

  return (
    <div className="mb-2 rounded-md border border-border bg-muted/70 px-2 py-1.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-2xs font-semibold text-muted-foreground">Trace</span>
        <span className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopyTraceDebugSummary}
            className={`h-6 w-6 rounded-full border p-0 ${copyButtonClassName}`}
            title={copyStatus === 'copied'
              ? 'Trace debug summary copied'
              : copyStatus === 'failed'
                ? 'Trace debug summary copy failed'
                : 'Copy trace debug summary'}
          >
            {copyStatus === 'copied'
              ? <Check className="h-3 w-3" />
              : copyStatus === 'failed'
                ? <X className="h-3 w-3" />
                : <Copy className="h-3 w-3" />}
          </Button>
          <span className="rounded-full border border-white bg-white/80 px-1.5 py-0.5 text-2xs text-muted-foreground">
            {traceEvents.length} events
          </span>
        </span>
      </div>
      {latestRuntimeShadow ? (
        <div className={`mb-1.5 rounded-md border px-2 py-1 ${resolveAgentSessionV2TraceClassName(latestRuntimeShadow)}`}>
          <div className="mb-1 flex flex-wrap items-center gap-1.5 text-2xs font-semibold">
            <span>Runtime diagnosis</span>
            {latestRuntimeShadow.status ? (
              <span className="rounded-full border border-current/20 bg-white/55 px-1.5 py-0.5">
                {latestRuntimeShadow.status}
              </span>
            ) : null}
          </div>
          <div className="break-words text-2xs leading-snug">
            {compactAgentPanelText(latestRuntimeShadow.summary, 220)}
          </div>
          {resolveAgentSessionV2TraceDetailPairs(latestRuntimeShadow).length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {resolveAgentSessionV2TraceDetailPairs(latestRuntimeShadow).map(([key, value]) => (
                <span key={`runtime-shadow-${key}`} className="min-w-0 max-w-full rounded border border-current/10 bg-white/55 px-1 py-0.5 text-2xs">
                  <span className="font-semibold opacity-70">{key}</span>
                  <span className="ml-1 break-words opacity-80">{compactAgentPanelText(value, 110)}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {stuckSignals.length ? (
        <div className="mb-1.5 rounded-md border border-amber-100 bg-amber-50/45 px-2 py-1">
          <div className="mb-1 text-2xs font-semibold text-amber-700">Stuck signals</div>
          <div className="flex flex-wrap gap-1">
            {stuckSignals.map((signal) => (
              <span key={signal.id} className={`min-w-0 max-w-full rounded-md border px-1.5 py-1 text-2xs leading-snug ${resolveAgentSessionV2StuckSignalClassName(signal.tone)}`}>
                <span className="block font-semibold">{signal.label}</span>
                <span className="block break-words opacity-80">{compactAgentPanelText(signal.detail, 180)}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {performanceSignals.length ? (
        <div className="mb-1.5 rounded-md border border-border bg-muted/45 px-2 py-1">
          <div className="mb-1 text-2xs font-semibold text-primary">Performance signals</div>
          <div className="flex flex-wrap gap-1">
            {performanceSignals.map((signal) => (
              <span key={signal.id} className={`min-w-0 max-w-full rounded-md border px-1.5 py-1 text-2xs leading-snug ${resolveAgentSessionV2StuckSignalClassName(signal.tone)}`}>
                <span className="block font-semibold">{signal.label}</span>
                <span className="block break-words opacity-80">{compactAgentPanelText(signal.detail, 180)}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div className="space-y-1">
        {traceEvents.slice(-8).map((event) => {
          const detailPairs = resolveAgentSessionV2TraceDetailPairs(event);
          return (
            <div key={event.id} className="grid grid-cols-[76px_minmax(0,1fr)_auto] items-start gap-2 rounded-md border border-white bg-white/75 px-2 py-1 text-2xs leading-relaxed text-foreground">
              <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-center ${resolveAgentSessionV2TraceClassName(event)}`}>
                {resolveAgentSessionV2TraceTypeText(event.type)}
              </span>
              <span className="min-w-0">
                <span className="block break-words font-medium text-foreground">
                  {compactAgentPanelText(event.summary, 150)}
                </span>
                {detailPairs.length ? (
                  <span className="mt-0.5 flex flex-wrap gap-1">
                    {detailPairs.map(([key, value]) => (
                      <span key={`${event.id}-${key}`} className="min-w-0 max-w-full rounded border border-border bg-muted px-1 py-0.5 text-muted-foreground">
                        <span className="font-semibold text-muted-foreground">{key}</span>
                        <span className="ml-1 break-words">{compactAgentPanelText(value, 96)}</span>
                      </span>
                    ))}
                  </span>
                ) : null}
              </span>
              <span className="min-w-0 max-w-[96px] truncate text-right text-muted-foreground">
                {event.tool ?? event.status ?? `#${event.stepIndex}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function resolveAgentSessionV2TimingStopReasonText(reason?: string | null) {
  switch (reason) {
    case 'max-duration':
      return '总时长上限';
    case 'max-model-calls':
      return '思考轮次上限';
    case 'max-tool-calls':
      return '工具次数上限';
    default:
      return '';
  }
}

function resolveAgentSessionV2CurrentTitle(
  process: ChatAgentProcessPanelSource,
  statusText: string,
) {
  const session = resolveChatAgentRuntimeContinuation(process);
  if (!session) {
    return statusText;
  }

  const latestStep = session.steps[session.steps.length - 1] ?? null;
  if (!latestStep) {
    return '正在理解需求';
  }

  if (process.status === 'awaiting-approval' || process.status === 'pending') {
    return `等待确认: ${latestStep.tool ?? compactAgentPanelText(latestStep.summary, 48)}`;
  }

  return resolveAgentSessionV2StepTitle(latestStep);
}

function resolveAgentSessionV2Progress(process: ChatAgentProcessPanelSource) {
  const session = resolveChatAgentRuntimeContinuation(process);
  const stepCount = session?.steps.length ?? 0;
  const isTerminal = process.status === 'completed'
    || process.status === 'failed'
    || process.status === 'blocked'
    || process.status === 'denied';
  const percent = isTerminal
    ? 100
    : Math.min(90, Math.max(12, stepCount * 22 || 12));

  return {
    percent,
    stepCount,
    toolResultCount: session?.toolResults.length ?? 0,
  };
}

function resolveAgentProcessStateSummary(process: ChatAgentProcessPanelSource) {
  return process.receipt?.stateSummary ?? process.context?.stateSummary ?? null;
}

function countAgentStateSummaryItems(stateSummary: ChatAgentExecutionReceipt['stateSummary']) {
  if (!stateSummary) {
    return 0;
  }

  return [
    stateSummary.observedState,
    stateSummary.changedState,
    stateSummary.verificationEvidence,
    stateSummary.missingEvidence,
    stateSummary.recommendedRecovery,
  ].reduce((count, items) => count + (items?.length ?? 0), stateSummary.structuredEvidence ? 1 : 0);
}

function createAgentStructuredEvidenceLines(stateSummary: ChatAgentExecutionReceipt['stateSummary']) {
  const evidence = stateSummary?.structuredEvidence;
  if (!evidence) {
    return [];
  }

  const window = evidence.finalWindow;
  const bounds = window?.bounds;
  const formatCandidateLabels = (candidates: typeof evidence.targetCandidates) => (
    Array.isArray(candidates) && candidates.length
      ? candidates.slice(0, 4).map((candidate, index) => (
          `${index + 1}:${compactAgentPanelText(candidate.label || candidate.description || 'candidate', 50)}${candidate.confidence ? `(${candidate.confidence})` : ''}`
        )).join(' | ')
      : ''
  );
  const targetCandidates = formatCandidateLabels(evidence.targetCandidates);
  const actionCandidates = formatCandidateLabels(evidence.actionCandidates);
  const coordinateAudit = evidence.coordinateAudit ?? evidence.inputReplayPreview?.coordinateAudit ?? null;
  const launcherVerification = evidence.launcherVerification;
  const formatTriState = (value: boolean | null | undefined) => (
    typeof value === 'boolean' ? String(value) : 'unknown'
  );
  return [
    evidence.captureStatus ? `captureStatus=${evidence.captureStatus}` : '',
    typeof evidence.captureTrusted === 'boolean' ? `captureTrusted=${evidence.captureTrusted}` : '',
    coordinateAudit
      ? [
          `coordinateAudit=${coordinateAudit.status}`,
          coordinateAudit.point ? `point=${coordinateAudit.point.x},${coordinateAudit.point.y}` : '',
          typeof coordinateAudit.insideSourceBounds === 'boolean' ? `insideSource=${coordinateAudit.insideSourceBounds}` : '',
          coordinateAudit.sourceRatio ? `ratio=${coordinateAudit.sourceRatio.x},${coordinateAudit.sourceRatio.y}` : '',
          coordinateAudit.sourceBoundsCoordinateSpace ? `boundsSpace=${coordinateAudit.sourceBoundsCoordinateSpace}` : '',
          coordinateAudit.sourceNativeBoundsSource ? `nativeBounds=${coordinateAudit.sourceNativeBoundsSource}` : '',
          coordinateAudit.sourceScaleFactor ? `scale=${coordinateAudit.sourceScaleFactor}` : '',
        ].filter(Boolean).join(', ')
      : '',
    evidence.inputReplayPreview?.clickPoint
      ? `inputReplayPoint=${evidence.inputReplayPreview.clickPoint.x},${evidence.inputReplayPreview.clickPoint.y}`
      : '',
    typeof evidence.inputReplayPreview?.uiChanged === 'boolean'
      ? `inputReplayChanged=${evidence.inputReplayPreview.uiChanged}`
      : '',
    evidence.inputReplayPreview?.coordinateClosureStatus
      ? `inputReplayClosure=${evidence.inputReplayPreview.coordinateClosureStatus}`
      : '',
    evidence.targetMatched ? `target=${evidence.targetMatched}` : '',
    targetCandidates ? `targetCandidates=${targetCandidates}` : '',
    actionCandidates ? `actionCandidates=${actionCandidates}` : '',
    launcherVerification?.status
      ? [
          `launcher=${launcherVerification.status}`,
          `visible=${formatTriState(launcherVerification.targetVisible)}`,
          `selected=${formatTriState(launcherVerification.targetSelected)}`,
          `detail=${formatTriState(launcherVerification.detailMatchesTarget)}`,
          `action=${formatTriState(launcherVerification.primaryActionMatchesTarget)}`,
        ].join(', ')
      : '',
    evidence.finalUrl ? `url=${evidence.finalUrl}` : '',
    window ? [
      window.processName ? `process=${window.processName}` : '',
      window.title ? `title=${compactAgentPanelText(window.title, 90)}` : '',
      typeof window.pid === 'number' ? `pid=${window.pid}` : '',
      typeof window.hwnd === 'number' ? `hwnd=${window.hwnd}` : '',
    ].filter(Boolean).join(', ') : '',
    evidence.finalDisplay?.label || evidence.finalDisplay?.id
      ? `display=${evidence.finalDisplay.label ?? evidence.finalDisplay.id}`
      : '',
    evidence.postActionState ? `postActionState=${evidence.postActionState}` : '',
    bounds && typeof bounds.x === 'number' && typeof bounds.y === 'number'
      ? `bounds=${bounds.x},${bounds.y},${bounds.width ?? '?'}x${bounds.height ?? '?'}`
      : '',
    evidence.status ? `status=${evidence.status}` : '',
    evidence.confidence ? `confidence=${evidence.confidence}` : '',
  ].filter(Boolean);
}

function isAgentVisualToolName(toolName?: string | null) {
  return toolName === 'summarize_visual_snapshot' || toolName === 'analyze_game_screen';
}

function normalizeAgentVisualLine(line?: string | null) {
  return line?.replace(/\s+/gu, ' ').trim() ?? '';
}

function uniqueAgentVisualLines(lines: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return lines
    .map(normalizeAgentVisualLine)
    .filter((line) => {
      if (!line || seen.has(line)) {
        return false;
      }

      seen.add(line);
      return true;
    });
}

function extractAgentVisualLine(lines: string[], prefixes: string[]) {
  for (const line of lines) {
    for (const prefix of prefixes) {
      if (line.toLowerCase().startsWith(prefix.toLowerCase())) {
        return line.slice(prefix.length).trim();
      }
    }
  }

  return '';
}

function splitAgentVisualListText(text?: string | null) {
  return uniqueAgentVisualLines(
    (text ?? '')
      .split(/\s*\|\s*/u)
      .map((item) => item.trim()),
  );
}

function resolveAgentVisualObservationFromToolResult(
  entry: ChatAgentSessionV2ToolResultEntry,
  index: number,
): ChatAgentVisualObservation | null {
  const toolName = entry.command.toolCall?.name ?? entry.command.kind;
  if (!isAgentVisualToolName(toolName)) {
    return null;
  }

  const result = entry.result;
  const stateSummary = result.stateSummary ?? result.receipt?.stateSummary ?? null;
  const observedLines = uniqueAgentVisualLines([
    ...(stateSummary?.observedState ?? []),
    ...(result.observations ?? []),
    ...(result.receipt?.evidenceLines ?? []),
    result.responseText,
  ]);
  const verificationLines = uniqueAgentVisualLines([
    ...(stateSummary?.verificationEvidence ?? []),
    result.verification,
    result.receipt?.verification,
  ]);
  const allLines = uniqueAgentVisualLines([
    ...observedLines,
    ...verificationLines,
    ...(stateSummary?.missingEvidence ?? []),
  ]);
  const source = extractAgentVisualLine(allLines, [
    'Visual source:',
    'Game source:',
    'Selected visual source:',
    'Selected game source:',
    '视觉来源：',
  ]);
  const extractedSummary = extractAgentVisualLine(allLines, [
    'Visual summary:',
    'Game content analysis:',
  ]);
  const summary = extractedSummary
    || (result.ok === false
      ? compactAgentPanelText(result.errorText ?? result.followUp ?? result.responseText, 180)
      : '');
  const confidence = extractAgentVisualLine(verificationLines, [
    'Visual confidence:',
    'Game confidence:',
  ]);
  const companionCue = extractAgentVisualLine(verificationLines, [
    'Visual companion cue:',
    'Game companion cue:',
  ]);

  const contentLines = uniqueAgentVisualLines([
    extractAgentVisualLine(allLines, ['Visual app/window:'])
      ? `窗口：${extractAgentVisualLine(allLines, ['Visual app/window:'])}`
      : '',
    extractAgentVisualLine(allLines, ['Visual main content:'])
      ? `内容：${extractAgentVisualLine(allLines, ['Visual main content:'])}`
      : '',
    extractAgentVisualLine(allLines, ['Visual visible objects:'])
      ? `对象：${splitAgentVisualListText(extractAgentVisualLine(allLines, ['Visual visible objects:'])).join(' / ')}`
      : '',
    extractAgentVisualLine(allLines, ['Game detected game/genre:'])
      ? `游戏：${extractAgentVisualLine(allLines, ['Game detected game/genre:'])}`
      : '',
    extractAgentVisualLine(allLines, ['Game scene state:'])
      ? `场景：${extractAgentVisualLine(allLines, ['Game scene state:'])}`
      : '',
    extractAgentVisualLine(allLines, ['Game player state:'])
      ? `玩家：${extractAgentVisualLine(allLines, ['Game player state:'])}`
      : '',
    extractAgentVisualLine(allLines, ['Game HUD:'])
      ? `HUD：${extractAgentVisualLine(allLines, ['Game HUD:'])}`
      : '',
  ]);
  const visibleTextLines = splitAgentVisualListText(
    extractAgentVisualLine(allLines, [
      'Visual readable text:',
      'Game visible text:',
    ]),
  );
  const uncertaintyLines = uniqueAgentVisualLines([
    ...(stateSummary?.missingEvidence ?? []).map((line) => (
      extractAgentVisualLine([line], ['Visual uncertainty:', 'Game uncertainty:']) || line
    )),
    ...splitAgentVisualListText(
      extractAgentVisualLine(allLines, [
        'Visual uncertainty:',
        'Game uncertainty:',
      ]),
    ),
  ]);

  return {
    companionCue,
    confidence,
    contentLines,
    key: `${index}-${toolName}-${source || summary || result.responseText || 'visual'}`,
    ok: result.ok !== false,
    recoveryLines: uniqueAgentVisualLines(stateSummary?.recommendedRecovery ?? []),
    source,
    summary,
    toolName,
    uncertaintyLines,
    visibleTextLines,
  };
}

function resolveAgentVisualObservations(process: ChatAgentProcessPanelSource) {
  return (resolveChatAgentRuntimeContinuation(process)?.toolResults ?? [])
    .map(resolveAgentVisualObservationFromToolResult)
    .filter((entry): entry is ChatAgentVisualObservation => Boolean(entry));
}

function resolveLatestAgentVisualObservation(process: ChatAgentProcessPanelSource) {
  const observations = resolveAgentVisualObservations(process);
  return observations[observations.length - 1] ?? null;
}

function resolveAgentProcessStageProgress(stages?: ChatAgentWorkStage[]) {
  const total = stages?.length ?? 0;
  const completed = stages?.filter((stage) => stage.status === 'completed').length ?? 0;
  const blocked = stages?.some((stage) => stage.status === 'blocked') ?? false;
  const failed = stages?.some((stage) => stage.status === 'failed') ?? false;
  const currentStage = resolveAgentProcessCurrentStage(stages);
  const percent = total ? Math.round((completed / total) * 100) : 0;

  return {
    blocked,
    completed,
    currentStage,
    failed,
    percent,
    total,
  };
}

function resolveAgentSessionV2CompactStepStatus(
  process: ChatAgentProcessPanelSource,
  step: ChatAgentSessionV2ProcessStep,
  isLatest: boolean,
): ChatAgentCompactTimelineItem['status'] {
  if (step.action === 'tool_result' && step.ok === false) {
    return 'failed';
  }

  if (isLatest) {
    if (process.status === 'failed') {
      return 'failed';
    }

    if (process.status === 'blocked' || process.status === 'denied') {
      return 'blocked';
    }

    if (process.status === 'awaiting-approval' || process.status === 'pending') {
      return 'pending';
    }

    if (process.status === 'running' || process.status === 'planned') {
      return 'running';
    }
  }

  if (step.action === 'ask_user') {
    return 'blocked';
  }

  return 'completed';
}

function resolveAgentProcessCompactTimeline(process: ChatAgentProcessPanelSource): ChatAgentCompactTimelineItem[] {
  const liveStages = (process.stages ?? []).filter((stage) => (
    stage.status === 'running'
    || stage.status === 'failed'
    || stage.status === 'blocked'
  ));
  if (liveStages.length) {
    return liveStages.slice(-3).map((stage) => ({
      detail: stage.summary ?? null,
      id: `stage-${stage.id}`,
      label: stage.title,
      status: stage.status,
    }));
  }

  const liveTraceItems = (process.trace ?? []).filter((item) => (
    item.status === 'running'
    || item.status === 'failed'
    || item.status === 'blocked'
  ));
  if (liveTraceItems.length) {
    return liveTraceItems.slice(-3).map((item) => ({
      detail: item.detail ?? null,
      id: `trace-${item.id}`,
      label: item.label,
      status: item.status,
    }));
  }

  const sessionSteps = resolveChatAgentRuntimeContinuation(process)?.steps ?? [];
  if (sessionSteps.length) {
    const recentSteps = sessionSteps.slice(-3);
    const latestStep = sessionSteps[sessionSteps.length - 1] ?? null;
    return recentSteps.map((step) => ({
      detail: step.summary || step.reason || null,
      id: `session-v2-step-${step.index}-${step.action}`,
      label: resolveAgentSessionV2StepTitle(step),
      status: resolveAgentSessionV2CompactStepStatus(process, step, step === latestStep),
    }));
  }

  const stages = process.stages ?? [];
  if (stages.length) {
    const visibleStages = stages.filter((stage) => stage.status !== 'pending');
    const recentStages = (visibleStages.length ? visibleStages : stages).slice(-3);
    return recentStages.map((stage) => ({
      detail: stage.summary ?? null,
      id: `stage-${stage.id}`,
      label: stage.title,
      status: stage.status,
    }));
  }

  const trace = process.trace ?? [];
  return trace.slice(-3).map((item) => ({
    detail: item.detail ?? null,
    id: `trace-${item.id}`,
    label: item.label,
    status: item.status,
  }));
}

function resolveAgentCompactTimelineDotClassName(status: ChatAgentCompactTimelineItem['status']) {
  switch (status) {
    case 'running':
      return 'border-primary/40 bg-white text-primary';
    case 'completed':
      return 'border-emerald-200 bg-emerald-500 text-white';
    case 'failed':
      return 'border-rose-200 bg-rose-500 text-white';
    case 'blocked':
      return 'border-amber-200 bg-amber-500 text-white';
    default:
      return 'border-border bg-white text-muted-foreground';
  }
}

function PetChatAgentCompactTimeline({
  items,
}: {
  items: ChatAgentCompactTimelineItem[];
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="mt-1.5 space-y-1 border-t border-white/70 pt-1.5">
      {items.map((item) => {
        const isRunning = item.status === 'running';
        return (
          <div key={item.id} className="grid grid-cols-[14px_minmax(0,1fr)] items-start gap-1.5 text-2xs leading-snug">
            <span className={`mt-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border ${resolveAgentCompactTimelineDotClassName(item.status)}`}>
              {isRunning ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : null}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-foreground">{item.label}</span>
              {item.detail ? (
                <span className="block line-clamp-1 break-words text-muted-foreground">
                  {compactAgentPanelText(item.detail, 96)}
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PetChatAgentProcessCompact({
  isActive,
  process,
  summaryText,
  statusText,
}: {
  isActive: boolean;
  process: ChatAgentProcessPanelSource;
  summaryText?: string;
  statusText: string;
}) {
  const timelineItems = resolveAgentProcessCompactTimeline(process);
  const agentRuntime = resolveChatAgentRuntimeContinuation(process);

  if (agentRuntime) {
    const v2Progress = resolveAgentSessionV2Progress(process);
    const understanding = resolveAgentSessionV2LatestUnderstanding(agentRuntime);
    const currentTitle = resolveAgentSessionV2CurrentTitle(process, statusText);
    const visualObservations = resolveAgentVisualObservations(process);
    const latestVisualObservation = visualObservations[visualObservations.length - 1] ?? null;
    const barClassName = process.status === 'failed' || process.status === 'denied'
      ? 'bg-rose-400'
      : process.status === 'blocked'
        ? 'bg-amber-400'
        : isActive
          ? 'bg-primary'
          : 'bg-emerald-500';

    return (
      <div className="mb-2 rounded-md border border-border bg-muted/45 px-2 py-1.5">
        <div className="mb-1 flex items-center justify-between gap-2 text-2xs">
          <span className="min-w-0 truncate font-semibold text-primary">
            {currentTitle}
          </span>
          <span className="shrink-0 text-muted-foreground">
            {statusText}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${barClassName}`}
            style={{ width: `${v2Progress.percent}%` }}
          />
        </div>
        {summaryText ? (
          <div className="mt-1 line-clamp-2 break-words text-2xs leading-relaxed text-muted-foreground">
            {summaryText}
          </div>
        ) : null}
        <div className="mt-1 flex flex-wrap gap-1 text-2xs text-muted-foreground">
          <span className="rounded-full border border-white bg-white/70 px-1.5 py-0.5">
            {v2Progress.stepCount} 步循环
          </span>
          {v2Progress.toolResultCount ? (
            <span className="rounded-full border border-white bg-white/70 px-1.5 py-0.5">
              {v2Progress.toolResultCount} 个工具结果
            </span>
          ) : null}
          {visualObservations.length ? (
            <span className="rounded-full border border-white bg-white/70 px-1.5 py-0.5">
              视觉 {visualObservations.length} 次
            </span>
          ) : null}
          {latestVisualObservation?.confidence ? (
            <span className="min-w-0 max-w-full rounded-full border border-white bg-white/70 px-1.5 py-0.5">
              <span className="block truncate">置信度 {latestVisualObservation.confidence}</span>
            </span>
          ) : null}
          {understanding?.neededCapability ? (
            <span className="min-w-0 max-w-full rounded-full border border-white bg-white/70 px-1.5 py-0.5">
              <span className="block truncate">{understanding.neededCapability}</span>
            </span>
          ) : null}
        </div>
        <PetChatAgentCompactTimeline items={timelineItems} />
      </div>
    );
  }

  const progress = resolveAgentProcessStageProgress(process.stages);
  const stateSummary = resolveAgentProcessStateSummary(process);
  const evidenceCount = countAgentStateSummaryItems(stateSummary);
  const currentStage = progress.currentStage;
  const barClassName = progress.failed
    ? 'bg-rose-400'
    : progress.blocked
      ? 'bg-amber-400'
      : isActive
        ? 'bg-primary'
        : 'bg-emerald-500';

  return (
    <div className="mb-2 rounded-md border border-border bg-muted/45 px-2 py-1.5">
      <div className="mb-1 flex items-center justify-between gap-2 text-2xs">
        <span className="min-w-0 truncate font-semibold text-primary">
          {currentStage ? currentStage.title : statusText}
        </span>
        <span className="shrink-0 text-muted-foreground">
          {progress.total ? `${progress.completed}/${progress.total}` : statusText}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${barClassName}`}
          style={{ width: `${Math.max(6, progress.percent)}%` }}
        />
      </div>
      {summaryText ? (
        <div className="mt-1 line-clamp-2 break-words text-2xs leading-relaxed text-muted-foreground">
          {summaryText}
        </div>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-1 text-2xs text-muted-foreground">
        <span className="rounded-full border border-white bg-white/70 px-1.5 py-0.5">
          {process.plan.steps.length} 个工具步骤
        </span>
        {evidenceCount ? (
          <span className="rounded-full border border-white bg-white/70 px-1.5 py-0.5">
            {evidenceCount} 条状态证据
          </span>
        ) : null}
        {process.rounds?.length ? (
          <span className="rounded-full border border-white bg-white/70 px-1.5 py-0.5">
            {process.rounds.length} 轮
          </span>
        ) : null}
      </div>
      <PetChatAgentCompactTimeline items={timelineItems} />
    </div>
  );
}

function resolveAgentProcessCollapsedSummary(
  process: ChatAgentProcessPanelSource,
  statusText: string,
) {
  const isWaiting = process.status === 'awaiting-approval' || process.status === 'pending';
  const isActive = process.status === 'running' || process.status === 'planned';
  const isProblem = process.status === 'failed' || process.status === 'blocked';
  if (!isWaiting && !isActive && !isProblem) {
    return '';
  }

  const agentRuntime = resolveChatAgentRuntimeContinuation(process);
  if (agentRuntime) {
    const latestStep = agentRuntime.steps[agentRuntime.steps.length - 1] ?? null;
    const summary = isProblem
      ? process.errorText || process.followUpText || latestStep?.summary || statusText
      : isWaiting
        ? process.followUpText || latestStep?.summary || statusText
        : resolveAgentSessionV2CurrentTitle(process, statusText);

    return compactAgentPanelText(summary, 110);
  }

  const urgentStage = resolveAgentProcessCurrentStage(process.stages);
  const urgentSummary = isProblem
    ? process.errorText || process.followUpText || process.assessment?.summary || urgentStage?.summary || statusText
    : isWaiting
      ? process.followUpText || urgentStage?.summary || statusText
      : urgentStage?.title || statusText;

  return compactAgentPanelText(urgentSummary, 110);
}

function resolveAgentApprovalCollapsedSummary(
  approval: NonNullable<ChatMessage['agentApproval']>,
  statusText: string,
) {
  if (approval.status === 'pending') {
    const title = approval.approvalSummary?.title?.trim() ?? '';
    const firstLine = approval.approvalSummary?.lines[0]?.trim() ?? '';
    return compactAgentPanelText(
      (title && firstLine ? `${title}: ${firstLine}` : firstLine)
      ?? `这一步要动到电脑，需要你确认`,
    );
  }

  return resolveAgentProcessCollapsedSummary(approval, statusText);
}

function resolveAgentCollapsedNoticeClassName(status: ChatAgentProcessPanelSource['status']) {
  if (status === 'failed') {
    return 'border-rose-100 bg-rose-50/70 text-rose-700';
  }

  if (status === 'blocked' || status === 'awaiting-approval' || status === 'pending') {
    return 'border-amber-100 bg-amber-50/70 text-amber-800';
  }

  return 'border-border bg-muted/55 text-primary';
}

function shouldShowAgentFollowUpOutsideDetails(process: ChatAgentProcessPanelSource) {
  return process.status === 'blocked'
    || process.status === 'failed'
    || process.status === 'awaiting-approval'
    || process.status === 'pending';
}

function PetChatAgentCollapsedNotice({
  process,
  text,
}: {
  process: ChatAgentProcessPanelSource;
  text: string;
}) {
  if (!text) {
    return null;
  }

  return (
    <div className={`mb-2 rounded-md border px-2 py-1 text-2xs leading-relaxed ${resolveAgentCollapsedNoticeClassName(process.status)}`}>
      <span className="line-clamp-2 break-words">{text}</span>
    </div>
  );
}

function resolveAgentReceiptStatusText(status: ChatAgentExecutionReceipt['status']) {
  switch (status) {
    case 'success':
      return '已验证';
    case 'failed':
      return '失败';
    case 'blocked':
      return '已拦截';
    default:
      return '未验证';
  }
}

function resolveAgentReceiptStatusClassName(status: ChatAgentExecutionReceipt['status']) {
  switch (status) {
    case 'success':
      return 'border-emerald-100 bg-emerald-50 text-emerald-700';
    case 'failed':
      return 'border-rose-100 bg-rose-50 text-rose-700';
    case 'blocked':
      return 'border-amber-100 bg-amber-50 text-amber-700';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

function PetChatAgentExecutionReceipt({
  receipt,
}: {
  receipt?: ChatAgentExecutionReceipt | null;
}) {
  if (!receipt) {
    return null;
  }

  const evidenceLines = [
    receipt.verification ? `验证：${receipt.verification}` : '',
    ...(receipt.evidenceLines ?? []),
  ].filter(Boolean).slice(0, 5);

  return (
    <div className="mt-2 rounded-md border border-emerald-100 bg-emerald-50/45 px-2 py-1.5 text-2xs leading-relaxed text-foreground">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="min-w-0 font-semibold text-emerald-800">
          <span className="break-words">{receipt.title || '执行回执'}</span>
          {receipt.toolName ? <span className="ml-1 font-normal text-emerald-600">({receipt.toolName})</span> : null}
        </span>
        <span className={`shrink-0 rounded-full border px-1.5 py-0.5 ${resolveAgentReceiptStatusClassName(receipt.status)}`}>
          {resolveAgentReceiptStatusText(receipt.status)}
        </span>
      </div>
      {receipt.summaryLines.length ? (
        <ul className="space-y-0.5">
          {receipt.summaryLines.slice(0, 5).map((line, index) => (
            <li key={`receipt-summary-${index}`} className="break-words">
              {line}
            </li>
          ))}
        </ul>
      ) : null}
      {evidenceLines.length ? (
        <div className="mt-1 space-y-0.5 border-t border-emerald-100 pt-1 text-emerald-700">
          {evidenceLines.map((line, index) => (
            <div key={`receipt-evidence-${index}`} className="break-words">
              {line}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PetChatAgentStateSummaryPanel({
  stateSummary,
}: {
  stateSummary?: ChatAgentExecutionReceipt['stateSummary'];
}) {
  if (!stateSummary || countAgentStateSummaryItems(stateSummary) === 0) {
    return null;
  }

  const structuredEvidenceLines = createAgentStructuredEvidenceLines(stateSummary);
  const inputReplayPreview = stateSummary.structuredEvidence?.inputReplayPreview ?? null;
  const groups = [
    {
      items: stateSummary.observedState,
      label: '观察',
      tone: 'border-border bg-muted/50 text-primary',
    },
    {
      items: structuredEvidenceLines,
      label: 'Structured',
      tone: 'border-indigo-100 bg-indigo-50/50 text-indigo-800',
    },
    {
      items: stateSummary.changedState,
      label: '变更',
      tone: 'border-emerald-100 bg-emerald-50/55 text-emerald-800',
    },
    {
      items: stateSummary.verificationEvidence,
      label: '验证',
      tone: 'border-violet-100 bg-violet-50/55 text-violet-800',
    },
    {
      items: stateSummary.missingEvidence,
      label: '缺失',
      tone: 'border-amber-100 bg-amber-50/60 text-amber-800',
    },
    {
      items: stateSummary.recommendedRecovery,
      label: '恢复',
      tone: 'border-border bg-muted text-foreground',
    },
  ].filter((group) => group.items?.length);

  return (
    <div className="mt-2 rounded-md border border-border bg-white/85 px-2 py-1.5 text-2xs leading-relaxed text-foreground">
      <div className="mb-1 font-semibold text-foreground">状态证据</div>
      <div className="grid gap-1 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.label} className={`min-w-0 rounded-md border px-2 py-1 ${group.tone}`}>
            <div className="mb-0.5 font-semibold">{group.label}</div>
            <ul className="space-y-0.5">
              {group.items?.slice(0, 4).map((item, index) => (
                <li key={`${group.label}-${index}`} className="break-words">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {inputReplayPreview?.beforeRedDotDataUrl || inputReplayPreview?.afterRedDotDataUrl ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {inputReplayPreview.beforeRedDotDataUrl ? (
            <figure className="min-w-0 overflow-hidden rounded-md border border-rose-100 bg-rose-50/35 p-1">
              <img
                alt="Agent input replay before click"
                className="max-h-40 w-full rounded object-contain"
                src={inputReplayPreview.beforeRedDotDataUrl}
              />
              <figcaption className="mt-1 truncate text-2xs text-rose-700">
                before · {inputReplayPreview.beforeCaptureStatus ?? 'capture_unknown'}
              </figcaption>
            </figure>
          ) : null}
          {inputReplayPreview.afterRedDotDataUrl ? (
            <figure className="min-w-0 overflow-hidden rounded-md border border-rose-100 bg-rose-50/35 p-1">
              <img
                alt="Agent input replay after click"
                className="max-h-40 w-full rounded object-contain"
                src={inputReplayPreview.afterRedDotDataUrl}
              />
              <figcaption className="mt-1 truncate text-2xs text-rose-700">
                after · {inputReplayPreview.afterCaptureStatus ?? 'capture_unknown'}
                {typeof inputReplayPreview.uiChanged === 'boolean' ? ` · changed=${inputReplayPreview.uiChanged}` : ''}
              </figcaption>
            </figure>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function resolveAgentVisualToolLabel(toolName: string) {
  return toolName === 'analyze_game_screen' ? '游戏画面' : '屏幕画面';
}

function PetChatAgentVisualObservationPanel({
  process,
}: {
  process: ChatAgentProcessPanelSource;
}) {
  const visualObservations = resolveAgentVisualObservations(process);
  if (!visualObservations.length) {
    return null;
  }

  const recentObservations = visualObservations.slice(-3).reverse();

  return (
    <div className="mt-2 rounded-md border border-cyan-100 bg-cyan-50/40 px-2 py-1.5 text-2xs leading-relaxed text-foreground">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-semibold text-cyan-900">视觉观察</span>
        <span className="shrink-0 rounded-full border border-cyan-100 bg-white/70 px-1.5 py-0.5 text-cyan-700">
          最近 {recentObservations.length} 次
        </span>
      </div>
      <div className="space-y-1.5">
        {recentObservations.map((observation) => (
          <div key={observation.key} className="rounded-md border border-cyan-100 bg-white/80 px-2 py-1.5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-semibold text-cyan-900">
                {resolveAgentVisualToolLabel(observation.toolName)}
              </span>
              <span className={`shrink-0 rounded-full border px-1.5 py-0.5 ${
                observation.ok
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                  : 'border-rose-100 bg-rose-50 text-rose-700'
              }`}>
                {observation.ok ? '已观察' : '失败'}
              </span>
            </div>
            {observation.source ? (
              <div className="mb-0.5 break-words text-cyan-700">
                来源：{compactAgentPanelText(observation.source, 180)}
              </div>
            ) : null}
            {observation.summary ? (
              <div className="mb-1 break-words text-foreground">
                {compactAgentPanelText(observation.summary, 240)}
              </div>
            ) : null}
            {observation.contentLines.length ? (
              <div className="space-y-0.5 text-muted-foreground">
                {observation.contentLines.slice(0, 4).map((line) => (
                  <div key={line} className="break-words">
                    {compactAgentPanelText(line, 220)}
                  </div>
                ))}
              </div>
            ) : null}
            {observation.visibleTextLines.length ? (
              <div className="mt-1 rounded-md border border-border bg-muted/70 px-2 py-1 text-muted-foreground">
                <span className="mr-1 font-semibold text-muted-foreground">可读文字</span>
                <span className="break-words">{observation.visibleTextLines.slice(0, 4).join(' / ')}</span>
              </div>
            ) : null}
            {observation.confidence || observation.uncertaintyLines.length ? (
              <div className="mt-1 grid gap-1 sm:grid-cols-2">
                {observation.confidence ? (
                  <div className="rounded-md border border-emerald-100 bg-emerald-50/60 px-2 py-1 text-emerald-800">
                    <span className="mr-1 font-semibold">置信度</span>
                    <span>{observation.confidence}</span>
                  </div>
                ) : null}
                {observation.uncertaintyLines.length ? (
                  <div className="rounded-md border border-amber-100 bg-amber-50/70 px-2 py-1 text-amber-800">
                    <div className="mb-0.5 font-semibold">不确定点</div>
                    {observation.uncertaintyLines.slice(0, 3).map((line) => (
                      <div key={line} className="break-words">
                        {compactAgentPanelText(line, 180)}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {observation.recoveryLines.length ? (
              <div className="mt-1 rounded-md border border-border bg-muted/75 px-2 py-1 text-muted-foreground">
                <div className="mb-0.5 font-semibold text-muted-foreground">建议处理</div>
                {observation.recoveryLines.slice(0, 2).map((line) => (
                  <div key={line} className="break-words">
                    {compactAgentPanelText(line, 220)}
                  </div>
                ))}
              </div>
            ) : null}
            {observation.companionCue ? (
              <div className="mt-1 break-words text-cyan-700">
                角色提示：{compactAgentPanelText(observation.companionCue, 180)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function resolveAgentCoreStepPhaseText(phase: NonNullable<ChatAgentProcessPanelSource['corePlanSummary']>['taskSteps'][number]['phase']) {
  switch (phase) {
    case 'observe':
      return '观察';
    case 'plan':
      return '计划';
    case 'execute':
      return '执行';
    case 'verify':
      return '验证';
    case 'recover':
      return '恢复';
    default:
      return '步骤';
  }
}

function PetChatAgentCorePlanSummary({
  summary,
}: {
  summary?: ChatAgentProcessPanelSource['corePlanSummary'];
}) {
  if (!summary?.taskSteps.length) {
    return null;
  }

  return (
    <div className="mt-2 rounded-md border border-violet-100 bg-violet-50/40 px-2 py-1.5 text-2xs leading-relaxed text-foreground">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-semibold text-violet-800">Agent Core 计划</span>
        <span className="shrink-0 rounded-full border border-violet-100 bg-white/70 px-1.5 py-0.5 text-violet-600">
          {summary.status}
        </span>
      </div>
      <div className="mb-1 break-words text-violet-700">
        {summary.taskSummary}
      </div>
      <div className="space-y-0.5">
        {summary.taskSteps.slice(0, 5).map((step) => (
          <div key={`core-step-${step.index}`} className="flex items-start gap-1.5">
            <span className="shrink-0 font-semibold text-violet-500">
              {step.index}. {resolveAgentCoreStepPhaseText(step.phase)}
            </span>
            <span className="min-w-0 flex-1 break-words">
              {step.tool}
              {step.selected ? <span className="ml-1 text-violet-500">当前</span> : null}
              <span className="ml-1 text-muted-foreground">
                {step.requiresApproval ? '需要确认' : step.permissionStatus}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PetChatAgentSessionV2Summary({
  process,
}: {
  process: ChatAgentProcessPanelSource;
}) {
  const session = resolveChatAgentRuntimeContinuation(process);
  if (!session) {
    return null;
  }

  const latestUnderstanding = resolveAgentSessionV2LatestUnderstanding(session);
  const understandingRows = [
    latestUnderstanding?.userNeed ? ['理解到的需求', latestUnderstanding.userNeed] : null,
    latestUnderstanding?.neededCapability ? ['需要的能力', latestUnderstanding.neededCapability] : null,
    latestUnderstanding?.successCriteria ? ['成功标准', latestUnderstanding.successCriteria] : null,
    latestUnderstanding?.capabilityGap ? ['能力缺口', latestUnderstanding.capabilityGap] : null,
  ].filter(Boolean) as Array<[string, string]>;
  const genericToolResults = session.toolResults.filter((entry) => (
    !isAgentVisualToolName(entry.command.toolCall?.name ?? entry.command.kind)
  ));
  const isLiveAgentRun = process.status === 'running' || process.status === 'planned';
  const timing = session.timing ?? null;
  const slowestTimingEntry = timing?.entries
    .filter((entry) => typeof entry.durationMs === 'number')
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))[0] ?? null;
  const stopReasonText = resolveAgentSessionV2TimingStopReasonText(timing?.stopReason);

  return (
    <div className="mb-3 rounded-md border border-border bg-white/80 p-2 text-2xs leading-relaxed text-foreground">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">处理过程</span>
        <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">
          {session.steps.length} 步
        </span>
      </div>

      {timing ? (
        <div className="mb-2 flex flex-wrap gap-1 text-2xs text-muted-foreground">
          <span className="rounded-full border border-border bg-muted px-1.5 py-0.5">
            总耗时 {formatAgentSessionV2TimingDuration(timing.elapsedMs)}
          </span>
          <span className="rounded-full border border-border bg-muted px-1.5 py-0.5">
            大脑 {timing.modelCallCount} 次 / {formatAgentSessionV2TimingDuration(timing.modelDurationMs)}
          </span>
          <span className="rounded-full border border-border bg-muted px-1.5 py-0.5">
            工具 {timing.toolCallCount} 次 / {formatAgentSessionV2TimingDuration(timing.toolDurationMs)}
          </span>
          {slowestTimingEntry ? (
            <span className="min-w-0 max-w-full rounded-full border border-border bg-muted px-1.5 py-0.5">
              <span className="block truncate">
                最慢 {slowestTimingEntry.label} {formatAgentSessionV2TimingDuration(slowestTimingEntry.durationMs)}
              </span>
            </span>
          ) : null}
          {stopReasonText ? (
            <span className="rounded-full border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-amber-700">
              {stopReasonText}
            </span>
          ) : null}
        </div>
      ) : null}

      {understandingRows.length ? (
        <div className="mb-2 grid gap-1.5 sm:grid-cols-2">
          {understandingRows.map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-md border border-border bg-muted/80 px-2 py-1">
              <div className="mb-0.5 text-2xs font-semibold text-muted-foreground">{label}</div>
              <div className="break-words text-foreground">{compactAgentPanelText(value, 180)}</div>
            </div>
          ))}
        </div>
      ) : null}

      <PetChatAgentVisualObservationPanel process={process} />
      {!isLiveAgentRun ? <PetChatAgentSessionV2TracePanel session={session} /> : null}

      {session.steps.length ? (
        <div className="space-y-1.5">
          {session.steps.slice(-8).map((step) => (
            <div key={`agent-v2-step-${step.index}`} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-2 rounded-md border border-border bg-white/75 px-2 py-1.5">
              <span className="mt-0.5 text-2xs font-semibold text-muted-foreground">{step.index}</span>
              <span className="min-w-0">
                <span className="block break-words font-medium text-foreground">
                  {resolveAgentSessionV2StepTitle(step)}
                </span>
                {step.summary ? (
                  <span className="mt-0.5 block line-clamp-2 break-words text-2xs text-muted-foreground">
                    {compactAgentPanelText(step.summary, 180)}
                  </span>
                ) : null}
                {step.reason ? (
                  <span className="mt-0.5 block line-clamp-2 break-words text-2xs text-muted-foreground">
                    {compactAgentPanelText(step.reason, 160)}
                  </span>
                ) : null}
              </span>
              <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-2xs ${resolveAgentSessionV2StepClassName(step)}`}>
                {step.timing?.durationMs
                  ? `${resolveAgentSessionV2StepStatusText(step)} · ${formatAgentSessionV2TimingDuration(step.timing.durationMs)}`
                  : resolveAgentSessionV2StepStatusText(step)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-border bg-muted px-2 py-1.5 text-2xs text-muted-foreground">
          正在读取当前任务上下文。
        </div>
      )}

      {!isLiveAgentRun && genericToolResults.length ? (
        <div className="mt-2 rounded-md border border-emerald-100 bg-emerald-50/45 px-2 py-1.5">
          <div className="mb-1 text-2xs font-semibold text-emerald-700">工具结果</div>
          <div className="space-y-1">
            {genericToolResults.slice(-4).map((entry, index) => {
              const toolName = entry.command.toolCall?.name ?? entry.command.kind;
              const resultText = entry.result.ok === false
                ? entry.result.errorText ?? entry.result.responseText
                : entry.result.responseText;

              return (
                <div key={`agent-v2-tool-result-${index}-${toolName}`} className="min-w-0 rounded-md border border-emerald-100 bg-white/75 px-2 py-1">
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-semibold text-emerald-800">{toolName}</span>
                    <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-2xs ${
                      entry.result.ok === false
                        ? 'border-rose-100 bg-rose-50 text-rose-700'
                        : 'border-emerald-100 bg-emerald-50 text-emerald-700'
                    }`}>
                      {entry.result.ok === false ? '失败' : '成功'}
                    </span>
                  </div>
                  {resultText ? (
                    <div className="line-clamp-3 break-words text-2xs text-emerald-700">
                      {compactAgentPanelText(resultText, 220)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PetChatAgentProcessSummary({
  process,
}: {
  process: ChatAgentProcessPanelSource;
}) {
  if (resolveChatAgentRuntimeContinuation(process)) {
    return <PetChatAgentSessionV2Summary process={process} />;
  }

  const stateSummary = resolveAgentProcessStateSummary(process);
  const stages = process.stages ?? [];
  const currentStage = resolveAgentProcessCurrentStage(stages);
  const latestTrace = resolveAgentProcessLatestTrace(process.trace);
  const latestRound = process.rounds?.length ? process.rounds[process.rounds.length - 1] : null;
  const completedStageCount = stages.filter((stage) => stage.status === 'completed').length;
  const confirmStepCount = process.plan.steps.filter((step) => (
    step.decision.mode === 'confirm' || step.decision.mode === 'blocked'
  )).length;
  const toolSummary = process.plan.steps.length
    ? process.plan.steps.slice(0, 2).map((step) => step.summary).join('；')
    : '没有需要调用的工具';

  return (
    <div className="mb-3 rounded-md border border-border bg-white/80 p-2 text-2xs leading-relaxed text-foreground">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">处理过程</span>
        {stages.length ? (
          <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">
            阶段 {completedStageCount}/{stages.length}
          </span>
        ) : null}
      </div>
      {currentStage ? (
        <div className="mb-2 rounded-md border border-border bg-muted/80 px-2 py-1.5">
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="mr-1 text-2xs font-semibold text-muted-foreground">当前</span>
              <span className="break-words font-medium text-foreground">{currentStage.title}</span>
            </span>
            <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-2xs ${resolveAgentWorkStageStatusClassName(currentStage.status)}`}>
              {resolveAgentWorkStageStatusText(currentStage.status)}
            </span>
          </div>
          {currentStage.summary ? (
            <div className="mt-0.5 line-clamp-2 break-words text-2xs text-muted-foreground">
              {currentStage.summary}
            </div>
          ) : null}
        </div>
      ) : null}
      {stages.length ? (
        <div className="flex flex-wrap gap-1.5">
          {stages.map((stage, index) => (
            <span
              key={stage.id}
              className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-1 text-2xs ${resolveAgentProcessStageClassName(stage.status)}`}
              title={stage.summary ?? stage.title}
            >
              <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-3xs ${resolveAgentProcessStageDotClassName(stage.status)}`}>
                {stage.status === 'running'
                  ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  : stage.status === 'completed'
                    ? <Check className="h-2.5 w-2.5" />
                    : stage.status === 'failed' || stage.status === 'blocked'
                      ? <X className="h-2.5 w-2.5" />
                      : index + 1}
              </span>
              <span className="truncate">{stage.title}</span>
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1.5 text-2xs">
        <span className="min-w-0 flex-1 basis-[120px] rounded-md border border-border bg-muted px-2 py-1">
          <span className="mr-1 font-semibold text-muted-foreground">工具</span>
          <span className="break-words text-muted-foreground">{process.plan.steps.length} 个：{toolSummary}</span>
        </span>
        <span className="min-w-0 flex-1 basis-[110px] rounded-md border border-border bg-muted px-2 py-1">
          <span className="mr-1 font-semibold text-muted-foreground">权限</span>
          <span className="break-words text-muted-foreground">{confirmStepCount ? `${confirmStepCount} 个需要确认` : '无需额外确认'}</span>
        </span>
        {latestRound ? (
          <span className="min-w-0 flex-1 basis-[120px] rounded-md border border-border bg-muted px-2 py-1">
            <span className="mr-1 font-semibold text-muted-foreground">轮次</span>
            <span className="break-words text-muted-foreground">第 {latestRound.index} 轮：{resolveAgentRoundStatusText(latestRound.status)}</span>
          </span>
        ) : null}
        {latestTrace ? (
          <span className="min-w-0 flex-1 basis-[120px] rounded-md border border-border bg-muted px-2 py-1">
            <span className="mr-1 font-semibold text-muted-foreground">事件</span>
            <span className="break-words text-muted-foreground">{latestTrace.label}</span>
          </span>
        ) : null}
      </div>
      <PetChatAgentCorePlanSummary summary={process.corePlanSummary} />
      <PetChatAgentStateSummaryPanel stateSummary={stateSummary} />
      <PetChatAgentExecutionReceipt receipt={process.receipt} />
    </div>
  );
}

function resolveAgentTraceStatusText(status: ChatAgentRunTraceItem['status']) {
  switch (status) {
    case 'running':
      return '进行中';
    case 'completed':
      return '完成';
    case 'failed':
      return '失败';
    case 'blocked':
      return '停止';
    default:
      return '等待';
  }
}

function resolveAgentTraceStatusClassName(status: ChatAgentRunTraceItem['status']) {
  switch (status) {
    case 'running':
      return 'border-border bg-muted text-primary';
    case 'completed':
      return 'border-emerald-100 bg-emerald-50 text-emerald-700';
    case 'failed':
      return 'border-rose-100 bg-rose-50 text-rose-700';
    case 'blocked':
      return 'border-amber-100 bg-amber-50 text-amber-700';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

function PetChatAgentTraceList({
  trace,
}: {
  trace?: ChatAgentRunTraceItem[];
}) {
  if (!trace?.length) {
    return null;
  }

  return (
    <div className="mb-3 space-y-1.5 rounded-md border border-border/50 bg-muted/45 p-2">
      <div className="mb-1.5 text-2xs font-semibold tracking-normal text-primary">
        执行事件
      </div>
      {trace.map((item) => {
        const isRunning = item.status === 'running';
        return (
          <div key={item.id} className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-2 text-2xs leading-relaxed text-foreground">
            <span className="mt-1 flex h-2.5 w-2.5 items-center justify-center rounded-full border border-border bg-white">
              {isRunning ? <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" /> : null}
            </span>
            <span className="min-w-0">
              <span className="block break-words">{item.label}</span>
              {item.detail ? (
                <span className="mt-0.5 block line-clamp-2 break-words text-2xs text-primary">
                  {item.detail}
                </span>
              ) : null}
            </span>
            <span className={`rounded-full border px-1.5 py-0.5 text-2xs ${resolveAgentTraceStatusClassName(item.status)}`}>
              {resolveAgentTraceStatusText(item.status)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function resolveAgentWorkStageStatusText(status: ChatAgentWorkStage['status']) {
  switch (status) {
    case 'running':
      return '进行中';
    case 'completed':
      return '完成';
    case 'failed':
      return '失败';
    case 'blocked':
      return '停止';
    default:
      return '等待';
  }
}

function resolveAgentWorkStageStatusClassName(status: ChatAgentWorkStage['status']) {
  switch (status) {
    case 'running':
      return 'border-border bg-muted text-primary';
    case 'completed':
      return 'border-emerald-100 bg-emerald-50 text-emerald-700';
    case 'failed':
      return 'border-rose-100 bg-rose-50 text-rose-700';
    case 'blocked':
      return 'border-amber-100 bg-amber-50 text-amber-700';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

function PetChatAgentWorkStageList({
  stages,
}: {
  stages?: ChatAgentWorkStage[];
}) {
  if (!stages?.length) {
    return null;
  }

  return (
    <div className="mb-3 rounded-md border border-border bg-muted/70 p-2">
      <div className="mb-1.5 text-2xs font-semibold tracking-normal text-muted-foreground">
        详细阶段
      </div>
      <div className="space-y-1.5">
        {stages.map((stage, index) => (
          <div key={stage.id} className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-2 text-2xs leading-relaxed text-foreground">
            <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-white text-3xs text-muted-foreground">
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block break-words font-medium">{stage.title}</span>
              {stage.summary ? (
                <span className="mt-0.5 block line-clamp-2 break-words text-2xs text-muted-foreground">
                  {stage.summary}
                </span>
              ) : null}
              {stage.details?.length ? (
                <span className="mt-1 block space-y-0.5 text-2xs leading-relaxed text-muted-foreground">
                  {stage.details.slice(0, 3).map((detail) => (
                    <span key={detail} className="block line-clamp-1 break-words">
                      {detail}
                    </span>
                  ))}
                </span>
              ) : null}
            </span>
            <span className={`rounded-full border px-1.5 py-0.5 text-2xs ${resolveAgentWorkStageStatusClassName(stage.status)}`}>
              {resolveAgentWorkStageStatusText(stage.status)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type ChatAgentAssessment = NonNullable<NonNullable<ChatMessage['agentRun']>['assessment']>;

function resolveAgentAssessmentStatusText(status: ChatAgentAssessment['status']) {
  switch (status) {
    case 'completed':
      return '已验证';
    case 'can-continue':
      return '可继续';
    case 'needs-user':
      return '需补充';
    case 'failed':
      return '失败';
    default:
      return '未复核';
  }
}

function resolveAgentAssessmentStatusClassName(status: ChatAgentAssessment['status']) {
  switch (status) {
    case 'completed':
      return 'border-emerald-100 bg-emerald-50 text-emerald-700';
    case 'can-continue':
      return 'border-amber-100 bg-amber-50 text-amber-700';
    case 'needs-user':
      return 'border-orange-100 bg-orange-50 text-orange-700';
    case 'failed':
      return 'border-rose-100 bg-rose-50 text-rose-700';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

function PetChatAgentAssessmentPanel({
  assessment,
}: {
  assessment?: ChatAgentAssessment | null;
}) {
  if (!assessment) {
    return null;
  }

  return (
    <div className="mb-3 rounded-md border border-border bg-white/70 p-2 text-2xs leading-relaxed text-foreground">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">执行评估</span>
        <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-2xs ${resolveAgentAssessmentStatusClassName(assessment.status)}`}>
          {resolveAgentAssessmentStatusText(assessment.status)}
        </span>
      </div>
      <div className="break-words text-foreground">{assessment.summary}</div>
      {assessment.evidence.length ? (
        <div className="mt-1.5 space-y-0.5 text-2xs text-muted-foreground">
          {assessment.evidence.slice(0, 4).map((evidence) => (
            <div key={evidence} className="line-clamp-2 break-words">
              {evidence}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function resolveAgentRoundStatusText(status: ChatAgentRunLoopRound['status']) {
  switch (status) {
    case 'auto-continued':
      return '已续步';
    case 'awaiting-approval':
      return '待确认';
    case 'needs-user':
      return '需补充';
    case 'failed':
      return '失败';
    case 'blocked':
      return '停止';
    case 'max-rounds':
      return '到上限';
    case 'unverified':
      return '待复查';
    default:
      return '完成';
  }
}

function resolveAgentRoundStatusClassName(status: ChatAgentRunLoopRound['status']) {
  switch (status) {
    case 'completed':
      return 'border-emerald-100 bg-emerald-50 text-emerald-700';
    case 'auto-continued':
      return 'border-border bg-muted text-primary';
    case 'awaiting-approval':
    case 'needs-user':
    case 'max-rounds':
      return 'border-amber-100 bg-amber-50 text-amber-700';
    case 'failed':
      return 'border-rose-100 bg-rose-50 text-rose-700';
    case 'blocked':
      return 'border-orange-100 bg-orange-50 text-orange-700';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

function PetChatAgentRunRoundsPanel({
  rounds,
}: {
  rounds?: ChatAgentRunLoopRound[];
}) {
  if (!rounds?.length) {
    return null;
  }

  return (
    <div className="mb-3 rounded-md border border-indigo-100 bg-indigo-50/45 p-2 text-2xs leading-relaxed text-indigo-950">
      <div className="mb-1.5 text-2xs font-semibold tracking-normal text-indigo-500">
        执行轮次
      </div>
      <div className="space-y-1.5">
        {rounds.map((round) => (
          <div key={`${round.index}-${round.actionLabel}`} className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-start gap-2">
            <span className="rounded-full border border-indigo-100 bg-white px-1.5 py-0.5 text-2xs text-indigo-600">
              第 {round.index} 轮
            </span>
            <span className="min-w-0">
              <span className="block break-words font-medium">{round.actionLabel}</span>
              {round.assessmentSummary ? (
                <span className="mt-0.5 block line-clamp-2 break-words text-2xs text-indigo-700">
                  {round.assessmentSummary}
                </span>
              ) : null}
              <span className="mt-0.5 block line-clamp-2 break-words text-2xs text-indigo-500">
                {round.stopReason}
              </span>
            </span>
            <span className={`rounded-full border px-1.5 py-0.5 text-2xs ${resolveAgentRoundStatusClassName(round.status)}`}>
              {resolveAgentRoundStatusText(round.status)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PetChatAgentStepList({
  plan,
}: {
  plan: NonNullable<ChatMessage['agentApproval']>['plan'];
}) {
  if (!plan.steps.length) {
    return null;
  }

  return (
    <div className="mb-3 rounded-md border border-border/50 bg-white/75 p-2">
      <div className="mb-1.5 text-2xs font-semibold tracking-normal text-primary">
        工具计划
      </div>
      <div className="space-y-1.5">
        {plan.steps.map((step, index) => (
          <div key={step.id} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-2 text-2xs leading-relaxed text-primary">
            <span className="text-primary/60">{index + 1}</span>
            <span className="min-w-0 break-words">
              <span className="block">{step.summary}</span>
              {step.details?.length ? (
                <span className="mt-1 block space-y-0.5 text-2xs leading-relaxed text-primary">
                  {step.details.map((detail) => (
                    <span key={detail} className="block break-words">
                      {detail}
                    </span>
                  ))}
                </span>
              ) : null}
            </span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-2xs text-primary">
              {resolveAgentApprovalPermissionText(step.decision.mode)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PetChatAgentApprovalSummary({
  summary,
}: {
  summary?: NonNullable<ChatMessage['agentApproval']>['approvalSummary'];
}) {
  if (!summary?.lines.length) {
    return null;
  }

  return (
    <div className="mb-3 rounded-md border border-amber-100 bg-amber-50/70 p-2 text-2xs leading-relaxed text-amber-950">
      <div className="mb-1.5 font-semibold text-amber-900">
        {summary.title}
      </div>
      <div className="space-y-1">
        {summary.lines.slice(0, 5).map((line) => (
          <div key={line} className="break-words">
            {line}
          </div>
        ))}
      </div>
      {summary.warning ? (
        <div className="mt-1.5 rounded-md border border-amber-200 bg-white/65 px-2 py-1 text-2xs text-amber-800">
          {summary.warning}
        </div>
      ) : null}
    </div>
  );
}

function resolveChatAgentFollowUpActions(
  followUpAction?: NonNullable<ChatMessage['agentRun']>['followUpAction'],
  followUpActions?: NonNullable<ChatMessage['agentRun']>['followUpActions'],
) {
  return followUpActions?.length
    ? followUpActions
    : followUpAction
      ? [followUpAction]
      : [];
}

function PetChatAgentFollowUpActionButtons({
  actions,
  onSendMessage,
}: {
  actions?: NonNullable<ChatMessage['agentRun']>['followUpActions'];
  onSendMessage: (
    textOverride?: string,
    options?: DesktopPetChatSendOptions,
  ) => void | Promise<void>;
}) {
  if (!actions?.length) {
    return null;
  }

  const handleClick = (action: NonNullable<ChatMessage['agentRun']>['followUpAction']) => {
    if (action.kind === 'run-command') {
      void onSendMessage(`继续：${action.label}`, {
        agentFollowUpAction: action,
        browserSearchMode: 'block',
      });
      return;
    }

    void onSendMessage(action.prompt, {
      browserSearchMode: 'block',
    });
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1">
      {actions.map((action, index) => (
        <Button
          key={`${action.kind}-${action.label}-${index}`}
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => handleClick(action)}
          className="h-6 max-w-[168px] rounded-full border border-amber-200 bg-white/70 px-2 text-2xs font-medium text-amber-800 hover:bg-white"
          title={action.kind === 'run-command' ? `继续执行：${action.label}` : action.prompt}
        >
          <Play className="mr-1 h-3 w-3 shrink-0" />
          <span className="truncate">{action.label}</span>
        </Button>
      ))}
    </div>
  );
}

function PetChatAgentRunPanel({
  message,
  onSendMessage,
  onStopAgentRun,
}: {
  message: ChatMessage;
  onSendMessage: (
    textOverride?: string,
    options?: DesktopPetChatSendOptions,
  ) => void | Promise<void>;
  onStopAgentRun?: (messageId?: string | null) => void;
}) {
  const run = message.agentRun;
  const isActiveRun = run?.status === 'running' || run?.status === 'planned' || run?.status === 'awaiting-approval';
  const canStopRun = Boolean(message.id && onStopAgentRun && (run?.status === 'running' || run?.status === 'planned'));
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsExpanded(false);
  }, [run?.id]);

  if (!run) {
    return null;
  }

  const statusText = resolveAgentRunStatusText(run.status);
  const shouldShowDetails = isExpanded;
  const collapsedSummary = resolveAgentProcessCollapsedSummary(run, statusText);

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0 text-2xs font-semibold text-foreground">
          <span className="block truncate">正在处理：{run.plan.goal}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-2xs font-medium text-primary">
            {isActiveRun ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            {statusText}
          </span>
          {canStopRun ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onStopAgentRun?.(message.id ?? null)}
              className="h-6 rounded-full border border-rose-100 px-2 text-2xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              title={'\u7ec8\u6b62\u5f53\u524d Agent \u6267\u884c'}
            >
              <StopCircle className="mr-1 h-3 w-3" />
              {'\u7ec8\u6b62'}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded((current) => !current)}
            className="h-6 rounded-full border border-border px-2 text-2xs text-primary hover:bg-muted"
            title={isExpanded ? '收起处理详情' : '展开处理详情'}
          >
            {isExpanded ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
            {isExpanded ? '收起' : '详情'}
          </Button>
        </div>
      </div>
      {!shouldShowDetails ? (
        <PetChatAgentProcessCompact
          process={run}
          statusText={statusText}
          isActive={isActiveRun}
          summaryText={collapsedSummary}
        />
      ) : null}
      {shouldShowDetails ? <PetChatAgentProcessSummary process={run} /> : null}
      {shouldShowDetails ? <PetChatAgentWorkStageList stages={run.stages} /> : null}
      {shouldShowDetails ? <PetChatAgentAssessmentPanel assessment={run.assessment} /> : null}
      {shouldShowDetails ? <PetChatAgentRunRoundsPanel rounds={run.rounds} /> : null}
      {shouldShowDetails ? <PetChatAgentTraceList trace={run.trace} /> : null}
      {shouldShowDetails ? <PetChatAgentStepList plan={run.plan} /> : null}
      {run.resultText && shouldShowDetails && (
        <div className="mt-2 break-words text-2xs leading-relaxed text-primary">
          {run.resultText}
        </div>
      )}
      {run.errorText && shouldShowDetails && (
        <div className="mt-2 break-words text-2xs leading-relaxed text-rose-600">
          {run.errorText}
        </div>
      )}
      {run.followUpText && (shouldShowDetails || shouldShowAgentFollowUpOutsideDetails(run)) && (
        <div className="mt-2 rounded-md border border-amber-100 bg-amber-50 px-2 py-1.5 text-2xs leading-relaxed text-amber-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 flex-1">
              <span className="font-semibold">下一步：</span>
              <span className="break-words">{run.followUpText}</span>
            </span>
            <PetChatAgentFollowUpActionButtons
              actions={resolveChatAgentFollowUpActions(run.followUpAction, run.followUpActions)}
              onSendMessage={onSendMessage}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PetChatAgentApprovalPanel({
  message,
  onResolveAgentApproval,
  onSendMessage,
  onStopAgentRun,
}: {
  message: ChatMessage;
  onResolveAgentApproval?: (messageId: string, decision: ChatAgentApprovalDecision) => void | Promise<void>;
  onSendMessage: (
    textOverride?: string,
    options?: DesktopPetChatSendOptions,
  ) => void | Promise<void>;
  onStopAgentRun?: (messageId?: string | null) => void;
}) {
  const approval = message.agentApproval;
  const messageId = message.id ?? '';
  const isActiveApproval = approval?.status === 'pending' || approval?.status === 'running' || approval?.status === 'awaiting-approval';
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsExpanded(false);
  }, [approval?.id]);

  if (!approval) {
    return null;
  }

  const isPending = approval.status === 'pending';
  const isRunning = approval.status === 'running';
  const shouldShowDetails = isExpanded;
  const canResolve = Boolean(messageId && onResolveAgentApproval && isPending);
  const canStopApproval = Boolean(messageId && onStopAgentRun && isActiveApproval);
  const statusText = resolveAgentApprovalStatusText(approval.status);
  const collapsedSummary = resolveAgentApprovalCollapsedSummary(approval, statusText);
  const pendingPrimaryText = `\u51c6\u5907\u6267\u884c\uff1a${approval.plan.goal}`;
  const pendingHelperText = isPending
    ? '\u786e\u8ba4\u540e\u4f1a\u76f4\u63a5\u6267\u884c\u8fd9\u4e00\u6b65\uff1b\u8be6\u60c5\u53ea\u662f\u7ed9\u4f60\u68c0\u67e5\u7528\u3002'
    : isRunning
      ? '\u6b63\u5728\u6267\u884c\u521a\u624d\u786e\u8ba4\u7684\u64cd\u4f5c\u3002'
      : collapsedSummary;

  const resolveApproval = (decision: ChatAgentApprovalDecision) => {
    if (!canResolve) {
      return;
    }

    void onResolveAgentApproval?.(messageId, decision);
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0 text-2xs font-semibold text-foreground">
          <span className="block truncate">确认这一步：{approval.plan.goal}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-2xs font-medium text-primary">
            {isRunning ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            {statusText}
          </span>
          {canStopApproval ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onStopAgentRun?.(messageId)}
              className="h-6 rounded-full border border-rose-100 px-2 text-2xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              title={'\u7ec8\u6b62\u5f53\u524d Agent \u6267\u884c'}
            >
              <StopCircle className="mr-1 h-3 w-3" />
              {'\u7ec8\u6b62'}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded((current) => !current)}
            className="h-6 rounded-full border border-border px-2 text-2xs text-primary hover:bg-muted"
            title={isExpanded ? '收起处理详情' : '展开处理详情'}
          >
            {isExpanded ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
            {isExpanded ? '收起' : '详情'}
          </Button>
        </div>
      </div>
      {!shouldShowDetails ? (
        <PetChatAgentProcessCompact
          process={approval}
          statusText={statusText}
          isActive={isActiveApproval}
          summaryText={collapsedSummary}
        />
      ) : null}
      {shouldShowDetails ? <PetChatAgentProcessSummary process={approval} /> : null}
      {shouldShowDetails ? <PetChatAgentApprovalSummary summary={approval.approvalSummary} /> : null}
      {shouldShowDetails ? <PetChatAgentWorkStageList stages={approval.stages} /> : null}
      {shouldShowDetails ? <PetChatAgentAssessmentPanel assessment={approval.assessment} /> : null}
      {shouldShowDetails ? <PetChatAgentRunRoundsPanel rounds={approval.rounds} /> : null}
      {shouldShowDetails ? <PetChatAgentTraceList trace={approval.trace} /> : null}
      {shouldShowDetails ? <PetChatAgentStepList plan={approval.plan} /> : null}
      {approval.resultText && approval.status !== 'pending' && shouldShowDetails && (
        <div className="mt-2 break-words text-2xs leading-relaxed text-primary">
          {approval.resultText}
        </div>
      )}
      {approval.errorText && shouldShowDetails && (
        <div className="mt-2 break-words text-2xs leading-relaxed text-rose-600">
          {approval.errorText}
        </div>
      )}
      {approval.followUpText && approval.status !== 'pending' && (shouldShowDetails || shouldShowAgentFollowUpOutsideDetails(approval)) && (
        <div className="mt-2 rounded-md border border-amber-100 bg-amber-50 px-2 py-1.5 text-2xs leading-relaxed text-amber-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 flex-1">
              <span className="font-semibold">下一步：</span>
              <span className="break-words">{approval.followUpText}</span>
            </span>
            <PetChatAgentFollowUpActionButtons
              actions={resolveChatAgentFollowUpActions(approval.followUpAction, approval.followUpActions)}
              onSendMessage={onSendMessage}
            />
          </div>
        </div>
      )}
      {isPending || isRunning ? (
        <div className="mt-2 rounded-md border border-amber-100 bg-amber-50 px-2 py-1.5 text-2xs leading-relaxed text-amber-900">
          <div className="font-semibold">{pendingPrimaryText}</div>
          <div className="mt-0.5 text-2xs text-amber-800">{pendingHelperText}</div>
        </div>
      ) : null}
      {isPending || isRunning ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!canResolve || isRunning}
            onClick={() => resolveApproval('approve')}
            className="h-7 rounded-full bg-primary px-3 text-2xs text-white hover:bg-primary disabled:opacity-70"
            title="允许这一步"
          >
            {isRunning ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
            允许
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canResolve || isRunning}
            onClick={() => resolveApproval('deny')}
            className="h-7 rounded-full border border-border px-3 text-2xs text-primary hover:bg-muted"
            title="拒绝这一步"
          >
            <X className="mr-1 h-3 w-3" />
            拒绝
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function AvatarBadge({
  avatarUrl,
  fallbackText,
  size,
}: {
  avatarUrl: string;
  fallbackText: string;
  size: number;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-white font-semibold text-primary shadow-[0_8px_18px_rgba(148,163,184,0.12)]"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.28)),
      }}
    >
      {avatarUrl ? (
        <img alt="" src={avatarUrl} className="size-full object-cover" draggable={false} />
      ) : (
        <span>{Array.from(fallbackText.trim() || '?')[0]}</span>
      )}
    </div>
  );
}

function PetChatMessageImageAttachments({
  attachments,
}: {
  attachments?: ChatMessageImageAttachment[] | null;
}) {
  const imageAttachments = (attachments ?? [])
    .filter((attachment) => attachment.kind === 'image' && attachment.dataUrl);
  if (imageAttachments.length === 0) {
    return null;
  }

  return (
    <div className={`grid max-w-[260px] gap-2 ${imageAttachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
      {imageAttachments.map((attachment) => (
        <div
          key={attachment.id}
          className="overflow-hidden rounded-xl border border-border bg-muted/40"
          title={attachment.name}
        >
          <img
            alt={attachment.name}
            src={attachment.dataUrl}
            className={imageAttachments.length === 1
              ? 'max-h-64 w-full object-contain'
              : 'h-28 w-28 object-cover'}
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}

function ExpressionContentSegment({ segment }: { segment: ChatMessageExpressionContentSegment }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (segment.expressionKind !== 'image' || !segment.assetId) return () => { active = false; };
    void expressionLibraryBridge.getPreview(segment.assetId).then((result) => {
      if (active && result.ok && result.dataUrl) setDataUrl(result.dataUrl);
      if (active && !result.ok) {
        pushFrontendRuntimeLog('expression-reply', 'image expression preview unavailable', {
          assetId: segment.assetId,
          error: result.error,
          rootId: segment.rootSnapshot?.id,
        });
      }
    });
    return () => { active = false; };
  }, [segment.assetId, segment.expressionKind]);

  if (segment.expressionKind !== 'image') {
    return <span className="mx-0.5 inline-block text-base leading-none" title={segment.expressionKind === 'emoji' ? '系统 Emoji' : '颜文字'}>{segment.value}</span>;
  }
  if (!dataUrl) return null;
  return (
    <img
      alt={segment.categorySnapshot?.name || '图片表情'}
      className="my-2 max-h-40 max-w-[220px] rounded-xl border border-border bg-muted/30 object-contain"
      draggable={false}
      src={dataUrl}
      title={`${segment.categorySnapshot?.name ?? '图片表情'}${segment.categorySnapshot?.description ? `：${segment.categorySnapshot.description}` : ''}`}
    />
  );
}

function OrderedMessageContent({
  color,
  content,
  messageKey,
}: {
  color: string;
  content: ChatMessageContentSegment[];
  messageKey: string;
}) {
  return content.map((segment, index) => segment.kind === 'expression'
    ? <ExpressionContentSegment key={`${messageKey}-expression-${segment.expressionId}-${index}`} segment={segment} />
    : (
      <Fragment key={`${messageKey}-content-text-${index}`}>
        {splitMessageTextByBrackets(segment.text).map((part, partIndex) => (
          <span key={`${messageKey}-content-text-${index}-${partIndex}`} style={!part.isBracketContent ? { color } : undefined}>{part.text}</span>
        ))}
      </Fragment>
    ));
}

function PetChatConversationMessageBubbleComponent({
  chatBracketOuterTextColor,
  config,
  embeddedStoryNarration = false,
  message,
  messageKey,
  onPlayMessageVoice,
  onResolveAgentApproval,
  onSaveMessageToMemory,
  onSendMessage,
  onStopAgentRun,
  showVoiceOutputStatus = false,
}: PetChatConversationMessageBubbleProps) {
  const messageContainerRef = useRef<HTMLDivElement | null>(null);
  const memoryMenuRef = useRef<HTMLDivElement | null>(null);
  const textSegments = splitMessageTextByBrackets(message.text);
  const hasMessageText = message.text.trim().length > 0;
  const canSaveMemory = Boolean(onSaveMessageToMemory && message.text.trim());
  const showAvatars = config.settings.chatAvatarsEnabled;
  const avatarDisplaySize = resolveChatAvatarDisplaySize(config);
  const avatarUrl = resolveChatMessageAvatarUrl(config, message);
  const avatarFallbackText = resolveAvatarFallbackText(message, config);
  const messageLabel = resolveConversationMessageLabel(message, config);
  const isModelMessage = message.role === 'model';
  const hasOrderedContent = isModelMessage && Boolean(message.content?.length);
  const isNarration = message.storyMessageKind === 'narration';
  const hasVoicePlaybackHandler = Boolean(onPlayMessageVoice);
  const shouldShowVoiceOutputStatus = Boolean(
    showVoiceOutputStatus
      && isModelMessage
      && !isNarration
      && resolveModelMessagePetId(message),
  );
  const [isManualPlaybackPending, setIsManualPlaybackPending] = useState(false);
  const [isMemoryMenuOpen, setIsMemoryMenuOpen] = useState(false);
  const [memoryMenuPosition, setMemoryMenuPosition] = useState<MemoryMenuPosition>({ x: 0, y: 0 });
  const isVoicePlaybackActive = shouldShowVoiceOutputStatus || isManualPlaybackPending;

  useEffect(() => {
    if (!isMemoryMenuOpen) {
      return;
    }

    const closeMenu = () => setIsMemoryMenuOpen(false);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };
    const closeAfterLeavingMessageAndMenu = (event: PointerEvent) => {
      const isInsideMessage = isPointInsideElement(messageContainerRef.current, event.clientX, event.clientY);
      const isInsideMenu = isPointInsideElement(memoryMenuRef.current, event.clientX, event.clientY);

      if (!isInsideMessage && !isInsideMenu) {
        closeMenu();
      }
    };

    window.addEventListener('pointerdown', closeMenu);
    window.addEventListener('pointermove', closeAfterLeavingMessageAndMenu);
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('pointermove', closeAfterLeavingMessageAndMenu);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isMemoryMenuOpen]);

  const saveMessageToMemory = (target: ChatMemorySaveTarget, groupId?: string) => {
    onSaveMessageToMemory?.(message, target, groupId);
    setIsMemoryMenuOpen(false);
  };

  const handlePlayMessageVoice = async () => {
    if (!onPlayMessageVoice || isManualPlaybackPending) {
      return;
    }

    setIsManualPlaybackPending(true);

    try {
      const playbackResult = onPlayMessageVoice(message.text);

      if (isPromiseLike(playbackResult)) {
        await playbackResult;
      } else {
        await new Promise((resolve) => {
          window.setTimeout(resolve, 280);
        });
      }
    } finally {
      setIsManualPlaybackPending(false);
    }
  };

  return (
    <div
      key={messageKey}
      className={isNarration
        ? 'flex w-full justify-center'
        : `flex max-w-[92%] items-end gap-2 ${message.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}
    >
      {showAvatars && !isNarration && (
        <AvatarBadge avatarUrl={avatarUrl} fallbackText={avatarFallbackText} size={avatarDisplaySize} />
      )}
      <div
        ref={messageContainerRef}
        className={`relative min-w-0 flex flex-col ${isNarration ? 'w-full max-w-4xl items-center' : message.role === 'user' ? 'items-end' : 'items-start'}`}
      >
        <div
          className={isNarration
            ? embeddedStoryNarration
              ? 'relative w-full px-6 py-5 text-left text-[15px] font-normal not-italic leading-8 text-foreground'
              : 'relative w-full rounded-2xl border border-border bg-white/95 px-6 py-5 text-left text-[15px] font-normal not-italic leading-8 text-foreground shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur-sm'
            : 'relative w-fit max-w-full rounded-[20px] border border-border bg-white px-4 py-3 text-xs font-medium leading-relaxed text-foreground shadow-[0_10px_24px_rgba(148,163,184,0.08)]'}
          style={isNarration && embeddedStoryNarration ? undefined
            : resolveChatBubbleBackgroundStyle(config.settings.chatBubbleTransparency, isNarration ? 0.95 : 1)}
          onContextMenu={(event) => {
            if (!canSaveMemory) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
            setMemoryMenuPosition(clampMemoryMenuPosition(event.clientX, event.clientY));
            setIsMemoryMenuOpen(true);
          }}
          title={canSaveMemory ? '右键可保存到记忆库' : undefined}
        >
          {!isNarration && <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-border pb-2 text-2xs tracking-[0.12em] text-primary">
            <span className="font-semibold">{messageLabel}</span>
            {isModelMessage && !isNarration ? (
              hasVoicePlaybackHandler ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isVoicePlaybackActive}
                  onClick={() => void handlePlayMessageVoice()}
                  className={`h-6 rounded-full border px-2 text-2xs tracking-[0.08em] transition-colors ${
                    isVoicePlaybackActive
                      ? 'border-primary/40 bg-primary/10 text-foreground'
                      : 'border-border bg-muted text-primary hover:bg-primary/10 hover:text-foreground'
                  } disabled:opacity-100`}
                  title={isVoicePlaybackActive ? '当前正在播放语音' : '播放这条回复语音'}
                >
                  {isVoicePlaybackActive ? (
                    <>
                      <Volume2 className="mr-1 h-3 w-3 animate-pulse" />
                      <span className="inline-flex items-center">
                        语音播放
                        <VoicePlaybackDots />
                      </span>
                    </>
                  ) : (
                    <>
                      <Play className="mr-1 h-3 w-3" />
                      播放语音
                    </>
                  )}
                </Button>
              ) : (
                <PetChatConversationVoiceUnavailableStatus />
              )
            ) : null}
          </div>}
          <PetChatMessageImageAttachments attachments={message.attachments} />
          {(hasMessageText || hasOrderedContent) && (
            <div
              className={`whitespace-pre-wrap break-words ${message.attachments?.length ? 'mt-2' : ''}`}
              style={resolveChatMessageTextStyle(config.settings.chatFontSize, config.settings.chatFontWeight)}
            >
              {isNarration ? (
                <StoryNarrativeText
                  dialogueColor={chatBracketOuterTextColor}
                  text={message.text}
                />
              ) : hasOrderedContent ? (
                <OrderedMessageContent color={chatBracketOuterTextColor} content={message.content!} messageKey={messageKey} />
              ) : textSegments.map((segment, index) => (
                <Fragment key={`${messageKey}-segment-${index}`}>
                  <span style={!segment.isBracketContent && isModelMessage
                    ? { color: chatBracketOuterTextColor }
                    : undefined}
                  >{segment.text}</span>
                </Fragment>
              ))}
            </div>
          )}
          <PetChatAgentApprovalPanel
            message={message}
            onResolveAgentApproval={onResolveAgentApproval}
            onSendMessage={onSendMessage}
            onStopAgentRun={onStopAgentRun}
          />
          {!message.agentApproval ? (
            <PetChatAgentRunPanel
              message={message}
              onSendMessage={onSendMessage}
              onStopAgentRun={onStopAgentRun}
            />
          ) : null}
        </div>
        {canSaveMemory && isMemoryMenuOpen && (
          <div
            ref={memoryMenuRef}
            className="fixed z-max flex gap-1 rounded-full border border-border bg-white/95 p-1 shadow-[0_14px_30px_rgba(148,163,184,0.16)]"
            style={{
              left: memoryMenuPosition.x,
              top: memoryMenuPosition.y,
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {message.chatMode === 'group' ? (
              <>
                <GroupMemoryCandidateSaveButton
                  onSave={() => saveMessageToMemory('groupMemoryCandidate')}
                />
                <GroupMemorySaveButton
                  onSave={(groupId) => saveMessageToMemory('groupMemory', groupId)}
                  repository={config.groupMemoryRepository}
                />
              </>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => saveMessageToMemory('roleMemory')}
              className="h-7 rounded-full px-2 text-2xs text-primary hover:bg-muted hover:text-foreground"
              title="存入角色记忆库"
            >
              <Brain className="mr-1 h-3 w-3" />
              角色记忆
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => saveMessageToMemory('chatMemory')}
              className="h-7 rounded-full px-2 text-2xs text-primary hover:bg-muted hover:text-foreground"
              title="存入聊天记忆库"
            >
              <MessageSquareText className="mr-1 h-3 w-3" />
              聊天记忆
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export const PetChatConversationMessageBubble = memo(PetChatConversationMessageBubbleComponent);
PetChatConversationMessageBubble.displayName = 'PetChatConversationMessageBubble';
