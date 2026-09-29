export type AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageSource =
  | 'operator-checklist-json'
  | 'readiness-rollup-json'
  | 'review-summary-json';

export interface AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation {
  entryCount: number;
  statusCounts: Record<string, number>;
  statuses: string[];
}

const KNOWN_STATUS_ORDER = [
  'clean',
  'needs-review',
  'unavailable',
];

function objectRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function phaseCoverageRecord(value: unknown) {
  const record = objectRecord(value);

  return record && typeof record.status === 'string'
    ? record
    : null;
}

function phaseCoverageRecordFromEntry(entry: unknown) {
  return phaseCoverageRecord(objectRecord(entry)?.phaseCoverageCounts);
}

function orderedStatuses(statusCounts: Record<string, number>) {
  const knownStatuses = KNOWN_STATUS_ORDER.filter((status) => statusCounts[status] !== undefined);
  const extraStatuses = Object.keys(statusCounts)
    .filter((status) => !KNOWN_STATUS_ORDER.includes(status))
    .sort();

  return [
    ...knownStatuses,
    ...extraStatuses,
  ];
}

function createObservation(
  phaseCoverageRecords: readonly Record<string, unknown>[],
): AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation {
  const statusCounts: Record<string, number> = {};

  for (const record of phaseCoverageRecords) {
    const status = String(record.status);
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
  }

  return {
    entryCount: phaseCoverageRecords.length,
    statusCounts,
    statuses: orderedStatuses(statusCounts),
  };
}

export function createAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation(options: {
  source: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageSource;
  value: Record<string, unknown> | null;
}): AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation | null {
  if (!options.value) {
    return null;
  }

  if (options.source === 'review-summary-json') {
    const entries = Array.isArray(options.value.intakeEntries)
      ? options.value.intakeEntries
      : [];

    return createObservation(
      entries
        .map(phaseCoverageRecordFromEntry)
        .filter((entry): entry is Record<string, unknown> => Boolean(entry)),
    );
  }

  if (options.source === 'readiness-rollup-json') {
    const entries = Array.isArray(options.value.entries)
      ? options.value.entries
      : [];

    return createObservation(
      entries
        .map(phaseCoverageRecordFromEntry)
        .filter((entry): entry is Record<string, unknown> => Boolean(entry)),
    );
  }

  const evidenceSummary = objectRecord(options.value.evidenceSummary);
  const operatorChecklistPhaseCoverage = phaseCoverageRecord(evidenceSummary?.phaseCoverageCounts);

  return createObservation(operatorChecklistPhaseCoverage ? [operatorChecklistPhaseCoverage] : []);
}

export function formatAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation(
  observation: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation | null,
) {
  if (!observation) {
    return 'n/a';
  }

  return observation.statuses.length
    ? observation.statuses.map((status) => `${status}:${observation.statusCounts[status]}`).join(',')
    : 'none';
}
