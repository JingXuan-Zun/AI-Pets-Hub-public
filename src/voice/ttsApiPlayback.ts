import { pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import {
  buildGeminiGenerateContentEndpoint,
  buildOpenAiAudioEndpoint,
  convertGeminiPcmBase64ToWavBase64,
  extractGeminiInlineAudioPart,
  getTtsApiProtocol,
  resolveApiVoiceName,
} from './apiProtocols';
import { normalizeVoiceErrorMessage } from './errorMessages';
import { createPreparedAudioPlayback } from './ttsPlaybackPrimitives';
import { type PreparedVoicePlayback, type VoicePlaybackSession, type VoiceSettings } from './types';

async function readApiErrorMessage(response: Response) {
  const rawText = (await response.text()).trim();
  if (!rawText) {
    return response.statusText || `HTTP ${response.status}`;
  }

  try {
    const parsed = JSON.parse(rawText) as {
      error?: { message?: unknown } | string;
      message?: unknown;
    };
    const errorMessage =
      typeof parsed.error === 'string'
        ? parsed.error
        : typeof parsed.error?.message === 'string'
          ? parsed.error.message
          : typeof parsed.message === 'string'
            ? parsed.message
            : rawText;
    return normalizeVoiceErrorMessage(errorMessage, rawText);
  } catch {
    return normalizeVoiceErrorMessage(rawText, rawText);
  }
}

function extractApiAudioFromJsonPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const next = payload as {
    audioBase64?: unknown;
    audio?: unknown;
    data?: unknown;
    mimeType?: unknown;
    audioMimeType?: unknown;
  };

  const resolveMimeType = (...values: unknown[]) => {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return 'audio/wav';
  };

  if (typeof next.audioBase64 === 'string' && next.audioBase64.trim()) {
    return {
      audioBase64: next.audioBase64.trim(),
      mimeType: resolveMimeType(next.mimeType, next.audioMimeType),
    };
  }

  if (typeof next.audio === 'string' && next.audio.trim()) {
    return {
      audioBase64: next.audio.trim(),
      mimeType: resolveMimeType(next.mimeType, next.audioMimeType),
    };
  }

  const audioObject = next.audio && typeof next.audio === 'object'
    ? next.audio as { data?: unknown; base64?: unknown; mimeType?: unknown }
    : null;

  if (typeof audioObject?.data === 'string' && audioObject.data.trim()) {
    return {
      audioBase64: audioObject.data.trim(),
      mimeType: resolveMimeType(audioObject.mimeType, next.mimeType, next.audioMimeType),
    };
  }

  if (typeof audioObject?.base64 === 'string' && audioObject.base64.trim()) {
    return {
      audioBase64: audioObject.base64.trim(),
      mimeType: resolveMimeType(audioObject.mimeType, next.mimeType, next.audioMimeType),
    };
  }

  const dataObject = next.data && typeof next.data === 'object'
    ? next.data as { audioBase64?: unknown; audio?: unknown; mimeType?: unknown }
    : null;

  if (typeof dataObject?.audioBase64 === 'string' && dataObject.audioBase64.trim()) {
    return {
      audioBase64: dataObject.audioBase64.trim(),
      mimeType: resolveMimeType(dataObject.mimeType, next.mimeType, next.audioMimeType),
    };
  }

  if (typeof dataObject?.audio === 'string' && dataObject.audio.trim()) {
    return {
      audioBase64: dataObject.audio.trim(),
      mimeType: resolveMimeType(dataObject.mimeType, next.mimeType, next.audioMimeType),
    };
  }

  return null;
}

function parseGeminiSampleRate(mimeType: string) {
  const match = mimeType.match(/(?:rate|sample[_-]?rate)\s*=\s*(\d{4,6})/iu);
  const nextRate = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(nextRate) ? nextRate : undefined;
}

export async function prepareApiVoicePlayback(text: string, settings: VoiceSettings): Promise<PreparedVoicePlayback> {
  if (!settings.customVoiceModel.trim()) {
    throw new Error('Voice model name is required.');
  }

  const protocol = getTtsApiProtocol(settings);
  const model = settings.customVoiceModel.trim();
  const apiKey = settings.customVoiceApiKey.trim();
  const voiceName = resolveApiVoiceName(settings, protocol);

  pushFrontendRuntimeLog('语音', '开始 API 语音生成', {
    mode: 'tts',
    protocol,
    model,
    voiceName,
    textLength: text.length,
  });

  try {
    if (protocol === 'gemini') {
      const endpoint = buildGeminiGenerateContentEndpoint(settings.customVoiceApiUrl, model);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(apiKey ? { 'x-goog-api-key': apiKey } : {}),
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Read the following text exactly as written. Do not add or remove words.\n\n${text}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName,
                },
              },
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API 语音生成失败：${await readApiErrorMessage(response)}`);
      }

      const payload = await response.json();
      const audioPart = extractGeminiInlineAudioPart(payload);

      if (!audioPart?.data) {
        throw new Error('Gemini 语音返回中没有可播放的音频数据。');
      }

      const normalizedMimeType = audioPart.mimeType.trim().toLowerCase();
      const wavBase64 = /wave|wav/iu.test(normalizedMimeType)
        ? audioPart.data
        : convertGeminiPcmBase64ToWavBase64(
          audioPart.data,
          parseGeminiSampleRate(normalizedMimeType),
        );

      pushFrontendRuntimeLog('语音', 'API 语音生成完成', {
        mode: 'tts',
        protocol,
        model,
        audioMimeType: audioPart.mimeType || 'audio/wav',
      });

      return await createPreparedAudioPlayback(
        `data:audio/wav;base64,${wavBase64}`,
        false,
        'API 语音播放',
        settings.speechPlaybackRate,
      );
    }

    const endpoint = buildOpenAiAudioEndpoint(settings.customVoiceApiUrl, 'tts');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/wav, application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        input: text,
        voice: voiceName,
        response_format: 'wav',
      }),
    });

    if (!response.ok) {
      throw new Error(`API 语音生成失败：${await readApiErrorMessage(response)}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const payload = await response.json();
      const audioPayload = extractApiAudioFromJsonPayload(payload);

      if (!audioPayload) {
        throw new Error('API 语音返回了 JSON，但里面没有可播放的音频数据。');
      }

      pushFrontendRuntimeLog('语音', 'API 语音生成完成', {
        mode: 'tts',
        protocol,
        model,
        contentType,
        responseType: 'json',
      });

      return await createPreparedAudioPlayback(
        `data:${audioPayload.mimeType};base64,${audioPayload.audioBase64}`,
        false,
        'API 语音播放',
        settings.speechPlaybackRate,
      );
    }

    const blob = await response.blob();

    pushFrontendRuntimeLog('语音', 'API 语音生成完成', {
      mode: 'tts',
      protocol,
      model,
      contentType: contentType || blob.type || 'unknown',
      responseType: 'binary',
    });

    return await createPreparedAudioPlayback(
      URL.createObjectURL(blob),
      true,
      'API 语音播放',
      settings.speechPlaybackRate,
    );
  } catch (error) {
    pushFrontendRuntimeLog('语音', 'API 语音生成失败', {
      mode: 'tts',
      protocol,
      model,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function createApiVoiceSession(text: string, settings: VoiceSettings): Promise<VoicePlaybackSession> {
  const preparedPlayback = await prepareApiVoicePlayback(text, settings);
  return preparedPlayback.play();
}
