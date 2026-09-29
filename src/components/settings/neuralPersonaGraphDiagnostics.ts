import type { Application } from 'pixi.js';

const SAMPLE_INTERVAL_MS = 500;

export type NeuralPersonaGraphDiagnosticsSample = {
  averageRenderMs: number;
  browserRafHz: number;
  frameIntervalP95Ms: number;
  inputToFrameP95Ms: number;
  longTaskCount: number;
  longestTaskMs: number;
  pointerHz: number;
  renderFps: number;
  tickerHz: number;
  tickerStartCount: number;
  tickerStopCount: number;
  visualLagPx: number;
  workerIntervalP95Ms: number;
  workerHz: number;
};

export type NeuralPersonaGraphDiagnosticsMetadata = {
  bufferSize: string;
  cssSize: string;
  devicePixelRatio: number;
  focused: boolean;
  gpuRenderer: string;
  visibility: DocumentVisibilityState;
};

export type NeuralPersonaGraphDiagnostics = {
  destroy: () => void;
  recordFrame: (renderMs: number) => void;
  recordMotionLag: (pixels: number) => void;
  recordPointer: () => void;
  recordTickerStart: () => void;
  recordTickerStop: () => void;
  recordTickerUpdate: () => void;
  recordWorkerFrame: () => void;
};

type DiagnosticsCounters = {
  browserRafCount: number;
  frameIntervals: number[];
  inputLatencies: number[];
  longTaskCount: number;
  longestTaskMs: number;
  motionLagSum: number;
  motionLagCount: number;
  pointerCount: number;
  renderCount: number;
  renderDurationMs: number;
  tickerStartCount: number;
  tickerStopCount: number;
  tickerUpdateCount: number;
  workerIntervals: number[];
  workerCount: number;
};

function emptyCounters(): DiagnosticsCounters {
  return {
    browserRafCount: 0, frameIntervals: [], inputLatencies: [], longTaskCount: 0, longestTaskMs: 0,
    motionLagCount: 0, motionLagSum: 0, pointerCount: 0, renderCount: 0,
    renderDurationMs: 0, tickerStartCount: 0, tickerStopCount: 0,
    tickerUpdateCount: 0, workerCount: 0, workerIntervals: [],
  };
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * ratio) - 1)];
}

export function calculateNeuralPersonaGraphDiagnosticsSample(
  counters: DiagnosticsCounters,
  elapsedMs: number,
): NeuralPersonaGraphDiagnosticsSample {
  const seconds = Math.max(1, elapsedMs) / 1000;
  return {
    averageRenderMs: counters.renderCount
      ? counters.renderDurationMs / counters.renderCount
      : 0,
    browserRafHz: counters.browserRafCount / seconds,
    frameIntervalP95Ms: percentile(counters.frameIntervals, 0.95),
    inputToFrameP95Ms: percentile(counters.inputLatencies, 0.95),
    longTaskCount: counters.longTaskCount,
    longestTaskMs: counters.longestTaskMs,
    pointerHz: counters.pointerCount / seconds,
    renderFps: counters.renderCount / seconds,
    tickerHz: counters.tickerUpdateCount / seconds,
    tickerStartCount: counters.tickerStartCount,
    tickerStopCount: counters.tickerStopCount,
    visualLagPx: counters.motionLagCount ? counters.motionLagSum / counters.motionLagCount : 0,
    workerIntervalP95Ms: percentile(counters.workerIntervals, 0.95),
    workerHz: counters.workerCount / seconds,
  };
}

export function formatNeuralPersonaGraphDiagnostics(
  sample: NeuralPersonaGraphDiagnosticsSample,
  metadata?: NeuralPersonaGraphDiagnosticsMetadata,
) {
  return [
    'Renderer  Pixi WebGL',
    metadata ? `GPU       ${metadata.gpuRenderer}` : null,
    metadata ? `Canvas    ${metadata.cssSize} -> ${metadata.bufferSize}` : null,
    metadata ? `Page      DPR ${metadata.devicePixelRatio.toFixed(2)} / ${metadata.visibility} / ${metadata.focused ? 'focus' : 'blur'}` : null,
    `Render    ${sample.renderFps.toFixed(1)} FPS`,
    `Browser rAF ${sample.browserRafHz.toFixed(1)} Hz`,
    `Pointer   ${sample.pointerHz.toFixed(1)} Hz`,
    `Worker    ${sample.workerHz.toFixed(1)} Hz`,
    `Frame P95 ${sample.frameIntervalP95Ms.toFixed(1)} ms`,
    `Worker P95 ${sample.workerIntervalP95Ms.toFixed(1)} ms`,
    `Input P95 ${sample.inputToFrameP95Ms.toFixed(1)} ms`,
    `Render    ${sample.averageRenderMs.toFixed(2)} ms`,
    `Ticker    ${sample.tickerHz.toFixed(1)} Hz / ${sample.tickerStartCount} start / ${sample.tickerStopCount} stop`,
    `Visual lag ${sample.visualLagPx.toFixed(1)} px`,
    `Long task ${sample.longTaskCount} / ${sample.longestTaskMs.toFixed(1)} ms`,
  ].filter(Boolean).join('\n');
}

function installLongTaskObserver(onTask: (duration: number) => void) {
  try {
    const observer = new PerformanceObserver((list) => list.getEntries().forEach((entry) => onTask(entry.duration)));
    observer.observe({ entryTypes: ['longtask'] });
    return () => observer.disconnect();
  } catch { return () => {}; }
}

export function createNeuralPersonaGraphDiagnostics(
  onSample: (sample: NeuralPersonaGraphDiagnosticsSample) => void,
): NeuralPersonaGraphDiagnostics {
  let counters = emptyCounters();
  let sampledAt = performance.now();
  let previousFrameAt: number | undefined;
  let previousWorkerAt: number | undefined;
  const pendingPointers: number[] = [];
  let rafId = 0;
  const countBrowserRaf = () => {
    counters.browserRafCount += 1;
    rafId = requestAnimationFrame(countBrowserRaf);
  };
  rafId = requestAnimationFrame(countBrowserRaf);
  const recordLongTask = (duration: number) => {
    counters.longTaskCount += 1;
    counters.longestTaskMs = Math.max(counters.longestTaskMs, duration);
  };
  const removeLongTaskObserver = installLongTaskObserver(recordLongTask);
  const timer = window.setInterval(() => {
    const now = performance.now();
    onSample(calculateNeuralPersonaGraphDiagnosticsSample(counters, now - sampledAt));
    counters = emptyCounters();
    sampledAt = now;
  }, SAMPLE_INTERVAL_MS);
  return {
    destroy: () => { cancelAnimationFrame(rafId); window.clearInterval(timer); removeLongTaskObserver(); },
    recordFrame: (renderMs) => {
      const now = performance.now();
      if (previousFrameAt !== undefined) counters.frameIntervals.push(now - previousFrameAt);
      previousFrameAt = now;
      pendingPointers.splice(0).forEach((pointerAt) => counters.inputLatencies.push(now - pointerAt));
      counters.renderCount += 1;
      counters.renderDurationMs += Math.max(0, renderMs);
    },
    recordMotionLag: (pixels) => {
      counters.motionLagCount += 1;
      counters.motionLagSum += Math.max(0, pixels);
    },
    recordPointer: () => {
      counters.pointerCount += 1;
      pendingPointers.push(performance.now());
      if (pendingPointers.length > 240) pendingPointers.shift();
    },
    recordTickerStart: () => { counters.tickerStartCount += 1; },
    recordTickerStop: () => { counters.tickerStopCount += 1; },
    recordTickerUpdate: () => { counters.tickerUpdateCount += 1; },
    recordWorkerFrame: () => {
      const now = performance.now();
      if (previousWorkerAt !== undefined) counters.workerIntervals.push(now - previousWorkerAt);
      previousWorkerAt = now;
      counters.workerCount += 1;
    },
  };
}

export function installNeuralPersonaGraphRenderDiagnostics(
  app: Application,
  diagnostics?: NeuralPersonaGraphDiagnostics,
) {
  if (!diagnostics) return () => {};
  let startedAt = 0;
  const before = () => { startedAt = performance.now(); };
  const after = () => diagnostics.recordFrame(performance.now() - startedAt);
  app.renderer.on('prerender', before);
  app.renderer.on('postrender', after);
  return () => {
    app.renderer.off('prerender', before);
    app.renderer.off('postrender', after);
  };
}
