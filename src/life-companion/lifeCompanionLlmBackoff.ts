const BASE_BACKOFF_MINUTES = 30;
const MAX_BACKOFF_MINUTES = 240;
const MINUTE_MS = 60 * 1000;

export interface LifeCompanionLlmBackoffState {
  failureCount: number;
  lastErrorMessage: string | null;
  retryAfter: number | null;
}

export const DEFAULT_LIFE_COMPANION_LLM_BACKOFF_STATE: LifeCompanionLlmBackoffState = {
  failureCount: 0,
  lastErrorMessage: null,
  retryAfter: null,
};

export function isLifeCompanionLlmBackoffActive(
  state: LifeCompanionLlmBackoffState,
  now = Date.now(),
) {
  return state.retryAfter !== null && now < state.retryAfter;
}

export function applyLifeCompanionLlmBackoffFailure(
  state: LifeCompanionLlmBackoffState,
  errorMessage: string,
  now = Date.now(),
) {
  const failureCount = Math.max(1, state.failureCount + 1);
  const backoffMinutes = Math.min(
    MAX_BACKOFF_MINUTES,
    BASE_BACKOFF_MINUTES * 2 ** Math.min(3, failureCount - 1),
  );

  return {
    failureCount,
    lastErrorMessage: errorMessage.trim() || 'unknown error',
    retryAfter: now + backoffMinutes * MINUTE_MS,
  } satisfies LifeCompanionLlmBackoffState;
}

export function clearLifeCompanionLlmBackoff() {
  return { ...DEFAULT_LIFE_COMPANION_LLM_BACKOFF_STATE };
}
