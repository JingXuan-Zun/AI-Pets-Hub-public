import { type AgentSessionV3PilotRunnerStatus } from './agentSessionV3PilotRunner';
import { type AgentSessionV3PilotShadowAgreementReportExport } from './agentSessionV3PilotShadowAgreement';
import {
  AGENT_SESSION_V3_PILOT_KNOWN_PHASES,
  type AgentSessionV3PilotShadowDebugExport,
  type AgentSessionV3PilotShadowPhaseCoverageStatus,
} from './agentSessionV3PilotShadowDebugExport';
import { type AgentSessionV3PilotShadowModeStatus } from './agentSessionV3PilotShadowMode';
import {
  type AgentSessionV3PilotEventType,
  type AgentSessionV3PilotPhase,
} from './agentSessionV3PilotStateMachine';

export type AgentSessionV3PilotDebugSampleCorpusRunnerStatus =
  | AgentSessionV3PilotRunnerStatus
  | 'none';

export type AgentSessionV3PilotDebugSampleCorpusPhaseCoverageStatus =
  | AgentSessionV3PilotShadowPhaseCoverageStatus
  | 'missing';

export type AgentSessionV3PilotDebugSampleCorpusShadowModeStatusCounts = Record<
  AgentSessionV3PilotShadowModeStatus,
  number
>;

export type AgentSessionV3PilotDebugSampleCorpusRunnerStatusCounts = Record<
  AgentSessionV3PilotDebugSampleCorpusRunnerStatus,
  number
>;

export type AgentSessionV3PilotDebugSampleCorpusPhaseCoverageStatusCounts = Record<
  AgentSessionV3PilotDebugSampleCorpusPhaseCoverageStatus,
  number
>;

export type AgentSessionV3PilotDebugSampleCorpusPhaseVisitCounts = Record<
  AgentSessionV3PilotPhase,
  number
>;

export type AgentSessionV3PilotDebugSampleCorpusEventTypeCounts = Partial<Record<
  AgentSessionV3PilotEventType,
  number
>>;

export interface AgentSessionV3PilotDebugSampleCorpusShadowSample {
  label: string | null;
  shadow: AgentSessionV3PilotShadowDebugExport;
}

export interface AgentSessionV3PilotDebugSampleCorpusCounts {
  agreementSampleCount: number;
  shadowAnomalySampleCount: number;
  shadowDebugSampleCount: number;
  shadowPhaseCoverage: AgentSessionV3PilotDebugSampleCorpusPhaseCoverageSummary;
  shadowModeStatusCounts: AgentSessionV3PilotDebugSampleCorpusShadowModeStatusCounts;
  shadowRunnerStatusCounts: AgentSessionV3PilotDebugSampleCorpusRunnerStatusCounts;
}

export interface AgentSessionV3PilotDebugSampleCorpusPhaseCoverageSummary {
  acceptedTransitionCount: number;
  coveredSampleCount: number;
  eventTypeCounts: AgentSessionV3PilotDebugSampleCorpusEventTypeCounts;
  missingCoverageSampleCount: number;
  phaseVisitCounts: AgentSessionV3PilotDebugSampleCorpusPhaseVisitCounts;
  rejectedTransitionCount: number;
  statusCounts: AgentSessionV3PilotDebugSampleCorpusPhaseCoverageStatusCounts;
  terminalObservedSampleCount: number;
  unvisitedPhasesAcrossCorpus: AgentSessionV3PilotPhase[];
}

export interface AgentSessionV3PilotDebugSampleCorpusExport {
  agreementReport?: AgentSessionV3PilotShadowAgreementReportExport | null;
  counts: AgentSessionV3PilotDebugSampleCorpusCounts;
  kind: 'agent-session-v3-pilot-debug-sample-corpus';
  shadowDebugSamples?: AgentSessionV3PilotDebugSampleCorpusShadowSample[];
  summaryText: string;
  version: 1;
}

export interface AgentSessionV3PilotDebugSampleCorpusInput {
  agreementReport?: AgentSessionV3PilotShadowAgreementReportExport | null;
  shadowDebugSamples?: ReadonlyArray<
    AgentSessionV3PilotShadowDebugExport
    | AgentSessionV3PilotDebugSampleCorpusShadowSample
  > | null;
}

export interface AgentSessionV3PilotDebugSampleCorpusExportOptions {
  includeAgreementReport?: boolean;
  includeShadowDebugSamples?: boolean;
  maxShadowDebugSamples?: number;
}

const AGENT_SESSION_V3_PILOT_SHADOW_MODE_STATUSES: AgentSessionV3PilotShadowModeStatus[] = [
  'disabled',
  'observed',
  'omitted',
];

const AGENT_SESSION_V3_PILOT_RUNNER_STATUSES: AgentSessionV3PilotDebugSampleCorpusRunnerStatus[] = [
  'driver-failed',
  'invalid-transition',
  'none',
  'terminal',
  'transition-limit',
  'waiting-for-event',
];

const AGENT_SESSION_V3_PILOT_PHASE_COVERAGE_STATUSES: AgentSessionV3PilotDebugSampleCorpusPhaseCoverageStatus[] = [
  'invalid',
  'limited',
  'missing',
  'partial',
  'terminal',
  'unavailable',
];

function createAgentSessionV3PilotDebugSampleCorpusShadowModeStatusCounts(): AgentSessionV3PilotDebugSampleCorpusShadowModeStatusCounts {
  return {
    disabled: 0,
    observed: 0,
    omitted: 0,
  };
}

function createAgentSessionV3PilotDebugSampleCorpusRunnerStatusCounts(): AgentSessionV3PilotDebugSampleCorpusRunnerStatusCounts {
  return {
    'driver-failed': 0,
    'invalid-transition': 0,
    none: 0,
    terminal: 0,
    'transition-limit': 0,
    'waiting-for-event': 0,
  };
}

function createAgentSessionV3PilotDebugSampleCorpusPhaseCoverageStatusCounts(): AgentSessionV3PilotDebugSampleCorpusPhaseCoverageStatusCounts {
  return {
    invalid: 0,
    limited: 0,
    missing: 0,
    partial: 0,
    terminal: 0,
    unavailable: 0,
  };
}

function createAgentSessionV3PilotDebugSampleCorpusPhaseVisitCounts(): AgentSessionV3PilotDebugSampleCorpusPhaseVisitCounts {
  return Object.fromEntries(
    AGENT_SESSION_V3_PILOT_KNOWN_PHASES.map((phase) => [phase, 0]),
  ) as AgentSessionV3PilotDebugSampleCorpusPhaseVisitCounts;
}

function getAgentSessionV3PilotDebugSampleCorpusLimit(
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

function normalizeAgentSessionV3PilotDebugSampleCorpusShadowSample(
  sample: AgentSessionV3PilotShadowDebugExport | AgentSessionV3PilotDebugSampleCorpusShadowSample,
): AgentSessionV3PilotDebugSampleCorpusShadowSample {
  return 'shadow' in sample
    ? {
      label: sample.label ?? null,
      shadow: sample.shadow,
    }
    : {
      label: null,
      shadow: sample,
    };
}

function isAgentSessionV3PilotDebugSampleCorpusShadowAnomaly(
  sample: AgentSessionV3PilotDebugSampleCorpusShadowSample,
) {
  return sample.shadow.status !== 'observed'
    || sample.shadow.runnerStatus !== 'terminal';
}

function incrementAgentSessionV3PilotDebugSampleCorpusEventTypeCount(
  counts: AgentSessionV3PilotDebugSampleCorpusEventTypeCounts,
  eventType: AgentSessionV3PilotEventType,
) {
  counts[eventType] = (counts[eventType] ?? 0) + 1;
}

function createAgentSessionV3PilotDebugSampleCorpusPhaseCoverageSummary(
  samples: readonly AgentSessionV3PilotDebugSampleCorpusShadowSample[],
): AgentSessionV3PilotDebugSampleCorpusPhaseCoverageSummary {
  const statusCounts = createAgentSessionV3PilotDebugSampleCorpusPhaseCoverageStatusCounts();
  const phaseVisitCounts = createAgentSessionV3PilotDebugSampleCorpusPhaseVisitCounts();
  const eventTypeCounts: AgentSessionV3PilotDebugSampleCorpusEventTypeCounts = {};
  let acceptedTransitionCount = 0;
  let coveredSampleCount = 0;
  let missingCoverageSampleCount = 0;
  let rejectedTransitionCount = 0;
  let terminalObservedSampleCount = 0;

  for (const sample of samples) {
    const coverage = sample.shadow.phaseCoverage ?? null;
    if (!coverage) {
      statusCounts.missing += 1;
      missingCoverageSampleCount += 1;
      continue;
    }

    coveredSampleCount += 1;
    statusCounts[coverage.status] += 1;
    acceptedTransitionCount += coverage.acceptedTransitionCount;
    rejectedTransitionCount += coverage.rejectedTransitionCount;
    if (coverage.terminalObserved) {
      terminalObservedSampleCount += 1;
    }

    for (const phase of coverage.visitedPhases) {
      if (phase in phaseVisitCounts) {
        phaseVisitCounts[phase] += 1;
      }
    }

    for (const eventType of coverage.eventTypes) {
      incrementAgentSessionV3PilotDebugSampleCorpusEventTypeCount(eventTypeCounts, eventType);
    }
  }

  return {
    acceptedTransitionCount,
    coveredSampleCount,
    eventTypeCounts,
    missingCoverageSampleCount,
    phaseVisitCounts,
    rejectedTransitionCount,
    statusCounts,
    terminalObservedSampleCount,
    unvisitedPhasesAcrossCorpus: AGENT_SESSION_V3_PILOT_KNOWN_PHASES.filter((phase) => phaseVisitCounts[phase] === 0),
  };
}

function formatAgentSessionV3PilotDebugSampleCorpusStatusCounts<
  TStatus extends string,
>(
  statuses: readonly TStatus[],
  counts: Record<TStatus, number>,
) {
  return statuses
    .filter((status) => counts[status] > 0)
    .map((status) => `${status}=${counts[status]}`)
    .join(',');
}

function createAgentSessionV3PilotDebugSampleCorpusSummaryText(
  counts: AgentSessionV3PilotDebugSampleCorpusCounts,
) {
  return [
    `AgentSessionV3PilotDebugSampleCorpus agreementSamples=${counts.agreementSampleCount}`,
    `shadowSamples=${counts.shadowDebugSampleCount}`,
    `shadowAnomalies=${counts.shadowAnomalySampleCount}`,
    `shadowMode=${formatAgentSessionV3PilotDebugSampleCorpusStatusCounts(
      AGENT_SESSION_V3_PILOT_SHADOW_MODE_STATUSES,
      counts.shadowModeStatusCounts,
    ) || 'none'}`,
    `shadowRunner=${formatAgentSessionV3PilotDebugSampleCorpusStatusCounts(
      AGENT_SESSION_V3_PILOT_RUNNER_STATUSES,
      counts.shadowRunnerStatusCounts,
    ) || 'none'}`,
    `phaseCoverage=${formatAgentSessionV3PilotDebugSampleCorpusStatusCounts(
      AGENT_SESSION_V3_PILOT_PHASE_COVERAGE_STATUSES,
      counts.shadowPhaseCoverage.statusCounts,
    ) || 'none'}`,
    `unvisitedPhases=${counts.shadowPhaseCoverage.unvisitedPhasesAcrossCorpus.length
      ? counts.shadowPhaseCoverage.unvisitedPhasesAcrossCorpus.join(',')
      : 'none'}`,
  ].join(' ');
}

export function createAgentSessionV3PilotDebugSampleCorpusExport(
  input: AgentSessionV3PilotDebugSampleCorpusInput,
  options: AgentSessionV3PilotDebugSampleCorpusExportOptions = {},
): AgentSessionV3PilotDebugSampleCorpusExport {
  const shadowSamples = (input.shadowDebugSamples ?? [])
    .map(normalizeAgentSessionV3PilotDebugSampleCorpusShadowSample);
  const shadowModeStatusCounts = createAgentSessionV3PilotDebugSampleCorpusShadowModeStatusCounts();
  const shadowRunnerStatusCounts = createAgentSessionV3PilotDebugSampleCorpusRunnerStatusCounts();
  const shadowPhaseCoverage = createAgentSessionV3PilotDebugSampleCorpusPhaseCoverageSummary(shadowSamples);
  let shadowAnomalySampleCount = 0;

  for (const sample of shadowSamples) {
    shadowModeStatusCounts[sample.shadow.status] += 1;
    shadowRunnerStatusCounts[sample.shadow.runnerStatus ?? 'none'] += 1;
    if (isAgentSessionV3PilotDebugSampleCorpusShadowAnomaly(sample)) {
      shadowAnomalySampleCount += 1;
    }
  }

  const counts: AgentSessionV3PilotDebugSampleCorpusCounts = {
    agreementSampleCount: input.agreementReport?.sampleCount ?? 0,
    shadowAnomalySampleCount,
    shadowDebugSampleCount: shadowSamples.length,
    shadowPhaseCoverage,
    shadowModeStatusCounts,
    shadowRunnerStatusCounts,
  };

  const exportValue: AgentSessionV3PilotDebugSampleCorpusExport = {
    counts,
    kind: 'agent-session-v3-pilot-debug-sample-corpus',
    summaryText: createAgentSessionV3PilotDebugSampleCorpusSummaryText(counts),
    version: 1,
  };

  if (options.includeAgreementReport ?? true) {
    exportValue.agreementReport = input.agreementReport ?? null;
  }

  if (options.includeShadowDebugSamples ?? true) {
    exportValue.shadowDebugSamples = shadowSamples.slice(
      0,
      getAgentSessionV3PilotDebugSampleCorpusLimit(options.maxShadowDebugSamples),
    );
  }

  return exportValue;
}

export function stringifyAgentSessionV3PilotDebugSampleCorpusExport(
  corpusExport: AgentSessionV3PilotDebugSampleCorpusExport,
  options: { pretty?: boolean } = {},
) {
  return JSON.stringify(corpusExport, null, options.pretty ? 2 : 0);
}
