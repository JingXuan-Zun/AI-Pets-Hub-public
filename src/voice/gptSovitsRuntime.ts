import { desktopPetShellRuntime } from '../desktopShellRuntime';
import {
  type BrowserTtsInstallProgress,
  type BrowserTtsInstallResult,
  type GptSovitsHealth,
  type GptSovitsModelSummary,
  type PetConfig,
} from '../types';
import { normalizeBrowserTtsInstallProgress, normalizeBrowserTtsInstallResult } from './browserTtsRuntime';
import { getVoiceErrorMessage } from './errorMessages';

const HEALTH_STATUSES: ReadonlyArray<GptSovitsHealth['status']> = [
  'idle', 'ready', 'stopped', 'missing-runtime', 'missing-dependencies', 'missing-source', 'missing-model', 'no-gpu', 'error',
];

export const EMPTY_GPT_SOVITS_HEALTH: GptSovitsHealth = {
  available: false,
  status: 'idle',
  running: false,
  error: null,
  cudaAvailable: false,
  device: 'auto',
  modelId: null,
  models: [],
};

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeModels(value: unknown): GptSovitsModelSummary[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id : '',
      name: typeof entry.name === 'string' ? entry.name : '',
      kind: entry.kind === 'lite' ? 'lite' as const : 'full' as const,
      description: typeof entry.description === 'string' ? entry.description : '',
      author: typeof entry.author === 'string' ? entry.author : '',
      ready: entry.ready === true,
      emotions: normalizeStringArray(entry.emotions),
      problems: normalizeStringArray(entry.problems),
    }))
    .filter((entry) => entry.id);
}

export function normalizeGptSovitsHealth(input: unknown): GptSovitsHealth {
  if (!input || typeof input !== 'object') return EMPTY_GPT_SOVITS_HEALTH;
  const next = input as Record<string, unknown>;
  const status = HEALTH_STATUSES.find((value) => value === next.status) ?? 'error';
  return {
    available: next.available === true && status === 'ready',
    status,
    running: next.running === true,
    error: typeof next.error === 'string' ? next.error : null,
    cudaAvailable: next.cudaAvailable === true,
    device: next.device === 'cuda' || next.device === 'cpu' ? next.device : 'auto',
    modelId: typeof next.modelId === 'string' ? next.modelId : null,
    models: normalizeModels(next.models),
    started: typeof next.started === 'boolean' ? next.started : undefined,
  };
}

export async function getGptSovitsHealth(settings: PetConfig['settings']): Promise<GptSovitsHealth> {
  try {
    return normalizeGptSovitsHealth(await desktopPetShellRuntime.getGptSovitsHealth(settings));
  } catch (error) {
    return { ...EMPTY_GPT_SOVITS_HEALTH, status: 'error', error: getVoiceErrorMessage(error, 'GPT-SoVITS 状态检测失败。') };
  }
}

// Resolves with a ready health snapshot or throws the user-facing reason the sidecar is unavailable.
export async function startGptSovitsService(settings: PetConfig['settings']): Promise<GptSovitsHealth> {
  if (!desktopPetShellRuntime.isDesktopMode()) {
    throw new Error('GPT-SoVITS 角色音色仅在桌面版可用。');
  }
  const health = normalizeGptSovitsHealth(await desktopPetShellRuntime.startGptSovitsService(settings));
  if (!health.available || !health.modelId) {
    throw new Error(health.error || 'GPT-SoVITS 服务未就绪。');
  }
  return health;
}

export async function listGptSovitsModels(): Promise<GptSovitsModelSummary[]> {
  const result = await desktopPetShellRuntime.listGptSovitsModels().catch(() => null);
  return normalizeModels((result as { models?: unknown } | null)?.models);
}

export async function installGptSovitsRuntime(settings: PetConfig['settings']): Promise<BrowserTtsInstallResult> {
  try {
    return normalizeBrowserTtsInstallResult(await desktopPetShellRuntime.installGptSovitsRuntime(settings));
  } catch (error) {
    return {
      ok: false, executable: null, messages: [], missingPackages: [],
      error: getVoiceErrorMessage(error, 'GPT-SoVITS 运行环境安装失败。'),
    };
  }
}

export function onGptSovitsInstallProgress(callback: (progress: BrowserTtsInstallProgress) => void) {
  return desktopPetShellRuntime.onGptSovitsInstallProgress((progress) => {
    callback(normalizeBrowserTtsInstallProgress(progress));
  });
}
