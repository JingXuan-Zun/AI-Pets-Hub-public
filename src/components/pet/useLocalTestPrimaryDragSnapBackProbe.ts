import { useEffect, useMemo, useRef } from 'react';
import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../../multiPetRoster';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import {
  measurePositionDistance,
  parseLocalTestPositiveNumber,
} from './petContainerMath';

type Position = {
  x: number;
  y: number;
};

type LocalTestPrimaryDragSnapBackProbeOptions = {
  dragDeltaX: number;
  dragDeltaY: number;
  observeMs: number;
  primaryPetId: string;
  sampleIntervalMs: number;
  startDelayMs: number;
  stepThresholdPx: number;
  waitForReadyMs: number;
};

interface UseLocalTestPrimaryDragSnapBackProbeHookOptions {
  resolvePetPositionForLocalTest: (petId: string) => Position | null;
}

function resolveProbeOptions() {
  if (typeof window === 'undefined') {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const primaryPetId = (searchParams.get('localTestPrimarySnapBackPetId') ?? '').trim();
  if (!primaryPetId) {
    return null;
  }

  const dragDeltaX = Number(searchParams.get('localTestDragDeltaX') ?? '-220');
  const dragDeltaY = Number(searchParams.get('localTestDragDeltaY') ?? '0');

  return {
    dragDeltaX: Number.isFinite(dragDeltaX) ? dragDeltaX : -220,
    dragDeltaY: Number.isFinite(dragDeltaY) ? dragDeltaY : 0,
    observeMs: parseLocalTestPositiveNumber(
      searchParams.get('localTestDragObserveMs'),
      1800,
    ),
    primaryPetId: primaryPetId || PRIMARY_DESKTOP_PET_SLOT_ID,
    sampleIntervalMs: parseLocalTestPositiveNumber(
      searchParams.get('localTestDragSampleIntervalMs'),
      120,
    ),
    startDelayMs: parseLocalTestPositiveNumber(
      searchParams.get('localTestDragStartDelayMs'),
      1400,
    ),
    stepThresholdPx: parseLocalTestPositiveNumber(
      searchParams.get('localTestDragStepThresholdPx'),
      28,
    ),
    waitForReadyMs: parseLocalTestPositiveNumber(
      searchParams.get('localTestDragWaitForMovementMs'),
      7000,
    ),
  } satisfies LocalTestPrimaryDragSnapBackProbeOptions;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function dispatchPointerEvent(
  target: EventTarget,
  type: string,
  point: Position,
  buttons: number,
) {
  target.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    button: 0,
    buttons,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    composed: true,
    isPrimary: true,
    pointerId: 1,
    pointerType: 'mouse',
  }));
}

function resolveInteractivePetElement(petId: string) {
  return document.querySelector<HTMLElement>(`[data-desktop-pet-id="${petId}"]`);
}

export function useLocalTestPrimaryDragSnapBackProbe({
  resolvePetPositionForLocalTest,
}: UseLocalTestPrimaryDragSnapBackProbeHookOptions) {
  const probeStartedRef = useRef(false);
  const probeOptions = useMemo(resolveProbeOptions, []);

  useEffect(() => {
    if (!probeOptions || probeStartedRef.current) {
      return undefined;
    }

    probeStartedRef.current = true;
    let isCancelled = false;

    const runProbe = async () => {
      await delay(probeOptions.startDelayMs);
      if (isCancelled) {
        return;
      }

      pushFrontendRuntimeLog('local-test', 'primary-drag snap-back probe armed', probeOptions);

      let primaryPetElement = resolveInteractivePetElement(probeOptions.primaryPetId);
      let currentPosition = resolvePetPositionForLocalTest(probeOptions.primaryPetId);
      const readyStartedAt = Date.now();

      while (
        !isCancelled
        && (!primaryPetElement || !currentPosition)
        && (Date.now() - readyStartedAt) < probeOptions.waitForReadyMs
      ) {
        await delay(probeOptions.sampleIntervalMs);
        primaryPetElement = resolveInteractivePetElement(probeOptions.primaryPetId);
        currentPosition = resolvePetPositionForLocalTest(probeOptions.primaryPetId);
      }

      if (!primaryPetElement || !currentPosition) {
        pushFrontendRuntimeLog('local-test', 'FAIL primary-drag snap-back probe missing primary pet', {
          primaryPetId: probeOptions.primaryPetId,
        });
        return;
      }

      const rect = primaryPetElement.getBoundingClientRect();
      const startPoint = {
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2),
      };
      const dragSteps = 10;

      dispatchPointerEvent(primaryPetElement, 'pointerdown', startPoint, 1);
      for (let dragStep = 1; dragStep <= dragSteps; dragStep += 1) {
        await delay(16);
        const progress = dragStep / dragSteps;
        dispatchPointerEvent(window, 'pointermove', {
          x: Math.round(startPoint.x + probeOptions.dragDeltaX * progress),
          y: Math.round(startPoint.y + probeOptions.dragDeltaY * progress),
        }, 1);
      }
      dispatchPointerEvent(window, 'pointerup', {
        x: Math.round(startPoint.x + probeOptions.dragDeltaX),
        y: Math.round(startPoint.y + probeOptions.dragDeltaY),
      }, 0);

      const releasedPosition = resolvePetPositionForLocalTest(probeOptions.primaryPetId);
      if (!releasedPosition) {
        pushFrontendRuntimeLog('local-test', 'FAIL primary-drag snap-back probe missing released position', {
          primaryPetId: probeOptions.primaryPetId,
        });
        return;
      }

      let previousPosition = releasedPosition;
      let maxObservedStep = 0;
      let maxDriftDistance = 0;
      const observedPositions: Position[] = [];
      const observeStartedAt = Date.now();
      let interruptedByPointerDown: Position | null = null;
      const handlePointerDownDuringObserve = (event: PointerEvent) => {
        interruptedByPointerDown = {
          x: event.clientX,
          y: event.clientY,
        };
      };

      window.addEventListener('pointerdown', handlePointerDownDuringObserve, true);

      try {
        while (!isCancelled && (Date.now() - observeStartedAt) < probeOptions.observeMs) {
          if (interruptedByPointerDown) {
            break;
          }

          await delay(probeOptions.sampleIntervalMs);
          if (interruptedByPointerDown) {
            break;
          }

          const nextPosition = resolvePetPositionForLocalTest(probeOptions.primaryPetId);
          if (!nextPosition) {
            continue;
          }

          observedPositions.push(nextPosition);
          maxObservedStep = Math.max(
            maxObservedStep,
            measurePositionDistance(previousPosition, nextPosition),
          );
          maxDriftDistance = Math.max(
            maxDriftDistance,
            measurePositionDistance(releasedPosition, nextPosition),
          );
          previousPosition = nextPosition;
        }
      } finally {
        window.removeEventListener('pointerdown', handlePointerDownDuringObserve, true);
      }

      if (interruptedByPointerDown && observedPositions.length === 0) {
        pushFrontendRuntimeLog('local-test', 'SKIP primary-drag snap-back probe interrupted before sampling', {
          interruptedByPointerDown,
          observeMs: probeOptions.observeMs,
          primaryPetId: probeOptions.primaryPetId,
          releasedPosition,
          sampleIntervalMs: probeOptions.sampleIntervalMs,
        });
        return;
      }

      const passed = maxDriftDistance <= probeOptions.stepThresholdPx;
      pushFrontendRuntimeLog(
        'local-test',
        passed
          ? 'PASS primary-drag snap-back probe stayed stable'
          : 'FAIL primary-drag snap-back probe detected drift after release',
        {
          dragDeltaX: probeOptions.dragDeltaX,
          dragDeltaY: probeOptions.dragDeltaY,
          maxDriftDistance,
          maxObservedStep,
          observedPositions,
          interruptedByPointerDown,
          observedMs: Date.now() - observeStartedAt,
          primaryPetId: probeOptions.primaryPetId,
          releasedPosition,
          sampleIntervalMs: probeOptions.sampleIntervalMs,
          stepThresholdPx: probeOptions.stepThresholdPx,
        },
      );
    };

    void runProbe();

    return () => {
      isCancelled = true;
    };
  }, [probeOptions, resolvePetPositionForLocalTest]);
}
