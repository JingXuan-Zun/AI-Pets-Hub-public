import { type VoiceApiProtocol } from '../types';
import { type VoiceSettings } from './types';

const DEFAULT_OPENAI_AUDIO_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GEMINI_PCM_SAMPLE_RATE = 24000;

export const DEFAULT_OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
export const DEFAULT_OPENAI_STT_MODEL = 'gpt-4o-mini-transcribe';
export const DEFAULT_GEMINI_TTS_MODEL = 'gemini-3.1-flash-tts-preview';
export const DEFAULT_GEMINI_STT_MODEL = 'gemini-2.5-flash';
export const DEFAULT_OPENAI_TTS_VOICE = 'alloy';
export const DEFAULT_GEMINI_TTS_VOICE = 'Kore';

function normalizeUrlWithFallback(rawUrl: string, fallbackUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return fallbackUrl;
  }

  return trimmed;
}

function appendPathname(url: URL, pathname: string) {
  const normalizedBasePath = url.pathname.replace(/\/+$/, '');
  url.pathname = `${normalizedBasePath}${pathname}`;
  return url.toString();
}

export function getTtsApiProtocol(settings: VoiceSettings): VoiceApiProtocol {
  return settings.apiTtsProtocol === 'gemini' ? 'gemini' : 'openai';
}

export function getSttApiProtocol(settings: VoiceSettings): VoiceApiProtocol {
  return settings.apiSttProtocol === 'gemini' ? 'gemini' : 'openai';
}

export function getApiProtocolLabel(protocol: VoiceApiProtocol) {
  return protocol === 'gemini' ? 'Gemini 协议' : 'OpenAI 协议';
}

export function getDefaultTtsModelForProtocol(protocol: VoiceApiProtocol) {
  return protocol === 'gemini' ? DEFAULT_GEMINI_TTS_MODEL : DEFAULT_OPENAI_TTS_MODEL;
}

export function getDefaultSttModelForProtocol(protocol: VoiceApiProtocol) {
  return protocol === 'gemini' ? DEFAULT_GEMINI_STT_MODEL : DEFAULT_OPENAI_STT_MODEL;
}

export function getDefaultVoiceNameForProtocol(protocol: VoiceApiProtocol) {
  return protocol === 'gemini' ? DEFAULT_GEMINI_TTS_VOICE : DEFAULT_OPENAI_TTS_VOICE;
}

export function resolveApiVoiceName(settings: VoiceSettings, protocol: VoiceApiProtocol) {
  const trimmed = settings.voiceName.trim();
  return trimmed || getDefaultVoiceNameForProtocol(protocol);
}

export function buildOpenAiAudioEndpoint(rawUrl: string, mode: 'tts' | 'stt') {
  const fallbackUrl = `${DEFAULT_OPENAI_AUDIO_BASE_URL}/audio/${mode === 'tts' ? 'speech' : 'transcriptions'}`;
  const normalized = normalizeUrlWithFallback(rawUrl, fallbackUrl);

  try {
    const url = new URL(normalized);
    const normalizedPath = url.pathname.replace(/\/+$/, '');
    const targetSuffix = mode === 'tts' ? '/audio/speech' : '/audio/transcriptions';

    if (normalizedPath.endsWith(targetSuffix)) {
      return url.toString();
    }

    if (/\/v\d+$/i.test(normalizedPath)) {
      return appendPathname(url, targetSuffix);
    }

    if (normalizedPath === '' || normalizedPath === '/') {
      url.pathname = `/v1${targetSuffix}`;
      return url.toString();
    }

    return appendPathname(url, targetSuffix);
  } catch {
    return normalized;
  }
}

export function buildGeminiGenerateContentEndpoint(rawUrl: string, model: string) {
  const resolvedModel = model.trim();
  const fallbackUrl = `${DEFAULT_GEMINI_API_BASE_URL}/models/${resolvedModel}:generateContent`;
  const normalized = normalizeUrlWithFallback(rawUrl, fallbackUrl);

  try {
    const url = new URL(normalized);
    const normalizedPath = url.pathname.replace(/\/+$/, '');

    if (/:generateContent$/i.test(normalizedPath)) {
      return url.toString();
    }

    if (/\/models\/[^/]+$/i.test(normalizedPath)) {
      url.pathname = `${normalizedPath}:generateContent`;
      return url.toString();
    }

    if (/\/v[\w.-]+$/i.test(normalizedPath)) {
      url.pathname = `${normalizedPath}/models/${resolvedModel}:generateContent`;
      return url.toString();
    }

    if (normalizedPath === '' || normalizedPath === '/') {
      url.pathname = `/v1beta/models/${resolvedModel}:generateContent`;
      return url.toString();
    }

    url.pathname = `${normalizedPath}/models/${resolvedModel}:generateContent`;
    return url.toString();
  } catch {
    return normalized;
  }
}

export function buildGeminiTranscriptionPrompt(languageCode: string) {
  const trimmed = languageCode.trim();
  return trimmed
    ? `Generate a transcript of the speech. Return only the transcript text in ${trimmed}.`
    : 'Generate a transcript of the speech. Return only the transcript text.';
}

export function extractGeminiTextFromPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const candidates = Array.isArray((payload as { candidates?: unknown }).candidates)
    ? (payload as { candidates: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> }).candidates
    : [];

  const textSegments = candidates
    .flatMap((candidate) => Array.isArray(candidate.content?.parts) ? candidate.content.parts : [])
    .map((part) => (typeof part.text === 'string' ? part.text.trim() : ''))
    .filter(Boolean);

  return textSegments.join('\n').trim();
}

export function extractGeminiInlineAudioPart(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidates = Array.isArray((payload as { candidates?: unknown }).candidates)
    ? (payload as { candidates: Array<{ content?: { parts?: Array<{ inlineData?: { data?: unknown; mimeType?: unknown } }> } }> }).candidates
    : [];

  for (const candidate of candidates) {
    const parts = Array.isArray(candidate.content?.parts) ? candidate.content.parts : [];
    for (const part of parts) {
      const data = typeof part.inlineData?.data === 'string' ? part.inlineData.data.trim() : '';
      if (!data) {
        continue;
      }

      const mimeType = typeof part.inlineData?.mimeType === 'string' ? part.inlineData.mimeType.trim() : '';
      return {
        data,
        mimeType,
      };
    }
  }

  return null;
}

function encodeWavHeader(byteLength: number, sampleRate: number, channelCount = 1, bytesPerSample = 2) {
  const blockAlign = channelCount * bytesPerSample;
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + byteLength, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeText(36, 'data');
  view.setUint32(40, byteLength, true);

  return new Uint8Array(buffer);
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function convertGeminiPcmBase64ToWavBase64(base64: string, sampleRate = DEFAULT_GEMINI_PCM_SAMPLE_RATE) {
  const pcmBytes = base64ToBytes(base64);
  const headerBytes = encodeWavHeader(pcmBytes.byteLength, sampleRate);
  const wavBytes = new Uint8Array(headerBytes.byteLength + pcmBytes.byteLength);
  wavBytes.set(headerBytes, 0);
  wavBytes.set(pcmBytes, headerBytes.byteLength);
  return bytesToBase64(wavBytes);
}
