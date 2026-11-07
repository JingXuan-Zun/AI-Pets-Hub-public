// Where the user is in the first-run guide. Kept in localStorage (same origin for every window);
// whether the model is set up is always read from the config, never stored here.

const STORAGE_KEY = 'desktop-pet.onboarding.v1';

export interface OnboardingProgress {
  /** L01–L03 have been played once (later launches only get L12). */
  introPlayedAt?: number;
  skippedAt?: number;
  /** How many times L10 ("I can't understand yet") was spoken; after two it is text only. */
  notReadyReplies?: number;
  /** L20 + the welcome question happened: the guide is over. */
  welcomedAt?: number;
  /** After the first finished job she offered her real voice (once). */
  voiceHintAt?: number;
}

export function readOnboardingProgress(): OnboardingProgress {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as unknown;
    return parsed && typeof parsed === 'object' ? parsed as OnboardingProgress : {};
  } catch {
    return {};
  }
}

export function updateOnboardingProgress(change: Partial<OnboardingProgress>) {
  const next = { ...readOnboardingProgress(), ...change };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Without storage the guide just starts over next launch.
  }
  return next;
}
