import {
  evaluateAgentSessionV3PilotCorpusReadiness,
  type AgentSessionV3PilotCorpusReadinessResult,
  type AgentSessionV3PilotCorpusReadinessThresholds,
} from './agentSessionV3PilotCorpusReadiness';
import { type AgentSessionV3PilotExternalSampleIntakeResult } from './agentSessionV3PilotExternalSampleIntake';

export type AgentSessionV3PilotExternalReadinessCalibrationStatus =
  | 'empty'
  | 'mixed'
  | 'not-ready'
  | 'ready';

export interface AgentSessionV3PilotExternalReadinessCalibrationSample {
  intake: AgentSessionV3PilotExternalSampleIntakeResult;
  label?: string | null;
  thresholds?: AgentSessionV3PilotCorpusReadinessThresholds;
}

export interface CreateAgentSessionV3PilotExternalReadinessCalibrationOptions {
  samples?: readonly AgentSessionV3PilotExternalReadinessCalibrationSample[] | null;
  thresholds?: AgentSessionV3PilotCorpusReadinessThresholds;
}

export interface AgentSessionV3PilotExternalReadinessCalibrationEntry {
  intakeIssueCount: number;
  intakeStatus: AgentSessionV3PilotExternalSampleIntakeResult['status'];
  label: string | null;
  readiness: AgentSessionV3PilotCorpusReadinessResult;
  status: AgentSessionV3PilotExternalReadinessCalibrationStatus;
}

export interface AgentSessionV3PilotExternalReadinessCalibrationCounts {
  empty: number;
  mixed: number;
  notReady: number;
  ready: number;
  total: number;
}

export interface AgentSessionV3PilotExternalReadinessCalibrationResult {
  counts: AgentSessionV3PilotExternalReadinessCalibrationCounts;
  entries: AgentSessionV3PilotExternalReadinessCalibrationEntry[];
  kind: 'agent-session-v3-pilot-external-readiness-calibration';
  status: AgentSessionV3PilotExternalReadinessCalibrationStatus;
  summaryText: string;
  version: 1;
}

function createAgentSessionV3PilotExternalReadinessCalibrationCounts(): AgentSessionV3PilotExternalReadinessCalibrationCounts {
  return {
    empty: 0,
    mixed: 0,
    notReady: 0,
    ready: 0,
    total: 0,
  };
}

function isAgentSessionV3PilotExternalReadinessCalibrationIntakeEmpty(
  intake: AgentSessionV3PilotExternalSampleIntakeResult,
) {
  return intake.status === 'empty'
    || (
      intake.corpus.counts.agreementSampleCount === 0
      && intake.corpus.counts.shadowDebugSampleCount === 0
    );
}

function getAgentSessionV3PilotExternalReadinessCalibrationEntryStatus(
  entry: AgentSessionV3PilotExternalReadinessCalibrationEntry,
): AgentSessionV3PilotExternalReadinessCalibrationStatus {
  if (entry.readiness.status === 'ready' && entry.intakeIssueCount === 0) {
    return 'ready';
  }

  if (entry.readiness.status === 'ready' && entry.intakeIssueCount > 0) {
    return 'mixed';
  }

  return 'not-ready';
}

function getAgentSessionV3PilotExternalReadinessCalibrationStatus(
  counts: AgentSessionV3PilotExternalReadinessCalibrationCounts,
): AgentSessionV3PilotExternalReadinessCalibrationStatus {
  if (counts.total === 0 || counts.empty === counts.total) {
    return 'empty';
  }

  if (counts.ready === counts.total) {
    return 'ready';
  }

  if (counts.ready > 0 || counts.mixed > 0) {
    return 'mixed';
  }

  return 'not-ready';
}

function createAgentSessionV3PilotExternalReadinessCalibrationSummaryText(options: {
  counts: AgentSessionV3PilotExternalReadinessCalibrationCounts;
  status: AgentSessionV3PilotExternalReadinessCalibrationStatus;
}) {
  return [
    `AgentSessionV3PilotExternalReadinessCalibration status=${options.status}`,
    `samples=${options.counts.total}`,
    `ready=${options.counts.ready}`,
    `mixed=${options.counts.mixed}`,
    `notReady=${options.counts.notReady}`,
    `empty=${options.counts.empty}`,
  ].join(' ');
}

export function createAgentSessionV3PilotExternalReadinessCalibration(
  options: CreateAgentSessionV3PilotExternalReadinessCalibrationOptions = {},
): AgentSessionV3PilotExternalReadinessCalibrationResult {
  const entries: AgentSessionV3PilotExternalReadinessCalibrationEntry[] = [];
  const counts = createAgentSessionV3PilotExternalReadinessCalibrationCounts();

  for (const sample of options.samples ?? []) {
    const readiness = evaluateAgentSessionV3PilotCorpusReadiness({
      collectorIssueCount: sample.intake.issueCount,
      corpus: sample.intake.corpus,
      thresholds: sample.thresholds ?? options.thresholds,
    });
    const entry: AgentSessionV3PilotExternalReadinessCalibrationEntry = {
      intakeIssueCount: sample.intake.issueCount,
      intakeStatus: sample.intake.status,
      label: sample.label ?? null,
      readiness,
      status: 'not-ready',
    };
    entry.status = isAgentSessionV3PilotExternalReadinessCalibrationIntakeEmpty(sample.intake)
      ? 'empty'
      : getAgentSessionV3PilotExternalReadinessCalibrationEntryStatus(entry);
    entries.push(entry);
    counts.total += 1;

    if (entry.status === 'ready') {
      counts.ready += 1;
    } else if (entry.status === 'mixed') {
      counts.mixed += 1;
    } else if (entry.status === 'not-ready') {
      counts.notReady += 1;
    } else {
      counts.empty += 1;
    }
  }

  const status = getAgentSessionV3PilotExternalReadinessCalibrationStatus(counts);
  return {
    counts,
    entries,
    kind: 'agent-session-v3-pilot-external-readiness-calibration',
    status,
    summaryText: createAgentSessionV3PilotExternalReadinessCalibrationSummaryText({
      counts,
      status,
    }),
    version: 1,
  };
}
