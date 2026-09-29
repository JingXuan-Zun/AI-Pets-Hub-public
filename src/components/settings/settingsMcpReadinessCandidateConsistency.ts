import { createSettingsMcpExternalServerCandidateReview } from './settingsMcpExternalServerCandidateReview';
import type { SettingsMcpExternalServerCandidate } from './settingsMcpExternalServerCandidateReview';
import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';

export type SettingsMcpReadinessCandidateConsistencyStatus = 'blocked' | 'ready' | 'warning';

export interface SettingsMcpReadinessCandidateConsistencyRow {
  candidateStatus: string;
  detail: string;
  serverId: string;
  status: SettingsMcpReadinessCandidateConsistencyStatus;
}

export interface SettingsMcpReadinessCandidateConsistency {
  matchedCount: number;
  missingCount: number;
  nextAction: string;
  readyServerCount: number;
  rows: SettingsMcpReadinessCandidateConsistencyRow[];
  status: SettingsMcpReadinessCandidateConsistencyStatus;
  summaryText: string;
}

function createCandidateMap(configText: string) {
  const review = createSettingsMcpExternalServerCandidateReview(configText);
  return new Map(review.rows.map((row) => [row.id, row]));
}

function getReadyServerIds(summary: SettingsMcpSoakReadinessSummaryResult | null) {
  return (summary?.servers ?? [])
    .filter((server) => server.readyForRealSoak)
    .map((server) => server.id)
    .filter(Boolean);
}

function createConsistencyRow(
  serverId: string,
  candidate: SettingsMcpExternalServerCandidate | undefined,
): SettingsMcpReadinessCandidateConsistencyRow {
  if (!candidate) {
    return {
      candidateStatus: 'missing',
      detail: 'Ready server from readiness is not present in the current config candidates.',
      serverId,
      status: 'blocked',
    };
  }

  if (candidate.status !== 'candidate') {
    return {
      candidateStatus: candidate.status,
      detail: `Current config row is ${candidate.status}, not a real external-server candidate.`,
      serverId,
      status: 'warning',
    };
  }

  return {
    candidateStatus: candidate.status,
    detail: 'Ready server still matches a current external-server candidate.',
    serverId,
    status: 'ready',
  };
}

function getOverallStatus(rows: SettingsMcpReadinessCandidateConsistencyRow[]) {
  if (rows.length === 0 || rows.some((row) => row.status === 'blocked')) {
    return 'blocked' as const;
  }

  return rows.some((row) => row.status === 'warning') ? 'warning' as const : 'ready' as const;
}

function createNextAction(status: SettingsMcpReadinessCandidateConsistencyStatus) {
  if (status === 'ready') {
    return 'Readiness ready servers still match the current config candidates.';
  }

  if (status === 'warning') {
    return 'Regenerate saved-config readiness before running commands for changed candidate rows.';
  }

  return 'Regenerate saved-config readiness; at least one ready server is missing from the current config.';
}

export function createSettingsMcpReadinessCandidateConsistency(options: {
  configText: string;
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null;
}): SettingsMcpReadinessCandidateConsistency {
  const candidates = createCandidateMap(options.configText);
  const rows = getReadyServerIds(options.readinessSummary)
    .map((serverId) => createConsistencyRow(serverId, candidates.get(serverId)));
  const status = getOverallStatus(rows);
  const matchedCount = rows.filter((row) => row.status === 'ready').length;
  const missingCount = rows.filter((row) => row.candidateStatus === 'missing').length;

  return {
    matchedCount,
    missingCount,
    nextAction: createNextAction(status),
    readyServerCount: rows.length,
    rows,
    status,
    summaryText: `MCPReadinessCandidateConsistency status=${status} matched=${matchedCount}/${rows.length} missing=${missingCount}`,
  };
}
