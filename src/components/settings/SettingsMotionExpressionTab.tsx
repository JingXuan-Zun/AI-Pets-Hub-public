import { useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { Activity } from 'lucide-react';
import { MAX_ACTIVITY_AREA_HEIGHT, MAX_ACTIVITY_AREA_WIDTH } from '../../activityArea';
import { getVisiblePetModelPresets } from '../../constants';
import { applyDesktopPetSlotChanges, type DesktopPetSlot } from '../../multiPetRoster';
import { type ModelType, type PetConfig, type PetModelMotionBinding, type PetModelMotionKey, type PetVisualSize } from '../../types';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Slider } from '../../../components/ui/slider';
import { SettingsAnimationDriftQaPanel } from './SettingsAnimationDriftQaPanel';
import { Settings2DAnimationSection, SettingsModelMotionSection } from './SettingsModelSections';
import { SettingsSkillTimelinePreviewPanel } from './SettingsSkillTimelinePreviewPanel';
import {
  getLive2DMotionImportAcceptAttribute,
  isSupportedCustomMotionFile,
  resolveUnsupportedCustomMotionImportReason,
} from './settingsModelImportUtils';
import { toggleButtonClass } from './settingsVoiceUtils';

type ActivityAreaPreview = {
  width: number;
  height: number;
};

type MotionLibraryKind = Extract<ModelType, '3d' | 'live2d'>;

export interface SettingsMotionExpressionTabProps {
  activityAreaHeightValue: number;
  activityAreaPreview: ActivityAreaPreview | null;
  activityAreaScale: number;
  activityAreaWidthValue: number;
  desktopPetSlots: DesktopPetSlot[];
  localConfig: PetConfig;
  logs: string[];
  noDragRegionStyle?: CSSProperties;
  petVisualSize: PetVisualSize | null;
  selectedDisplay: DesktopPetDisplayLike | null;
  selectedDisplayPixelHeight: number;
  selectedDisplayPixelWidth: number;
  selectedPetSlot: DesktopPetSlot;
  selectedPetSlotId: string;
  onAddPetSlot: () => void;
  onAppendModelMotionBindings: (modelId: string, files: File[]) => Promise<void> | void;
  onApplyConfig: (config: PetConfig) => void;
  onRemoveModelMotionBinding: (modelId: string, bindingId: string) => void;
  onRemovePetSlot: (slotId: string) => void;
  onRestoreActivityAreaAuto: () => void;
  onSelectPetSlot: (slotId: string) => void;
  onSetPetSlotEnabled: (slotId: string, enabled: boolean) => void;
  onSetPetSlotModelVisible: (slotId: string, visible: boolean) => void;
  onSetActivityBorderVisible: (visible: boolean) => void;
  onUpdateActivityAreaDimension: (dimension: 'width' | 'height', value: string) => void;
  onUpdateActivityAreaScale: (value: number | number[]) => void;
  onUpdateModelMotionBindingDuration: (modelId: string, bindingId: string, durationMs: number | null) => void;
  onUpdateModelMotionBindingKey: (modelId: string, bindingId: string, motionKey: PetModelMotionKey) => void;
  onUpdateModelMotionBindingSemantic: (
    modelId: string,
    bindingId: string,
    updates: Pick<PetModelMotionBinding, 'semanticAliases' | 'semanticDescription' | 'semanticTags'>,
  ) => void;
  onUpdatePetAutoMovementEnabled: (slotId: string, enabled: boolean) => void;
  onUpdatePetPointerLookEnabled: (slotId: string, enabled: boolean) => void;
}

export function SettingsMotionExpressionTab({
  activityAreaHeightValue,
  activityAreaPreview,
  activityAreaScale,
  activityAreaWidthValue,
  desktopPetSlots,
  localConfig,
  logs,
  noDragRegionStyle,
  petVisualSize,
  selectedDisplay,
  selectedDisplayPixelHeight,
  selectedDisplayPixelWidth,
  selectedPetSlot,
  selectedPetSlotId,
  onAddPetSlot,
  onAppendModelMotionBindings,
  onApplyConfig,
  onRemoveModelMotionBinding,
  onRemovePetSlot,
  onRestoreActivityAreaAuto,
  onSelectPetSlot,
  onSetPetSlotEnabled,
  onSetPetSlotModelVisible,
  onSetActivityBorderVisible,
  onUpdateActivityAreaDimension,
  onUpdateActivityAreaScale,
  onUpdateModelMotionBindingDuration,
  onUpdateModelMotionBindingKey,
  onUpdateModelMotionBindingSemantic,
  onUpdatePetAutoMovementEnabled,
  onUpdatePetPointerLookEnabled,
}: SettingsMotionExpressionTabProps) {
  const motion3dFileInputRef = useRef<HTMLInputElement | null>(null);
  const live2dMotionFileInputRef = useRef<HTMLInputElement | null>(null);
  const [motionUploadTarget, setMotionUploadTarget] = useState<MotionLibraryKind | null>(null);
  const [motionLibraryFeedbackByKind, setMotionLibraryFeedbackByKind] = useState<Record<MotionLibraryKind, string>>({
    '3d': '',
    live2d: '',
  });
  const [selectedMotionModelIdByKind, setSelectedMotionModelIdByKind] = useState<Record<MotionLibraryKind, string>>({
    '3d': '',
    live2d: '',
  });
  const fallbackPetVisualSize = selectedPetSlot.modelType === '3d'
    ? {
        width: Math.max(1, Math.round(232 * selectedPetSlot.scale)),
        height: Math.max(1, Math.round(216 * selectedPetSlot.scale)),
      }
    : {
        width: Math.max(1, Math.round(144 * selectedPetSlot.scale)),
        height: Math.max(1, Math.round(192 * selectedPetSlot.scale)),
      };
  const displayedPetVisualSize = selectedPetSlot.isPrimary
    && petVisualSize
    && petVisualSize.width > 0
    && petVisualSize.height > 0
    ? petVisualSize
    : fallbackPetVisualSize;
  const scaleSliderMax = selectedPetSlot.modelType === '3d' ? 6 : 3;
  const allModelPresets = getVisiblePetModelPresets(
    localConfig.customModelPresets,
    localConfig.settings.hiddenBuiltinModelPresetIds,
  );
  const custom2DModelPresets = localConfig.customModelPresets.filter((preset) => preset.type === '2d');
  const custom3DModelPresets = localConfig.customModelPresets.filter((preset) => preset.type === '3d');
  const customLive2DModelPresets = localConfig.customModelPresets.filter((preset) => preset.type === 'live2d');
  const selected3DMotionModel = custom3DModelPresets.find((preset) => preset.id === selectedMotionModelIdByKind['3d'])
    ?? custom3DModelPresets[0]
    ?? null;
  const selectedLive2DMotionModel = customLive2DModelPresets.find((preset) => preset.id === selectedMotionModelIdByKind.live2d)
    ?? customLive2DModelPresets[0]
    ?? null;
  const currentModelPreset = allModelPresets.find((preset) => (
    preset.type === selectedPetSlot.modelType && preset.url === selectedPetSlot.modelUrl
  )) ?? allModelPresets.find((preset) => preset.url === selectedPetSlot.modelUrl) ?? null;
  const currentModelLabel = currentModelPreset?.name
    ?? (
      selectedPetSlot.modelUrl.startsWith('data:')
        ? '自定义模型'
        : (selectedPetSlot.modelUrl.split(/[\\/]/).pop() || selectedPetSlot.modelUrl)
    );
  const recentAnimationAgentLogs = logs
    .filter((log) => (
      log.includes('character-animation')
      || log.includes('角色工具')
    ))
    .slice(-8)
    .reverse();
  const updateMotionLibraryFeedback = (kind: MotionLibraryKind, feedback: string) => {
    setMotionLibraryFeedbackByKind((current) => ({
      ...current,
      [kind]: feedback,
    }));
  };

  const handleMotionFileSelection = async (
    event: ChangeEvent<HTMLInputElement>,
    kind: MotionLibraryKind,
  ) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';
    const targetModel = kind === '3d' ? selected3DMotionModel : selectedLive2DMotionModel;

    if (!selectedFiles.length || !targetModel) {
      return;
    }

    const supportedFiles = selectedFiles.filter(isSupportedCustomMotionFile);
    if (!supportedFiles.length) {
      const unsupportedReason = selectedFiles
        .map((file) => resolveUnsupportedCustomMotionImportReason(file.name))
        .find((reason) => Boolean(reason));
      if (unsupportedReason) {
        updateMotionLibraryFeedback(kind, unsupportedReason);
        return;
      }

      updateMotionLibraryFeedback(
        kind,
        kind === 'live2d'
          ? '当前 Live2D 模块只支持导入 .motion3.json 动作 / .exp3.json 表情文件。'
          : '当前 3D 模块只支持导入 VRMA / FBX / GLB / GLTF 动作文件。',
      );
      return;
    }

    setMotionUploadTarget(kind);
    updateMotionLibraryFeedback(kind, '');
    try {
      await onAppendModelMotionBindings(targetModel.id, supportedFiles);
      const feedbackTarget = kind === 'live2d'
        ? '动作/表情文件'
        : '动作文件';
      updateMotionLibraryFeedback(
        kind,
        `已为 ${targetModel.name} 绑定 ${supportedFiles.length} 个${feedbackTarget}。右键菜单和动作 Agent 现在可以使用这些资源。`,
      );
    } catch (error) {
      updateMotionLibraryFeedback(
        kind,
        error instanceof Error
          ? error.message
          : '动作导入失败，请换一个文件再试。',
      );
    } finally {
      setMotionUploadTarget(null);
    }
  };

  return (
    <div className="m-0 space-y-6">
      <input
        ref={motion3dFileInputRef}
        type="file"
        accept=".vrma,.fbx,.glb,.gltf"
        multiple
        className="hidden"
        onChange={(event) => {
          void handleMotionFileSelection(event, '3d');
        }}
      />
      <input
        ref={live2dMotionFileInputRef}
        type="file"
        accept={getLive2DMotionImportAcceptAttribute()}
        multiple
        className="hidden"
        onChange={(event) => {
          void handleMotionFileSelection(event, 'live2d');
        }}
      />

      <div className="hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">自动位移</Label>
            <div className="mt-1 text-xs text-muted-foreground">
              每个角色分别控制。关闭后角色不会自主巡逻、觅食或自动移动，但仍然可以手动拖动和缩放。
            </div>
          </div>
          <span className="font-mono text-2xs text-primary">
            {desktopPetSlots.filter((slot) => slot.autoMovementEnabled).length}/{desktopPetSlots.length} 已开启
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {desktopPetSlots.map((slot) => {
            const isSelected = slot.id === selectedPetSlotId;

            return (
              <div
                key={slot.id}
                className={`rounded-sm border px-3 py-3 transition-colors ${
                  isSelected
                    ? 'border-primary/60 bg-primary/5'
                    : 'border-border/80 bg-background/25'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-2xs font-bold uppercase tracking-widest text-foreground">{slot.label}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{slot.personality.name}</div>
                    <div className="mt-1 text-2xs text-muted-foreground">
                      {slot.isPrimary ? '主角色' : (slot.enabled ? '副角色已启用' : '副角色未启用')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdatePetAutoMovementEnabled(slot.id, !slot.autoMovementEnabled)}
                    className={toggleButtonClass(slot.autoMovementEnabled)}
                  >
                    {slot.autoMovementEnabled ? '已开启' : '已关闭'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-sm border border-border bg-secondary/20 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">当前槽位模型</Label>
            <div className="mt-1 text-xs text-muted-foreground">
              下面的 2D / 3D / Live2D 模块会固定显示；3D 和 Live2D 可以在各自模块里选择目标模型。
            </div>
          </div>
          <span className="max-w-[50%] truncate text-right font-mono text-2xs text-primary">
            {currentModelLabel}
          </span>
        </div>
      </div>

      <Settings2DAnimationSection
        currentAction={selectedPetSlot.currentAction}
        modelCount={custom2DModelPresets.length}
        selectedSlotIs2D={selectedPetSlot.modelType === '2d'}
        selectedSlotLabel={currentModelLabel}
      />

      <SettingsModelMotionSection
        canManageCurrentModelMotions={Boolean(selected3DMotionModel)}
        currentModelType="3d"
        currentModelPresetId={selected3DMotionModel?.id ?? null}
        currentMotionBindings={selected3DMotionModel?.motionBindings ?? []}
        disabledMessage="请先在模型库导入一个自定义 3D 模型，然后在这里选择目标模型并导入动作文件。"
        isUploadingMotionFiles={motionUploadTarget === '3d'}
        modelOptions={custom3DModelPresets}
        motionLibraryFeedback={motionLibraryFeedbackByKind['3d']}
        selectedModelId={selected3DMotionModel?.id ?? ''}
        onRemoveModelMotionBinding={onRemoveModelMotionBinding}
        onSelectModelId={(modelId) => setSelectedMotionModelIdByKind((current) => ({
          ...current,
          '3d': modelId,
        }))}
        onTriggerMotionUpload={() => motion3dFileInputRef.current?.click()}
        onUpdateModelMotionBindingDuration={onUpdateModelMotionBindingDuration}
        onUpdateModelMotionBindingKey={onUpdateModelMotionBindingKey}
        onUpdateModelMotionBindingSemantic={onUpdateModelMotionBindingSemantic}
      />

      <SettingsModelMotionSection
        canManageCurrentModelMotions={Boolean(selectedLive2DMotionModel)}
        currentModelType="live2d"
        currentModelPresetId={selectedLive2DMotionModel?.id ?? null}
        currentMotionBindings={selectedLive2DMotionModel?.motionBindings ?? []}
        disabledMessage="请先在模型库导入一个自定义 Live2D .model3.json 模型，然后在这里选择目标模型并导入 .motion3.json / .exp3.json。"
        isUploadingMotionFiles={motionUploadTarget === 'live2d'}
        modelOptions={customLive2DModelPresets}
        motionLibraryFeedback={motionLibraryFeedbackByKind.live2d}
        selectedModelId={selectedLive2DMotionModel?.id ?? ''}
        onRemoveModelMotionBinding={onRemoveModelMotionBinding}
        onSelectModelId={(modelId) => setSelectedMotionModelIdByKind((current) => ({
          ...current,
          live2d: modelId,
        }))}
        onTriggerMotionUpload={() => live2dMotionFileInputRef.current?.click()}
        onUpdateModelMotionBindingDuration={onUpdateModelMotionBindingDuration}
        onUpdateModelMotionBindingKey={onUpdateModelMotionBindingKey}
        onUpdateModelMotionBindingSemantic={onUpdateModelMotionBindingSemantic}
      />

      <SettingsSkillTimelinePreviewPanel
        localConfig={localConfig}
        selectedPetSlotId={selectedPetSlotId}
      />

      <div className="rounded-sm border border-border bg-secondary/15 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">动作 Agent 诊断</Label>
          <span className="font-mono text-2xs text-primary">{recentAnimationAgentLogs.length}/8</span>
        </div>
        <div className="max-h-48 space-y-2 overflow-y-auto pr-1 text-2xs">
          {recentAnimationAgentLogs.length ? recentAnimationAgentLogs.map((log, index) => (
            <div
              key={`${log}-${index}`}
              className="whitespace-pre-wrap rounded-sm border-l border-primary/30 bg-background/40 px-2 py-1 font-mono text-muted-foreground"
            >
              {log}
            </div>
          )) : (
            <div className="rounded-sm border border-dashed border-border/80 bg-background/20 px-3 py-5 text-center text-2xs text-muted-foreground">
              暂无动作触发记录。
            </div>
          )}
        </div>
      </div>

      <SettingsAnimationDriftQaPanel logs={logs} />

      <div className="space-y-4 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">活动范围限制</Label>
            <div className="mt-1 text-xs text-muted-foreground">
              开启时使用当前活动框，关闭后桌宠会在整张桌面自由活动。
            </div>
          </div>
            <button
            type="button"
            onClick={() =>
              onApplyConfig({
                ...localConfig,
                settings: {
                  ...localConfig.settings,
                  activityAreaLimitEnabled: !localConfig.settings.activityAreaLimitEnabled,
                },
              })
            }
            className={toggleButtonClass(localConfig.settings.activityAreaLimitEnabled)}
          >
            {localConfig.settings.activityAreaLimitEnabled ? '已开启限制' : '自由桌面模式'}
          </button>
        </div>

        {localConfig.settings.activityAreaLimitEnabled ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">活动范围</Label>
              <span className="font-mono text-2xs text-primary">{activityAreaScale}%</span>
            </div>
            <Slider
              value={[localConfig.settings.activityAreaScale]}
              min={30}
              max={100}
              step={5}
              onValueChange={onUpdateActivityAreaScale}
            />
            <div className="rounded-sm border border-border bg-secondary/20 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">实时尺寸</span>
                <span className="font-mono text-2xs text-primary">
                  {activityAreaPreview ? `${activityAreaPreview.width} x ${activityAreaPreview.height}px` : '--'}
                </span>
              </div>
              <div className="mt-1 font-mono text-3xs text-muted-foreground">
                {selectedDisplay
                  ? `屏幕 ${selectedDisplay.id} // ${selectedDisplayPixelWidth} x ${selectedDisplayPixelHeight}px`
                  : '暂未检测到显示器。'}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">宽度 (px)</Label>
                <Input
                  type="number"
                  min={1}
                  max={MAX_ACTIVITY_AREA_WIDTH}
                  className="h-9 rounded-sm border-border bg-secondary text-xs focus-visible:ring-primary"
                  value={activityAreaPreview?.width ?? activityAreaWidthValue}
                  onChange={(event) => onUpdateActivityAreaDimension('width', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">高度 (px)</Label>
                <Input
                  type="number"
                  min={1}
                  max={MAX_ACTIVITY_AREA_HEIGHT}
                  className="h-9 rounded-sm border-border bg-secondary text-xs focus-visible:ring-primary"
                  value={activityAreaPreview?.height ?? activityAreaHeightValue}
                  onChange={(event) => onUpdateActivityAreaDimension('height', event.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">
                {localConfig.settings.activityAreaManual ? '已启用手动尺寸。' : '自动尺寸会跟随当前活动屏幕。'}
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={onRestoreActivityAreaAuto}
                className="h-8 rounded-sm border-border px-3 text-2xs uppercase tracking-widest"
              >
                恢复自动
              </Button>
            </div>
            <div className="font-mono text-3xs text-muted-foreground">
              手动输入上限：7680 x 4320
            </div>
            <button
              type="button"
              onClick={() => onSetActivityBorderVisible(!localConfig.settings.activityBorderVisible)}
              className={toggleButtonClass(localConfig.settings.activityBorderVisible)}
            >
              {localConfig.settings.activityBorderVisible ? '隐藏活动边框' : '显示活动边框'}
            </button>
          </div>
        ) : (
          <div className="rounded-sm border border-border bg-secondary/20 px-3 py-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-3">
              <span className="text-2xs font-bold uppercase tracking-widest">自由桌面模式</span>
              <span className="font-mono text-2xs text-primary">
                {activityAreaPreview ? `${activityAreaPreview.width} x ${activityAreaPreview.height}px` : 'FULL DESKTOP'}
              </span>
            </div>
            <div className="mt-2">
              桌宠会使用整张桌面作为活动区，不再显示范围框。鼠标不在桌宠或面板上时会继续穿透到桌面，方便点击图标和正常使用电脑。
            </div>
            <button
              type="button"
              onClick={() =>
                onApplyConfig({
                  ...localConfig,
                  settings: {
                    ...localConfig.settings,
                    desktopIconInteractionEnabled: !localConfig.settings.desktopIconInteractionEnabled,
                  },
                })
              }
              className={`${toggleButtonClass(localConfig.settings.desktopIconInteractionEnabled)} mt-3`}
            >
              {localConfig.settings.desktopIconInteractionEnabled ? '真实图标互动已开启' : '真实图标互动已关闭'}
            </button>
            <button
              type="button"
              onClick={() =>
                onApplyConfig({
                  ...localConfig,
                  settings: {
                    ...localConfig.settings,
                    desktopMouseInteractionEnabled: !localConfig.settings.desktopMouseInteractionEnabled,
                  },
                })
              }
              className={`${toggleButtonClass(localConfig.settings.desktopMouseInteractionEnabled)} ml-2 mt-3`}
            >
              {localConfig.settings.desktopMouseInteractionEnabled ? '真实鼠标互动已开启' : '真实鼠标互动已关闭'}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">物理模拟</Label>
          <button
            type="button"
            onClick={() =>
              onApplyConfig({
                ...localConfig,
                settings: {
                  ...localConfig.settings,
                  physicsEnabled: !localConfig.settings.physicsEnabled,
                },
              })
            }
            className={toggleButtonClass(localConfig.settings.physicsEnabled)}
          >
            {localConfig.settings.physicsEnabled ? '已开启' : '已关闭'}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">载体缩放</Label>
          <span className="font-mono text-2xs text-primary">{selectedPetSlot.scale.toFixed(2)}X</span>
        </div>
        <Slider
          value={[selectedPetSlot.scale]}
          min={0.5}
          max={scaleSliderMax}
          step={0.05}
          onValueChange={(value) =>
            onApplyConfig(
              applyDesktopPetSlotChanges(localConfig, selectedPetSlot.id, {
                scale: Array.isArray(value) ? value[0] : value,
              })
            )
          }
        />
        <div className="rounded-sm border border-border bg-secondary/20 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">模型尺寸</span>
            <span className="font-mono text-2xs text-primary">
              {displayedPetVisualSize.width} x {displayedPetVisualSize.height}px
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-sm border border-border bg-secondary/20 p-4">
        <div className="mb-2 flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-primary">
          <Activity className="h-3 w-3" />
          运行状态
        </div>
        <div className="space-y-2 text-2xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>当前动作</span>
            <span className="font-mono text-primary">{selectedPetSlot.currentAction}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>自动位移</span>
            <span className="font-mono">{selectedPetSlot.autoMovementEnabled ? 'ON' : 'OFF'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>移动刷新</span>
            <span className="font-mono">850ms</span>
          </div>
        </div>
      </div>
    </div>
  );
}
