import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';

type PointerLookTargetLike = {
  x: number;
  y: number;
} | null | undefined;

export type PointerLookDiagnosticsState = {
  lastAt: number;
  signature: string;
};

const POINTER_LOOK_DIAGNOSTIC_LOG_INTERVAL_MS = 420;

export function createPointerLookDiagnosticsState(): PointerLookDiagnosticsState {
  return {
    lastAt: 0,
    signature: '',
  };
}

export function isPointerLookDiagnosticsEnabled() {
  if (typeof window === 'undefined') {
    return false;
  }

  return new URLSearchParams(window.location.search).get('pointerDiagnostics') === '1';
}

export function summarizePointerLookTarget(target: PointerLookTargetLike) {
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
    return null;
  }

  return {
    x: Math.round(target.x),
    y: Math.round(target.y),
  };
}

export function createPointerLookTargetSignature(target: PointerLookTargetLike) {
  const summary = summarizePointerLookTarget(target);
  return summary
    ? `${summary.x},${summary.y}`
    : 'null';
}

export function pushPointerLookDiagnosticLog(
  state: PointerLookDiagnosticsState,
  message: string,
  signatureParts: Array<number | string | null | undefined>,
  details: Record<string, unknown>,
) {
  if (!isPointerLookDiagnosticsEnabled()) {
    return;
  }

  const now = window.performance?.now?.() ?? Date.now();
  const signature = signatureParts
    .map((part) => (part === null || part === undefined ? 'null' : String(part)))
    .join(':');

  if (
    state.signature === signature
    && now - state.lastAt < POINTER_LOOK_DIAGNOSTIC_LOG_INTERVAL_MS
  ) {
    return;
  }

  state.signature = signature;
  state.lastAt = now;
  pushFrontendRuntimeLog('pointer-look', message, details);
}

export function pushPointerLookTraceLog(
  state: PointerLookDiagnosticsState,
  message: string,
  signatureParts: Array<number | string | null | undefined>,
  details: Record<string, unknown>,
  minIntervalMs = 1200,
) {
  const now = typeof window !== 'undefined'
    ? window.performance?.now?.() ?? Date.now()
    : Date.now();
  const signature = signatureParts
    .map((part) => (part === null || part === undefined ? 'null' : String(part)))
    .join(':');

  if (
    state.signature === signature
    && now - state.lastAt < minIntervalMs
  ) {
    return;
  }

  state.signature = signature;
  state.lastAt = now;
  pushFrontendRuntimeLog('pointer-look', message, details);
}
