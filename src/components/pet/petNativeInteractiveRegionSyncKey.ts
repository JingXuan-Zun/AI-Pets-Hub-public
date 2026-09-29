type Position = {
  x: number;
  y: number;
};

type Size = {
  height: number;
  width: number;
};

type VisualBounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

type NativeInteractiveRegionSyncPet = {
  position: Position;
  scale?: number;
  visualBounds?: VisualBounds | null;
};

type NativeInteractiveRegionSyncCompanion = NativeInteractiveRegionSyncPet & {
  id: string;
};

type CreateNativeInteractiveRegionPostRenderSyncKeyOptions = {
  activityArea: Size;
  activityCenter: Position;
  companionSlots?: NativeInteractiveRegionSyncCompanion[];
  isActivityRegionInteractionActive?: boolean;
  isCompanionDragActive?: boolean;
  isPetMotionActive?: boolean;
  isPrimaryDragActive?: boolean;
  panelLayoutKey?: string;
  primary: NativeInteractiveRegionSyncPet;
};

function formatNumber(value: number) {
  return Number.isFinite(value) ? String(Math.round(value)) : '0';
}

function formatQuantizedNumber(value: number, quantum: number) {
  if (!Number.isFinite(value)) {
    return '0';
  }

  const safeQuantum = Math.max(1, Math.round(quantum));
  return String(Math.round(value / safeQuantum) * safeQuantum);
}

function formatScale(value: number | null | undefined) {
  return Number.isFinite(value) ? String(Math.round((value ?? 0) * 1000)) : 'na';
}

function formatPosition(position: Position, quantum = 1) {
  return `${formatQuantizedNumber(position.x, quantum)},${formatQuantizedNumber(position.y, quantum)}`;
}

function formatBounds(bounds: VisualBounds | null | undefined, quantum = 1) {
  if (!bounds) {
    return 'na';
  }

  return [
    formatQuantizedNumber(bounds.left, quantum),
    formatQuantizedNumber(bounds.right, quantum),
    formatQuantizedNumber(bounds.top, quantum),
    formatQuantizedNumber(bounds.bottom, quantum),
  ].join(',');
}

function formatPet(pet: NativeInteractiveRegionSyncPet, positionQuantum = 1, boundsQuantum = 1) {
  return [
    formatPosition(pet.position, positionQuantum),
    formatScale(pet.scale),
    formatBounds(pet.visualBounds, boundsQuantum),
  ].join(',');
}

export function createNativeInteractiveRegionPostRenderSyncKey({
  activityArea,
  activityCenter,
  companionSlots = [],
  isActivityRegionInteractionActive = false,
  isCompanionDragActive = false,
  isPetMotionActive = false,
  isPrimaryDragActive = false,
  panelLayoutKey = '',
  primary,
}: CreateNativeInteractiveRegionPostRenderSyncKeyOptions) {
  const isInteractiveSyncActive = isPrimaryDragActive
    || isCompanionDragActive
    || isActivityRegionInteractionActive;
  const positionQuantum = isPetMotionActive && !isInteractiveSyncActive ? 8 : 1;
  const boundsQuantum = isPetMotionActive && !isInteractiveSyncActive ? 16 : 1;
  const companionKey = companionSlots
    .map((slot) => `${slot.id}:${formatPet(slot, positionQuantum, boundsQuantum)}`)
    .join(';');

  return [
    `activity:${formatPosition(activityCenter)},${formatNumber(activityArea.width)},${formatNumber(activityArea.height)}`,
    `primary:${formatPet(primary, positionQuantum, boundsQuantum)}`,
    `companions:${companionKey}`,
    `panels:${panelLayoutKey}`,
    `state:${isPrimaryDragActive ? 1 : 0},${isCompanionDragActive ? 1 : 0},${isActivityRegionInteractionActive ? 1 : 0},${isPetMotionActive ? 1 : 0}`,
  ].join('|');
}
