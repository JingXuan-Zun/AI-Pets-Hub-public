export const DEFAULT_GPT_SOVITS_API_URL = 'http://127.0.0.1:9881';

/** Digits only, up to 9 of them (stays a safe 31-bit seed); anything else means "not fixed". */
export function normalizeGptSovitsSeed(value: unknown) {
  const text = typeof value === 'number' ? String(Math.trunc(value)) : typeof value === 'string' ? value.trim() : '';
  return /^\d{1,9}$/u.test(text) ? String(Number(text)) : '';
}
