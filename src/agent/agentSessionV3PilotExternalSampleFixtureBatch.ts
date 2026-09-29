import {
  createAgentSessionV3PilotExternalReadinessCalibration,
  type AgentSessionV3PilotExternalReadinessCalibrationResult,
} from './agentSessionV3PilotExternalReadinessCalibration';
import {
  createAgentSessionV3PilotExternalSampleIntake,
  type AgentSessionV3PilotExternalSampleIntakeResult,
} from './agentSessionV3PilotExternalSampleIntake';
import { type AgentSessionV3PilotCorpusReadinessThresholds } from './agentSessionV3PilotCorpusReadiness';
import { type AgentSessionV3PilotDebugSampleCorpusExportOptions } from './agentSessionV3PilotDebugSampleCorpus';
import { type AgentSessionV3PilotShadowAgreementReportExport } from './agentSessionV3PilotShadowAgreement';
import { type AgentSessionV3PilotShadowDebugExport } from './agentSessionV3PilotShadowDebugExport';

export interface AgentSessionV3PilotExternalSampleFixtureAgreementReport {
  label?: string | null;
  report: AgentSessionV3PilotShadowAgreementReportExport | null;
}

export interface AgentSessionV3PilotExternalSampleFixtureShadowDebugSample {
  label?: string | null;
  shadow: AgentSessionV3PilotShadowDebugExport | null;
}

export interface AgentSessionV3PilotExternalSampleFixtureBatch {
  agreementReports?: readonly AgentSessionV3PilotExternalSampleFixtureAgreementReport[] | null;
  corpusOptions?: AgentSessionV3PilotDebugSampleCorpusExportOptions;
  label?: string | null;
  shadowDebugSamples?: readonly AgentSessionV3PilotExternalSampleFixtureShadowDebugSample[] | null;
  thresholds?: AgentSessionV3PilotCorpusReadinessThresholds;
}

export interface AgentSessionV3PilotExternalSampleFixtureSet {
  batches?: readonly AgentSessionV3PilotExternalSampleFixtureBatch[] | null;
  corpusOptions?: AgentSessionV3PilotDebugSampleCorpusExportOptions;
  thresholds?: AgentSessionV3PilotCorpusReadinessThresholds;
}

export interface AgentSessionV3PilotExternalSampleFixtureBatchEntry {
  intake: AgentSessionV3PilotExternalSampleIntakeResult;
  label: string | null;
  thresholds?: AgentSessionV3PilotCorpusReadinessThresholds;
}

export interface AgentSessionV3PilotExternalSampleFixtureBatchResult {
  calibration: AgentSessionV3PilotExternalReadinessCalibrationResult;
  entries: AgentSessionV3PilotExternalSampleFixtureBatchEntry[];
  intakeCount: number;
  issueCount: number;
  kind: 'agent-session-v3-pilot-external-sample-fixture-batch';
  status: AgentSessionV3PilotExternalReadinessCalibrationResult['status'];
  summaryText: string;
  version: 1;
}

function createAgentSessionV3PilotExternalSampleFixtureBatchSummaryText(options: {
  calibration: AgentSessionV3PilotExternalReadinessCalibrationResult;
  intakeCount: number;
  issueCount: number;
}) {
  return [
    `AgentSessionV3PilotExternalSampleFixtureBatch status=${options.calibration.status}`,
    `batches=${options.intakeCount}`,
    `issues=${options.issueCount}`,
    `ready=${options.calibration.counts.ready}`,
    `mixed=${options.calibration.counts.mixed}`,
    `notReady=${options.calibration.counts.notReady}`,
    `empty=${options.calibration.counts.empty}`,
  ].join(' ');
}

export function createAgentSessionV3PilotExternalSampleFixtureBatch(
  fixtureSet: AgentSessionV3PilotExternalSampleFixtureSet = {},
): AgentSessionV3PilotExternalSampleFixtureBatchResult {
  const entries: AgentSessionV3PilotExternalSampleFixtureBatchEntry[] = [];
  let issueCount = 0;

  for (const batch of fixtureSet.batches ?? []) {
    const intake = createAgentSessionV3PilotExternalSampleIntake({
      agreementReports: batch.agreementReports,
      corpusOptions: batch.corpusOptions ?? fixtureSet.corpusOptions,
      shadowDebugSamples: batch.shadowDebugSamples,
    });
    entries.push({
      intake,
      label: batch.label ?? null,
      thresholds: batch.thresholds,
    });
    issueCount += intake.issueCount;
  }

  const calibration = createAgentSessionV3PilotExternalReadinessCalibration({
    samples: entries.map((entry) => ({
      intake: entry.intake,
      label: entry.label,
      thresholds: entry.thresholds,
    })),
    thresholds: fixtureSet.thresholds,
  });

  return {
    calibration,
    entries,
    intakeCount: entries.length,
    issueCount,
    kind: 'agent-session-v3-pilot-external-sample-fixture-batch',
    status: calibration.status,
    summaryText: createAgentSessionV3PilotExternalSampleFixtureBatchSummaryText({
      calibration,
      intakeCount: entries.length,
      issueCount,
    }),
    version: 1,
  };
}
