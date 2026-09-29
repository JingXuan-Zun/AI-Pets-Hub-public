import { type AgentSessionV3PilotDebugSampleCorpusExport } from './agentSessionV3PilotDebugSampleCorpus';
import { type AgentSessionV3PilotShadowAgreementReportExportSample } from './agentSessionV3PilotShadowAgreement';
import { AGENT_SESSION_V3_PILOT_KNOWN_PHASES } from './agentSessionV3PilotShadowDebugExport';

export type AgentSessionV3PilotCorpusReadinessStatus =
  | 'not-ready'
  | 'ready';

export interface AgentSessionV3PilotCorpusReadinessThresholds {
  allowInconclusiveBudgetStops?: boolean;
  maxCollectorIssues?: number;
  maxInconclusive?: number;
  maxMismatches?: number;
  maxShadowAnomalies?: number;
  maxUnavailable?: number;
  minAgreementSamples?: number;
  minShadowSamples?: number;
  minTerminalObservedShadowSamples?: number;
  requireNoDisabledShadowSamples?: boolean;
  requireNoMissingPhaseCoverage?: boolean;
  requireFullPhaseCoverage?: boolean;
  requireNoInvalidTransitions?: boolean;
  requireNoRunnerFailures?: boolean;
  requireNoShadowOmissions?: boolean;
  requireNoTransitionLimits?: boolean;
}

export interface EvaluateAgentSessionV3PilotCorpusReadinessOptions {
  collectorIssueCount?: number | null;
  corpus: AgentSessionV3PilotDebugSampleCorpusExport;
  thresholds?: AgentSessionV3PilotCorpusReadinessThresholds;
}

export interface AgentSessionV3PilotCorpusReadinessCheck {
  actual: number;
  key: string;
  passed: boolean;
  reason: string;
  required?: number;
}

export interface AgentSessionV3PilotCorpusReadinessResult {
  checks: AgentSessionV3PilotCorpusReadinessCheck[];
  kind: 'agent-session-v3-pilot-corpus-readiness';
  status: AgentSessionV3PilotCorpusReadinessStatus;
  summaryText: string;
  version: 1;
}

const AGENT_SESSION_V3_PILOT_DEFAULT_CORPUS_READINESS_THRESHOLDS: Required<
  AgentSessionV3PilotCorpusReadinessThresholds
> = {
  allowInconclusiveBudgetStops: true,
  maxCollectorIssues: 0,
  maxInconclusive: 0,
  maxMismatches: 0,
  maxShadowAnomalies: Number.MAX_SAFE_INTEGER,
  maxUnavailable: 0,
  minAgreementSamples: 1,
  minShadowSamples: 1,
  minTerminalObservedShadowSamples: 0,
  requireNoDisabledShadowSamples: true,
  requireFullPhaseCoverage: false,
  requireNoInvalidTransitions: true,
  requireNoMissingPhaseCoverage: false,
  requireNoRunnerFailures: true,
  requireNoShadowOmissions: true,
  requireNoTransitionLimits: true,
};

function normalizeAgentSessionV3PilotCorpusReadinessThresholds(
  thresholds: AgentSessionV3PilotCorpusReadinessThresholds | undefined,
): Required<AgentSessionV3PilotCorpusReadinessThresholds> {
  return {
    ...AGENT_SESSION_V3_PILOT_DEFAULT_CORPUS_READINESS_THRESHOLDS,
    ...thresholds,
  };
}

function normalizeAgentSessionV3PilotCorpusReadinessCount(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function createAgentSessionV3PilotCorpusReadinessMinCheck(options: {
  actual: number;
  key: string;
  label: string;
  required: number;
}): AgentSessionV3PilotCorpusReadinessCheck {
  const required = normalizeAgentSessionV3PilotCorpusReadinessCount(options.required);
  const passed = options.actual >= required;
  return {
    actual: options.actual,
    key: options.key,
    passed,
    reason: passed
      ? `${options.label} reached ${options.actual}/${required}.`
      : `${options.label} needs at least ${required}, got ${options.actual}.`,
    required,
  };
}

function createAgentSessionV3PilotCorpusReadinessMaxCheck(options: {
  actual: number;
  key: string;
  label: string;
  required: number;
}): AgentSessionV3PilotCorpusReadinessCheck {
  const required = normalizeAgentSessionV3PilotCorpusReadinessCount(options.required);
  const passed = options.actual <= required;
  return {
    actual: options.actual,
    key: options.key,
    passed,
    reason: passed
      ? `${options.label} stayed within ${required}, got ${options.actual}.`
      : `${options.label} must be at most ${required}, got ${options.actual}.`,
    required,
  };
}

function createAgentSessionV3PilotCorpusReadinessZeroCheck(options: {
  actual: number;
  enabled: boolean;
  key: string;
  label: string;
}): AgentSessionV3PilotCorpusReadinessCheck | null {
  if (!options.enabled) {
    return null;
  }

  return createAgentSessionV3PilotCorpusReadinessMaxCheck({
    actual: options.actual,
    key: options.key,
    label: options.label,
    required: 0,
  });
}

function isAgentSessionV3PilotCorpusReadinessBudgetStopSample(
  sample: AgentSessionV3PilotShadowAgreementReportExportSample,
) {
  return sample.status === 'inconclusive'
    && (
      sample.v2Status === 'budget-exceeded'
      || sample.v2Status === 'max-steps'
    );
}

function getAgentSessionV3PilotCorpusReadinessBudgetStopInconclusiveCount(
  corpus: AgentSessionV3PilotDebugSampleCorpusExport,
  allowInconclusiveBudgetStops: boolean,
) {
  if (!allowInconclusiveBudgetStops) {
    return 0;
  }

  const samples = corpus.agreementReport?.samples ?? [];
  if (!samples.length) {
    return 0;
  }

  return samples.filter(isAgentSessionV3PilotCorpusReadinessBudgetStopSample).length;
}

function getAgentSessionV3PilotCorpusReadinessBlockingInconclusiveCount(
  corpus: AgentSessionV3PilotDebugSampleCorpusExport,
  allowInconclusiveBudgetStops: boolean,
) {
  const inconclusiveCount = corpus.agreementReport?.counts.inconclusive ?? 0;
  const toleratedCount = getAgentSessionV3PilotCorpusReadinessBudgetStopInconclusiveCount(
    corpus,
    allowInconclusiveBudgetStops,
  );
  return Math.max(0, inconclusiveCount - toleratedCount);
}

function getAgentSessionV3PilotCorpusReadinessPhaseCoverageCounts(
  corpus: AgentSessionV3PilotDebugSampleCorpusExport,
) {
  const phaseCoverage = corpus.counts.shadowPhaseCoverage;
  if (phaseCoverage) {
    return {
      missingCoverageSampleCount: phaseCoverage.missingCoverageSampleCount,
      terminalObservedSampleCount: phaseCoverage.terminalObservedSampleCount,
      unvisitedPhaseCount: phaseCoverage.unvisitedPhasesAcrossCorpus.length,
    };
  }

  return {
    missingCoverageSampleCount: normalizeAgentSessionV3PilotCorpusReadinessCount(
      corpus.counts.shadowDebugSampleCount,
    ),
    terminalObservedSampleCount: 0,
    unvisitedPhaseCount: AGENT_SESSION_V3_PILOT_KNOWN_PHASES.length,
  };
}

function createAgentSessionV3PilotCorpusReadinessSummaryText(options: {
  checks: readonly AgentSessionV3PilotCorpusReadinessCheck[];
  corpus: AgentSessionV3PilotDebugSampleCorpusExport;
  status: AgentSessionV3PilotCorpusReadinessStatus;
}) {
  const failedCount = options.checks.filter((check) => !check.passed).length;
  const passedCount = options.checks.length - failedCount;
  const phaseCoverage = getAgentSessionV3PilotCorpusReadinessPhaseCoverageCounts(options.corpus);
  return [
    `AgentSessionV3PilotCorpusReadiness status=${options.status}`,
    `checks=${options.checks.length}`,
    `passed=${passedCount}`,
    `failed=${failedCount}`,
    `agreementSamples=${options.corpus.counts.agreementSampleCount}`,
    `shadowSamples=${options.corpus.counts.shadowDebugSampleCount}`,
    `mismatches=${options.corpus.agreementReport?.counts.mismatch ?? 0}`,
    `shadowAnomalies=${options.corpus.counts.shadowAnomalySampleCount}`,
    `phaseCoverageMissing=${phaseCoverage.missingCoverageSampleCount}`,
    `unvisitedPhases=${phaseCoverage.unvisitedPhaseCount}`,
  ].join(' ');
}

function pushAgentSessionV3PilotCorpusReadinessCheck(
  checks: AgentSessionV3PilotCorpusReadinessCheck[],
  check: AgentSessionV3PilotCorpusReadinessCheck | null,
) {
  if (check) {
    checks.push(check);
  }
}

export function evaluateAgentSessionV3PilotCorpusReadiness(
  options: EvaluateAgentSessionV3PilotCorpusReadinessOptions,
): AgentSessionV3PilotCorpusReadinessResult {
  const thresholds = normalizeAgentSessionV3PilotCorpusReadinessThresholds(options.thresholds);
  const checks: AgentSessionV3PilotCorpusReadinessCheck[] = [];
  const blockingInconclusiveCount = getAgentSessionV3PilotCorpusReadinessBlockingInconclusiveCount(
    options.corpus,
    thresholds.allowInconclusiveBudgetStops,
  );
  const phaseCoverage = getAgentSessionV3PilotCorpusReadinessPhaseCoverageCounts(options.corpus);

  checks.push(createAgentSessionV3PilotCorpusReadinessMinCheck({
    actual: options.corpus.counts.agreementSampleCount,
    key: 'min-agreement-samples',
    label: 'Agreement samples',
    required: thresholds.minAgreementSamples,
  }));
  checks.push(createAgentSessionV3PilotCorpusReadinessMinCheck({
    actual: options.corpus.counts.shadowDebugSampleCount,
    key: 'min-shadow-samples',
    label: 'Shadow debug samples',
    required: thresholds.minShadowSamples,
  }));
  checks.push(createAgentSessionV3PilotCorpusReadinessMaxCheck({
    actual: options.corpus.agreementReport?.counts.mismatch ?? 0,
    key: 'max-mismatches',
    label: 'Agreement mismatches',
    required: thresholds.maxMismatches,
  }));
  checks.push(createAgentSessionV3PilotCorpusReadinessMaxCheck({
    actual: blockingInconclusiveCount,
    key: 'max-blocking-inconclusive',
    label: thresholds.allowInconclusiveBudgetStops
      ? 'Blocking inconclusive agreements after budget/step-limit tolerance'
      : 'Blocking inconclusive agreements',
    required: thresholds.maxInconclusive,
  }));
  checks.push(createAgentSessionV3PilotCorpusReadinessMaxCheck({
    actual: options.corpus.agreementReport?.counts.unavailable ?? 0,
    key: 'max-unavailable',
    label: 'Unavailable agreement samples',
    required: thresholds.maxUnavailable,
  }));
  checks.push(createAgentSessionV3PilotCorpusReadinessMaxCheck({
    actual: options.corpus.counts.shadowAnomalySampleCount,
    key: 'max-shadow-anomalies',
    label: 'Shadow anomaly samples',
    required: thresholds.maxShadowAnomalies,
  }));
  checks.push(createAgentSessionV3PilotCorpusReadinessMinCheck({
    actual: phaseCoverage.terminalObservedSampleCount,
    key: 'min-terminal-observed-shadow-samples',
    label: 'Terminal-observed shadow samples',
    required: thresholds.minTerminalObservedShadowSamples,
  }));
  checks.push(createAgentSessionV3PilotCorpusReadinessMaxCheck({
    actual: normalizeAgentSessionV3PilotCorpusReadinessCount(options.collectorIssueCount),
    key: 'max-collector-issues',
    label: 'Collector issues',
    required: thresholds.maxCollectorIssues,
  }));
  pushAgentSessionV3PilotCorpusReadinessCheck(checks, createAgentSessionV3PilotCorpusReadinessZeroCheck({
    actual: options.corpus.counts.shadowRunnerStatusCounts['driver-failed'],
    enabled: thresholds.requireNoRunnerFailures,
    key: 'no-runner-failures',
    label: 'Shadow runner failures',
  }));
  pushAgentSessionV3PilotCorpusReadinessCheck(checks, createAgentSessionV3PilotCorpusReadinessZeroCheck({
    actual: options.corpus.counts.shadowRunnerStatusCounts['invalid-transition'],
    enabled: thresholds.requireNoInvalidTransitions,
    key: 'no-invalid-transitions',
    label: 'Invalid shadow transitions',
  }));
  pushAgentSessionV3PilotCorpusReadinessCheck(checks, createAgentSessionV3PilotCorpusReadinessZeroCheck({
    actual: options.corpus.counts.shadowRunnerStatusCounts['transition-limit'],
    enabled: thresholds.requireNoTransitionLimits,
    key: 'no-transition-limits',
    label: 'Shadow transition-limit stops',
  }));
  pushAgentSessionV3PilotCorpusReadinessCheck(checks, createAgentSessionV3PilotCorpusReadinessZeroCheck({
    actual: options.corpus.counts.shadowModeStatusCounts.omitted,
    enabled: thresholds.requireNoShadowOmissions,
    key: 'no-shadow-omissions',
    label: 'Shadow omissions',
  }));
  pushAgentSessionV3PilotCorpusReadinessCheck(checks, createAgentSessionV3PilotCorpusReadinessZeroCheck({
    actual: options.corpus.counts.shadowModeStatusCounts.disabled,
    enabled: thresholds.requireNoDisabledShadowSamples,
    key: 'no-disabled-shadow-samples',
    label: 'Disabled shadow samples',
  }));
  pushAgentSessionV3PilotCorpusReadinessCheck(checks, createAgentSessionV3PilotCorpusReadinessZeroCheck({
    actual: phaseCoverage.missingCoverageSampleCount,
    enabled: thresholds.requireNoMissingPhaseCoverage,
    key: 'no-missing-phase-coverage',
    label: 'Missing shadow phase-coverage samples',
  }));
  pushAgentSessionV3PilotCorpusReadinessCheck(checks, createAgentSessionV3PilotCorpusReadinessZeroCheck({
    actual: phaseCoverage.unvisitedPhaseCount,
    enabled: thresholds.requireFullPhaseCoverage,
    key: 'full-phase-coverage',
    label: 'Unvisited shadow phases',
  }));

  const status: AgentSessionV3PilotCorpusReadinessStatus = checks.every((check) => check.passed)
    ? 'ready'
    : 'not-ready';

  return {
    checks,
    kind: 'agent-session-v3-pilot-corpus-readiness',
    status,
    summaryText: createAgentSessionV3PilotCorpusReadinessSummaryText({
      checks,
      corpus: options.corpus,
      status,
    }),
    version: 1,
  };
}
