import { type ChatAgentWorkStage } from '../../../types';
import { resolveChatAgentRuntimeContinuation } from '../chatAgentRuntimeCompatibility';
import { resolveAgentProcessCurrentStage, resolveAgentSessionV2StepTitle } from './agentMessageProgress';
import { type ChatAgentCompactTimelineItem, type ChatAgentProcessPanelSource, type ChatAgentSessionV2ProcessStep } from './agentMessageTypes';

export function resolveAgentProcessStageProgress(stages?: ChatAgentWorkStage[]) {
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

export function resolveAgentProcessCompactTimeline(process: ChatAgentProcessPanelSource): ChatAgentCompactTimelineItem[] {
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

export function resolveAgentCompactTimelineDotClassName(status: ChatAgentCompactTimelineItem['status']) {
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
