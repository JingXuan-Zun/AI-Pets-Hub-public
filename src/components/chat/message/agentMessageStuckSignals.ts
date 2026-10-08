import { compactAgentPanelText } from './agentMessageProgress';
import { stableAgentSessionV2PanelJson } from './agentMessageTraceFormatting';
import { type ChatAgentSessionV2Process, type ChatAgentSessionV2StuckSignalSummary, type ChatAgentSessionV2StuckSignalTone, type ChatAgentSessionV2ToolResultEntry } from './agentMessageTypes';

export function getAgentSessionV2PanelActionEvidence(entry: ChatAgentSessionV2ToolResultEntry) {
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

export function resolveAgentSessionV2StuckSignalClassName(tone: ChatAgentSessionV2StuckSignalTone) {
  switch (tone) {
    case 'rose':
      return 'border-rose-100 bg-rose-50 text-rose-700';
    case 'sky':
      return 'border-border bg-muted text-primary';
    default:
      return 'border-amber-100 bg-amber-50 text-amber-700';
  }
}

export function resolveAgentSessionV2TraceStuckSignals(
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
