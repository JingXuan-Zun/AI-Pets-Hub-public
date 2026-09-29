import {
  type DesktopPetAnimationToolPerformanceStatus,
  type DesktopPetAnimationToolPerformanceTriggerKind,
} from '../../chatState';

export interface AnimationToolTriggerPlaybackResult {
  handled: boolean;
  itemCount?: number;
  status?: DesktopPetAnimationToolPerformanceStatus;
  triggerKind?: DesktopPetAnimationToolPerformanceTriggerKind;
}
