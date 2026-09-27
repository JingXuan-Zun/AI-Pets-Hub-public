import { type CSSProperties } from 'react';
import { type BrowserTtsHealth, type BrowserTtsInstallProgress, type BrowserTtsInstallResult, type LocalVoiceAssets, type LocalVoiceHealth, type LocalVoiceInstallProgress, type LocalVoiceInstallResult, type PetConfig, type VoiceApiProtocol } from '../../types';
import {
  getDefaultSttModelForProtocol,
  getDefaultTtsModelForProtocol,
  getDefaultVoiceNameForProtocol,
} from '../../voice/apiProtocols';
import {
  SettingsLocalVoiceEnvironmentSection,
  SettingsVoiceBrowserTtsSection,
  SettingsVoiceGeneralSection,
  SettingsVoiceSourcesSection,
} from './SettingsVoiceCoreSections';
import { SettingsApiSttSection, SettingsApiTtsSection } from './SettingsVoiceApiSections';
import { SettingsLocalSttSection, SettingsLocalTtsSection } from './SettingsVoiceLocalModelSections';
import {
  buildRandomLocalTtsSeed,
  clampLocalTtsVoiceToneStability,
  normalizeLocalTtsRandomSeedInput,
} from './settingsVoiceUtils';

export interface SettingsVoiceTabProps {
  browserTtsHealth: BrowserTtsHealth;
  browserTtsHealthLoading: boolean;
  browserTtsInstallProgress: BrowserTtsInstallProgress | null;
  browserTtsInstallFeedback: BrowserTtsInstallResult | null;
  browserTtsInstallRunning: boolean;
  localConfig: PetConfig;
  localVoiceAssets: LocalVoiceAssets;
  localVoiceHealth: LocalVoiceHealth;
  localVoiceHealthLoading: boolean;
  localVoiceInstallProgress: LocalVoiceInstallProgress | null;
  localVoiceInstallFeedback: LocalVoiceInstallResult | null;
  localVoiceInstallRunning: boolean;
  noDragRegionStyle?: CSSProperties;
  onApplyConfig: (config: PetConfig) => void;
  onInstallBrowserTtsDependencies: () => void;
  onInstallLocalVoiceDependencies: () => void;
  onRefreshBrowserTtsHealth: () => void;
  onRefreshLocalVoiceHealth: () => void;
  onStartBrowserTtsService: () => void;
}

export function SettingsVoiceTab({
  browserTtsHealth,
  browserTtsHealthLoading,
  browserTtsInstallProgress,
  browserTtsInstallFeedback,
  browserTtsInstallRunning,
  localConfig,
  localVoiceAssets,
  localVoiceHealth,
  localVoiceHealthLoading,
  localVoiceInstallProgress,
  localVoiceInstallFeedback,
  localVoiceInstallRunning,
  noDragRegionStyle,
  onApplyConfig,
  onInstallBrowserTtsDependencies,
  onInstallLocalVoiceDependencies,
  onRefreshBrowserTtsHealth,
  onRefreshLocalVoiceHealth,
  onStartBrowserTtsService,
}: SettingsVoiceTabProps) {
  const { settings } = localConfig;
  const localTtsVoiceToneStability = clampLocalTtsVoiceToneStability(
    Number.isFinite(settings.localTtsVoiceToneStability)
      ? settings.localTtsVoiceToneStability
      : (settings.localTtsLockVoiceTone ? 100 : 0),
  );
  const localTtsRandomSeed = normalizeLocalTtsRandomSeedInput(settings.localTtsRandomSeed);
  const hasLocalTtsModels = localVoiceAssets.ttsModels.length > 0;
  const hasLocalSttModels = localVoiceAssets.sttModels.length > 0;
  const hasLocalReferences = localVoiceAssets.references.length > 0;
  const usingLocalVoice = settings.ttsProvider === 'local' || settings.sttProvider === 'local';
  const installMessages = localVoiceInstallRunning
    ? (localVoiceInstallProgress?.messages ?? [])
    : (localVoiceInstallFeedback?.messages ?? []);
  const installCurrentStep = localVoiceInstallRunning
    ? (localVoiceInstallProgress?.currentStep ?? null)
    : (installMessages.length > 0 ? installMessages[installMessages.length - 1] : null);
  const installExecutable = localVoiceInstallRunning
    ? (localVoiceInstallProgress?.executable ?? localVoiceInstallFeedback?.executable ?? null)
    : (localVoiceInstallFeedback?.executable ?? localVoiceInstallProgress?.executable ?? null);
  const installError = localVoiceInstallRunning
    ? (localVoiceInstallProgress?.error ?? localVoiceInstallFeedback?.error ?? null)
    : (localVoiceInstallFeedback?.error ?? localVoiceInstallProgress?.error ?? null);
  const installMissingPackages = localVoiceInstallRunning
    ? (localVoiceInstallProgress?.missingPackages ?? localVoiceInstallFeedback?.missingPackages ?? [])
    : (localVoiceInstallFeedback?.missingPackages ?? localVoiceInstallProgress?.missingPackages ?? []);

  const applySettings = (updates: Partial<PetConfig['settings']>) => {
    onApplyConfig({
      ...localConfig,
      settings: {
        ...settings,
        ...updates,
      },
    });
  };

  const applyLocalTtsVoiceToneStability = (value: number | number[]) => {
    const nextValue = Array.isArray(value) ? value[0] ?? 0 : value;
    const normalizedValue = clampLocalTtsVoiceToneStability(nextValue);
    applySettings({
      localTtsVoiceToneStability: normalizedValue,
      localTtsLockVoiceTone: normalizedValue > 0,
    });
  };

  const applyLocalTtsRandomSeed = (value: string) => {
    const normalizedValue = normalizeLocalTtsRandomSeedInput(value);
    applySettings({
      localTtsRandomSeed: normalizedValue,
      localTtsVoiceToneStability: 100,
      localTtsLockVoiceTone: true,
    });
  };

  const applyTtsProtocol = (protocol: VoiceApiProtocol) => {
    const updates: Partial<PetConfig['settings']> = { apiTtsProtocol: protocol };
    if (!settings.customVoiceModel.trim() || settings.customVoiceModel.trim() === getDefaultTtsModelForProtocol(settings.apiTtsProtocol)) {
      updates.customVoiceModel = getDefaultTtsModelForProtocol(protocol);
    }
    if (!settings.voiceName.trim() || settings.voiceName.trim() === getDefaultVoiceNameForProtocol(settings.apiTtsProtocol)) {
      updates.voiceName = getDefaultVoiceNameForProtocol(protocol);
    }
    applySettings(updates);
  };

  const applySttProtocol = (protocol: VoiceApiProtocol) => {
    const updates: Partial<PetConfig['settings']> = { apiSttProtocol: protocol };
    if (!settings.customSpeechModel.trim() || settings.customSpeechModel.trim() === getDefaultSttModelForProtocol(settings.apiSttProtocol)) {
      updates.customSpeechModel = getDefaultSttModelForProtocol(protocol);
    }
    applySettings(updates);
  };

  const voiceNamePlaceholder = settings.ttsProvider === 'browser'
    ? '音色名称，例如 xiaoxiao'
    : settings.ttsProvider === 'api' && settings.apiTtsProtocol === 'gemini'
      ? '音色名称，例如 Kore'
      : '音色名称，例如 alloy';

  return (
    <div className="m-0 space-y-6">
      <SettingsVoiceGeneralSection
        settings={settings}
        noDragRegionStyle={noDragRegionStyle}
        applySettings={applySettings}
      />
      <SettingsVoiceSourcesSection
        settings={settings}
        noDragRegionStyle={noDragRegionStyle}
        voiceNamePlaceholder={voiceNamePlaceholder}
        applySettings={applySettings}
      />
      <SettingsVoiceBrowserTtsSection
        browserTtsHealth={browserTtsHealth}
        browserTtsHealthLoading={browserTtsHealthLoading}
        browserTtsInstallProgress={browserTtsInstallProgress}
        browserTtsInstallFeedback={browserTtsInstallFeedback}
        browserTtsInstallRunning={browserTtsInstallRunning}
        noDragRegionStyle={noDragRegionStyle}
        settings={settings}
        onInstallBrowserTtsDependencies={onInstallBrowserTtsDependencies}
        onRefreshBrowserTtsHealth={onRefreshBrowserTtsHealth}
        onStartBrowserTtsService={onStartBrowserTtsService}
        applySettings={applySettings}
      />
      <SettingsLocalVoiceEnvironmentSection
        localVoiceAssets={localVoiceAssets}
        localVoiceHealth={localVoiceHealth}
        localVoiceHealthLoading={localVoiceHealthLoading}
        localVoiceInstallProgress={localVoiceInstallProgress}
        localVoiceInstallFeedback={localVoiceInstallFeedback}
        localVoiceInstallRunning={localVoiceInstallRunning}
        noDragRegionStyle={noDragRegionStyle}
        settings={settings}
        usingLocalVoice={usingLocalVoice}
        installMessages={installMessages}
        installCurrentStep={installCurrentStep}
        installExecutable={installExecutable}
        installError={installError}
        installMissingPackages={installMissingPackages}
        onInstallLocalVoiceDependencies={onInstallLocalVoiceDependencies}
        onRefreshLocalVoiceHealth={onRefreshLocalVoiceHealth}
        applySettings={applySettings}
      />
      <SettingsApiTtsSection
        settings={settings}
        noDragRegionStyle={noDragRegionStyle}
        applySettings={applySettings}
        applyTtsProtocol={applyTtsProtocol}
      />
      <SettingsApiSttSection
        settings={settings}
        noDragRegionStyle={noDragRegionStyle}
        applySettings={applySettings}
        applySttProtocol={applySttProtocol}
      />
      <SettingsLocalTtsSection
        settings={settings}
        noDragRegionStyle={noDragRegionStyle}
        localVoiceAssets={localVoiceAssets}
        localVoiceHealth={localVoiceHealth}
        hasLocalTtsModels={hasLocalTtsModels}
        hasLocalReferences={hasLocalReferences}
        localTtsRandomSeed={localTtsRandomSeed}
        localTtsVoiceToneStability={localTtsVoiceToneStability}
        applySettings={applySettings}
        applyLocalTtsRandomSeed={applyLocalTtsRandomSeed}
        applyLocalTtsVoiceToneStability={applyLocalTtsVoiceToneStability}
        buildRandomSeed={buildRandomLocalTtsSeed}
      />
      <SettingsLocalSttSection
        settings={settings}
        noDragRegionStyle={noDragRegionStyle}
        localVoiceAssets={localVoiceAssets}
        localVoiceHealth={localVoiceHealth}
        hasLocalSttModels={hasLocalSttModels}
        applySettings={applySettings}
      />
    </div>
  );
}
