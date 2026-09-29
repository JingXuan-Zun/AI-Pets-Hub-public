import { type DesktopPetAnimationToolPerformanceState } from '../../chatState';

export interface AnimationToolPerformanceDisplay {
  detail: string;
  petId: string;
  status: DesktopPetAnimationToolPerformanceState['status'];
  title: string;
  tone: 'active' | 'idle';
}

const STATUS_LABELS: Partial<Record<DesktopPetAnimationToolPerformanceState['status'], string>> = {
  cancelled: '已取消',
  ended: '已结束',
  playing: '演出中',
};

export function createAnimationToolPerformanceDisplay(
  state: DesktopPetAnimationToolPerformanceState | null | undefined,
): AnimationToolPerformanceDisplay | null {
  if (!state) {
    return null;
  }

  return {
    detail: state.itemCount > 0 ? `${state.itemCount} steps` : 'manual stop',
    petId: state.petId,
    status: state.status,
    title: STATUS_LABELS[state.status] ?? state.status,
    tone: state.status === 'playing' || state.status === 'paused' ? 'active' : 'idle',
  };
}
