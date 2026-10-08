import { pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import {
  buildGeminiGenerateContentEndpoint,
  buildGeminiTranscriptionPrompt,
  buildOpenAiAudioEndpoint,
  extractGeminiTextFromPayload,
  getSttApiProtocol,
} from './apiProtocols';
import { getSpeechRecognitionErrorMessage, getVoiceErrorMessage, normalizeVoiceErrorMessage } from './errorMessages';
import { transcribeLocalVoice } from './runtime';
import { type StartVoiceInputOptions, type VoiceInputSession, type VoiceSettings } from './types';

const LOCAL_STT_SAMPLE_RATE = 16000;

function createBrowserSttSession({
  settings,
  onError,
  onFinalTranscript,
  onInterimTranscript,
  onListeningChange,
}: StartVoiceInputOptions): VoiceInputSession {
  const SpeechRecognitionConstructor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!SpeechRecognitionConstructor) {
    throw new Error('当前环境不支持语音识别接口。');
  }

  const recognition = new SpeechRecognitionConstructor();
  let latestTranscript = '';

  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = settings.speechRecognitionLang || 'zh-CN';

  recognition.onresult = (event) => {
    let transcript = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      transcript += event.results[index][0]?.transcript ?? '';
    }

    latestTranscript = transcript.trim();
    onInterimTranscript(latestTranscript);
  };

  recognition.onerror = (event) => {
    onListeningChange(false);
    onError(getSpeechRecognitionErrorMessage(event.error ?? 'unknown_error'));
  };

  recognition.onend = () => {
    onListeningChange(false);
    const transcript = latestTranscript.trim();
    if (transcript) {
      onFinalTranscript(transcript);
    }
  };

  recognition.start();
  onListeningChange(true);

  return {
    stop: () => {
      recognition.stop();
    },
  };
}

function mergeAudioChunks(chunks: Float32Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;

  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.length;
  });

  return merged;
}

export function resampleAudio(samples: Float32Array, sourceRate: number, targetRate: number) {
  if (sourceRate === targetRate) {
    return samples;
  }

  const sampleRatio = sourceRate / targetRate;
  const targetLength = Math.max(1, Math.round(samples.length / sampleRatio));
  const result = new Float32Array(targetLength);

  for (let index = 0; index < targetLength; index += 1) {
    const sourceIndex = index * sampleRatio;
    const leftIndex = Math.floor(sourceIndex);
    const rightIndex = Math.min(samples.length - 1, leftIndex + 1);
    const mix = sourceIndex - leftIndex;
    result[index] = samples[leftIndex] * (1 - mix) + samples[rightIndex] * mix;
  }

  return result;
}

export function encodeWavBase64(samples: Float32Array, sampleRate: number) {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
}

function base64ToBlob(base64: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function getMicrophoneAccessErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return '麦克风权限被拒绝，请允许应用访问麦克风。';
      case 'NotFoundError':
        return '没有检测到可用麦克风。';
      case 'NotReadableError':
      case 'TrackStartError':
        return '麦克风当前无法读取，请检查是否被其他程序占用。';
      default:
        return getVoiceErrorMessage(error, '无法访问麦克风。');
    }
  }

  return getVoiceErrorMessage(error, '无法访问麦克风。');
}

async function createMicrophoneCaptureSession({
  emptyAudioMessage,
  onAudioReady,
  onError,
  onListeningChange,
}: {
  emptyAudioMessage: string;
  onAudioReady: (audioBase64: string) => Promise<void>;
  onError: (message: string) => void;
  onListeningChange: (isListening: boolean) => void;
}): Promise<VoiceInputSession> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前环境不支持语音录音。');
  }

  let mediaStream: MediaStream;
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
  } catch (error) {
    throw new Error(getMicrophoneAccessErrorMessage(error));
  }

  const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) {
    mediaStream.getTracks().forEach((track) => track.stop());
    throw new Error('当前环境不支持音频采样。');
  }

  const audioContext = new AudioContextConstructor();
  const sourceNode = audioContext.createMediaStreamSource(mediaStream);
  const processorNode = audioContext.createScriptProcessor(4096, 1, 1);
  const sinkGain = audioContext.createGain();
  const recordedChunks: Float32Array[] = [];
  let finalizing = false;

  sinkGain.gain.value = 0;
  processorNode.onaudioprocess = (event) => {
    const samples = event.inputBuffer.getChannelData(0);
    recordedChunks.push(new Float32Array(samples));
  };

  sourceNode.connect(processorNode);
  processorNode.connect(sinkGain);
  sinkGain.connect(audioContext.destination);
  onListeningChange(true);

  const finalize = async () => {
    if (finalizing) {
      return;
    }

    finalizing = true;
    onListeningChange(false);

    try {
      processorNode.disconnect();
      sourceNode.disconnect();
      sinkGain.disconnect();
    } catch {
      // Ignore disconnect failures.
    }

    mediaStream.getTracks().forEach((track) => track.stop());
    await audioContext.close();

    const merged = mergeAudioChunks(recordedChunks);
    if (!merged.length) {
      onError(emptyAudioMessage);
      return;
    }

    try {
      const resampled = resampleAudio(merged, audioContext.sampleRate, LOCAL_STT_SAMPLE_RATE);
      const audioBase64 = encodeWavBase64(resampled, LOCAL_STT_SAMPLE_RATE);
      await onAudioReady(audioBase64);
    } catch (error) {
      onError(getVoiceErrorMessage(error, '语音识别执行失败。'));
    }
  };

  return {
    stop: () => {
      void finalize();
    },
  };
}

function extractTranscriptFromApiPayload(payload: unknown) {
  if (typeof payload === 'string') {
    return payload.trim();
  }

  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const next = payload as {
    text?: unknown;
    transcript?: unknown;
    result?: unknown;
    data?: { text?: unknown; transcript?: unknown } | null;
  };

  if (typeof next.text === 'string') {
    return next.text.trim();
  }
  if (typeof next.transcript === 'string') {
    return next.transcript.trim();
  }
  if (typeof next.result === 'string') {
    return next.result.trim();
  }
  if (typeof next.data?.text === 'string') {
    return next.data.text.trim();
  }
  if (typeof next.data?.transcript === 'string') {
    return next.data.transcript.trim();
  }

  return '';
}

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

async function transcribeApiVoice(audioBase64: string, settings: VoiceSettings) {
  if (!settings.customSpeechModel.trim()) {
    throw new Error('识别模型名称未填写。');
  }

  const protocol = getSttApiProtocol(settings);
  const model = settings.customSpeechModel.trim();
  const apiKey = settings.customSpeechApiKey.trim();
  const language = settings.speechRecognitionLang.trim();

  pushFrontendRuntimeLog('语音', '开始 API 语音识别', {
    mode: 'stt',
    protocol,
    model,
    language: language || 'auto',
    audioBase64Length: audioBase64.length,
  });

  try {
    if (protocol === 'gemini') {
      const endpoint = buildGeminiGenerateContentEndpoint(settings.customSpeechApiUrl, model);
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
                { text: buildGeminiTranscriptionPrompt(language) },
                {
                  inlineData: {
                    mimeType: 'audio/wav',
                    data: audioBase64,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`API 识别失败：${await readApiErrorMessage(response)}`);
      }

      const payload = await response.json();
      const transcript = (
        extractGeminiTextFromPayload(payload)
        || extractTranscriptFromApiPayload(payload)
      ).trim();

      if (!transcript) {
        throw new Error('Gemini 识别返回为空。');
      }

      pushFrontendRuntimeLog('语音', 'API 语音识别完成', {
        mode: 'stt',
        protocol,
        model,
        transcriptLength: transcript.length,
      });

      return transcript;
    }

    const formData = new FormData();
    formData.set('file', new File([base64ToBlob(audioBase64, 'audio/wav')], 'speech.wav', { type: 'audio/wav' }));
    formData.set('model', model);
    formData.set('response_format', 'json');

    if (language) {
      formData.set('language', language);
    }

    const endpoint = buildOpenAiAudioEndpoint(settings.customSpeechApiUrl, 'stt');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: apiKey
        ? { Authorization: `Bearer ${apiKey}` }
        : undefined,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`API 识别失败：${await readApiErrorMessage(response)}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const transcript = contentType.includes('application/json')
      ? extractTranscriptFromApiPayload(await response.json()).trim()
      : (await response.text()).trim();

    pushFrontendRuntimeLog('语音', 'API 语音识别完成', {
      mode: 'stt',
      protocol,
      model,
      transcriptLength: transcript.length,
      responseType: contentType.includes('application/json') ? 'json' : 'text',
    });

    return transcript;
  } catch (error) {
    pushFrontendRuntimeLog('语音', 'API 语音识别失败', {
      mode: 'stt',
      protocol,
      model,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function createLocalSttSession({
  settings,
  onError,
  onFinalTranscript,
  onListeningChange,
}: StartVoiceInputOptions): Promise<VoiceInputSession> {
  if (!settings.localSttModelId) {
    throw new Error('本地语音识别未选择模型。');
  }

  return createMicrophoneCaptureSession({
    emptyAudioMessage: '本地语音识别没有录到有效音频。',
    onAudioReady: async (audioBase64) => {
      const transcript = (await transcribeLocalVoice(audioBase64, settings)).trim();
      if (!transcript) {
        throw new Error('本地识别没有返回有效文本。');
      }

      onFinalTranscript(transcript);
    },
    onError,
    onListeningChange,
  });
}

async function createApiSttSession({
  settings,
  onError,
  onFinalTranscript,
  onListeningChange,
}: StartVoiceInputOptions): Promise<VoiceInputSession> {
  return createMicrophoneCaptureSession({
    emptyAudioMessage: 'API 识别没有录到有效音频。',
    onAudioReady: async (audioBase64) => {
      const transcript = (await transcribeApiVoice(audioBase64, settings)).trim();
      if (!transcript) {
        throw new Error('API 识别没有返回有效文本。');
      }

      onFinalTranscript(transcript);
    },
    onError,
    onListeningChange,
  });
}

export async function startSttSession(options: StartVoiceInputOptions) {
  switch (options.settings.sttProvider) {
    case 'api':
      return createApiSttSession(options);
    case 'local':
      return createLocalSttSession(options);
    case 'browser':
    default:
      return createBrowserSttSession(options);
  }
}
