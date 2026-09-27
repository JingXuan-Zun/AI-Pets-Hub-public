import {
  type SettingsMcpExternalSoakClosureChecklist,
  type SettingsMcpExternalSoakClosureStatus,
  type SettingsMcpExternalSoakClosureStep,
} from './settingsMcpExternalSoakClosureChecklist';

export interface SettingsMcpExternalSoakClosureEvidencePayload {
  checklist: SettingsMcpExternalSoakClosureChecklist;
  exportedAt: string;
  kind: 'mcp-external-soak-closure-settings-export';
  source: 'settings-session';
  version: 1;
}

export interface SettingsMcpExternalSoakClosureImportedPayload
  extends SettingsMcpExternalSoakClosureEvidencePayload {
  inputPath: string;
}

export interface SettingsMcpExternalSoakClosureImportedSummary {
  currentMatch: boolean;
  detail: string;
  exportedAt: string;
  inputPath: string;
  readyCount: number;
  status: SettingsMcpExternalSoakClosureStatus;
}

function isClosureStatus(value: unknown): value is SettingsMcpExternalSoakClosureStatus {
  return value === 'blocked' || value === 'ready' || value === 'todo' || value === 'warning';
}

function isClosureStep(value: unknown): value is SettingsMcpExternalSoakClosureStep {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const step = value as Partial<SettingsMcpExternalSoakClosureStep>;
  return typeof step.detail === 'string'
    && typeof step.id === 'string'
    && typeof step.label === 'string'
    && isClosureStatus(step.status);
}

function isClosureChecklist(value: unknown): value is SettingsMcpExternalSoakClosureChecklist {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const checklist = value as Partial<SettingsMcpExternalSoakClosureChecklist>;
  return typeof checklist.nextAction === 'string'
    && Number.isFinite(Number(checklist.readyCount))
    && isClosureStatus(checklist.status)
    && Array.isArray(checklist.steps)
    && checklist.steps.every(isClosureStep)
    && typeof checklist.summaryText === 'string';
}

function isClosureEvidencePayload(value: unknown): value is SettingsMcpExternalSoakClosureEvidencePayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const payload = value as Partial<SettingsMcpExternalSoakClosureEvidencePayload>;
  return payload.kind === 'mcp-external-soak-closure-settings-export'
    && payload.version === 1
    && payload.source === 'settings-session'
    && typeof payload.exportedAt === 'string'
    && isClosureChecklist(payload.checklist);
}

function createStepSignature(checklist: SettingsMcpExternalSoakClosureChecklist) {
  return checklist.steps
    .map((step) => `${step.id}:${step.status}`)
    .sort()
    .join('|');
}

function isSameClosureChecklist(
  imported: SettingsMcpExternalSoakClosureChecklist,
  current: SettingsMcpExternalSoakClosureChecklist,
) {
  return imported.status === current.status
    && imported.readyCount === current.readyCount
    && createStepSignature(imported) === createStepSignature(current);
}

export function createSettingsMcpExternalSoakClosureEvidencePayload(
  checklist: SettingsMcpExternalSoakClosureChecklist,
  exportedAt = new Date().toISOString(),
): SettingsMcpExternalSoakClosureEvidencePayload {
  return {
    checklist,
    exportedAt,
    kind: 'mcp-external-soak-closure-settings-export',
    source: 'settings-session',
    version: 1,
  };
}

export function formatSettingsMcpExternalSoakClosureEvidenceText(
  checklist: SettingsMcpExternalSoakClosureChecklist,
  exportedAt?: string,
) {
  return `${JSON.stringify(createSettingsMcpExternalSoakClosureEvidencePayload(checklist, exportedAt), null, 2)}\n`;
}

export function createSettingsMcpExternalSoakClosureEvidenceName(
  checklist: SettingsMcpExternalSoakClosureChecklist,
) {
  return `mcp-external-soak-closure-${checklist.status}-${checklist.readyCount}-of-${checklist.steps.length}.json`;
}

export function parseSettingsMcpExternalSoakClosureEvidenceText(
  text: string,
  inputPath: string,
): SettingsMcpExternalSoakClosureImportedPayload {
  const parsed = JSON.parse(text) as unknown;
  if (!isClosureEvidencePayload(parsed)) {
    throw new Error('Input is not a valid MCP external soak closure Settings export.');
  }

  return {
    ...parsed,
    inputPath,
  };
}

export function createSettingsMcpExternalSoakClosureImportedSummary(
  imported: SettingsMcpExternalSoakClosureImportedPayload,
  current: SettingsMcpExternalSoakClosureChecklist,
): SettingsMcpExternalSoakClosureImportedSummary {
  const currentMatch = isSameClosureChecklist(imported.checklist, current);
  return {
    currentMatch,
    detail: currentMatch
      ? 'Imported closure evidence matches the current MCP external soak closure.'
      : 'Imported closure evidence differs from the current MCP external soak closure.',
    exportedAt: imported.exportedAt,
    inputPath: imported.inputPath,
    readyCount: imported.checklist.readyCount,
    status: imported.checklist.status,
  };
}
