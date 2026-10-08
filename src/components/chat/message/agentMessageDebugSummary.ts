import { resolveAgentSessionV2PerformanceSignals } from './agentMessagePerformance';
import { compactAgentPanelText } from './agentMessageProgress';
import { getAgentSessionV2PanelActionEvidence } from './agentMessageStuckSignals';
import { resolveAgentSessionV2TraceDetailPairs } from './agentMessageTraceFormatting';
import { type ChatAgentSessionV2Process, type ChatAgentSessionV2StuckSignalSummary, resolveLatestAgentRuntimeDiagnosticEvent } from './agentMessageTypes';

export function createAgentSessionV2TraceDebugSummary(
  session: ChatAgentSessionV2Process,
  stuckSignals: ChatAgentSessionV2StuckSignalSummary[],
) {
  const performanceSignals = resolveAgentSessionV2PerformanceSignals(session);
  const latestRuntimeShadow = resolveLatestAgentRuntimeDiagnosticEvent(session);
  const taskState = session.taskState;
  const taskStateLines = taskState ? [
    `taskId=${taskState.taskId}`,
    `runId=${taskState.runId ?? 'unavailable'}`,
    `revision=${taskState.revision}`,
    `state=${taskState.state}`,
    `phase=${taskState.phase}`,
    `modelIterationCount=${taskState.modelIterationCount}`,
    `modelIterationLimit=${taskState.modelIterationLimit}`,
    `recoveryAttemptCount=${taskState.recoveryAttemptCount}`,
    `recoveryLimit=${taskState.recoveryLimit}`,
    `startedAt=${taskState.startedAt}`,
    `updatedAt=${taskState.updatedAt}`,
  ] : [];
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
    'Task Runtime:',
    taskStateLines.length ? taskStateLines.join('\n') : 'unavailable',
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
