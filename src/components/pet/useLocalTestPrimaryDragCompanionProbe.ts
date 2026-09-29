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

type LocalTestPrimaryDragCompanionProbeOptions = {
  companionPetId: string;
  dragDeltaX: number;
  dragDeltaY: number;
  observeMs: number;
  primaryPetId: string;
  sampleIntervalMs: number;
  startDelayMs: number;
  stepThresholdPx: number;
  waitForMovementMs: number;
};

interface UseLocalTestPrimaryDragCompanionProbeHookOptions {
  resolvePetPositionForLocalTest: (petId: string) => Position | null;
}

function resolveProbeOptions() {
  if (typeof window === 'undefined') {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const companionPetId = (searchParams.get('localTestDragCompanionPetId') ?? '').trim();
  if (!companionPetId) {
    return null;
  }

  const dragDeltaX = Number(searchParams.get('localTestDragDeltaX') ?? '-220');
  const dragDeltaY = Number(searchParams.get('localTestDragDeltaY') ?? '0');

  return {
    companionPetId,
    dragDeltaX: Number.isFinite(dragDeltaX) ? dragDeltaX : -220,
    dragDeltaY: Number.isFinite(dragDeltaY) ? dragDeltaY : 0,
    observeMs: parseLocalTestPositiveNumber(
      searchParams.get('localTestDragObserveMs'),
      1800,
    ),
    primaryPetId: (searchParams.get('localTestDragPrimaryPetId') ?? '').trim() || PRIMARY_DESKTOP_PET_SLOT_ID,
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
    waitForMovementMs: parseLocalTestPositiveNumber(
      searchParams.get('localTestDragWaitForMovementMs'),
      7000,
    ),
  } satisfies LocalTestPrimaryDragCompanionProbeOptions;
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

async function sampleMovingStep(
  petId: string,
  sampleIntervalMs: number,
  resolvePetPositionForLocalTest: (petId: string) => Position | null,
) {
  let previousPosition = resolvePetPositionForLocalTest(petId);
  let maxStep = 0;

  for (let sampleIndex = 0; sampleIndex < 6; sampleIndex += 1) {
    await delay(sampleIntervalMs);
    const nextPosition = resolvePetPositionForLocalTest(petId);
    if (!previousPosition || !nextPosition) {
      previousPosition = nextPosition;
      continue;
    }

    maxStep = Math.max(maxStep, measurePositionDistance(previousPosition, nextPosition));
    previousPosition = nextPosition;
  }

  return maxStep;
}

export function useLocalTestPrimaryDragCompanionProbe({
  resolvePetPositionForLocalTest,
}: UseLocalTestPrimaryDragCompanionProbeHookOptions) {
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

      pushFrontendRuntimeLog('local-test', 'primary-drag companion-bounce probe armed', probeOptions);

      let baselinePosition = resolvePetPositionForLocalTest(probeOptions.companionPetId);
      const waitStartedAt = Date.now();

      while (!isCancelled && (Date.now() - waitStartedAt) < probeOptions.waitForMovementMs) {
        await delay(probeOptions.sampleIntervalMs);
        const currentPosition = resolvePetPositionForLocalTest(probeOptions.companionPetId);
        if (!currentPosition) {
          continue;
        }

        if (!baselinePosition) {
          baselinePosition = currentPosition;
          continue;
        }

        if (measurePositionDistance(currentPosition, baselinePosition) >= 8) {
          const preDragMaxStep = await sampleMovingStep(
            probeOptions.companionPetId,
            probeOptions.sampleIntervalMs,
            resolvePetPositionForLocalTest,
          );
          const primaryPetElement = resolveInteractivePetElement(probeOptions.primaryPetId);

          if (!primaryPetElement) {
            pushFrontendRuntimeLog('local-test', 'FAIL primary-drag companion-bounce probe missing primary pet element', {
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

          let previousPosition = resolvePetPositionForLocalTest(probeOptions.companionPetId);
          let maxObservedStep = 0;
          const observedPositions: Position[] = [];
          const observeStartedAt = Date.now();

          while (!isCancelled && (Date.now() - observeStartedAt) < probeOptions.observeMs) {
            await delay(probeOptions.sampleIntervalMs);
            const nextPosition = resolvePetPositionForLocalTest(probeOptions.companionPetId);
            if (nextPosition) {
              observedPositions.push(nextPosition);
            }
            if (!previousPosition || !nextPosition) {
              previousPosition = nextPosition;
              continue;
            }

            maxObservedStep = Math.max(
              maxObservedStep,
              measurePositionDistance(previousPosition, nextPosition),
            );
            previousPosition = nextPosition;
          }

          const allowedStep = Math.max(
            probeOptions.stepThresholdPx,
            Number((preDragMaxStep * 1.8).toFixed(2)),
          );
          const passed = maxObservedStep <= allowedStep;

          pushFrontendRuntimeLog(
            'local-test',
            passed
              ? 'PASS primary-drag companion-bounce probe stayed smooth'
              : 'FAIL primary-drag companion-bounce probe detected snap-back jump',
            {
              allowedStep,
              companionPetId: probeOptions.companionPetId,
              dragDeltaX: probeOptions.dragDeltaX,
              dragDeltaY: probeOptions.dragDeltaY,
              maxObservedStep,
              observedPositions,
              preDragMaxStep,
              primaryPetId: probeOptions.primaryPetId,
              sampleIntervalMs: probeOptions.sampleIntervalMs,
            },
          );
          return;
        }
      }

      pushFrontendRuntimeLog('local-test', 'SKIP primary-drag companion-bounce probe timed out before companion started moving', {
        companionPetId: probeOptions.companionPetId,
        waitForMovementMs: probeOptions.waitForMovementMs,
      });
    };

    void runProbe();

    return () => {
      isCancelled = true;
    };
  }, [probeOptions, resolvePetPositionForLocalTest]);
}
