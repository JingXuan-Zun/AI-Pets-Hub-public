import { type ChatAgentRunTraceItem, type ChatAgentWorkStage } from '../../../types';
import { resolveChatAgentRuntimeContinuation } from '../chatAgentRuntimeCompatibility';
import { type ChatAgentProcessPanelSource, type ChatAgentSessionV2Process, type ChatAgentSessionV2ProcessStep } from './agentMessageTypes';

export function resolveAgentProcessStageClassName(status: ChatAgentWorkStage['status']) {
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

export function resolveAgentProcessStageDotClassName(status: ChatAgentWorkStage['status']) {
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

export function resolveAgentProcessCurrentStage(stages?: ChatAgentWorkStage[]) {
  if (!stages?.length) {
    return null;
  }

  return stages.find((stage) => stage.status === 'failed' || stage.status === 'blocked')
    ?? stages.find((stage) => stage.status === 'running')
    ?? stages.find((stage) => stage.status === 'pending')
    ?? stages[stages.length - 1]
    ?? null;
}

export function resolveAgentProcessLatestTrace(trace?: ChatAgentRunTraceItem[]) {
  if (!trace?.length) {
    return null;
  }

  return trace.find((item) => item.status === 'running')
    ?? [...trace].reverse().find((item) => item.status !== 'pending')
    ?? trace[0]
    ?? null;
}

export function compactAgentPanelText(text?: string | null, maxLength = 132) {
  const normalizedText = text?.replace(/\s+/gu, ' ').trim() ?? '';
  if (normalizedText.length <= maxLength) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function resolveAgentSessionV2LatestUnderstanding(session?: ChatAgentSessionV2Process | null) {
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

export function resolveAgentSessionV2StepTitle(step: ChatAgentSessionV2ProcessStep) {
  const actionText = resolveAgentSessionV2ActionText(step.action);
  return step.tool ? `${actionText}: ${step.tool}` : actionText;
}

export function resolveAgentSessionV2StepStatusText(step: ChatAgentSessionV2ProcessStep) {
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

export function resolveAgentSessionV2StepClassName(step: ChatAgentSessionV2ProcessStep) {
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

export function formatAgentSessionV2TimingDuration(ms?: number | null) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) {
    return '0ms';
  }

  if (ms >= 1000) {
    const seconds = ms / 1000;
    return `${seconds >= 10 ? Math.round(seconds) : seconds.toFixed(1)}s`;
  }

  return `${Math.max(0, Math.round(ms))}ms`;
}

export function resolveAgentSessionV2TimingStopReasonText(reason?: string | null) {
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

export function resolveAgentSessionV2CurrentTitle(
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

export function resolveAgentSessionV2Progress(process: ChatAgentProcessPanelSource) {
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

export function resolveAgentProcessStateSummary(process: ChatAgentProcessPanelSource) {
  return process.receipt?.stateSummary ?? process.context?.stateSummary ?? null;
}
