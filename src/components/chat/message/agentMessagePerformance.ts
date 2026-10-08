import { formatAgentSessionV2TimingDuration } from './agentMessageProgress';
import { type ChatAgentSessionV2PerformanceSignalSummary, type ChatAgentSessionV2Process } from './agentMessageTypes';

function countAgentSessionV2TimingEntries(
  session: ChatAgentSessionV2Process,
  status: string,
) {
  return (session.timing?.entries ?? []).filter((entry) => entry.status === status).length;
}

export function resolveAgentSessionV2PerformanceSignals(
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
