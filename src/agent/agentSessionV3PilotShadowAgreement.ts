import {
  type AgentSessionV2Result,
  type AgentSessionV2Status,
} from './agentProductionSessionImplementation';
import { type AgentSessionV3PilotRunnerStatus } from './agentSessionV3PilotRunner';
import {
  type AgentSessionV3PilotEventType,
  type AgentSessionV3PilotPhase,
  type AgentSessionV3PilotTerminalStatus,
} from './agentSessionV3PilotStateMachine';
import {
  type AgentSessionV3PilotShadowModeResult,
  type AgentSessionV3PilotShadowModeStatus,
} from './agentSessionV3PilotShadowMode';

export type AgentSessionV3PilotShadowAgreementStatus =
  | 'aligned'
  | 'inconclusive'
  | 'mismatch'
  | 'unavailable';

export type AgentSessionV3PilotShadowAgreementExpectation =
  | 'terminal:cancelled'
  | 'terminal:completed'
  | 'terminal:failed'
  | 'terminal:needs-user'
  | 'waiting:needs_approval'
  | 'no-strict-terminal-mapping';

export interface AgentSessionV3PilotShadowAgreementObserved {
  lastEvent: AgentSessionV3PilotEventType | null;
  phase: AgentSessionV3PilotPhase | null;
  runnerStatus: AgentSessionV3PilotRunnerStatus | null;
  shadowStatus: AgentSessionV3PilotShadowModeStatus | null;
  terminalStatus: AgentSessionV3PilotTerminalStatus | null;
  transitionCount: number | null;
}

export interface AgentSessionV3PilotShadowAgreement {
  expectations: AgentSessionV3PilotShadowAgreementExpectation[];
  observed: AgentSessionV3PilotShadowAgreementObserved;
  reason: string;
  status: AgentSessionV3PilotShadowAgreementStatus;
  v2Status: AgentSessionV2Status;
}

export interface AgentSessionV3PilotShadowAgreementReportSample {
  agreement: AgentSessionV3PilotShadowAgreement;
  label: string | null;
}

export type AgentSessionV3PilotShadowAgreementStatusCounts = Record<
  AgentSessionV3PilotShadowAgreementStatus,
  number
>;

export type AgentSessionV3PilotShadowAgreementV2StatusCounts = Record<
  AgentSessionV2Status,
  number
>;

export interface AgentSessionV3PilotShadowAgreementReport {
  counts: AgentSessionV3PilotShadowAgreementStatusCounts;
  mismatchSamples: AgentSessionV3PilotShadowAgreementReportSample[];
  sampleCount: number;
  samples: AgentSessionV3PilotShadowAgreementReportSample[];
  summaryText: string;
  v2StatusCounts: AgentSessionV3PilotShadowAgreementV2StatusCounts;
}

export interface AgentSessionV3PilotShadowAgreementReportExportOptions {
  includeMismatchSamples?: boolean;
  includeSamples?: boolean;
  maxMismatchSamples?: number;
  maxSamples?: number;
}

export interface AgentSessionV3PilotShadowAgreementReportExportSample {
  expectations: AgentSessionV3PilotShadowAgreementExpectation[];
  label: string | null;
  observed: AgentSessionV3PilotShadowAgreementObserved;
  reason: string;
  status: AgentSessionV3PilotShadowAgreementStatus;
  v2Status: AgentSessionV2Status;
}

export interface AgentSessionV3PilotShadowAgreementReportExport {
  counts: AgentSessionV3PilotShadowAgreementStatusCounts;
  kind: 'agent-session-v3-pilot-shadow-agreement-report';
  mismatchSamples?: AgentSessionV3PilotShadowAgreementReportExportSample[];
  sampleCount: number;
  samples?: AgentSessionV3PilotShadowAgreementReportExportSample[];
  summaryText: string;
  v2StatusCounts: AgentSessionV3PilotShadowAgreementV2StatusCounts;
  version: 1;
}

function createAgentSessionV3PilotShadowAgreementObserved(
  shadow: AgentSessionV3PilotShadowModeResult | null | undefined,
): AgentSessionV3PilotShadowAgreementObserved {
  const runnerResult = shadow?.result ?? null;
  return {
    lastEvent: runnerResult?.state.lastEvent ?? null,
    phase: runnerResult?.state.phase ?? null,
    runnerStatus: runnerResult?.status ?? null,
    shadowStatus: shadow?.status ?? null,
    terminalStatus: runnerResult?.state.terminal?.status ?? null,
    transitionCount: runnerResult?.transitions.length ?? null,
  };
}

function createAgentSessionV3PilotShadowAgreement(options: {
  expectations: AgentSessionV3PilotShadowAgreementExpectation[];
  observed: AgentSessionV3PilotShadowAgreementObserved;
  reason: string;
  status: AgentSessionV3PilotShadowAgreementStatus;
  v2Status: AgentSessionV2Status;
}): AgentSessionV3PilotShadowAgreement {
  return {
    expectations: options.expectations,
    observed: options.observed,
    reason: options.reason,
    status: options.status,
    v2Status: options.v2Status,
  };
}

function createAgentSessionV3PilotShadowAgreementStatusCounts(): AgentSessionV3PilotShadowAgreementStatusCounts {
  return {
    aligned: 0,
    inconclusive: 0,
    mismatch: 0,
    unavailable: 0,
  };
}

function createAgentSessionV3PilotShadowAgreementV2StatusCounts(): AgentSessionV3PilotShadowAgreementV2StatusCounts {
  return {
    'budget-exceeded': 0,
    cancelled: 0,
    completed: 0,
    failed: 0,
    'max-steps': 0,
    'needs-approval': 0,
    'needs-user': 0,
  };
}

function copyAgentSessionV3PilotShadowAgreementStatusCounts(
  counts: AgentSessionV3PilotShadowAgreementStatusCounts,
): AgentSessionV3PilotShadowAgreementStatusCounts {
  return {
    aligned: counts.aligned,
    inconclusive: counts.inconclusive,
    mismatch: counts.mismatch,
    unavailable: counts.unavailable,
  };
}

function copyAgentSessionV3PilotShadowAgreementV2StatusCounts(
  counts: AgentSessionV3PilotShadowAgreementV2StatusCounts,
): AgentSessionV3PilotShadowAgreementV2StatusCounts {
  return {
    'budget-exceeded': counts['budget-exceeded'],
    cancelled: counts.cancelled,
    completed: counts.completed,
    failed: counts.failed,
    'max-steps': counts['max-steps'],
    'needs-approval': counts['needs-approval'],
    'needs-user': counts['needs-user'],
  };
}

function getAgentSessionV3PilotShadowAgreementSampleLimit(
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

function createAgentSessionV3PilotShadowAgreementReportSample(options: {
  agreement: AgentSessionV3PilotShadowAgreement;
  label?: string | null;
}): AgentSessionV3PilotShadowAgreementReportSample {
  return {
    agreement: options.agreement,
    label: options.label ?? null,
  };
}

function createAgentSessionV3PilotShadowAgreementReportExportSample(
  sample: AgentSessionV3PilotShadowAgreementReportSample,
): AgentSessionV3PilotShadowAgreementReportExportSample {
  return {
    expectations: [...sample.agreement.expectations],
    label: sample.label,
    observed: {
      lastEvent: sample.agreement.observed.lastEvent,
      phase: sample.agreement.observed.phase,
      runnerStatus: sample.agreement.observed.runnerStatus,
      shadowStatus: sample.agreement.observed.shadowStatus,
      terminalStatus: sample.agreement.observed.terminalStatus,
      transitionCount: sample.agreement.observed.transitionCount,
    },
    reason: sample.agreement.reason,
    status: sample.agreement.status,
    v2Status: sample.agreement.v2Status,
  };
}

function createAgentSessionV3PilotShadowAgreementReportExportSamples(
  samples: readonly AgentSessionV3PilotShadowAgreementReportSample[],
  limit: number | undefined,
) {
  return samples
    .slice(0, getAgentSessionV3PilotShadowAgreementSampleLimit(limit))
    .map(createAgentSessionV3PilotShadowAgreementReportExportSample);
}

function formatAgentSessionV3PilotShadowAgreementReportSummary(options: {
  counts: AgentSessionV3PilotShadowAgreementStatusCounts;
  sampleCount: number;
  v2StatusCounts: AgentSessionV3PilotShadowAgreementV2StatusCounts;
}) {
  const v2StatusParts = (Object.entries(options.v2StatusCounts) as Array<[AgentSessionV2Status, number]>)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${status}=${count}`);

  return [
    `AgentSessionV3PilotShadowAgreement samples=${options.sampleCount}`,
    `aligned=${options.counts.aligned}`,
    `mismatch=${options.counts.mismatch}`,
    `inconclusive=${options.counts.inconclusive}`,
    `unavailable=${options.counts.unavailable}`,
    `v2=${v2StatusParts.length ? v2StatusParts.join(',') : 'none'}`,
  ].join(' ');
}

function getAgentSessionV3PilotShadowAgreementExpectations(
  v2Status: AgentSessionV2Status,
): AgentSessionV3PilotShadowAgreementExpectation[] {
  switch (v2Status) {
    case 'completed':
      return ['terminal:completed'];
    case 'needs-user':
      return ['terminal:needs-user'];
    case 'needs-approval':
      return ['waiting:needs_approval', 'terminal:needs-user'];
    case 'failed':
      return ['terminal:failed'];
    case 'cancelled':
      return ['terminal:cancelled'];
    case 'budget-exceeded':
    case 'max-steps':
      return ['no-strict-terminal-mapping'];
  }
}

function isAgentSessionV3PilotShadowTerminalMatch(
  observed: AgentSessionV3PilotShadowAgreementObserved,
  terminalStatus: AgentSessionV3PilotTerminalStatus,
) {
  return observed.runnerStatus === 'terminal'
    && observed.terminalStatus === terminalStatus;
}

function isAgentSessionV3PilotShadowWaitingMatch(
  observed: AgentSessionV3PilotShadowAgreementObserved,
  phase: AgentSessionV3PilotPhase,
) {
  return observed.runnerStatus === 'waiting-for-event'
    && observed.phase === phase;
}

function doesAgentSessionV3PilotShadowMatchExpectation(
  observed: AgentSessionV3PilotShadowAgreementObserved,
  expectation: AgentSessionV3PilotShadowAgreementExpectation,
) {
  switch (expectation) {
    case 'terminal:cancelled':
      return isAgentSessionV3PilotShadowTerminalMatch(observed, 'cancelled');
    case 'terminal:completed':
      return isAgentSessionV3PilotShadowTerminalMatch(observed, 'completed');
    case 'terminal:failed':
      return isAgentSessionV3PilotShadowTerminalMatch(observed, 'failed');
    case 'terminal:needs-user':
      return isAgentSessionV3PilotShadowTerminalMatch(observed, 'needs-user');
    case 'waiting:needs_approval':
      return isAgentSessionV3PilotShadowWaitingMatch(observed, 'needs_approval');
    case 'no-strict-terminal-mapping':
      return false;
  }
}

function getAgentSessionV3PilotShadowAllowedTerminalStatuses(
  expectations: readonly AgentSessionV3PilotShadowAgreementExpectation[],
): AgentSessionV3PilotTerminalStatus[] {
  const statuses: AgentSessionV3PilotTerminalStatus[] = [];

  for (const expectation of expectations) {
    if (expectation === 'terminal:cancelled') {
      statuses.push('cancelled');
    } else if (expectation === 'terminal:completed') {
      statuses.push('completed');
    } else if (expectation === 'terminal:failed') {
      statuses.push('failed');
    } else if (expectation === 'terminal:needs-user') {
      statuses.push('needs-user');
    }
  }

  return statuses;
}

function hasAgentSessionV3PilotShadowContradictoryTerminal(
  observed: AgentSessionV3PilotShadowAgreementObserved,
  expectations: readonly AgentSessionV3PilotShadowAgreementExpectation[],
) {
  if (observed.runnerStatus !== 'terminal' || !observed.terminalStatus) {
    return false;
  }

  const allowedTerminalStatuses = getAgentSessionV3PilotShadowAllowedTerminalStatuses(expectations);
  if (!allowedTerminalStatuses.length) {
    return false;
  }

  return !allowedTerminalStatuses.includes(observed.terminalStatus);
}

export function evaluateAgentSessionV3PilotShadowAgreement(
  result: AgentSessionV2Result,
): AgentSessionV3PilotShadowAgreement {
  const shadow = result.debug?.v3PilotShadow ?? null;
  const observed = createAgentSessionV3PilotShadowAgreementObserved(shadow);
  const expectations = getAgentSessionV3PilotShadowAgreementExpectations(result.status);

  if (!shadow) {
    return createAgentSessionV3PilotShadowAgreement({
      expectations,
      observed,
      reason: 'No v3 pilot shadow debug result is attached.',
      status: 'unavailable',
      v2Status: result.status,
    });
  }

  if (shadow.status === 'disabled') {
    return createAgentSessionV3PilotShadowAgreement({
      expectations,
      observed,
      reason: shadow.reason ?? 'v3 pilot shadow mode is disabled.',
      status: 'unavailable',
      v2Status: result.status,
    });
  }

  if (shadow.status !== 'observed' || !shadow.result) {
    return createAgentSessionV3PilotShadowAgreement({
      expectations,
      observed,
      reason: shadow.reason ?? 'v3 pilot shadow output is not comparable.',
      status: 'inconclusive',
      v2Status: result.status,
    });
  }

  if (expectations.includes('no-strict-terminal-mapping')) {
    return createAgentSessionV3PilotShadowAgreement({
      expectations,
      observed,
      reason: `v2 status ${result.status} has no strict v3 terminal-state mapping yet.`,
      status: 'inconclusive',
      v2Status: result.status,
    });
  }

  if (expectations.some((expectation) => (
    doesAgentSessionV3PilotShadowMatchExpectation(observed, expectation)
  ))) {
    return createAgentSessionV3PilotShadowAgreement({
      expectations,
      observed,
      reason: `v2 status ${result.status} agrees with the v3 pilot mirror state.`,
      status: 'aligned',
      v2Status: result.status,
    });
  }

  if (hasAgentSessionV3PilotShadowContradictoryTerminal(observed, expectations)) {
    return createAgentSessionV3PilotShadowAgreement({
      expectations,
      observed,
      reason: `v2 status ${result.status} disagrees with v3 terminal status ${observed.terminalStatus}.`,
      status: 'mismatch',
      v2Status: result.status,
    });
  }

  return createAgentSessionV3PilotShadowAgreement({
    expectations,
    observed,
    reason: `v3 pilot mirror stopped at ${observed.runnerStatus ?? 'unknown'}:${observed.phase ?? 'unknown'}, so terminal-state agreement is not proven.`,
    status: 'inconclusive',
    v2Status: result.status,
  });
}

export function createAgentSessionV3PilotShadowAgreementReport(
  samples: ReadonlyArray<
    AgentSessionV3PilotShadowAgreement
    | AgentSessionV3PilotShadowAgreementReportSample
  >,
): AgentSessionV3PilotShadowAgreementReport {
  const counts = createAgentSessionV3PilotShadowAgreementStatusCounts();
  const v2StatusCounts = createAgentSessionV3PilotShadowAgreementV2StatusCounts();
  const normalizedSamples = samples.map((sample) => (
    'agreement' in sample
      ? createAgentSessionV3PilotShadowAgreementReportSample(sample)
      : createAgentSessionV3PilotShadowAgreementReportSample({ agreement: sample })
  ));

  for (const sample of normalizedSamples) {
    counts[sample.agreement.status] += 1;
    v2StatusCounts[sample.agreement.v2Status] += 1;
  }

  return {
    counts,
    mismatchSamples: normalizedSamples.filter((sample) => sample.agreement.status === 'mismatch'),
    sampleCount: normalizedSamples.length,
    samples: normalizedSamples,
    summaryText: formatAgentSessionV3PilotShadowAgreementReportSummary({
      counts,
      sampleCount: normalizedSamples.length,
      v2StatusCounts,
    }),
    v2StatusCounts,
  };
}

export function createAgentSessionV3PilotShadowAgreementReportFromResults(
  results: ReadonlyArray<
    AgentSessionV2Result
    | {
      label?: string | null;
      result: AgentSessionV2Result;
    }
  >,
): AgentSessionV3PilotShadowAgreementReport {
  return createAgentSessionV3PilotShadowAgreementReport(results.map((entry) => (
    'result' in entry
      ? {
        agreement: evaluateAgentSessionV3PilotShadowAgreement(entry.result),
        label: entry.label ?? null,
      }
      : evaluateAgentSessionV3PilotShadowAgreement(entry)
  )));
}

export function createAgentSessionV3PilotShadowAgreementReportExport(
  report: AgentSessionV3PilotShadowAgreementReport,
  options: AgentSessionV3PilotShadowAgreementReportExportOptions = {},
): AgentSessionV3PilotShadowAgreementReportExport {
  const exportValue: AgentSessionV3PilotShadowAgreementReportExport = {
    counts: copyAgentSessionV3PilotShadowAgreementStatusCounts(report.counts),
    kind: 'agent-session-v3-pilot-shadow-agreement-report',
    sampleCount: report.sampleCount,
    summaryText: report.summaryText,
    v2StatusCounts: copyAgentSessionV3PilotShadowAgreementV2StatusCounts(report.v2StatusCounts),
    version: 1,
  };

  if (options.includeMismatchSamples ?? true) {
    exportValue.mismatchSamples = createAgentSessionV3PilotShadowAgreementReportExportSamples(
      report.mismatchSamples,
      options.maxMismatchSamples,
    );
  }

  if (options.includeSamples) {
    exportValue.samples = createAgentSessionV3PilotShadowAgreementReportExportSamples(
      report.samples,
      options.maxSamples,
    );
  }

  return exportValue;
}

export function stringifyAgentSessionV3PilotShadowAgreementReportExport(
  reportExport: AgentSessionV3PilotShadowAgreementReportExport,
  options: { pretty?: boolean } = {},
) {
  return JSON.stringify(reportExport, null, options.pretty ? 2 : 0);
}
