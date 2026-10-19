import type { ComfyUiInputTarget, ComfyUiWorkflowEntry } from './comfyUiWorkflow';

// Connection and imported workflows for ComfyUI. The access token is not here: it is the
// top-level setting `comfyUiApiKey`, so it is encrypted and kept out of backups like other keys.

export type ComfyUiSettings = {
  defaultWorkflowId: string;
  serverUrl: string;
  /** Seconds to wait for one picture before giving up. */
  timeoutSeconds: number;
  workflows: ComfyUiWorkflowEntry[];
};

export const DEFAULT_COMFY_UI_SETTINGS: ComfyUiSettings = {
  defaultWorkflowId: '',
  serverUrl: 'http://127.0.0.1:8188',
  timeoutSeconds: 300,
  workflows: [],
};

const MAX_WORKFLOWS = 30;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTarget(value: unknown): ComfyUiInputTarget | null {
  return isRecord(value) && typeof value.nodeId === 'string' && typeof value.inputKey === 'string'
    ? { inputKey: value.inputKey, nodeId: value.nodeId }
    : null;
}

function normalizeWorkflow(value: unknown): ComfyUiWorkflowEntry | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !isRecord(value.workflow)) return null;
  return {
    description: typeof value.description === 'string' ? value.description : '',
    id: value.id,
    importedAt: typeof value.importedAt === 'number' ? value.importedAt : 0,
    name: typeof value.name === 'string' && value.name.trim() ? value.name : '未命名工作流',
    negative: normalizeTarget(value.negative),
    positive: normalizeTarget(value.positive),
    seeds: Array.isArray(value.seeds) ? value.seeds.map(normalizeTarget).filter((target): target is ComfyUiInputTarget => Boolean(target)) : [],
    workflow: value.workflow as ComfyUiWorkflowEntry['workflow'],
  };
}

export function normalizeComfyUiSettings(value: unknown): ComfyUiSettings {
  const raw = isRecord(value) ? value : {};
  const workflows = (Array.isArray(raw.workflows) ? raw.workflows : [])
    .map(normalizeWorkflow)
    .filter((entry): entry is ComfyUiWorkflowEntry => Boolean(entry))
    .slice(0, MAX_WORKFLOWS);
  const defaultWorkflowId = typeof raw.defaultWorkflowId === 'string' && workflows.some((entry) => entry.id === raw.defaultWorkflowId)
    ? raw.defaultWorkflowId
    : workflows[0]?.id ?? '';
  const timeoutSeconds = Number(raw.timeoutSeconds);
  return {
    defaultWorkflowId,
    serverUrl: typeof raw.serverUrl === 'string' ? raw.serverUrl.trim() : DEFAULT_COMFY_UI_SETTINGS.serverUrl,
    timeoutSeconds: Number.isFinite(timeoutSeconds) ? Math.max(30, Math.min(1800, Math.round(timeoutSeconds))) : DEFAULT_COMFY_UI_SETTINGS.timeoutSeconds,
    workflows,
  };
}
