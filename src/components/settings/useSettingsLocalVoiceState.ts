import { useCallback, useEffect, useState } from 'react';
import {
  type LocalVoiceAssets,
  type BrowserTtsHealth,
  type BrowserTtsInstallProgress,
  type BrowserTtsInstallResult,
  type LocalVoiceHealth,
  type LocalVoiceInstallProgress,
  type LocalVoiceInstallResult,
  type PetConfig,
} from '../../types';
import { listLocalVoiceAssets } from '../../voice/catalog';
import {
  getBrowserTtsHealth,
  installBrowserTtsDependencies,
  onBrowserTtsInstallProgress,
  startBrowserTtsService,
} from '../../voice/browserTtsRuntime';
import { getLocalVoiceHealth, installLocalVoiceDependencies, onLocalVoiceInstallProgress } from '../../voice/runtime';
import { EMPTY_BROWSER_TTS_HEALTH, EMPTY_LOCAL_VOICE_ASSETS, EMPTY_LOCAL_VOICE_HEALTH } from '../../voice/shared';

interface UseSettingsLocalVoiceStateOptions {
  activeTab: string;
  config: PetConfig;
  isOpen: boolean;
  resetToken: number;
}

export function useSettingsLocalVoiceState({
  activeTab,
  config,
  isOpen,
  resetToken,
}: UseSettingsLocalVoiceStateOptions) {
  const [localVoiceAssets, setLocalVoiceAssets] = useState<LocalVoiceAssets>(EMPTY_LOCAL_VOICE_ASSETS);
  const [localVoiceHealth, setLocalVoiceHealth] = useState<LocalVoiceHealth>(EMPTY_LOCAL_VOICE_HEALTH);
  const [localVoiceHealthLoading, setLocalVoiceHealthLoading] = useState(false);
  const [localVoiceInstallRunning, setLocalVoiceInstallRunning] = useState(false);
  const [localVoiceInstallProgress, setLocalVoiceInstallProgress] = useState<LocalVoiceInstallProgress | null>(null);
  const [localVoiceInstallFeedback, setLocalVoiceInstallFeedback] = useState<LocalVoiceInstallResult | null>(null);
  const [browserTtsHealth, setBrowserTtsHealth] = useState<BrowserTtsHealth>(EMPTY_BROWSER_TTS_HEALTH);
  const [browserTtsHealthLoading, setBrowserTtsHealthLoading] = useState(false);
  const [browserTtsInstallRunning, setBrowserTtsInstallRunning] = useState(false);
  const [browserTtsInstallProgress, setBrowserTtsInstallProgress] = useState<BrowserTtsInstallProgress | null>(null);
  const [browserTtsInstallFeedback, setBrowserTtsInstallFeedback] = useState<BrowserTtsInstallResult | null>(null);

  const refreshLocalVoiceHealth = useCallback(async (options?: { forceRefreshAssets?: boolean }) => {
    setLocalVoiceHealthLoading(true);
    try {
      const nextAssets = await listLocalVoiceAssets({
        forceRefresh: Boolean(options?.forceRefreshAssets),
      });
      setLocalVoiceAssets(nextAssets);
      const nextHealth = await getLocalVoiceHealth(config.settings);
      setLocalVoiceHealth(nextHealth);
      return nextHealth;
    } finally {
      setLocalVoiceHealthLoading(false);
    }
  }, [config]);

  const refreshBrowserTtsHealth = useCallback(async () => {
    setBrowserTtsHealthLoading(true);
    try {
      const nextHealth = await getBrowserTtsHealth(config.settings);
      setBrowserTtsHealth(nextHealth);
      return nextHealth;
    } finally {
      setBrowserTtsHealthLoading(false);
    }
  }, [config]);

  const handleStartBrowserTtsService = useCallback(async () => {
    setBrowserTtsHealthLoading(true);
    try {
      const nextHealth = await startBrowserTtsService(config.settings);
      setBrowserTtsHealth(nextHealth);
      return nextHealth;
    } catch (error) {
      const nextHealth: BrowserTtsHealth = {
        ...EMPTY_BROWSER_TTS_HEALTH,
        status: 'error',
        url: config.settings.browserTtsApiUrl,
        error: error instanceof Error ? error.message : String(error),
      };
      setBrowserTtsHealth(nextHealth);
      return nextHealth;
    } finally {
      setBrowserTtsHealthLoading(false);
    }
  }, [config]);

  const handleInstallBrowserTtsDependencies = useCallback(async () => {
    setBrowserTtsInstallRunning(true);
    setBrowserTtsInstallFeedback(null);
    setBrowserTtsInstallProgress({
      stage: 'starting',
      currentStep: '正在准备 Edge-TTS 依赖安装...',
      executable: null,
      messages: ['正在准备 Edge-TTS 依赖安装...'],
      error: null,
      missingPackages: [],
    });

    try {
      const result = await installBrowserTtsDependencies(config.settings);
      setBrowserTtsInstallFeedback(result);
      setBrowserTtsInstallProgress((previous) => previous ?? {
        stage: result.ok ? 'completed' : 'failed',
        currentStep: result.error || result.messages[result.messages.length - 1] || null,
        executable: result.executable,
        messages: result.messages,
        error: result.error,
        missingPackages: result.missingPackages,
      });
      await refreshBrowserTtsHealth();
    } finally {
      setBrowserTtsInstallRunning(false);
    }
  }, [config, refreshBrowserTtsHealth]);

  const handleInstallLocalVoiceDependencies = useCallback(async () => {
    setLocalVoiceInstallRunning(true);
    setLocalVoiceInstallFeedback(null);
    setLocalVoiceInstallProgress({
      stage: 'starting',
      currentStep: '正在准备本地语音依赖安装...',
      executable: null,
      messages: ['正在准备本地语音依赖安装...'],
      error: null,
      missingPackages: [],
    });

    try {
      const result = await installLocalVoiceDependencies(config.settings);
      setLocalVoiceInstallFeedback(result);
      setLocalVoiceInstallProgress((previous) => previous ?? {
        stage: result.ok ? 'completed' : 'failed',
        currentStep: result.error || result.messages[result.messages.length - 1] || null,
        executable: result.executable,
        messages: result.messages,
        error: result.error,
        missingPackages: result.missingPackages,
      });
      await refreshLocalVoiceHealth({ forceRefreshAssets: true });
    } finally {
      setLocalVoiceInstallRunning(false);
    }
  }, [config, refreshLocalVoiceHealth]);

  useEffect(() => onLocalVoiceInstallProgress((progress) => {
    setLocalVoiceInstallProgress(progress);
  }), []);

  useEffect(() => onBrowserTtsInstallProgress((progress) => {
    setBrowserTtsInstallProgress(progress);
  }), []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setLocalVoiceHealth(EMPTY_LOCAL_VOICE_HEALTH);
    setLocalVoiceInstallFeedback(null);
    setLocalVoiceInstallRunning(false);
    setBrowserTtsHealth(EMPTY_BROWSER_TTS_HEALTH);
    setBrowserTtsInstallFeedback(null);
    setBrowserTtsInstallRunning(false);
  }, [isOpen, resetToken]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;
    setLocalVoiceHealthLoading(true);
    void listLocalVoiceAssets({ forceRefresh: true })
      .then((assets) => {
        if (!isMounted) {
          return;
        }

        setLocalVoiceAssets(assets);
      })
      .finally(() => {
        if (isMounted) {
          setLocalVoiceHealthLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, resetToken]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'voice' || localVoiceHealth.status !== 'idle' || localVoiceHealthLoading) {
      return;
    }

    void refreshLocalVoiceHealth();
  }, [activeTab, isOpen, localVoiceHealth.status, localVoiceHealthLoading, refreshLocalVoiceHealth]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'voice' || browserTtsHealth.status !== 'idle' || browserTtsHealthLoading) {
      return;
    }

    void refreshBrowserTtsHealth();
  }, [activeTab, browserTtsHealth.status, browserTtsHealthLoading, isOpen, refreshBrowserTtsHealth]);

  return {
    browserTtsHealth,
    browserTtsHealthLoading,
    browserTtsInstallFeedback,
    browserTtsInstallProgress,
    browserTtsInstallRunning,
    handleInstallBrowserTtsDependencies,
    handleInstallLocalVoiceDependencies,
    handleStartBrowserTtsService,
    localVoiceAssets,
    localVoiceHealth,
    localVoiceHealthLoading,
    localVoiceInstallFeedback,
    localVoiceInstallProgress,
    localVoiceInstallRunning,
    refreshLocalVoiceHealth,
    refreshBrowserTtsHealth,
  };
}
