import { desktopPetShellRuntime } from '../desktopShellRuntime';
import { type LocalVoiceHealth, type LocalVoiceInstallProgress, type LocalVoiceInstallResult, type PetConfig } from '../types';
import { getVoiceErrorMessage } from './errorMessages';
import { EMPTY_LOCAL_VOICE_HEALTH } from './shared';

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function normalizeLocalVoiceHealth(input: unknown): LocalVoiceHealth {
  if (!input || typeof input !== 'object') {
    return EMPTY_LOCAL_VOICE_HEALTH;
  }

  const next = input as Record<string, unknown>;
  const status = next.status;

  return {
    available: Boolean(next.available),
    status:
      status === 'idle'
      || status === 'ready'
      || status === 'missing-runtime'
      || status === 'missing-dependencies'
      || status === 'missing-assets'
      || status === 'error'
        ? status
        : EMPTY_LOCAL_VOICE_HEALTH.status,
    runtimeLabel: typeof next.runtimeLabel === 'string' ? next.runtimeLabel : null,
    executable: typeof next.executable === 'string' ? next.executable : null,
    pythonVersion: typeof next.pythonVersion === 'string' ? next.pythonVersion : null,
    device: next.device === 'cpu' || next.device === 'cuda' ? next.device : 'unknown',
    ttsReady: Boolean(next.ttsReady),
    sttReady: Boolean(next.sttReady),
    referenceReady: Boolean(next.referenceReady),
    missingPackages: normalizeStringArray(next.missingPackages),
    detectedPackages: normalizeStringArray(next.detectedPackages),
    messages: normalizeStringArray(next.messages),
  };
}

export function normalizeLocalVoiceInstallResult(input: unknown): LocalVoiceInstallResult {
  if (!input || typeof input !== 'object') {
    return {
      ok: false,
      executable: null,
      messages: [],
      error: '本地语音依赖安装返回了无法识别的数据。',
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

export function normalizeLocalVoiceInstallProgress(input: unknown): LocalVoiceInstallProgress {
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

export async function getLocalVoiceHealth(settings: PetConfig['settings']): Promise<LocalVoiceHealth> {
  try {
    const result = await desktopPetShellRuntime.getLocalVoiceHealth(settings);
    return normalizeLocalVoiceHealth(result);
  } catch (error) {
    return {
      ...EMPTY_LOCAL_VOICE_HEALTH,
      status: 'error' as const,
      messages: [
        getVoiceErrorMessage(error, '本地语音状态检测失败。'),
      ],
    };
  }
}

export async function warmupLocalVoice(settings: PetConfig['settings']) {
  try {
    await desktopPetShellRuntime.warmupLocalVoice(settings);
  } catch (error) {
    throw new Error(getVoiceErrorMessage(error, '本地语音预热失败。'));
  }
}

export async function installLocalVoiceDependencies(settings: PetConfig['settings']): Promise<LocalVoiceInstallResult> {
  try {
    const result = await desktopPetShellRuntime.installLocalVoiceDependencies(settings);
    return normalizeLocalVoiceInstallResult(result);
  } catch (error) {
    return {
      ok: false,
      executable: null,
      messages: [],
      error: getVoiceErrorMessage(error, '本地语音依赖安装失败。'),
      missingPackages: [],
    };
  }
}

export function onLocalVoiceInstallProgress(callback: (progress: LocalVoiceInstallProgress) => void) {
  return desktopPetShellRuntime.onLocalVoiceInstallProgress((progress) => {
    callback(normalizeLocalVoiceInstallProgress(progress));
  });
}

export interface LocalVoiceSynthesisResult {
  audioBase64: string;
  mimeType: string;
  audioFilePath: string | null;
  audioFileUrl: string | null;
  cacheHit: boolean;
  cacheKey: string | null;
  promptCacheHit: boolean;
}

export interface LocalVoiceSynthesisOptions {
  seed?: number | null;
}

export async function synthesizeLocalVoice(
  text: string,
  settings: PetConfig['settings'],
  options: LocalVoiceSynthesisOptions = {},
): Promise<LocalVoiceSynthesisResult> {
  const result = await desktopPetShellRuntime.synthesizeLocalVoice({
    text,
    settings,
    seed: Number.isFinite(options.seed) ? Math.trunc(options.seed as number) : null,
  });

  if (!result || typeof result !== 'object') {
    throw new Error('本地语音返回了无法识别的数据。');
  }

  const audioBase64 = typeof (result as { audioBase64?: unknown }).audioBase64 === 'string'
    ? (result as { audioBase64: string }).audioBase64
    : '';
  const mimeType = typeof (result as { mimeType?: unknown }).mimeType === 'string'
    ? (result as { mimeType: string }).mimeType
    : 'audio/wav';
  const audioFilePath = typeof (result as { audioFilePath?: unknown }).audioFilePath === 'string'
    ? (result as { audioFilePath: string }).audioFilePath
    : null;
  const audioFileUrl = typeof (result as { audioFileUrl?: unknown }).audioFileUrl === 'string'
    ? (result as { audioFileUrl: string }).audioFileUrl
    : null;
  const cacheHit = Boolean((result as { cacheHit?: unknown }).cacheHit);
  const cacheKey = typeof (result as { cacheKey?: unknown }).cacheKey === 'string'
    ? (result as { cacheKey: string }).cacheKey
    : null;
  const promptCacheHit = Boolean((result as { promptCacheHit?: unknown }).promptCacheHit);

  if (!audioBase64 && !audioFileUrl) {
    throw new Error('本地语音没有返回可播放的音频数据。');
  }

  return {
    audioBase64,
    mimeType,
    audioFilePath,
    audioFileUrl,
    cacheHit,
    cacheKey,
    promptCacheHit,
  };
}

export async function transcribeLocalVoice(audioBase64: string, settings: PetConfig['settings']) {
  const result = await desktopPetShellRuntime.transcribeLocalVoice({
    audioBase64,
    settings,
  });

  if (!result || typeof result !== 'object') {
    throw new Error('本地语音识别返回了无法识别的数据。');
  }

  return typeof (result as { text?: unknown }).text === 'string'
    ? (result as { text: string }).text
    : '';
}
