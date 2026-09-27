import {
  type SettingsMcpExternalSoakClosureChecklist,
  type SettingsMcpExternalSoakClosureStatus,
} from './settingsMcpExternalSoakClosureChecklist';
import {
  type SettingsMcpExternalSoakClosureCoverage,
  type SettingsMcpExternalSoakClosureCoverageStatus,
} from './settingsMcpExternalSoakClosureCoverage';
import {
  type SettingsMcpExternalSoakClosureDrift,
  type SettingsMcpExternalSoakClosureDriftStatus,
} from './settingsMcpExternalSoakClosureDrift';

export interface SettingsMcpExternalSoakClosureReviewSnapshot {
  checklist: SettingsMcpExternalSoakClosureChecklist;
  coverage: SettingsMcpExternalSoakClosureCoverage;
  drift: SettingsMcpExternalSoakClosureDrift;
}

export interface SettingsMcpExternalSoakClosureReviewEvidencePayload {
  exportedAt: string;
  kind: 'mcp-external-soak-closure-review-settings-export';
  snapshot: SettingsMcpExternalSoakClosureReviewSnapshot;
  source: 'settings-session';
  version: 1;
}

export interface SettingsMcpExternalSoakClosureReviewImportedPayload
  extends SettingsMcpExternalSoakClosureReviewEvidencePayload {
  inputPath: string;
}

export interface SettingsMcpExternalSoakClosureReviewImportedSummary {
  currentMatch: boolean;
  detail: string;
  driftStatus: SettingsMcpExternalSoakClosureDriftStatus;
  exportedAt: string;
  inputPath: string;
  readyText: string;
  statusText: string;
}

function isObject(value: unknown) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isClosureStatus(value: unknown): value is SettingsMcpExternalSoakClosureStatus {
  return value === 'blocked' || value === 'ready' || value === 'todo' || value === 'warning';
}

function isCoverageStatus(value: unknown): value is SettingsMcpExternalSoakClosureCoverageStatus {
  return value === 'blocked' || value === 'covered' || value === 'missing' || value === 'warning';
}

function isDriftStatus(value: unknown): value is SettingsMcpExternalSoakClosureDriftStatus {
  return value === 'aligned' || value === 'blocked' || value === 'drift' || value === 'warning';
}

function isSnapshot(value: unknown): value is SettingsMcpExternalSoakClosureReviewSnapshot {
  if (!isObject(value)) {
    return false;
  }

  const snapshot = value as Partial<SettingsMcpExternalSoakClosureReviewSnapshot>;
  return isObject(snapshot.checklist)
    && isObject(snapshot.coverage)
    && isObject(snapshot.drift)
    && isClosureStatus(snapshot.checklist?.status)
    && isCoverageStatus(snapshot.coverage?.status)
    && isDriftStatus(snapshot.drift?.status)
    && Array.isArray(snapshot.checklist?.steps)
    && Array.isArray(snapshot.coverage?.rows)
    && Array.isArray(snapshot.coverage?.closureSteps)
    && Array.isArray(snapshot.drift?.comparisons);
}

function isReviewPayload(
  value: unknown,
): value is SettingsMcpExternalSoakClosureReviewEvidencePayload {
  if (!isObject(value)) {
    return false;
  }

  const payload = value as Partial<SettingsMcpExternalSoakClosureReviewEvidencePayload>;
  return payload.kind === 'mcp-external-soak-closure-review-settings-export'
    && payload.version === 1
    && payload.source === 'settings-session'
    && typeof payload.exportedAt === 'string'
    && isSnapshot(payload.snapshot);
}

function createSnapshotSignature(snapshot: SettingsMcpExternalSoakClosureReviewSnapshot) {
  const checklist = `${snapshot.checklist.status}:${snapshot.checklist.readyCount}:${
    snapshot.checklist.steps.map((step) => `${step.id}:${step.status}`).sort().join('|')
  }`;
  const coverage = `${snapshot.coverage.status}:${snapshot.coverage.coveredCount}:${
    snapshot.coverage.totalReadyServers
  }:${snapshot.coverage.rows.map((row) => `${row.serverId}:${row.status}:${row.soakStatus}`).sort().join('|')}`;
  const drift = `${snapshot.drift.status}:${snapshot.drift.alignedCount}:${
    snapshot.drift.comparisons.map((item) => `${item.id}:${item.aligned}`).sort().join('|')
  }`;
  return [checklist, coverage, drift].join('\n');
}

export function createSettingsMcpExternalSoakClosureReviewSnapshot(
  snapshot: SettingsMcpExternalSoakClosureReviewSnapshot,
) {
  return snapshot;
}

export function createSettingsMcpExternalSoakClosureReviewEvidencePayload(
  snapshot: SettingsMcpExternalSoakClosureReviewSnapshot,
  exportedAt = new Date().toISOString(),
): SettingsMcpExternalSoakClosureReviewEvidencePayload {
  return {
    exportedAt,
    kind: 'mcp-external-soak-closure-review-settings-export',
    snapshot: createSettingsMcpExternalSoakClosureReviewSnapshot(snapshot),
    source: 'settings-session',
    version: 1,
  };
}

export function formatSettingsMcpExternalSoakClosureReviewEvidenceText(
  snapshot: SettingsMcpExternalSoakClosureReviewSnapshot,
  exportedAt?: string,
) {
  return `${JSON.stringify(
    createSettingsMcpExternalSoakClosureReviewEvidencePayload(snapshot, exportedAt),
    null,
    2,
  )}\n`;
}

export function createSettingsMcpExternalSoakClosureReviewEvidenceName(
  snapshot: SettingsMcpExternalSoakClosureReviewSnapshot,
) {
  return `mcp-external-soak-closure-review-${snapshot.drift.status}-${snapshot.drift.alignedCount}-of-${snapshot.drift.totalCount}.json`;
}

export function parseSettingsMcpExternalSoakClosureReviewEvidenceText(
  text: string,
  inputPath: string,
): SettingsMcpExternalSoakClosureReviewImportedPayload {
  const parsed = JSON.parse(text) as unknown;
  if (!isReviewPayload(parsed)) {
    throw new Error('Input is not a valid MCP external soak closure review Settings export.');
  }

  return {
    ...parsed,
    inputPath,
  };
}

export function createSettingsMcpExternalSoakClosureReviewImportedSummary(
  imported: SettingsMcpExternalSoakClosureReviewImportedPayload,
  current: SettingsMcpExternalSoakClosureReviewSnapshot,
): SettingsMcpExternalSoakClosureReviewImportedSummary {
  const currentMatch = createSnapshotSignature(imported.snapshot) === createSnapshotSignature(current);
  return {
    currentMatch,
    detail: currentMatch
      ? 'Imported closure review snapshot matches the current checklist, coverage, and drift state.'
      : 'Imported closure review snapshot differs from the current checklist, coverage, or drift state.',
    driftStatus: imported.snapshot.drift.status,
    exportedAt: imported.exportedAt,
    inputPath: imported.inputPath,
    readyText: `${imported.snapshot.checklist.readyCount} checklist ready / ${imported.snapshot.coverage.coveredCount} server covered`,
    statusText: `checklist=${imported.snapshot.checklist.status} / coverage=${imported.snapshot.coverage.status}`,
  };
}
