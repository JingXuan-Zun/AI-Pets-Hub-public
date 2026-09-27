import { useEffect, useRef, type MutableRefObject } from 'react';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { isLive2DDragReleaseProbeEnabled } from './live2dDragProbeFlag';
import { logLive2DDragProbeReport } from './live2dDragReleaseProbeReport';
import {
  collectLive2DDragProbeSample,
  type Live2DDragProbeSample,
  type Live2DDragReleaseProbeOptions,
} from './live2dDragReleaseProbeSample';

const LIVE2D_DRAG_PROBE_OBSERVE_MS = 3200;
const LIVE2D_DRAG_PROBE_SAMPLE_INTERVAL_MS = 32;
const LIVE2D_DRAG_PROBE_MAX_RUNS = 6;

let live2DDragProbeRunCount = 0;

function shouldStartProbe(options: Live2DDragReleaseProbeOptions, wasDragging: boolean) {
  return !options.isDragging
    && wasDragging
    && options.modelType === 'live2d'
    && isLive2DDragReleaseProbeEnabled()
    && live2DDragProbeRunCount < LIVE2D_DRAG_PROBE_MAX_RUNS;
}

function startProbe(
  latestOptionsRef: MutableRefObject<Live2DDragReleaseProbeOptions>,
  probeRun: number,
) {
  const samples: Live2DDragProbeSample[] = [];
  const startedAtMs = window.performance?.now?.() ?? Date.now();
  let timeoutId: number | null = null;
  let cancelled = false;
  let reported = false;

  const report = (status: 'completed' | 'interrupted') => {
    if (reported || samples.length < 2) {
      return;
    }
    reported = true;
    const latestOptions = latestOptionsRef.current;
    logLive2DDragProbeReport({
      modelUrl: latestOptions.modelUrl,
      observeMs: samples.at(-1)?.tMs ?? 0,
      petId: latestOptions.petId,
      probeRun,
      samples,
      scale: latestOptions.scale,
      status,
    });
  };

  const sample = () => {
    if (cancelled) {
      return;
    }
    const latestOptions = latestOptionsRef.current;
    samples.push(collectLive2DDragProbeSample(latestOptions, startedAtMs));
    const elapsedMs = (window.performance?.now?.() ?? Date.now()) - startedAtMs;
    if (elapsedMs >= LIVE2D_DRAG_PROBE_OBSERVE_MS) {
      report('completed');
      return;
    }
    timeoutId = window.setTimeout(sample, LIVE2D_DRAG_PROBE_SAMPLE_INTERVAL_MS);
  };

  sample();
  return () => {
    cancelled = true;
    report('interrupted');
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  };
}

export function useLive2DDragReleaseProbe(options: Live2DDragReleaseProbeOptions) {
  const latestOptionsRef = useRef(options);
  const wasDraggingRef = useRef(options.isDragging);
  latestOptionsRef.current = options;

  useEffect(() => {
    const wasDragging = wasDraggingRef.current;
    wasDraggingRef.current = options.isDragging;
    if (!shouldStartProbe(options, wasDragging)) {
      return undefined;
    }

    live2DDragProbeRunCount += 1;
    const probeRun = live2DDragProbeRunCount;
    pushFrontendRuntimeLog('drag-diagnose', 'TEMP live2d drag release probe started', {
      maxRuns: LIVE2D_DRAG_PROBE_MAX_RUNS,
      modelUrl: options.modelUrl,
      observeMs: LIVE2D_DRAG_PROBE_OBSERVE_MS,
      petId: options.petId,
      probeRun,
      sampleIntervalMs: LIVE2D_DRAG_PROBE_SAMPLE_INTERVAL_MS,
      scale: options.scale,
    });
    return startProbe(latestOptionsRef, probeRun);
  }, [options.isDragging, options.modelType, options.modelUrl, options.petId, options.scale]);
}
