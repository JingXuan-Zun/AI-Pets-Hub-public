import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from 'react';
import { type FolderItem, type PetAction, type PetConfig } from '../../types';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type PetRuntimePosition } from '../core/petRuntimeTypes';
import { type PetDragVisualPreviewHandler } from './petDragVisualPreview';

const PET_DRAG_ACTIVATION_THRESHOLD_PX = 3;

export type PetDragState =
  | { kind: 'pet'; offsetX: number; offsetY: number; startViewportPosition: PetRuntimePosition }
  | { kind: 'folder'; folderId: string; offsetX: number; offsetY: number }
  | null;

export type PetFolderDragPreview = {
  folderId: string;
  position: PetRuntimePosition;
} | null;

interface UsePetDragControllerOptions {
  addLog: (message: string) => void;
  clampPetPosition: (position: PetRuntimePosition) => PetRuntimePosition;
  clampToScene: (position: PetRuntimePosition, type: 'pet' | 'folder') => PetRuntimePosition;
  clearAutoMove: (nextAction?: PetAction, syncAction?: boolean) => void;
  configRef: MutableRefObject<PetConfig>;
  folderDragPreviewRef: MutableRefObject<PetFolderDragPreview>;
  getScenePositionFromViewportPoint: (point: PetRuntimePosition) => PetRuntimePosition;
  petPos: PetRuntimePosition;
  petPosRef: MutableRefObject<PetRuntimePosition>;
  pointerInteractionLockRef: MutableRefObject<boolean>;
  onPetDragNativeRegionPreview?: (preview: {
    position: PetRuntimePosition;
    previousPosition: PetRuntimePosition;
  }) => void;
  onPetDragNativeShapeActiveChange?: (active: boolean) => void;
  onPetDragVisualPreview?: PetDragVisualPreviewHandler;
  canInteractWithFolder?: (petPosition: PetRuntimePosition, folderPosition: PetRuntimePosition) => boolean;
  interactWithFolder?: (folder: FolderItem, positionOverride?: PetRuntimePosition, isManualHandoff?: boolean) => void;
  setPetPos: Dispatch<SetStateAction<PetRuntimePosition>>;
  updateFolderPosition: (folderId: string, position: PetRuntimePosition) => void;
  updatePetPosition: (position: PetRuntimePosition) => void;
}

function resolveLatestPointerViewportPosition(event: PointerEvent) {
  const coalescedEvents = typeof event.getCoalescedEvents === 'function'
    ? event.getCoalescedEvents()
    : [];
  const latestEvent = coalescedEvents[coalescedEvents.length - 1] ?? event;

  return {
    x: latestEvent.clientX,
    y: latestEvent.clientY,
  } satisfies PetRuntimePosition;
}

export function hasExceededPetDragActivationThreshold(
  startPosition: PetRuntimePosition,
  currentPosition: PetRuntimePosition,
  thresholdPx = PET_DRAG_ACTIVATION_THRESHOLD_PX,
) {
  return Math.hypot(
    currentPosition.x - startPosition.x,
    currentPosition.y - startPosition.y,
  ) >= Math.max(0, thresholdPx);
}

export function usePetDragController({
  addLog,
  clampPetPosition,
  clampToScene,
  clearAutoMove,
  configRef,
  folderDragPreviewRef,
  getScenePositionFromViewportPoint,
  petPos,
  petPosRef,
  pointerInteractionLockRef,
  onPetDragNativeRegionPreview,
  onPetDragNativeShapeActiveChange,
  onPetDragVisualPreview,
  canInteractWithFolder,
  interactWithFolder,
  setPetPos,
  updateFolderPosition,
  updatePetPosition,
}: UsePetDragControllerOptions) {
  const [dragState, setDragState] = useState<PetDragState>(null);
  const [folderDragPreview, setFolderDragPreview] = useState<PetFolderDragPreview>(null);
  const [isPetDragActive, setIsPetDragActive] = useState(false);
  const dragMovedRef = useRef(false);
  const nativeShapeActiveRef = useRef(false);
  const releaseVisualDragFrameIdRef = useRef<number | null>(null);
  const latestPointerViewportPositionRef = useRef<PetRuntimePosition | null>(null);
  const suppressPetClickRef = useRef(false);

  useEffect(() => () => {
    if (releaseVisualDragFrameIdRef.current !== null) {
      window.cancelAnimationFrame(releaseVisualDragFrameIdRef.current);
      releaseVisualDragFrameIdRef.current = null;
    }
  }, []);
  const latestDragOptionsRef = useRef({
    addLog,
    clampPetPosition,
    clampToScene,
    getScenePositionFromViewportPoint,
    onPetDragNativeRegionPreview,
    onPetDragNativeShapeActiveChange,
    onPetDragVisualPreview,
    canInteractWithFolder,
    interactWithFolder,
    setPetPos,
    updateFolderPosition,
    updatePetPosition,
  });
  latestDragOptionsRef.current = {
    addLog,
    clampPetPosition,
    clampToScene,
    getScenePositionFromViewportPoint,
    onPetDragNativeRegionPreview,
    onPetDragNativeShapeActiveChange,
    onPetDragVisualPreview,
    canInteractWithFolder,
    interactWithFolder,
    setPetPos,
    updateFolderPosition,
    updatePetPosition,
  };

  useEffect(() => {
    folderDragPreviewRef.current = folderDragPreview;
  }, [folderDragPreview]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    let dragAnimationFrameId: number | null = null;
    let pendingPointerViewportPosition: PetRuntimePosition | null = null;

    const applyPointerMove = (latestPointerViewportPosition: PetRuntimePosition) => {
      const latestOptions = latestDragOptionsRef.current;
      latestPointerViewportPositionRef.current = latestPointerViewportPosition;
      const pointerPosition = latestOptions.getScenePositionFromViewportPoint(latestPointerViewportPosition);

      if (dragState.kind === 'pet') {
        if (
          !dragMovedRef.current
          && !hasExceededPetDragActivationThreshold(
            dragState.startViewportPosition,
            latestPointerViewportPosition,
          )
        ) {
          return;
        }

        const previousPosition = petPosRef.current;
        const nextPosition = latestOptions.clampPetPosition({
          x: pointerPosition.x + dragState.offsetX,
          y: pointerPosition.y + dragState.offsetY,
        });
        const hasPositionChanged = previousPosition.x !== nextPosition.x || previousPosition.y !== nextPosition.y;
        if (!dragMovedRef.current && !hasPositionChanged) {
          return;
        }

        dragMovedRef.current = true;
        const isStartingNativeShapeSession = !nativeShapeActiveRef.current;
        if (isStartingNativeShapeSession) {
          nativeShapeActiveRef.current = true;
          latestOptions.onPetDragNativeShapeActiveChange?.(true);
        }
        latestOptions.onPetDragNativeRegionPreview?.({
          position: nextPosition,
          previousPosition,
        });
        if (isStartingNativeShapeSession) {
          setIsPetDragActive(true);
        }
        latestOptions.onPetDragVisualPreview?.({
          position: nextPosition,
          previousPosition,
        });
        petPosRef.current = nextPosition;
        return;
      }

      dragMovedRef.current = true;
      const nextPosition = latestOptions.clampToScene({
        x: pointerPosition.x + dragState.offsetX,
        y: pointerPosition.y + dragState.offsetY,
      }, 'folder');
      const nextPreview = {
        folderId: dragState.folderId,
        position: nextPosition,
      };

      folderDragPreviewRef.current = nextPreview;
      setFolderDragPreview((currentPreview) => (
        currentPreview?.folderId === nextPreview.folderId
        && currentPreview.position.x === nextPreview.position.x
        && currentPreview.position.y === nextPreview.position.y
          ? currentPreview
          : nextPreview
      ));
    };

    const flushPendingPointerMove = () => {
      if (dragAnimationFrameId !== null) {
        window.cancelAnimationFrame(dragAnimationFrameId);
        dragAnimationFrameId = null;
      }

      const nextPointerViewportPosition = pendingPointerViewportPosition;
      pendingPointerViewportPosition = null;
      if (!nextPointerViewportPosition) {
        return;
      }

      applyPointerMove(nextPointerViewportPosition);
    };

    const handlePointerMove = (event: PointerEvent) => {
      pendingPointerViewportPosition = resolveLatestPointerViewportPosition(event);
      if (dragAnimationFrameId !== null) {
        return;
      }

      dragAnimationFrameId = window.requestAnimationFrame(() => {
        dragAnimationFrameId = null;
        flushPendingPointerMove();
      });
    };

    const finishDrag = (reason: 'pointerup' | 'pointercancel' | 'blur') => {
      const {
        addLog,
        canInteractWithFolder,
        interactWithFolder,
        onPetDragNativeShapeActiveChange,
        setPetPos,
        updateFolderPosition,
        updatePetPosition,
      } = latestDragOptionsRef.current;
      flushPendingPointerMove();
      suppressPetClickRef.current = dragState.kind === 'pet' && dragMovedRef.current;

      if (dragState.kind === 'pet') {
        pushFrontendRuntimeLog('drag-diagnose', 'primary drag finish', {
          dragMoved: dragMovedRef.current,
          finalPetPosition: petPosRef.current,
          latestPointerViewportPosition: latestPointerViewportPositionRef.current,
          reason,
        });
        setPetPos((currentPosition) => (
          currentPosition.x === petPosRef.current.x
          && currentPosition.y === petPosRef.current.y
            ? currentPosition
            : petPosRef.current
        ));
        updatePetPosition(petPosRef.current);
        if (dragMovedRef.current) {
          addLog('已更新角色位置');
        }
      } else {
        const currentFolder = configRef.current.folders.find((item) => item.id === dragState.folderId);
        const finalFolderPosition = folderDragPreviewRef.current?.folderId === dragState.folderId
          ? folderDragPreviewRef.current.position
          : currentFolder?.position ?? { x: 0, y: 0 };
        if (currentFolder && canInteractWithFolder?.(petPosRef.current, finalFolderPosition)) {
          interactWithFolder?.(currentFolder, finalFolderPosition, reason === 'pointerup');
          addLog(`已将 ${currentFolder.name} 交给桌宠`);
        } else {
          updateFolderPosition(dragState.folderId, finalFolderPosition);
          if (dragMovedRef.current) {
            addLog(`已调整 ${currentFolder?.name ?? '道具'} 的位置`);
          }
        }
      }

      pointerInteractionLockRef.current = false;
      if (nativeShapeActiveRef.current) {
        nativeShapeActiveRef.current = false;
        onPetDragNativeShapeActiveChange?.(false);
      }
      folderDragPreviewRef.current = null;
      setDragState(null);
      setFolderDragPreview(null);
      if (dragState.kind === 'pet' && dragMovedRef.current) {
        releaseVisualDragFrameIdRef.current = window.requestAnimationFrame(() => {
          releaseVisualDragFrameIdRef.current = null;
          setIsPetDragActive(false);
        });
      } else {
        setIsPetDragActive(false);
      }
      dragMovedRef.current = false;
      latestPointerViewportPositionRef.current = null;
    };

    const handlePointerUp = () => {
      finishDrag('pointerup');
    };

    const handlePointerCancel = () => {
      finishDrag('pointercancel');
    };

    const handleWindowBlur = () => {
      finishDrag('blur');
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('pointercancel', handlePointerCancel, { once: true });
    window.addEventListener('blur', handleWindowBlur, { once: true });

    return () => {
      if (dragAnimationFrameId !== null) {
        window.cancelAnimationFrame(dragAnimationFrameId);
      }
      if (nativeShapeActiveRef.current) {
        nativeShapeActiveRef.current = false;
        latestDragOptionsRef.current.onPetDragNativeShapeActiveChange?.(false);
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [dragState]);

  const startPetDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
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
    clearAutoMove('IDLE');
    dragMovedRef.current = false;
    nativeShapeActiveRef.current = false;
    folderDragPreviewRef.current = null;
    setFolderDragPreview(null);

    const currentPetPosition = clampPetPosition(petPos);
    if (currentPetPosition.x !== petPos.x || currentPetPosition.y !== petPos.y) {
      petPosRef.current = currentPetPosition;
      setPetPos(currentPetPosition);
    }
    const pointerPosition = getScenePositionFromViewportPoint({ x: event.clientX, y: event.clientY });
    latestPointerViewportPositionRef.current = { x: event.clientX, y: event.clientY };
    pushFrontendRuntimeLog('drag-diagnose', 'primary drag start', {
      petPosition: currentPetPosition,
      pointerScenePosition: pointerPosition,
      pointerViewportPosition: latestPointerViewportPositionRef.current,
    });
    setDragState({
      kind: 'pet',
      offsetX: currentPetPosition.x - pointerPosition.x,
      offsetY: currentPetPosition.y - pointerPosition.y,
      startViewportPosition: latestPointerViewportPositionRef.current,
    });
  }, [
    clampPetPosition,
    clearAutoMove,
    getScenePositionFromViewportPoint,
    petPos,
    petPosRef,
    pointerInteractionLockRef,
    setPetPos,
  ]);

  const startFolderDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>, folder: FolderItem) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerInteractionLockRef.current = true;
    dragMovedRef.current = false;

    const pointerPosition = getScenePositionFromViewportPoint({ x: event.clientX, y: event.clientY });
    const nextPreview = {
      folderId: folder.id,
      position: folder.position,
    };

    folderDragPreviewRef.current = nextPreview;
    setFolderDragPreview(nextPreview);
    setDragState({
      kind: 'folder',
      folderId: folder.id,
      offsetX: folder.position.x - pointerPosition.x,
      offsetY: folder.position.y - pointerPosition.y,
    });
  }, [getScenePositionFromViewportPoint, pointerInteractionLockRef]);

  return {
    dragState,
    folderDragPreview,
    folderDragPreviewRef,
    isPetDragActive,
    startFolderDrag,
    startPetDrag,
    suppressPetClickRef,
  };
}
