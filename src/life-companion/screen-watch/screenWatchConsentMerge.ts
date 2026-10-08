import type { PetConfig } from '../../types';

/**
 * Watching is switched off from the pet (断开 or "不用看了") while the settings window
 * may hold an older draft. When saving or reverting that draft, keep the live consent
 * unless the user changed the switch in settings themselves.
 */
export function keepLiveScreenWatchConsent(next: PetConfig, opened: PetConfig, live: PetConfig): PetConfig {
  const draft = next.settings.lifeCompanion.screenWatchConsented;
  if (draft !== opened.settings.lifeCompanion.screenWatchConsented) return next;
  const current = live.settings.lifeCompanion.screenWatchConsented;
  if (draft === current) return next;
  return { ...next, settings: { ...next.settings, lifeCompanion: { ...next.settings.lifeCompanion, screenWatchConsented: current } } };
}
