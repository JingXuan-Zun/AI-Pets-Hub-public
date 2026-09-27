const DEFAULT_LIP_SYNC_CYCLE_MS = 220;
const DEFAULT_LIP_SYNC_VISEMES = ['aa', 'ih', 'ou', 'ee', 'oh'] as const;

export type Avatar3DViseme = typeof DEFAULT_LIP_SYNC_VISEMES[number];

export type Avatar3DLipSyncControllerState = {
  cycleMs: number;
  isActive: boolean;
  mouthOpen: number;
  speechPhase: number;
  viseme: Avatar3DViseme | null;
};

type ResolveAvatar3DLipSyncControllerStateOptions = {
  cycleMs?: number;
  isSpeaking?: boolean;
  timestampMs?: number;
};

function resolveSpeechPhase(timestampMs: number, cycleMs: number) {
  const normalizedCycleMs = Math.max(120, Math.round(cycleMs));
  return (timestampMs % normalizedCycleMs) / normalizedCycleMs;
}

function resolveMouthOpenAmount(speechPhase: number) {
  const waveform = Math.sin(speechPhase * Math.PI * 2);
  return Number((0.35 + ((waveform + 1) / 2) * 0.65).toFixed(3));
}

function resolveViseme(speechPhase: number): Avatar3DViseme {
  const visemeIndex = Math.min(
    DEFAULT_LIP_SYNC_VISEMES.length - 1,
    Math.floor(speechPhase * DEFAULT_LIP_SYNC_VISEMES.length),
  );

  return DEFAULT_LIP_SYNC_VISEMES[visemeIndex] ?? 'aa';
}

export function resolveAvatar3DLipSyncControllerState({
  cycleMs = DEFAULT_LIP_SYNC_CYCLE_MS,
  isSpeaking = false,
  timestampMs = Date.now(),
}: ResolveAvatar3DLipSyncControllerStateOptions): Avatar3DLipSyncControllerState {
  if (!isSpeaking) {
    return {
      cycleMs,
      isActive: false,
      mouthOpen: 0,
      speechPhase: 0,
      viseme: null,
    };
  }

  const speechPhase = resolveSpeechPhase(timestampMs, cycleMs);
  return {
    cycleMs,
    isActive: true,
    mouthOpen: resolveMouthOpenAmount(speechPhase),
    speechPhase: Number(speechPhase.toFixed(3)),
    viseme: resolveViseme(speechPhase),
  };
}
