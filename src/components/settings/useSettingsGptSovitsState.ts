import { useCallback, useEffect, useRef, useState } from 'react';
import { type BrowserTtsInstallProgress, type BrowserTtsInstallResult, type GptSovitsHealth, type PetConfig } from '../../types';
import {
  EMPTY_GPT_SOVITS_HEALTH,
  getGptSovitsHealth,
  installGptSovitsRuntime,
  onGptSovitsInstallProgress,
} from '../../voice/gptSovitsRuntime';
import { getVoiceErrorMessage } from '../../voice/errorMessages';
import { warmupGptSovitsVoice } from '../../voice/ttsGptSovitsPlayback';

export type GptSovitsBusyAction = 'checking' | 'installing' | 'starting' | null;

// Settings-side status for the GPT-SoVITS section: it only observes and triggers the voice runtime.
export function useSettingsGptSovitsState(settings: PetConfig['settings']) {
  const [health, setHealth] = useState<GptSovitsHealth>(EMPTY_GPT_SOVITS_HEALTH);
  const [busy, setBusy] = useState<GptSovitsBusyAction>(null);
  const [installProgress, setInstallProgress] = useState<BrowserTtsInstallProgress | null>(null);
  const [installResult, setInstallResult] = useState<BrowserTtsInstallResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const active = settings.ttsProvider === 'gpt-sovits';

  const refresh = useCallback(async () => {
    setBusy((current) => current ?? 'checking');
    try {
      setHealth(await getGptSovitsHealth(settingsRef.current));
    } finally {
      setBusy((current) => (current === 'checking' ? null : current));
    }
  }, []);

  useEffect(() => {
    if (active) void refresh();
  }, [active, refresh, settings.gptSovitsDevice, settings.gptSovitsModelId]);

  useEffect(() => onGptSovitsInstallProgress(setInstallProgress), []);

  const install = useCallback(async () => {
    setBusy('installing');
    setActionError(null);
    setInstallResult(null);
    try {
      setInstallResult(await installGptSovitsRuntime(settingsRef.current));
    } finally {
      setBusy(null);
      void refresh();
    }
  }, [refresh]);

  const startAndWarmup = useCallback(async () => {
    setBusy('starting');
    setActionError(null);
    try {
      await warmupGptSovitsVoice(settingsRef.current);
    } catch (error) {
      setActionError(getVoiceErrorMessage(error, 'GPT-SoVITS 服务启动失败。'));
    } finally {
      setBusy(null);
      void refresh();
    }
  }, [refresh]);

  return { actionError, busy, health, install, installProgress, installResult, refresh, startAndWarmup };
}
