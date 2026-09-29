import {
  type DesktopPetAnimationToolPerformanceStatus,
  type DesktopPetAnimationToolPerformanceTriggerKind,
} from '../../chatState';
import { desktopPetChatStore } from '../../chatStore';

export function setAnimationToolPerformanceRuntimeState(options: {
  itemCount: number;
  petId?: string;
  status: DesktopPetAnimationToolPerformanceStatus;
  token: number;
  triggerKind?: DesktopPetAnimationToolPerformanceTriggerKind;
}) {
  if (!options.petId) {
    return;
  }

  desktopPetChatStore.setAnimationToolPerformanceState(options.petId, {
    itemCount: Math.max(0, Math.round(options.itemCount)),
    petId: options.petId,
    status: options.status,
    token: options.token,
    ...(options.triggerKind ? { triggerKind: options.triggerKind } : {}),
    updatedAt: Date.now(),
  });
}
