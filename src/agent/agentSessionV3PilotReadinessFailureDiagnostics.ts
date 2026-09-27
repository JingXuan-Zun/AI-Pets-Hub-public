import { type AgentSessionV3PilotExternalReadinessCalibrationResult } from './agentSessionV3PilotExternalReadinessCalibration';

export type AgentSessionV3PilotReadinessFailureDiagnosticsStatus =
  | 'clean'
  | 'empty'
  | 'has-failures';

export interface CreateAgentSessionV3PilotReadinessFailureDiagnosticsOptions {
  calibration: AgentSessionV3PilotExternalReadinessCalibrationResult;
  maxLabelsPerCheck?: number;
}

export interface AgentSessionV3PilotReadinessFailureDiagnosticsEntry {
  failedCheckKeys: string[];
  failedCheckReasons: string[];
  label: string | null;
  status: AgentSessionV3PilotExternalReadinessCalibrationResult['entries'][number]['status'];
}

export interface AgentSessionV3PilotReadinessFailureDiagnosticsCheckSummary {
  failedCount: number;
  key: string;
  maxActual: number;
  maxRequired: number | null;
  sampleLabels: (string | null)[];
}

export interface AgentSessionV3PilotReadinessFailureDiagnosticsResult {
  calibrationStatus: AgentSessionV3PilotExternalReadinessCalibrationResult['status'];
  checkSummaries: AgentSessionV3PilotReadinessFailureDiagnosticsCheckSummary[];
  entryCount: number;
  failedCheckCount: number;
  failedEntries: AgentSessionV3PilotReadinessFailureDiagnosticsEntry[];
  failedEntryCount: number;
  kind: 'agent-session-v3-pilot-readiness-failure-diagnostics';
  status: AgentSessionV3PilotReadinessFailureDiagnosticsStatus;
  summaryText: string;
  version: 1;
}

function getAgentSessionV3PilotReadinessFailureDiagnosticsLabelLimit(
  limit: number | undefined,
) {
  if (limit === undefined) {
    return Number.POSITIVE_INFINITY;
  }

  if (!Number.isFinite(limit) || limit < 0) {
    return 0;
  }

  return Math.floor(limit);
}

function getAgentSessionV3PilotReadinessFailureDiagnosticsStatus(options: {
  entryCount: number;
  failedEntryCount: number;
}): AgentSessionV3PilotReadinessFailureDiagnosticsStatus {
  if (options.entryCount === 0) {
    return 'empty';
  }

  if (options.failedEntryCount > 0) {
    return 'has-failures';
  }

  return 'clean';
}

function createAgentSessionV3PilotReadinessFailureDiagnosticsSummaryText(options: {
  checkSummaries: readonly AgentSessionV3PilotReadinessFailureDiagnosticsCheckSummary[];
  entryCount: number;
  failedCheckCount: number;
  failedEntryCount: number;
  status: AgentSessionV3PilotReadinessFailureDiagnosticsStatus;
}) {
  const topCheck = options.checkSummaries[0];
  return [
    `AgentSessionV3PilotReadinessFailureDiagnostics status=${options.status}`,
    `entries=${options.entryCount}`,
    `failedEntries=${options.failedEntryCount}`,
    `failedChecks=${options.failedCheckCount}`,
    `top=${topCheck ? `${topCheck.key}:${topCheck.failedCount}` : 'none'}`,
  ].join(' ');
}

export function createAgentSessionV3PilotReadinessFailureDiagnostics(
  options: CreateAgentSessionV3PilotReadinessFailureDiagnosticsOptions,
): AgentSessionV3PilotReadinessFailureDiagnosticsResult {
  const failedEntries: AgentSessionV3PilotReadinessFailureDiagnosticsEntry[] = [];
  const checkSummaryMap = new Map<string, AgentSessionV3PilotReadinessFailureDiagnosticsCheckSummary>();
  const labelLimit = getAgentSessionV3PilotReadinessFailureDiagnosticsLabelLimit(options.maxLabelsPerCheck);
  let failedCheckCount = 0;

  for (const entry of options.calibration.entries) {
    const failedChecks = entry.readiness.checks.filter((check) => !check.passed);
    if (!failedChecks.length) {
      continue;
    }

    failedCheckCount += failedChecks.length;
    failedEntries.push({
      failedCheckKeys: failedChecks.map((check) => check.key),
      failedCheckReasons: failedChecks.map((check) => check.reason),
      label: entry.label,
      status: entry.status,
    });

    for (const check of failedChecks) {
      const existing = checkSummaryMap.get(check.key);
      if (existing) {
        existing.failedCount += 1;
        existing.maxActual = Math.max(existing.maxActual, check.actual);
        existing.maxRequired = check.required === undefined
          ? existing.maxRequired
          : Math.max(existing.maxRequired ?? check.required, check.required);
        if (existing.sampleLabels.length < labelLimit) {
          existing.sampleLabels.push(entry.label);
        }
        continue;
      }

      checkSummaryMap.set(check.key, {
        failedCount: 1,
        key: check.key,
        maxActual: check.actual,
        maxRequired: check.required ?? null,
        sampleLabels: labelLimit > 0 ? [entry.label] : [],
      });
    }
  }

  const checkSummaries = [...checkSummaryMap.values()].sort((left, right) => (
    right.failedCount - left.failedCount
      || left.key.localeCompare(right.key)
  ));
  const status = getAgentSessionV3PilotReadinessFailureDiagnosticsStatus({
    entryCount: options.calibration.entries.length,
    failedEntryCount: failedEntries.length,
  });

  return {
    calibrationStatus: options.calibration.status,
    checkSummaries,
    entryCount: options.calibration.entries.length,
    failedCheckCount,
    failedEntries,
    failedEntryCount: failedEntries.length,
    kind: 'agent-session-v3-pilot-readiness-failure-diagnostics',
    status,
    summaryText: createAgentSessionV3PilotReadinessFailureDiagnosticsSummaryText({
      checkSummaries,
      entryCount: options.calibration.entries.length,
      failedCheckCount,
      failedEntryCount: failedEntries.length,
      status,
    }),
    version: 1,
  };
}
