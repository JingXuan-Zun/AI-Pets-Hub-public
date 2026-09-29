import {
  type AgentSessionV3PilotReadinessFailureDiagnosticsCheckSummary,
  type AgentSessionV3PilotReadinessFailureDiagnosticsResult,
} from './agentSessionV3PilotReadinessFailureDiagnostics';

export const AGENT_SESSION_V3_PILOT_PHASE_COVERAGE_READINESS_CHECK_KEYS = [
  'full-phase-coverage',
  'min-terminal-observed-shadow-samples',
  'no-missing-phase-coverage',
] as const;

export type AgentSessionV3PilotPhaseCoverageReadinessCheckKey =
  typeof AGENT_SESSION_V3_PILOT_PHASE_COVERAGE_READINESS_CHECK_KEYS[number];

export type AgentSessionV3PilotPhaseCoverageReadinessStatus =
  | 'clean'
  | 'needs-review';

export interface AgentSessionV3PilotPhaseCoverageReadinessCheckSummary {
  failedCount: number;
  key: AgentSessionV3PilotPhaseCoverageReadinessCheckKey;
  maxActual: number;
  maxRequired: number | null;
  sampleLabels: (string | null)[];
}

export interface AgentSessionV3PilotPhaseCoverageReadinessSummary {
  affectedSampleLabels: (string | null)[];
  checkSummaries: AgentSessionV3PilotPhaseCoverageReadinessCheckSummary[];
  failedCheckCount: number;
  kind: 'agent-session-v3-pilot-phase-coverage-readiness';
  status: AgentSessionV3PilotPhaseCoverageReadinessStatus;
  summaryText: string;
  version: 1;
}

function isAgentSessionV3PilotPhaseCoverageReadinessCheckKey(
  key: string,
): key is AgentSessionV3PilotPhaseCoverageReadinessCheckKey {
  return AGENT_SESSION_V3_PILOT_PHASE_COVERAGE_READINESS_CHECK_KEYS.includes(
    key as AgentSessionV3PilotPhaseCoverageReadinessCheckKey,
  );
}

function normalizeAgentSessionV3PilotPhaseCoverageReadinessLabelLimit(
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

function createAgentSessionV3PilotPhaseCoverageReadinessSummaryText(options: {
  affectedSampleLabels: readonly (string | null)[];
  checkSummaries: readonly AgentSessionV3PilotPhaseCoverageReadinessCheckSummary[];
  failedCheckCount: number;
  status: AgentSessionV3PilotPhaseCoverageReadinessStatus;
}) {
  return [
    `AgentSessionV3PilotPhaseCoverageReadiness status=${options.status}`,
    `failedChecks=${options.failedCheckCount}`,
    `checks=${options.checkSummaries.map((check) => check.key).join(',') || 'none'}`,
    `affectedSamples=${options.affectedSampleLabels.map((label) => label ?? 'unknown').join(',') || 'none'}`,
  ].join(' ');
}

function toAgentSessionV3PilotPhaseCoverageReadinessCheckSummary(
  check: AgentSessionV3PilotReadinessFailureDiagnosticsCheckSummary,
): AgentSessionV3PilotPhaseCoverageReadinessCheckSummary | null {
  if (!isAgentSessionV3PilotPhaseCoverageReadinessCheckKey(check.key)) {
    return null;
  }

  return {
    failedCount: check.failedCount,
    key: check.key,
    maxActual: check.maxActual,
    maxRequired: check.maxRequired,
    sampleLabels: [...check.sampleLabels],
  };
}

export function createAgentSessionV3PilotPhaseCoverageReadinessSummary(options: {
  diagnostics: AgentSessionV3PilotReadinessFailureDiagnosticsResult;
  maxLabels?: number;
}): AgentSessionV3PilotPhaseCoverageReadinessSummary {
  const checkSummaries = options.diagnostics.checkSummaries
    .map(toAgentSessionV3PilotPhaseCoverageReadinessCheckSummary)
    .filter((check): check is AgentSessionV3PilotPhaseCoverageReadinessCheckSummary => Boolean(check));
  const labelLimit = normalizeAgentSessionV3PilotPhaseCoverageReadinessLabelLimit(options.maxLabels);
  const affectedSampleLabels: (string | null)[] = [];

  for (const check of checkSummaries) {
    for (const label of check.sampleLabels) {
      if (affectedSampleLabels.length >= labelLimit) {
        break;
      }

      if (!affectedSampleLabels.includes(label)) {
        affectedSampleLabels.push(label);
      }
    }
  }

  const failedCheckCount = checkSummaries.reduce(
    (sum, check) => sum + check.failedCount,
    0,
  );
  const status: AgentSessionV3PilotPhaseCoverageReadinessStatus = failedCheckCount > 0
    ? 'needs-review'
    : 'clean';

  return {
    affectedSampleLabels,
    checkSummaries,
    failedCheckCount,
    kind: 'agent-session-v3-pilot-phase-coverage-readiness',
    status,
    summaryText: createAgentSessionV3PilotPhaseCoverageReadinessSummaryText({
      affectedSampleLabels,
      checkSummaries,
      failedCheckCount,
      status,
    }),
    version: 1,
  };
}
