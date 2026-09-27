import { pushFrontendRuntimeLog } from './frontendRuntimeLogger';

const EVENT_LOOP_SAMPLE_INTERVAL_MS = 250;
const EVENT_LOOP_REPORT_THRESHOLD_MS = 100;
const LONG_TASK_REPORT_THRESHOLD_MS = 80;
const REPORT_COOLDOWN_MS = 1000;
const RECENT_CONTEXT_WINDOW_MS = 2000;

let installed = false;
let recentContext: {
  details: Record<string, unknown>;
  recordedAt: number;
  scope: string;
} | null = null;

function resolvePanelMode() {
  if (typeof window === 'undefined') {
    return 'unknown';
  }

  return new URLSearchParams(window.location.search).get('panel') || 'main';
}

function report(kind: 'event-loop-lag' | 'long-task', details: Record<string, unknown>) {
  const now = performance.now();
  const context = recentContext && now - recentContext.recordedAt <= RECENT_CONTEXT_WINDOW_MS
    ? recentContext
    : null;
  pushFrontendRuntimeLog(`renderer-${kind}`, `Renderer ${kind} detected`, {
    panel: resolvePanelMode(),
    visibilityState: typeof document === 'undefined' ? 'unknown' : document.visibilityState,
    contextScope: context?.scope ?? null,
    contextAgeMs: context ? Math.round(now - context.recordedAt) : null,
    contextDetails: context?.details ?? null,
    ...details,
  });
}

export function markRendererDiagnosticContext(scope: string, details: Record<string, unknown>) {
  recentContext = {
    details,
    recordedAt: performance.now(),
    scope,
  };
}

export function installRendererEventLoopDiagnostics() {
  if (installed || typeof window === 'undefined') {
    return;
  }

  installed = true;
  let lastReportAt = 0;
  let expectedAt = performance.now() + EVENT_LOOP_SAMPLE_INTERVAL_MS;

  const sample = () => {
    const now = performance.now();
    const delayMs = Math.max(0, now - expectedAt);
    expectedAt = now + EVENT_LOOP_SAMPLE_INTERVAL_MS;

    if (document.visibilityState !== 'visible') {
      return;
    }

    if (delayMs >= EVENT_LOOP_REPORT_THRESHOLD_MS && now - lastReportAt >= REPORT_COOLDOWN_MS) {
      lastReportAt = now;
      report('event-loop-lag', {
        delayMs: Math.round(delayMs),
        sampleIntervalMs: EVENT_LOOP_SAMPLE_INTERVAL_MS,
      });
    }
  };

  window.setInterval(sample, EVENT_LOOP_SAMPLE_INTERVAL_MS);

  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const observer = new PerformanceObserver((list) => {
        if (document.visibilityState !== 'visible') {
          return;
        }

        for (const entry of list.getEntries()) {
          if (entry.duration < LONG_TASK_REPORT_THRESHOLD_MS) {
            continue;
          }

          const now = performance.now();
          if (now - lastReportAt < REPORT_COOLDOWN_MS) {
            continue;
          }

          lastReportAt = now;
          report('long-task', {
            durationMs: Math.round(entry.duration),
            startTimeMs: Math.round(entry.startTime),
            attributionCount: 'attribution' in entry
              ? ((entry as PerformanceEntry & { attribution?: unknown[] }).attribution?.length ?? 0)
              : 0,
          });
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
    } catch {
      // Long Task is optional; the event-loop timer remains available.
    }
  }

  document.addEventListener('visibilitychange', () => {
    expectedAt = performance.now() + EVENT_LOOP_SAMPLE_INTERVAL_MS;
  });
}
