import {
  createAgentSessionV3PilotExternalReadinessCalibration,
  type AgentSessionV3PilotExternalReadinessCalibrationResult,
} from './agentSessionV3PilotExternalReadinessCalibration';
import { type AgentSessionV3PilotExternalSampleFixtureBatchResult } from './agentSessionV3PilotExternalSampleFixtureBatch';
import { type AgentSessionV3PilotCorpusReadinessThresholds } from './agentSessionV3PilotCorpusReadiness';
import {
  createAgentSessionV3PilotReadinessFailureDiagnostics,
  type AgentSessionV3PilotReadinessFailureDiagnosticsResult,
} from './agentSessionV3PilotReadinessFailureDiagnostics';

export type AgentSessionV3PilotReadinessThresholdProfileComparisonStatus =
  | 'compared'
  | 'empty';

export interface AgentSessionV3PilotReadinessThresholdProfile {
  label?: string | null;
  thresholds?: AgentSessionV3PilotCorpusReadinessThresholds;
}

export interface CreateAgentSessionV3PilotReadinessThresholdProfileComparisonOptions {
  fixtureBatch: AgentSessionV3PilotExternalSampleFixtureBatchResult;
  profiles?: readonly AgentSessionV3PilotReadinessThresholdProfile[] | null;
  useBatchThresholdOverrides?: boolean;
}

export interface AgentSessionV3PilotReadinessThresholdProfileComparisonEntry {
  calibration: AgentSessionV3PilotExternalReadinessCalibrationResult;
  diagnostics: AgentSessionV3PilotReadinessFailureDiagnosticsResult;
  label: string;
  status: AgentSessionV3PilotExternalReadinessCalibrationResult['status'];
  thresholds?: AgentSessionV3PilotCorpusReadinessThresholds;
}

export interface AgentSessionV3PilotReadinessThresholdProfileComparisonResult {
  entries: AgentSessionV3PilotReadinessThresholdProfileComparisonEntry[];
  kind: 'agent-session-v3-pilot-readiness-threshold-profile-comparison';
  profileCount: number;
  sampleCount: number;
  status: AgentSessionV3PilotReadinessThresholdProfileComparisonStatus;
  summaryText: string;
  useBatchThresholdOverrides: boolean;
  version: 1;
}

function createAgentSessionV3PilotReadinessThresholdProfileComparisonLabel(
  profile: AgentSessionV3PilotReadinessThresholdProfile,
  index: number,
) {
  return typeof profile.label === 'string' && profile.label.trim()
    ? profile.label
    : `profile-${index + 1}`;
}

function createAgentSessionV3PilotReadinessThresholdProfileComparisonSummaryText(options: {
  entries: readonly AgentSessionV3PilotReadinessThresholdProfileComparisonEntry[];
  sampleCount: number;
  status: AgentSessionV3PilotReadinessThresholdProfileComparisonStatus;
}) {
  const profileParts = options.entries.map((entry) => `${entry.label}:${entry.status}`);
  return [
    `AgentSessionV3PilotReadinessThresholdProfileComparison status=${options.status}`,
    `profiles=${options.entries.length}`,
    `samples=${options.sampleCount}`,
    `results=${profileParts.length ? profileParts.join(',') : 'none'}`,
  ].join(' ');
}

export function createAgentSessionV3PilotReadinessThresholdProfileComparison(
  options: CreateAgentSessionV3PilotReadinessThresholdProfileComparisonOptions,
): AgentSessionV3PilotReadinessThresholdProfileComparisonResult {
  const entries = (options.profiles ?? []).map((profile, index) => {
    const calibration = createAgentSessionV3PilotExternalReadinessCalibration({
      samples: options.fixtureBatch.entries.map((entry) => ({
        intake: entry.intake,
        label: entry.label,
        thresholds: options.useBatchThresholdOverrides ? entry.thresholds : undefined,
      })),
      thresholds: profile.thresholds,
    });
    return {
      calibration,
      diagnostics: createAgentSessionV3PilotReadinessFailureDiagnostics({
        calibration,
      }),
      label: createAgentSessionV3PilotReadinessThresholdProfileComparisonLabel(profile, index),
      status: calibration.status,
      thresholds: profile.thresholds,
    };
  });
  const status: AgentSessionV3PilotReadinessThresholdProfileComparisonStatus = entries.length
    ? 'compared'
    : 'empty';

  return {
    entries,
    kind: 'agent-session-v3-pilot-readiness-threshold-profile-comparison',
    profileCount: entries.length,
    sampleCount: options.fixtureBatch.entries.length,
    status,
    summaryText: createAgentSessionV3PilotReadinessThresholdProfileComparisonSummaryText({
      entries,
      sampleCount: options.fixtureBatch.entries.length,
      status,
    }),
    useBatchThresholdOverrides: options.useBatchThresholdOverrides ?? false,
    version: 1,
  };
}
