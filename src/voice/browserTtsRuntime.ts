import { desktopPetShellRuntime } from '../desktopShellRuntime';
import { type BrowserTtsHealth, type BrowserTtsInstallProgress, type BrowserTtsInstallResult, type PetConfig } from '../types';
import { getVoiceErrorMessage } from './errorMessages';
import { EMPTY_BROWSER_TTS_HEALTH } from './shared';

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function normalizeBrowserTtsStatus(value: unknown): BrowserTtsHealth['status'] {
  return value === 'ready'
    || value === 'stopped'
    || value === 'missing-runtime'
    || value === 'missing-dependencies'
    || value === 'error'
    || value === 'idle'
    ? value
    : EMPTY_BROWSER_TTS_HEALTH.status;
}

export function normalizeBrowserTtsHealth(input: unknown): BrowserTtsHealth {
  if (!input || typeof input !== 'object') {
    return EMPTY_BROWSER_TTS_HEALTH;
  }

  const next = input as Record<string, unknown>;
  return {
    available: Boolean(next.available),
    status: normalizeBrowserTtsStatus(next.status),
    running: Boolean(next.running),
    url: typeof next.url === 'string' ? next.url : null,
    executable: typeof next.executable === 'string' ? next.executable : null,
    error: typeof next.error === 'string' ? next.error : null,
    missingPackages: normalizeStringArray(next.missingPackages),
    voicesCount: Number.isFinite(Number(next.voicesCount)) ? Number(next.voicesCount) : undefined,
    started: typeof next.started === 'boolean' ? next.started : undefined,
  };
}

export function normalizeBrowserTtsInstallProgress(input: unknown): BrowserTtsInstallProgress {
  if (!input || typeof input !== 'object') {
    return {
      stage: 'starting',
      currentStep: null,
      executable: null,
      messages: [],
      error: null,
      missingPackages: [],
    };
  }

  const next = input as Record<string, unknown>;
  const stage = next.stage;
  return {
    stage:
      stage === 'starting'
      || stage === 'running'
      || stage === 'completed'
      || stage === 'failed'
        ? stage
        : 'starting',
    currentStep: typeof next.currentStep === 'string' ? next.currentStep : null,
    executable: typeof next.executable === 'string' ? next.executable : null,
    messages: normalizeStringArray(next.messages),
    error: typeof next.error === 'string' ? next.error : null,
    missingPackages: normalizeStringArray(next.missingPackages),
  };
}

export function normalizeBrowserTtsInstallResult(input: unknown): BrowserTtsInstallResult {
  if (!input || typeof input !== 'object') {
    return {
      ok: false,
      executable: null,
      messages: [],
      error: 'Edge-TTS 依赖安装返回了无法识别的数据。',
      missingPackages: [],
    };
  }

  const next = input as Record<string, unknown>;
  return {
    ok: Boolean(next.ok),
    executable: typeof next.executable === 'string' ? next.executable : null,
    messages: normalizeStringArray(next.messages),
    error: typeof next.error === 'string' ? next.error : null,
    missingPackages: normalizeStringArray(next.missingPackages),
  };
}

export async function getBrowserTtsHealth(settings: PetConfig['settings']): Promise<BrowserTtsHealth> {
  try {
    const result = await desktopPetShellRuntime.getBrowserTtsHealth(settings);
    return normalizeBrowserTtsHealth(result);
  } catch (error) {
    return {
      ...EMPTY_BROWSER_TTS_HEALTH,
      status: 'error',
      error: getVoiceErrorMessage(error, 'Edge-TTS 本地服务检测失败。'),
    };
  }
}

export async function startBrowserTtsService(settings: PetConfig['settings']): Promise<BrowserTtsHealth> {
  if (!desktopPetShellRuntime.isDesktopMode()) {
    return EMPTY_BROWSER_TTS_HEALTH;
  }

  const result = await desktopPetShellRuntime.startBrowserTtsService(settings);
  const health = normalizeBrowserTtsHealth(result);
  if (!health.available) {
    if (health.status === 'missing-dependencies') {
      throw new Error(`Edge-TTS 依赖缺失：${health.missingPackages.join(', ') || 'edge_tts'}。请先在语音设置里安装 Edge-TTS 依赖。`);
    }
    throw new Error(health.error || 'Edge-TTS 本地服务未就绪。');
  }
  return health;
}

export async function installBrowserTtsDependencies(settings: PetConfig['settings']): Promise<BrowserTtsInstallResult> {
  try {
    const result = await desktopPetShellRuntime.installBrowserTtsDependencies(settings);
    return normalizeBrowserTtsInstallResult(result);
  } catch (error) {
    return {
      ok: false,
      executable: null,
      messages: [],
      error: getVoiceErrorMessage(error, 'Edge-TTS 依赖安装失败。'),
      missingPackages: [],
    };
  }
}

export function onBrowserTtsInstallProgress(callback: (progress: BrowserTtsInstallProgress) => void) {
  return desktopPetShellRuntime.onBrowserTtsInstallProgress((progress) => {
    callback(normalizeBrowserTtsInstallProgress(progress));
  });
}
