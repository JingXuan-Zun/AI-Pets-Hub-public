import { createConversationVad, type ConversationVadEvent } from './conversationVad';
import { encodeWavBase64, resampleAudio } from './stt';

const STT_SAMPLE_RATE = 16000;
// ~21 ms frames at 48 kHz keep onset/offset detection responsive.
const CAPTURE_FRAME_SIZE = 1024;

export interface ConversationCaptureHandlers {
  onSpeechStart?: () => void;
  /** A finished utterance as 16 kHz mono WAV (base64), ready for local STT. */
  onUtterance: (audioBase64: string, durationMs: number) => void;
}

export interface ConversationCapture {
  /** Stop feeding audio to the detector (e.g. while the pet is speaking) without releasing the mic. */
  pause: () => void;
  resume: () => void;
  isPaused: () => boolean;
  stop: () => Promise<void>;
}

function handleVadEvent(event: ConversationVadEvent | null, sampleRate: number, handlers: ConversationCaptureHandlers) {
  if (!event) return;
  if (event.type === 'speech-start') {
    handlers.onSpeechStart?.();
  } else if (event.type === 'utterance') {
    const resampled = resampleAudio(event.samples, sampleRate, STT_SAMPLE_RATE);
    handlers.onUtterance(encodeWavBase64(resampled, STT_SAMPLE_RATE), Math.round(event.durationMs));
  }
}

// Keeps the microphone open and emits one WAV per detected utterance (half-duplex: callers pause it).
export async function startConversationCapture(handlers: ConversationCaptureHandlers): Promise<ConversationCapture> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('当前环境不支持语音录音。');
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const audioContext = new AudioContext();
  const sourceNode = audioContext.createMediaStreamSource(mediaStream);
  const processorNode = audioContext.createScriptProcessor(CAPTURE_FRAME_SIZE, 1, 1);
  const sinkGain = audioContext.createGain();
  const vad = createConversationVad({ sampleRate: audioContext.sampleRate });
  let paused = false;

  sinkGain.gain.value = 0;
  processorNode.onaudioprocess = (event) => {
    if (paused) return;
    const frame = new Float32Array(event.inputBuffer.getChannelData(0));
    handleVadEvent(vad.push(frame), audioContext.sampleRate, handlers);
  };
  sourceNode.connect(processorNode);
  processorNode.connect(sinkGain);
  sinkGain.connect(audioContext.destination);

  return {
    pause: () => {
      paused = true;
      vad.reset();
    },
    resume: () => {
      vad.reset();
      paused = false;
    },
    isPaused: () => paused,
    stop: async () => {
      paused = true;
      processorNode.onaudioprocess = null;
      try {
        processorNode.disconnect();
        sourceNode.disconnect();
        sinkGain.disconnect();
      } catch {
        // Already disconnected.
      }
      mediaStream.getTracks().forEach((track) => track.stop());
      await audioContext.close().catch(() => undefined);
    },
  };
}
