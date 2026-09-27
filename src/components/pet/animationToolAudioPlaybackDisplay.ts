import { type DesktopPetAnimationToolAudioPlaybackState } from '../../chatState';
import { createAnimationToolAudioProgressDetail } from './animationToolAudioPlaybackProgress';

export interface AnimationToolAudioPlaybackDisplay {
  detail: string;
  petId: string;
  resumeDetail?: string;
  sourceRef: string;
  status: DesktopPetAnimationToolAudioPlaybackState['status'];
  title: string;
  tone: 'active' | 'failed' | 'idle' | 'pending';
}

const STATUS_LABELS: Partial<Record<DesktopPetAnimationToolAudioPlaybackState['status'], string>> = {
  cancelled: '已取消',
  ended: '已结束',
  failed: '播放失败',
  pending: '等待播放',
  playing: '正在播放',
  skipped: '未播放',
};

function formatMs(value: number | undefined) {
  if (value === undefined || value <= 0) {
    return '';
  }

  return value >= 1000
    ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}s`
    : `${value}ms`;
}

function resolveTone(status: DesktopPetAnimationToolAudioPlaybackState['status']) {
  if (status === 'playing') {
    return 'active' as const;
  }
  if (status === 'pending' || status === 'paused') {
    return 'pending' as const;
  }
  if (status === 'failed') {
    return 'failed' as const;
  }

  return 'idle' as const;
}

function getAudioSourceLabel(sourceRef: string) {
  const normalizedRef = sourceRef.replace(/\\/g, '/');
  return normalizedRef.split('/').filter(Boolean).pop() ?? sourceRef;
}

function createPositionDetail(state: DesktopPetAnimationToolAudioPlaybackState) {
  return createAnimationToolAudioProgressDetail(state);
}

function createPlaybackDetail(state: DesktopPetAnimationToolAudioPlaybackState) {
  const parts = [
    createPositionDetail(state),
    state.status === 'pending' ? `延迟 ${formatMs(state.scheduledDelayMs)}` : '',
    state.syncOffsetMs === undefined ? '' : `同步 ${formatMs(state.syncOffsetMs) || '0ms'}`,
    state.errorMessage ? state.errorMessage : '',
  ].filter(Boolean);

  return parts.join(' · ') || getAudioSourceLabel(state.sourceRef);
}

export function createAnimationToolAudioPlaybackDisplay(
  state: DesktopPetAnimationToolAudioPlaybackState | null | undefined,
  _options: { tick?: number } = {},
): AnimationToolAudioPlaybackDisplay | null {
  if (!state) {
    return null;
  }

  return {
    detail: createPlaybackDetail(state),
    petId: state.petId,
    ...(state.resumeSupported === false && state.resumeUnsupportedReason
      ? { resumeDetail: state.resumeUnsupportedReason }
      : {}),
    sourceRef: state.sourceRef,
    status: state.status,
    title: STATUS_LABELS[state.status] ?? state.status,
    tone: resolveTone(state.status),
  };
}

export function resolveVisibleAnimationToolAudioPlaybackState(
  statesByPetId: Record<string, DesktopPetAnimationToolAudioPlaybackState | undefined>,
  activePetId: string,
) {
  const activeState = statesByPetId[activePetId];
  if (activeState) {
    return activeState;
  }

  return Object.values(statesByPetId)
    .filter((state): state is DesktopPetAnimationToolAudioPlaybackState => Boolean(state))
    .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null;
}
