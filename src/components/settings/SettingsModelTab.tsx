import { useRef, useState, type ChangeEvent } from 'react';
import { Zap } from 'lucide-react';
import { getVisiblePetModelPresets } from '../../constants';
import { MAX_FOOD_APPEARANCES } from '../../foodAppearances';
import {
  getSupported3DModelAcceptAttribute,
  getSupported3DModelLabel,
} from '../../model3dFormatSupport';
import { type DesktopPetSlot } from '../../multiPetRoster';
import { type Avatar3DRuntimeBackend, type ModelType, type PetConfig } from '../../types';
import { type Live2DRuntimeProfileConfigV1 } from '../../pet-runtime/live2d/live2dRuntimeProfile';
import {
  MAX_CUSTOM_PET_MODELS,
  isCustom2DVideoFile,
  isSupportedCustomModelFile,
  resolveCustomPetModelType,
} from './settingsModelImportUtils';
import { getSupportedLive2DModelAcceptAttribute } from '../../pet-runtime/live2d/live2dModelSupport';
import { Label } from '../../../components/ui/label';
import {
  SettingsFoodAppearanceSection,
  SettingsModelPresetSection,
} from './SettingsModelSections';
import { SettingsAudioAssetSection } from './SettingsAudioAssetSection';
import { toggleButtonClass } from './settingsVoiceUtils';
import { Button } from '../../../components/ui/button';
import { SettingsLive2DRuntimeProfileSection } from './SettingsLive2DRuntimeProfileSection';
import { SettingsVideoItemBindingsSection } from './SettingsVideoItemBindingsSection';

export interface SettingsModelTabProps {
  desktopPetSlots: DesktopPetSlot[];
  localConfig: PetConfig;
  onAddPetSlot: () => void;
  onAppendCustomModelPresets: (files: File[], sequenceName?: string) => Promise<void> | void;
  onAppendFoodAppearances: (files: File[]) => Promise<void> | void;
  onApplyConfig: (config: PetConfig) => void;
  onRemoveModelPreset: (modelId: string) => void;
  onRemoveFoodAppearance: (appearanceId: string) => void;
  onUpdateFoodInteractionType: (appearanceId: string, interactionType: 'eat' | 'toy' | 'custom') => void;
  onRemovePetSlot: (slotId: string) => void;
  onResetFolders: () => void;
  onRestoreBuiltinModelPresets: () => void;
  onRestoreFoodAppearances: () => void;
  onSelectPetSlot: (slotId: string) => void;
  onSetAvatar3DRuntimeBackend: (backend: Avatar3DRuntimeBackend) => void;
  onSetPetSlotAutoMovementEnabled: (slotId: string, enabled: boolean) => void;
  onSetPetSlotModelVisible: (slotId: string, visible: boolean) => void;
  onSetPetSlotPointerLookEnabled: (slotId: string, enabled: boolean) => void;
  onSetPetSlotEnabled: (slotId: string, enabled: boolean) => void;
  onUpdateModel: (url: string, type: ModelType) => void;
  onUpdateLive2DRuntimeProfile: (
    modelId: string,
    profile: Live2DRuntimeProfileConfigV1 | null,
  ) => void;
  selectedPetSlot: DesktopPetSlot;
  selectedPetSlotId: string;
}

export function SettingsModelTab({
  desktopPetSlots,
  localConfig,
  onAddPetSlot,
  onAppendCustomModelPresets,
  onAppendFoodAppearances,
  onApplyConfig,
  onRemoveModelPreset,
  onRemoveFoodAppearance,
  onUpdateFoodInteractionType,
  onRemovePetSlot,
  onResetFolders,
  onRestoreBuiltinModelPresets,
  onRestoreFoodAppearances,
  onSelectPetSlot,
  onSetAvatar3DRuntimeBackend,
  onSetPetSlotAutoMovementEnabled,
  onSetPetSlotModelVisible,
  onSetPetSlotPointerLookEnabled,
  onSetPetSlotEnabled,
  onUpdateModel,
  onUpdateLive2DRuntimeProfile,
  selectedPetSlot,
  selectedPetSlotId,
}: SettingsModelTabProps) {
  const foodFileInputRef = useRef<HTMLInputElement | null>(null);
  const modelFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingFoodImages, setIsUploadingFoodImages] = useState(false);
  const [isUploadingCustomModels, setIsUploadingCustomModels] = useState(false);
  const [modelLibraryFeedback, setModelLibraryFeedback] = useState('');
  const foodAppearanceCount = localConfig.foodAppearances.length;
  const canUploadMoreFoodImages = foodAppearanceCount < MAX_FOOD_APPEARANCES;
  const customModelCount = localConfig.customModelPresets.length;
  const canUploadMoreCustomModels = customModelCount < MAX_CUSTOM_PET_MODELS;
  const allModelPresets = getVisiblePetModelPresets(
    localConfig.customModelPresets,
    localConfig.settings.hiddenBuiltinModelPresetIds,
  );
  const currentModelPreset = allModelPresets.find((preset) => (
    preset.type === selectedPetSlot.modelType && preset.url === selectedPetSlot.modelUrl
  )) ?? allModelPresets.find((preset) => preset.url === selectedPetSlot.modelUrl) ?? null;
  const currentModelLabel = currentModelPreset?.name
    ?? (
      selectedPetSlot.modelUrl.startsWith('data:')
        ? '自定义模型'
        : (selectedPetSlot.modelUrl.split(/[\\/]/).pop() || selectedPetSlot.modelUrl)
    );

  const handleCustomModelSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!selectedFiles.length || !canUploadMoreCustomModels) {
      return;
    }

    const supportedFiles = selectedFiles.filter(isSupportedCustomModelFile);
    if (!supportedFiles.length) {
      setModelLibraryFeedback(`只支持上传 2D 图片、透明 WebM、${getSupported3DModelLabel()} 3D 模型或 Live2D .model3.json 模型。`);
      return;
    }

    const static2DImageFiles = supportedFiles.filter((file) => (
      resolveCustomPetModelType(file) === '2d' && !isCustom2DVideoFile(file)
    ));
    const first2DFrame = static2DImageFiles[0] ?? null;
    const defaultSequenceName = static2DImageFiles.length > 1 && first2DFrame
      ? first2DFrame.name.replace(/(?:[-_ ]?\d+)?\.[^.]+$/u, '').trim() || '未命名序列帧动画'
      : undefined;
    const sequenceName = defaultSequenceName
      ? window.prompt('请输入这组 2D 序列帧动画的名称（将作为“2d模型”下的文件夹名）：', defaultSequenceName)
      : undefined;
    if (defaultSequenceName && sequenceName === null) {
      return;
    }

    setIsUploadingCustomModels(true);
    const hasVideo = supportedFiles.some((file) => isCustom2DVideoFile(file));
    const videoFiles = supportedFiles.filter((file) => isCustom2DVideoFile(file));
    const videoSummary = videoFiles.length
      ? videoFiles.map((file) => `${file.name}（${Math.max(1, Math.round(file.size / 1024 / 1024))} MB）`).join('、')
      : '';
    setModelLibraryFeedback(hasVideo
      ? `已选择视频：${videoSummary}。MP4/MOV 会先按白色背景抠像并转码；透明 WebM 可直接导入。正在处理，请勿重复点击。`
      : '正在导入模型，请稍候…');
    try {
      await onAppendCustomModelPresets(supportedFiles, sequenceName?.trim() || defaultSequenceName);
          setModelLibraryFeedback(hasVideo
            ? `视频转码完成，已加入 ${Math.min(supportedFiles.length, MAX_CUSTOM_PET_MODELS - customModelCount)} 个模型，并自动应用第 1 个新模型。当前按透明 WebM 播放。`
            : `已加入 ${Math.min(supportedFiles.length, MAX_CUSTOM_PET_MODELS - customModelCount)} 个模型，并自动应用第 1 个新模型到当前桌宠。`);
    } catch (error) {
      setModelLibraryFeedback(
        error instanceof Error
          ? error.message
          : '模型上传失败，请换一个模型文件再试。',
      );
    } finally {
      setIsUploadingCustomModels(false);
    }
  };

  const handleFoodImageSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!selectedFiles.length || !canUploadMoreFoodImages) {
      return;
    }

    const remainingSlots = MAX_FOOD_APPEARANCES - localConfig.foodAppearances.length;
    const acceptedFiles = selectedFiles
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, remainingSlots);

    if (!acceptedFiles.length) {
      return;
    }

    setIsUploadingFoodImages(true);
    try {
      await onAppendFoodAppearances(acceptedFiles);
    } finally {
      setIsUploadingFoodImages(false);
    }
  };

  return (
    <div className="m-0 space-y-6">
      <input
        ref={modelFileInputRef}
        type="file"
        accept={`image/*,.avif,.bmp,.jpeg,.jpg,.png,.webp,.webm,.mp4,.m4v,.mov,.gif,${getSupported3DModelAcceptAttribute()},${getSupportedLive2DModelAcceptAttribute()}`}
        multiple
        className="hidden"
        onChange={(event) => {
          void handleCustomModelSelection(event);
        }}
      />
      <input
        ref={foodFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          void handleFoodImageSelection(event);
        }}
      />

      <div className="rounded-sm border border-border bg-secondary/20 p-4">
        <div className="mb-3 flex items-center justify-between">
          <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">引擎状态</Label>
          <span className="flex items-center gap-1 font-mono text-2xs text-primary">
            <Zap className="h-3 w-3" />
            {localConfig.settings.avatar3dRuntimeBackend === 'unity' ? 'Unity 3D Runtime' : localConfig.settings.engineType}
          </span>
        </div>
        <div className="truncate text-xs text-muted-foreground">当前槽位模型：{currentModelLabel}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className={toggleButtonClass(localConfig.settings.avatar3dRuntimeBackend === 'three')}
            onClick={() => onSetAvatar3DRuntimeBackend('three')}
          >
            Three fallback
          </Button>
          <Button
            type="button"
            variant="outline"
            className={toggleButtonClass(localConfig.settings.avatar3dRuntimeBackend === 'unity')}
            onClick={() => onSetAvatar3DRuntimeBackend('unity')}
          >
            Unity runtime
          </Button>
        </div>
      </div>

      {selectedPetSlot.isPrimary && currentModelPreset?.type === '2d' && currentModelPreset.renderKind === 'video'
        && !currentModelPreset.builtIn ? (
        <SettingsVideoItemBindingsSection
          appearances={localConfig.foodAppearances}
          canUploadMoreAppearances={canUploadMoreFoodImages}
          config={localConfig}
          isUploadingAppearances={isUploadingFoodImages}
          onApplyConfig={onApplyConfig}
          onTriggerAppearanceUpload={() => foodFileInputRef.current?.click()}
          onUpdateInteractionType={onUpdateFoodInteractionType}
          preset={currentModelPreset}
        />
      ) : null}

      <SettingsModelPresetSection
        allModelPresets={allModelPresets}
        customModelCount={customModelCount}
        canUploadMoreCustomModels={canUploadMoreCustomModels}
        hiddenBuiltinModelPresetCount={localConfig.settings.hiddenBuiltinModelPresetIds.length}
        isUploadingCustomModels={isUploadingCustomModels}
        modelLibraryFeedback={modelLibraryFeedback}
        onRemoveModelPreset={onRemoveModelPreset}
        onResetFolders={onResetFolders}
        onRestoreBuiltinModelPresets={onRestoreBuiltinModelPresets}
        onTriggerModelUpload={() => modelFileInputRef.current?.click()}
        onUpdateModel={onUpdateModel}
        selectedModelType={selectedPetSlot.modelType}
        selectedModelUrl={selectedPetSlot.modelUrl}
      />

      {currentModelPreset?.type === 'live2d' && !currentModelPreset.builtIn ? (
        <SettingsLive2DRuntimeProfileSection
          preset={currentModelPreset}
          onCommitProfile={onUpdateLive2DRuntimeProfile}
        />
      ) : null}

      <SettingsAudioAssetSection
        localConfig={localConfig}
        onApplyConfig={onApplyConfig}
      />

      <SettingsFoodAppearanceSection
        allowCustomVideoActions={Boolean(selectedPetSlot.isPrimary && currentModelPreset?.type === '2d'
          && currentModelPreset.renderKind === 'video' && !currentModelPreset.builtIn)}
        canUploadMoreFoodImages={canUploadMoreFoodImages}
        foodAppearanceCount={foodAppearanceCount}
        foodAppearances={localConfig.foodAppearances}
        isUploadingFoodImages={isUploadingFoodImages}
        onRemoveFoodAppearance={onRemoveFoodAppearance}
        onUpdateFoodInteractionType={onUpdateFoodInteractionType}
        onUpdateFoodInteractionLabel={(appearanceId, interactionLabel) => onApplyConfig({
          ...localConfig,
          foodAppearances: localConfig.foodAppearances.map((appearance) => (
            appearance.id === appearanceId ? { ...appearance, interactionLabel } : appearance
          )),
        })}
        onRestoreFoodAppearances={onRestoreFoodAppearances}
        onTriggerFoodUpload={() => foodFileInputRef.current?.click()}
      />
    </div>
  );
}
