import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { keepLiveScreenWatchConsent } from '../../life-companion/screen-watch/screenWatchConsentMerge';
import {
  PRIMARY_DESKTOP_PET_SLOT_ID,
  addDesktopPetSlot,
  applyDesktopPetSlotChanges,
  getDesktopPetSlot,
  getDesktopPetSlots,
  removeDesktopPetSlot,
} from '../../multiPetRoster';
import { normalizePetConfig } from '../../petConfigNormalization';
import { desktopPetChatStore } from '../../chatStore';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { type PetConfig, type PetConfigUpdateHandler, type PetPersonality } from '../../types';
import { type SettingsPanelTabValue } from './SettingsPanelTabSections';
import { removeEmptyBeginDialogDrafts } from './settingsPersonalityBeginDialogs';

type CustomApiDraft = {
  modelName: string;
  apiUrl: string;
  apiKey: string;
};

interface UseSettingsPanelDraftStateOptions {
  config: PetConfig;
  initialSelectedPetSlotId: string;
  initialTab: SettingsPanelTabValue;
  isOpen: boolean;
  onClose: () => void;
  onUpdateConfig: PetConfigUpdateHandler;
  resetToken: number;
}

function createCustomApiDraft(config: PetConfig): CustomApiDraft {
  return {
    modelName: config.settings.customModelName,
    apiUrl: config.settings.customApiUrl,
    apiKey: config.settings.customApiKey,
  };
}

function resolveSelectedPetSlotId(config: PetConfig, selectedPetSlotId: string) {
  return getDesktopPetSlot(config, selectedPetSlotId)
    ? selectedPetSlotId
    : PRIMARY_DESKTOP_PET_SLOT_ID;
}

export function useSettingsPanelDraftState({
  config,
  initialSelectedPetSlotId,
  initialTab,
  isOpen,
  onClose,
  onUpdateConfig,
  resetToken,
}: UseSettingsPanelDraftStateOptions) {
  const safeInitialTab: SettingsPanelTabValue = ['personality', 'model', 'motion-expression', 'vision', 'voice', 'system'].includes(initialTab)
    ? initialTab
    : 'personality';
  const [localConfig, setLocalConfigState] = useState<PetConfig>(() => normalizePetConfig(config));
  const localConfigRef = useRef(localConfig);
  const committedConfigRef = useRef(normalizePetConfig(config));
  const previousConfigPropRef = useRef(config);
  if (previousConfigPropRef.current !== config) {
    previousConfigPropRef.current = config;
    committedConfigRef.current = normalizePetConfig(config);
  }
  const setLocalConfig: Dispatch<SetStateAction<PetConfig>> = (update) => {
    const next = typeof update === 'function' ? update(localConfigRef.current) : update;
    localConfigRef.current = next;
    setLocalConfigState(next);
  };
  const [traitsDraft, setTraitsDraft] = useState(() => config.personality.traits.join(', '));
  const [isEditingTraits, setIsEditingTraits] = useState(false);
  const [customApiDraft, setCustomApiDraft] = useState(() => createCustomApiDraft(config));
  const [customApiSaveFeedback, setCustomApiSaveFeedback] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsPanelTabValue>('personality');
  const [selectedPetSlotId, setSelectedPetSlotId] = useState(PRIMARY_DESKTOP_PET_SLOT_ID);
  const hasUnsavedChangesRef = useRef(false);
  const openedConfigSnapshotRef = useRef<PetConfig>(normalizePetConfig(config));

  const desktopPetSlots = getDesktopPetSlots(localConfig);
  const selectedPetSlot = getDesktopPetSlot(localConfig, selectedPetSlotId) ?? desktopPetSlots[0];
  const isCustomApiDirty =
    customApiDraft.modelName !== localConfig.settings.customModelName
    || customApiDraft.apiUrl !== localConfig.settings.customApiUrl
    || customApiDraft.apiKey !== localConfig.settings.customApiKey;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Consume the initial* values only when the panel (re)opens or a reset is
    // requested. The effect intentionally does NOT re-run when
    // initialSelectedPetSlotId / initialTab change while the panel is open —
    // those props track live chat state (e.g. group-chat speaker rotation) and
    // re-running here would silently wipe the user's unsaved draft.
    hasUnsavedChangesRef.current = false;
    const normalizedConfig = normalizePetConfig(config);
    const nextSelectedPetSlotId = resolveSelectedPetSlotId(normalizedConfig, initialSelectedPetSlotId);
    const nextSelectedPetSlot = getDesktopPetSlot(normalizedConfig, nextSelectedPetSlotId)
      ?? getDesktopPetSlots(normalizedConfig)[0];

    openedConfigSnapshotRef.current = normalizedConfig;
    committedConfigRef.current = normalizedConfig;
    setLocalConfig(normalizedConfig);
    setCustomApiDraft(createCustomApiDraft(normalizedConfig));
    setCustomApiSaveFeedback(false);
    setActiveTab(safeInitialTab);
    setSelectedPetSlotId(nextSelectedPetSlotId);
    setTraitsDraft(nextSelectedPetSlot.personality.traits.join(', '));
    setIsEditingTraits(false);
  }, [isOpen, resetToken]);

  useEffect(() => {
    if (!isOpen || hasUnsavedChangesRef.current) {
      return;
    }

    const normalizedConfig = normalizePetConfig(config);
    openedConfigSnapshotRef.current = normalizedConfig;
    setLocalConfig(normalizedConfig);
    setCustomApiDraft(createCustomApiDraft(normalizedConfig));
  }, [config, isOpen]);

  useEffect(() => {
    if (isEditingTraits || !selectedPetSlot) {
      return;
    }

    setTraitsDraft(selectedPetSlot.personality.traits.join(', '));
  }, [isEditingTraits, selectedPetSlot]);

  useEffect(() => {
    if (isCustomApiDirty && customApiSaveFeedback) {
      setCustomApiSaveFeedback(false);
    }
  }, [customApiSaveFeedback, isCustomApiDirty]);

  const applyConfig = (newConfig: PetConfig) => {
    hasUnsavedChangesRef.current = true;
    const normalizedConfig = normalizePetConfig(newConfig);
    setLocalConfig(normalizedConfig);
  };

  const resolveCommittedConfigBase = () => (
    hasUnsavedChangesRef.current
      ? openedConfigSnapshotRef.current
      : committedConfigRef.current
  );

  const commitModelConfig = (
    buildLocalConfig: (baseConfig: PetConfig) => PetConfig,
    buildCommittedConfig = buildLocalConfig,
  ) => {
    const committedBaseConfig = resolveCommittedConfigBase();
    const nextLocalConfig = normalizePetConfig(buildLocalConfig(localConfigRef.current));
    const nextCommittedConfig = normalizePetConfig(buildCommittedConfig(committedBaseConfig));
    const nextOpenedConfigSnapshot = hasUnsavedChangesRef.current
      ? normalizePetConfig(buildCommittedConfig(openedConfigSnapshotRef.current))
      : nextCommittedConfig;

    openedConfigSnapshotRef.current = nextOpenedConfigSnapshot;
    committedConfigRef.current = nextCommittedConfig;
    setLocalConfig(nextLocalConfig);
    // Pass the diff base so runtime-only changes (pet movement, stats, group
    // memory) made while the panel was open survive the commit.
    onUpdateConfig(nextCommittedConfig, { persist: true, baseConfig: committedBaseConfig });

    return nextLocalConfig;
  };

  const handleAddPetSlot = () => {
    const nextLocalConfig = commitModelConfig(addDesktopPetSlot);
    const nextSlot = getDesktopPetSlots(nextLocalConfig).at(-1);

    if (nextSlot) {
      setSelectedPetSlotId(nextSlot.id);
      setTraitsDraft(nextSlot.personality.traits.join(', '));
      setIsEditingTraits(false);
    }
  };

  const handleRemovePetSlot = (slotId: string) => {
    if (slotId === PRIMARY_DESKTOP_PET_SLOT_ID) {
      return;
    }

    const fallbackSlotId = selectedPetSlotId === slotId
      ? PRIMARY_DESKTOP_PET_SLOT_ID
      : selectedPetSlotId;
    const nextLocalConfig = commitModelConfig((baseConfig) => removeDesktopPetSlot(baseConfig, slotId));
    desktopPetChatStore.removePetRuntimeState(slotId, PRIMARY_DESKTOP_PET_SLOT_ID);
    if (desktopPetShellRuntime.isDesktopMode()) {
      desktopPetShellRuntime.dispatch({
        type: 'remove-pet-runtime-state',
        petId: slotId,
        fallbackPetId: PRIMARY_DESKTOP_PET_SLOT_ID,
      });
    }
    const nextSelectedSlot = getDesktopPetSlot(nextLocalConfig, fallbackSlotId)
      ?? getDesktopPetSlots(nextLocalConfig)[0];

    if (nextSelectedSlot) {
      setSelectedPetSlotId(nextSelectedSlot.id);
      setTraitsDraft(nextSelectedSlot.personality.traits.join(', '));
      setIsEditingTraits(false);
    }
  };

  const handleSetTraitsDraft = (value: string) => {
    hasUnsavedChangesRef.current = true;
    setTraitsDraft(value);
  };

  const handleSetCustomApiDraft: Dispatch<SetStateAction<CustomApiDraft>> = (value) => {
    hasUnsavedChangesRef.current = true;
    setCustomApiDraft(value);
  };

  const handleUpdatePersonality = (updates: Partial<PetPersonality>) => {
    const nextConfig = applyDesktopPetSlotChanges(localConfig, selectedPetSlot.id, {
      personality: {
        ...selectedPetSlot.personality,
        ...updates,
      },
    });
    applyConfig(nextConfig);
  };

  const commitTraitsDraft = (value: string) => {
    const nextTraits = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const normalizedDraft = nextTraits.join(', ');

    setIsEditingTraits(false);
    setTraitsDraft(normalizedDraft);
    handleUpdatePersonality({ traits: nextTraits });
  };

  const saveCustomApiSettings = () => {
    applyConfig({
      ...localConfig,
      settings: {
        ...localConfig.settings,
        customModelName: customApiDraft.modelName.trim(),
        customApiUrl: customApiDraft.apiUrl.trim(),
        customApiKey: customApiDraft.apiKey.trim(),
      },
    });
    setCustomApiSaveFeedback(true);
  };

  const replaceConfig = (nextConfig: PetConfig) => {
    const normalizedConfig = normalizePetConfig(nextConfig);
    const nextSelectedSlot = getDesktopPetSlot(normalizedConfig, PRIMARY_DESKTOP_PET_SLOT_ID)
      ?? getDesktopPetSlots(normalizedConfig)[0];

    hasUnsavedChangesRef.current = false;
    openedConfigSnapshotRef.current = normalizedConfig;
    setLocalConfig(normalizedConfig);
    setCustomApiDraft(createCustomApiDraft(normalizedConfig));
    setCustomApiSaveFeedback(false);
    setSelectedPetSlotId(nextSelectedSlot.id);
    setTraitsDraft(nextSelectedSlot.personality.traits.join(', '));
    setIsEditingTraits(false);
    onUpdateConfig(normalizedConfig, { persist: true });
  };

  const buildConfigForSave = () => {
    const nextTraits = traitsDraft
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const nextConfigWithTraits = applyDesktopPetSlotChanges(localConfig, selectedPetSlot.id, {
      personality: {
        ...selectedPetSlot.personality,
        traits: nextTraits,
      },
    });

    return keepLiveScreenWatchConsent(normalizePetConfig(removeEmptyBeginDialogDrafts({
      ...nextConfigWithTraits,
      settings: {
        ...nextConfigWithTraits.settings,
        customModelName: customApiDraft.modelName.trim(),
        customApiUrl: customApiDraft.apiUrl.trim(),
        customApiKey: customApiDraft.apiKey.trim(),
      },
    })), openedConfigSnapshotRef.current, committedConfigRef.current);
  };

  const handleCloseWithoutSaving = () => {
    if (hasUnsavedChangesRef.current) {
      onUpdateConfig(keepLiveScreenWatchConsent(openedConfigSnapshotRef.current, openedConfigSnapshotRef.current, committedConfigRef.current));
      hasUnsavedChangesRef.current = false;
    }
    onClose();
  };

  const handleSaveAndClose = () => {
    const nextConfig = buildConfigForSave();
    const nextSelectedSlot = getDesktopPetSlot(nextConfig, selectedPetSlot.id) ?? getDesktopPetSlots(nextConfig)[0];
    const saveBaseConfig = openedConfigSnapshotRef.current;
    hasUnsavedChangesRef.current = false;
    openedConfigSnapshotRef.current = nextConfig;
    setLocalConfig(nextConfig);
    setTraitsDraft(nextSelectedSlot.personality.traits.join(', '));
    setIsEditingTraits(false);
    setCustomApiDraft(createCustomApiDraft(nextConfig));
    setCustomApiSaveFeedback(false);
    onUpdateConfig(nextConfig, { persist: true, baseConfig: saveBaseConfig });
    onClose();
  };

  return {
    activeTab,
    applyConfig,
    commitModelConfig,
    commitTraitsDraft,
    customApiDraft,
    customApiSaveFeedback,
    desktopPetSlots,
    handleCloseWithoutSaving,
    handleAddPetSlot,
    handleRemovePetSlot,
    handleSaveAndClose,
    handleSetCustomApiDraft,
    handleSetTraitsDraft,
    handleUpdatePersonality,
    isCustomApiDirty,
    isEditingTraits,
    localConfig,
    resolveCommittedConfigBase,
    replaceConfig,
    saveCustomApiSettings,
    selectedPetSlot,
    selectedPetSlotId,
    setActiveTab,
    setIsEditingTraits,
    setLocalConfig,
    setSelectedPetSlotId,
    traitsDraft,
  };
}
