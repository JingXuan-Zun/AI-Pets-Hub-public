import { useEffect, useRef } from 'react';
import { desktopPetShellRuntime } from '../desktopShellRuntime';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import { type PetConfig } from '../types';
import { warmupGptSovitsVoice } from '../voice/ttsGptSovitsPlayback';

// Loading the GPT-SoVITS model takes ~20–40 s, so the main window starts and warms it in the background
// shortly after launch (or after the voice settings change) instead of on the first reply.
const AUTO_WARMUP_DELAY_MS = 4000;

export function useGptSovitsAutoWarmup(settings: PetConfig['settings']) {
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const enabled = desktopPetShellRuntime.isDesktopMode()
    && settings.voiceEnabled
    && settings.ttsProvider === 'gpt-sovits';
  // Only the fields that change which sidecar/model gets warmed re-trigger the warmup.
  const warmupKey = enabled ? [settings.gptSovitsApiUrl, settings.gptSovitsDevice, settings.gptSovitsModelId].join('::') : '';

  useEffect(() => {
    if (!warmupKey) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const startedAt = performance.now();
      warmupGptSovitsVoice(settingsRef.current)
        .then(() => {
          if (!cancelled) {
            pushFrontendRuntimeLog('voice', 'gpt-sovits auto warmup ready', { elapsedMs: Math.round(performance.now() - startedAt) });
          }
        })
        .catch((error) => {
          if (!cancelled) pushFrontendRuntimeError('voice', 'gpt-sovits auto warmup failed', error);
        });
    }, AUTO_WARMUP_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [warmupKey]);
}
