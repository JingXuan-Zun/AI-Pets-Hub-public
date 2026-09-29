import { useEffect, useMemo, useRef } from 'react';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import {
  measurePositionDistance,
  parseLocalTestPositiveNumber,
} from './petContainerMath';

type Position = {
  x: number;
  y: number;
};

type LocalTestMenuPauseOptions = {
  petId: string;
  openDelayMs: number;
  waitForMovementMs: number;
  observeMs: number;
  thresholdPx: number;
};

interface UseLocalTestMenuPauseProbeOptions {
  openPetActionsForPet: (petId: string) => void;
  resolvePetPositionForLocalTest: (petId: string) => Position | null;
  selectPanelPet: (petId: string) => void;
}

function resolveLocalTestMenuPauseOptions() {
  if (typeof window === 'undefined') {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const targetPetId = (searchParams.get('localTestMenuPausePetId') ?? '').trim();
  if (!targetPetId) {
    return null;
  }

  return {
    petId: targetPetId,
    openDelayMs: parseLocalTestPositiveNumber(
      searchParams.get('localTestMenuPauseOpenDelayMs'),
      600,
    ),
    waitForMovementMs: parseLocalTestPositiveNumber(
      searchParams.get('localTestMenuPauseWaitForMovementMs'),
      4500,
    ),
    observeMs: parseLocalTestPositiveNumber(
      searchParams.get('localTestMenuPauseObserveMs'),
      1800,
    ),
    thresholdPx: parseLocalTestPositiveNumber(
      searchParams.get('localTestMenuPauseThresholdPx'),
      2,
    ),
  } satisfies LocalTestMenuPauseOptions;
}

export function useLocalTestMenuPauseProbe({
  openPetActionsForPet,
  resolvePetPositionForLocalTest,
  selectPanelPet,
}: UseLocalTestMenuPauseProbeOptions) {
  const probeStartedRef = useRef(false);
  const localTestMenuPauseOptions = useMemo(resolveLocalTestMenuPauseOptions, []);

  useEffect(() => {
    if (!localTestMenuPauseOptions || probeStartedRef.current) {
      return undefined;
    }

    probeStartedRef.current = true;
    let isCancelled = false;
    let armTimer: number | null = null;
    let waitForMovementTimer: number | null = null;
    let observeTimer: number | null = null;

    const clearTimers = () => {
      if (armTimer !== null) {
        window.clearTimeout(armTimer);
        armTimer = null;
      }
      if (waitForMovementTimer !== null) {
        window.clearInterval(waitForMovementTimer);
        waitForMovementTimer = null;
      }
      if (observeTimer !== null) {
        window.clearTimeout(observeTimer);
        observeTimer = null;
      }
    };

    armTimer = window.setTimeout(() => {
      if (isCancelled) {
        return;
      }

      pushFrontendRuntimeLog('local-test', 'menu movement lock probe armed', localTestMenuPauseOptions);
      selectPanelPet(localTestMenuPauseOptions.petId);
      let baselinePosition = resolvePetPositionForLocalTest(localTestMenuPauseOptions.petId);
      const waitStartedAt = Date.now();

      waitForMovementTimer = window.setInterval(() => {
        if (isCancelled) {
          return;
        }

        const currentPosition = resolvePetPositionForLocalTest(localTestMenuPauseOptions.petId);
        if (!currentPosition) {
          return;
        }

        if (!baselinePosition) {
          baselinePosition = currentPosition;
          return;
        }

        const movementDistance = measurePositionDistance(currentPosition, baselinePosition);
        if (movementDistance >= localTestMenuPauseOptions.thresholdPx) {
          if (waitForMovementTimer !== null) {
            window.clearInterval(waitForMovementTimer);
            waitForMovementTimer = null;
          }

          const lockedPosition = currentPosition;
          openPetActionsForPet(localTestMenuPauseOptions.petId);
          pushFrontendRuntimeLog('local-test', 'movement detected, opening pet actions', {
            petId: localTestMenuPauseOptions.petId,
            baselinePosition,
            lockedPosition,
            movementDistance,
          });

          observeTimer = window.setTimeout(() => {
            if (isCancelled) {
              return;
            }

            const finalPosition = resolvePetPositionForLocalTest(localTestMenuPauseOptions.petId);
            const driftDistance = finalPosition
              ? measurePositionDistance(finalPosition, lockedPosition)
              : null;
            const passed = typeof driftDistance === 'number'
              && driftDistance <= localTestMenuPauseOptions.thresholdPx;
            pushFrontendRuntimeLog(
              'local-test',
              passed
                ? 'PASS menu-open movement lock preserved selected pet position'
                : 'FAIL menu-open movement lock drift detected',
              {
                petId: localTestMenuPauseOptions.petId,
                lockedPosition,
                finalPosition,
                driftDistance,
                thresholdPx: localTestMenuPauseOptions.thresholdPx,
                observeMs: localTestMenuPauseOptions.observeMs,
              },
            );
          }, localTestMenuPauseOptions.observeMs);
          return;
        }

        if (Date.now() - waitStartedAt >= localTestMenuPauseOptions.waitForMovementMs) {
          if (waitForMovementTimer !== null) {
            window.clearInterval(waitForMovementTimer);
            waitForMovementTimer = null;
          }

          pushFrontendRuntimeLog('local-test', 'SKIP menu movement lock probe timed out before pet started moving', {
            petId: localTestMenuPauseOptions.petId,
            baselinePosition,
            thresholdPx: localTestMenuPauseOptions.thresholdPx,
            waitForMovementMs: localTestMenuPauseOptions.waitForMovementMs,
          });
        }
      }, 120);
    }, localTestMenuPauseOptions.openDelayMs);

    return () => {
      isCancelled = true;
      clearTimers();
    };
  }, [
    localTestMenuPauseOptions,
    openPetActionsForPet,
    resolvePetPositionForLocalTest,
    selectPanelPet,
  ]);
}
