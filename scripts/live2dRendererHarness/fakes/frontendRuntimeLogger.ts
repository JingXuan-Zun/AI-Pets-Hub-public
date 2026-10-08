import { record } from '../traceStore.ts';

export function pushFrontendRuntimeLog(scope: string, message: string, details?: unknown) {
  record(`log ${scope} ${message}`, details ?? null);
}

export function pushFrontendRuntimeError(scope: string, message: string, error: unknown, details?: Record<string, unknown>) {
  record(`error ${scope} ${message}`, error instanceof Error ? error.message : String(error), details ?? null);
}

export function installRendererRuntimeLogging() {}
