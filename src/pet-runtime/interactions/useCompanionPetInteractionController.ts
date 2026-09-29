import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { applyDesktopPetSlotChanges, getDesktopPetSlot } from '../../multiPetRoster';
import { applyFoodConsumedStats } from '../../components/pet/petStatsMath';
import { type CompanionPetConfig, type PetConfig, type PetConfigUpdateHandler } from '../../types';
import { hasExceededPetDragActivationThreshold } from './petDragController';
import { createPointerFrameScheduler } from './pointerFrameScheduler';

type Position = {
  x: number;
  y: number;
};

type CompanionClampPet = Pick<CompanionPetConfig, 'id' | 'scale'>;
const COMPANION_DRAG_ACTIVATION_THRESHOLD_PX = 1;

export type CompanionDragState =
  | {
      petId: string;
      offsetX: number;
      offsetY: number;
      startViewportPosition: Position;
    }
  | null;

export type CompanionDragPreview = {
  petId: string;
  position: Position;
} | null;

export type CompanionDragDelta = Position | null;

export function resolveCompanionDragDelta(
  previousPosition: Position,
  nextPosition: Position,
): Position {
  return {
    x: nextPosition.x - previousPosition.x,
    y: nextPosition.y - previousPosition.y,
  };
}

interface UseCompanionPetInteractionControllerOptions {
  addLog: (message: string) => void;
  clampCompanionPosition: (position: Position, pet: CompanionClampPet) => Position;
  clampCompanionDragPosition?: (position: Position, pet: CompanionClampPet) => Position;
  companionEatingDurationMs: number;
  configRef: MutableRefObject<PetConfig>;
  getPetEatReachThresholdForScale: (scale: number) => number;
  getScenePositionFromViewportPoint: (point: Position) => Position;
  manualEatingUntilByPetIdRef: MutableRefObject<Record<string, number>>;
  minPetScale: number;
  onCompanionEatScaleBoost: (petId: string) => void;
  onCompanionDragNativeRegionPreview?: (preview: {
    petId: string;
    position: Position;
    previousPosition: Position;
  }) => void;
  onCompanionDragNativeShapeActiveChange?: (active: boolean) => void;
  onUpdateConfig: PetConfigUpdateHandler;
  petScaleStep: number;
  pointerInteractionLockRef: MutableRefObject<boolean>;
  resolveCompanionMaxScale: (petId: string, currentScale: number) => number;
  resolveScaledCompanionPosition: (
    petId: string,
    currentPosition: Position,
    currentScale: number,
    nextScale: number,
  ) => Position;
}

function resolveLatestPointerViewportPosition(event: PointerEvent) {
  const coalescedEvents = typeof event.getCoalescedEvents === 'function'
    ? event.getCoalescedEvents()
    : [];
  const latestEvent = coalescedEvents[coalescedEvents.length - 1] ?? event;

  return {
    x: latestEvent.clientX,
    y: latestEvent.clientY,
  } satisfies Position;
}

export function useCompanionPetInteractionController({
  addLog,
  clampCompanionPosition,
  clampCompanionDragPosition,
  companionEatingDurationMs,
  configRef,
  getPetEatReachThresholdForScale,
  getScenePositionFromViewportPoint,
  manualEatingUntilByPetIdRef,
  minPetScale,
  onCompanionEatScaleBoost,
  onCompanionDragNativeRegionPreview,
  onCompanionDragNativeShapeActiveChange,
  onUpdateConfig,
  petScaleStep,
  pointerInteractionLockRef,
  resolveCompanionMaxScale,
  resolveScaledCompanionPosition,
}: UseCompanionPetInteractionControllerOptions) {
  const resolveCompanionDragPosition = clampCompanionDragPosition ?? clampCompanionPosition;
  const draggingCompanionPetIdRef = useRef<string | null>(null);
  const companionDragPreviewRef = useRef<CompanionDragPreview>(null);
  const releaseVisualDragFrameIdRef = useRef<number | null>(null);
  const nativeShapeActiveRef = useRef(false);
  const [companionDragState, setCompanionDragState] = useState<CompanionDragState>(null);
  const [companionDragPreview, setCompanionDragPreview] = useState<CompanionDragPreview>(null);
  const [companionDragDelta, setCompanionDragDelta] = useState<CompanionDragDelta>(null);
  const [isCompanionDragActive, setIsCompanionDragActive] = useState(false);
  const latestCompanionDragOptionsRef = useRef({
    addLog,
    clampCompanionPosition,
    clampCompanionDragPosition: resolveCompanionDragPosition,
    companionEatingDurationMs,
    getPetEatReachThresholdForScale,
    getScenePositionFromViewportPoint,
    onCompanionEatScaleBoost,
    onCompanionDragNativeRegionPreview,
    onCompanionDragNativeShapeActiveChange,
    onUpdateConfig,
  });
  latestCompanionDragOptionsRef.current = {
    addLog,
    clampCompanionPosition,
    clampCompanionDragPosition: resolveCompanionDragPosition,
    companionEatingDurationMs,
    getPetEatReachThresholdForScale,
    getScenePositionFromViewportPoint,
    onCompanionEatScaleBoost,
    onCompanionDragNativeRegionPreview,
    onCompanionDragNativeShapeActiveChange,
    onUpdateConfig,
  };

  const startCompanionDrag = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
    petId: string,
    renderedPosition?: Position,
  ) => {
    if (event.button !== 0) {
      return;
    }

    const currentSlot = getDesktopPetSlot(configRef.current, petId);
    if (!currentSlot || currentSlot.isPrimary || !currentSlot.enabled || !currentSlot.modelVisible) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerInteractionLockRef.current = true;
    if (releaseVisualDragFrameIdRef.current !== null) {
      window.cancelAnimationFrame(releaseVisualDragFrameIdRef.current);
      releaseVisualDragFrameIdRef.current = null;
    }
    companionDragPreviewRef.current = null;
    setCompanionDragPreview(null);
    setCompanionDragDelta(null);

    const pointerPosition = getScenePositionFromViewportPoint({ x: event.clientX, y: event.clientY });
    const basePosition = renderedPosition ?? currentSlot.position;
    const currentPosition = clampCompanionPosition(basePosition, currentSlot);
    if (
      currentPosition.x !== currentSlot.position.x
      || currentPosition.y !== currentSlot.position.y
    ) {
      const nextConfig = applyDesktopPetSlotChanges(configRef.current, petId, {
        position: currentPosition,
      });
      configRef.current = nextConfig;
      onUpdateConfig(nextConfig, { normalize: false });
    }

    setCompanionDragState({
      petId,
      offsetX: currentPosition.x - pointerPosition.x,
      offsetY: currentPosition.y - pointerPosition.y,
      startViewportPosition: { x: event.clientX, y: event.clientY },
    });
  }, [
    clampCompanionPosition,
    configRef,
    getScenePositionFromViewportPoint,
    onUpdateConfig,
    pointerInteractionLockRef,
  ]);

  const handleCompanionWheelScale = useCallback((event: ReactWheelEvent<HTMLDivElement>, petId: string) => {
    if (event.deltaY === 0) {
      return;
    }

    const currentSlot = getDesktopPetSlot(configRef.current, petId);
    if (!currentSlot || currentSlot.isPrimary || !currentSlot.enabled || !currentSlot.modelVisible) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const direction = event.deltaY < 0 ? 1 : -1;
    const companionMaxScale = resolveCompanionMaxScale(petId, currentSlot.scale);
    const nextScale = Math.max(
      minPetScale,
      Math.min(companionMaxScale, Number((currentSlot.scale + direction * petScaleStep).toFixed(2))),
    );

    if (Math.abs(nextScale - currentSlot.scale) < 0.001) {
      return;
    }

    const currentPosition = clampCompanionPosition(currentSlot.position, currentSlot);
    const nextConfig = applyDesktopPetSlotChanges(configRef.current, petId, {
      scale: nextScale,
      position: resolveScaledCompanionPosition(
        petId,
        currentPosition,
        currentSlot.scale,
        nextScale,
      ),
    });

    configRef.current = nextConfig;
    onUpdateConfig(nextConfig, { normalize: false });
  }, [
    clampCompanionPosition,
    configRef,
    minPetScale,
    onUpdateConfig,
    petScaleStep,
    resolveCompanionMaxScale,
    resolveScaledCompanionPosition,
  ]);

  useEffect(() => {
    if (!companionDragState) {
      return;
    }

    const applyPointerMove = (latestPointerViewportPosition: Position) => {
      const {
        addLog,
        clampCompanionPosition,
        clampCompanionDragPosition,
        companionEatingDurationMs,
        getPetEatReachThresholdForScale,
        getScenePositionFromViewportPoint,
        onCompanionEatScaleBoost,
        onCompanionDragNativeRegionPreview,
        onCompanionDragNativeShapeActiveChange,
        onUpdateConfig,
      } = latestCompanionDragOptionsRef.current;
      const currentSlot = getDesktopPetSlot(configRef.current, companionDragState.petId);
      if (!currentSlot || currentSlot.isPrimary || !currentSlot.enabled || !currentSlot.modelVisible) {
        return;
      }

      if (
        !companionDragPreviewRef.current
        && !hasExceededPetDragActivationThreshold(
          companionDragState.startViewportPosition,
          latestPointerViewportPosition,
          COMPANION_DRAG_ACTIVATION_THRESHOLD_PX,
        )
      ) {
        return;
      }

      const pointerPosition = getScenePositionFromViewportPoint(latestPointerViewportPosition);
      const previousPosition = companionDragPreviewRef.current?.petId === currentSlot.id
        ? companionDragPreviewRef.current.position
        : currentSlot.position;
      const nextPosition = clampCompanionDragPosition(
        {
          x: pointerPosition.x + companionDragState.offsetX,
          y: pointerPosition.y + companionDragState.offsetY,
        },
        currentSlot,
      );
      const nextPreview = {
        petId: currentSlot.id,
        position: nextPosition,
      };
      const hasPositionChanged = previousPosition.x !== nextPosition.x || previousPosition.y !== nextPosition.y;
      if (!companionDragPreviewRef.current && !hasPositionChanged) {
        return;
      }

      draggingCompanionPetIdRef.current = currentSlot.id;
      const isStartingNativeShapeSession = !nativeShapeActiveRef.current;
      if (isStartingNativeShapeSession) {
        nativeShapeActiveRef.current = true;
        onCompanionDragNativeShapeActiveChange?.(true);
      }
      companionDragPreviewRef.current = nextPreview;
      setCompanionDragDelta(resolveCompanionDragDelta(previousPosition, nextPosition));
      onCompanionDragNativeRegionPreview?.({
        petId: currentSlot.id,
        position: nextPosition,
        previousPosition,
      });
      setIsCompanionDragActive(true);
      setCompanionDragPreview((currentPreview) => (
        currentPreview?.petId === nextPreview.petId
        && currentPreview.position.x === nextPreview.position.x
        && currentPreview.position.y === nextPreview.position.y
          ? currentPreview
          : nextPreview
      ));

      const currentConfig = configRef.current;
      const nextFood = currentConfig.folders.find((folder) => (
        Math.hypot(nextPosition.x - folder.position.x, nextPosition.y - folder.position.y)
        <= getPetEatReachThresholdForScale(currentSlot.scale)
      ));

      let nextConfig = currentConfig;

      if (nextFood) {
        manualEatingUntilByPetIdRef.current[currentSlot.id] = Date.now() + companionEatingDurationMs;
        nextConfig = applyDesktopPetSlotChanges({
          ...currentConfig,
          folders: currentConfig.folders.filter((folder) => folder.id !== nextFood.id),
        }, currentSlot.id, {
          currentAction: 'EATING',
          position: nextPosition,
          stats: applyFoodConsumedStats(currentSlot.stats),
        });
        onCompanionEatScaleBoost(currentSlot.id);
        addLog(`${currentSlot.personality.name} 吃掉了 ${nextFood.name}`);
      }

      if (nextConfig !== currentConfig) {
        configRef.current = nextConfig;
        onUpdateConfig(nextConfig, { normalize: false });
      }
    };
    const pointerFrameScheduler = createPointerFrameScheduler(applyPointerMove);
    const handlePointerMove = (event: PointerEvent) => {
      pointerFrameScheduler.push(resolveLatestPointerViewportPosition(event));
    };

    const handlePointerUp = () => {
      pointerFrameScheduler.flush();
      const {
        onCompanionDragNativeShapeActiveChange,
        onUpdateConfig,
      } = latestCompanionDragOptionsRef.current;
      const currentSlot = getDesktopPetSlot(configRef.current, companionDragState.petId);
      const hadVisualDragPreview = companionDragPreviewRef.current?.petId === companionDragState.petId;
      const finalPosition = companionDragPreviewRef.current?.petId === companionDragState.petId
        ? companionDragPreviewRef.current.position
        : currentSlot?.position;

      if (
        currentSlot
        && !currentSlot.isPrimary
        && currentSlot.enabled
        && currentSlot.modelVisible
        && finalPosition
        && (
          finalPosition.x !== currentSlot.position.x
          || finalPosition.y !== currentSlot.position.y
        )
      ) {
        const nextConfig = applyDesktopPetSlotChanges(configRef.current, currentSlot.id, {
          position: finalPosition,
        });
        configRef.current = nextConfig;
        onUpdateConfig(nextConfig, { normalize: false });
      }

      draggingCompanionPetIdRef.current = null;
      pointerInteractionLockRef.current = false;
      if (nativeShapeActiveRef.current) {
        nativeShapeActiveRef.current = false;
        onCompanionDragNativeShapeActiveChange?.(false);
      }
      if (releaseVisualDragFrameIdRef.current !== null) {
        window.cancelAnimationFrame(releaseVisualDragFrameIdRef.current);
        releaseVisualDragFrameIdRef.current = null;
      }
      if (hadVisualDragPreview) {
        // Let React commit the final direction while the visual layer is still
        // marked as dragging. A very short gesture can otherwise batch the
        // final delta and the cleanup to the same render and lose the look cue.
        releaseVisualDragFrameIdRef.current = window.requestAnimationFrame(() => {
          releaseVisualDragFrameIdRef.current = null;
          companionDragPreviewRef.current = null;
          setCompanionDragPreview(null);
          setCompanionDragDelta(null);
        });
      } else {
        setCompanionDragDelta(null);
      }
      setCompanionDragState(null);
      setIsCompanionDragActive(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('pointercancel', handlePointerUp, { once: true });
    window.addEventListener('blur', handlePointerUp, { once: true });

    return () => {
      pointerFrameScheduler.cancel();
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('blur', handlePointerUp);
    };
  }, [companionDragState]);

  useEffect(() => (
    () => {
      if (releaseVisualDragFrameIdRef.current !== null) {
        window.cancelAnimationFrame(releaseVisualDragFrameIdRef.current);
        releaseVisualDragFrameIdRef.current = null;
      }
      draggingCompanionPetIdRef.current = null;
      companionDragPreviewRef.current = null;
      if (nativeShapeActiveRef.current) {
        nativeShapeActiveRef.current = false;
        latestCompanionDragOptionsRef.current.onCompanionDragNativeShapeActiveChange?.(false);
      }
      pointerInteractionLockRef.current = false;
    }
  ), [pointerInteractionLockRef]);

  return {
    companionDragPreview,
    companionDragDelta,
    companionDragState,
    draggingCompanionPetIdRef,
    handleCompanionWheelScale,
    isCompanionDragActive,
    startCompanionDrag,
  };
}
