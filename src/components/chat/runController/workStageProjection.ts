import { type ChatAgentWorkStage, type ChatAgentWorkStageId, type ChatAgentWorkStageStatus } from '../../../types';
import { type AgentChatCommandResult, resolveAgentResultFollowUpActions, createAgentDecisionSummary } from '../../../agent';
import { type AgentRunControllerAutoContinuationStartEvent } from './controllerTypes';
import { resolveAgentReceiptStatus } from './executionReceipt';
import { AGENT_STOPPED_DETAIL_TEXT } from './stoppedText';

export function updateAgentWorkStage(
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

export function markAgentWorkStageToolsRunning(stages: ChatAgentWorkStage[] | undefined) {
  return updateAgentWorkStage(
    stages,
    'execute-tools',
    'running',
    '正在调用本机能力',
  );
}

export function completeAgentWorkStagesWithResult(
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

export function finalizePersonaWorkStage(stages: ChatAgentWorkStage[] | undefined) {
  return updateAgentWorkStage(stages, 'persona-reply', 'completed', '角色回复完成');
}

export function stopPendingAgentWorkStages(stages: ChatAgentWorkStage[] | undefined) {
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
