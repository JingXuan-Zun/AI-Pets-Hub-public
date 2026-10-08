import { DEFAULT_GPT_SOVITS_API_URL } from './gptSovitsDefaults';
import { startGptSovitsService } from './gptSovitsRuntime';
import { getVoiceErrorMessage, isVoiceCancellationError } from './errorMessages';
import { createPreparedAudioPlayback } from './ttsPlaybackPrimitives';
import { type PreparedVoicePlayback, type VoicePlaybackSession, type VoiceSettings } from './types';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const SERVER_ERROR_MESSAGES: Record<string, string> = {
  model_not_found: '所选角色音色模型不存在，请在语音设置中重新选择。',
  invalid_manifest: '角色音色模型配置不完整，请检查情绪参考音频。',
  invalid_model_id: '角色音色模型名称无效。',
  synthesis_failed: '角色音色生成失败，请稍后再试。',
};

const activeRequests = new Set<AbortController>();
let readyState: { key: string; modelId: string } | null = null;
let pendingStart: { key: string; promise: Promise<string> } | null = null;
let lastBaseUrl = DEFAULT_GPT_SOVITS_API_URL;

// Text never leaves the machine: a non-loopback URL falls back to the default sidecar address.
export function resolveGptSovitsBaseUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl.trim() || DEFAULT_GPT_SOVITS_API_URL);
    if (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)) {
      return `${url.protocol}//${url.host}`;
    }
  } catch {
    // Fall through to the default.
  }
  return DEFAULT_GPT_SOVITS_API_URL;
}

function buildReadyKey(settings: VoiceSettings) {
  return [resolveGptSovitsBaseUrl(settings.gptSovitsApiUrl), settings.gptSovitsModelId, settings.gptSovitsDevice].join('::');
}

// Starting the sidecar probes Python and may load CUDA, so one successful start is reused per settings key.
async function ensureGptSovitsReady(settings: VoiceSettings) {
  const key = buildReadyKey(settings);
  if (readyState?.key === key) return readyState.modelId;
  if (pendingStart?.key !== key) {
    const promise = startGptSovitsService(settings).then((health) => {
      readyState = { key, modelId: health.modelId as string };
      return readyState.modelId;
    });
    pendingStart = { key, promise };
    void promise.catch(() => undefined).finally(() => {
      if (pendingStart?.promise === promise) pendingStart = null;
    });
  }
  return pendingStart.promise;
}

async function readServerError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: unknown } | null;
  const code = typeof payload?.error === 'string' ? payload.error : '';
  if (code === 'cancelled') return 'local_voice_cancelled';
  return SERVER_ERROR_MESSAGES[code] ?? SERVER_ERROR_MESSAGES.synthesis_failed;
}

async function requestGptSovitsAudio(text: string, settings: VoiceSettings, emotion: string, signal: AbortSignal) {
  const modelId = await ensureGptSovitsReady(settings);
  lastBaseUrl = resolveGptSovitsBaseUrl(settings.gptSovitsApiUrl);
  const response = await fetch(`${lastBaseUrl}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'audio/wav, application/json' },
    body: JSON.stringify({ text, model_id: modelId, emotion }),
    signal,
  });
  if (!response.ok) {
    throw new Error(await readServerError(response));
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error(SERVER_ERROR_MESSAGES.synthesis_failed);
  return blob;
}

function isConnectionError(error: unknown) {
  return error instanceof Error && /Failed to fetch|NetworkError|ERR_CONNECTION_REFUSED/iu.test(error.message);
}

export async function prepareGptSovitsVoicePlayback(
  text: string,
  settings: VoiceSettings,
  emotion = 'neutral',
): Promise<PreparedVoicePlayback> {
  const controller = new AbortController();
  activeRequests.add(controller);
  try {
    const blob = await requestGptSovitsAudio(text, settings, emotion, controller.signal).catch((error: unknown) => {
      if (!isConnectionError(error) || controller.signal.aborted) throw error;
      // The sidecar died or was restarted: drop the cached ready state and let one retry restart it.
      readyState = null;
      return requestGptSovitsAudio(text, settings, emotion, controller.signal);
    });
    return await createPreparedAudioPlayback(URL.createObjectURL(blob), true, 'GPT-SoVITS playback', settings.speechPlaybackRate);
  } catch (error) {
    // Callers detect cancellation by the raw marker, so it must not be translated into user text.
    if ((error as { name?: string })?.name === 'AbortError' || isVoiceCancellationError(error)) {
      throw new Error('local_voice_cancelled');
    }
    if (isConnectionError(error)) {
      readyState = null;
      throw new Error('GPT-SoVITS 本地服务未启动或已退出，请在语音设置中检查服务状态。');
    }
    throw new Error(getVoiceErrorMessage(error, SERVER_ERROR_MESSAGES.synthesis_failed));
  } finally {
    activeRequests.delete(controller);
  }
}

export async function createGptSovitsVoiceSession(
  text: string,
  settings: VoiceSettings,
  emotion?: string,
): Promise<VoicePlaybackSession> {
  return (await prepareGptSovitsVoicePlayback(text, settings, emotion)).play();
}

// Aborts in-flight requests and asks the sidecar to drop its current generation.
export function stopGptSovitsVoicePlayback() {
  if (activeRequests.size === 0) return;
  for (const controller of activeRequests) controller.abort();
  activeRequests.clear();
  void fetch(`${lastBaseUrl}/cancel`, { method: 'POST' }).catch(() => undefined);
}

export async function warmupGptSovitsVoice(settings: VoiceSettings) {
  const modelId = await ensureGptSovitsReady(settings);
  const response = await fetch(`${resolveGptSovitsBaseUrl(settings.gptSovitsApiUrl)}/warmup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model_id: modelId }),
  });
  if (!response.ok) throw new Error(await readServerError(response));
}
