import { DEFAULT_BROWSER_TTS_API_URL, DEFAULT_BROWSER_TTS_VOICE } from '../constants';
import { desktopPetShellRuntime } from '../desktopShellRuntime';
import { startBrowserTtsService } from './browserTtsRuntime';
import { getVoiceErrorMessage } from './errorMessages';
import { createPreparedAudioPlayback } from './ttsPlaybackPrimitives';
import { type PreparedVoicePlayback, type VoicePlaybackSession, type VoiceSettings } from './types';

const activeBrowserTtsRequests = new Set<AbortController>();

function buildBrowserTtsGenerateEndpoint(rawUrl: string) {
  const normalizedUrl = rawUrl.trim() || DEFAULT_BROWSER_TTS_API_URL;

  try {
    const url = new URL(normalizedUrl);
    const normalizedPath = url.pathname.replace(/\/+$/, '');
    if (normalizedPath.endsWith('/tts/generate')) {
      return url.toString();
    }

    url.pathname = `${normalizedPath}/tts/generate`;
    return url.toString();
  } catch {
    return normalizedUrl.replace(/\/+$/, '') + '/tts/generate';
  }
}

async function readBrowserTtsErrorMessage(response: Response) {
  const rawText = (await response.text().catch(() => '')).trim();
  if (!rawText) {
    return response.statusText || `HTTP ${response.status}`;
  }

  try {
    const parsed = JSON.parse(rawText) as {
      detail?: unknown;
      error?: unknown;
      message?: unknown;
    };
    return typeof parsed.detail === 'string'
      ? parsed.detail
      : typeof parsed.error === 'string'
        ? parsed.error
        : typeof parsed.message === 'string'
          ? parsed.message
          : rawText;
  } catch {
    return rawText;
  }
}

function isLikelyBrowserTtsConnectionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /Failed to fetch|NetworkError|Load failed|ERR_CONNECTION_REFUSED|browser_tts_health_timeout/i.test(error.message);
}

function resolveBrowserTtsSpeaker(settings: VoiceSettings) {
  return settings.voiceName.trim() || DEFAULT_BROWSER_TTS_VOICE;
}

export function stopBrowserVoicePlayback() {
  for (const controller of activeBrowserTtsRequests) {
    controller.abort();
  }

  activeBrowserTtsRequests.clear();
}

export async function createPreparedBrowserVoicePlayback(
  text: string,
  settings: VoiceSettings,
): Promise<PreparedVoicePlayback> {
  const controller = new AbortController();
  activeBrowserTtsRequests.add(controller);

  try {
    if (desktopPetShellRuntime.isDesktopMode()) {
      await startBrowserTtsService(settings);
    }

    const endpoint = buildBrowserTtsGenerateEndpoint(settings.browserTtsApiUrl);
    const apiKey = settings.browserTtsApiKey.trim();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg, audio/wav, audio/*, application/octet-stream',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        text,
        speaker: resolveBrowserTtsSpeaker(settings),
        language: settings.browserTtsLanguage.trim() || 'Auto',
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Browser TTS ${response.status}: ${await readBrowserTtsErrorMessage(response)}`);
    }

    const blob = await response.blob();
    if (!blob.size) {
      throw new Error('Browser TTS did not return playable audio data.');
    }

    return await createPreparedAudioPlayback(
      URL.createObjectURL(blob),
      true,
      'Browser TTS playback',
      settings.speechPlaybackRate,
    );
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') {
      throw new Error('local_voice_cancelled');
    }

    if (isLikelyBrowserTtsConnectionError(error)) {
      throw new Error('Edge-TTS 本地服务未启动或端口不可访问，请先在语音设置里启动服务，默认地址为 http://127.0.0.1:9880。');
    }

    throw new Error(getVoiceErrorMessage(error, 'Browser TTS playback failed.'));
  } finally {
    activeBrowserTtsRequests.delete(controller);
  }
}

export async function createBrowserVoiceSession(
  text: string,
  settings: VoiceSettings,
): Promise<VoicePlaybackSession> {
  const preparedPlayback = await createPreparedBrowserVoicePlayback(text, settings);
  return preparedPlayback.play();
}
