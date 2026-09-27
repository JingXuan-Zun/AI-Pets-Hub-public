import { ChevronDown, ImagePlus, RotateCcw, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { MAX_FOOD_APPEARANCES } from '../../foodAppearances';
import { getSupported3DModelLabel } from '../../model3dFormatSupport';
import { isPetModelExpressionBinding } from '../../pet-runtime/content/petModelMotionBindingKinds';
import { PET_ACTION_LABELS } from '../../pet-runtime/content/petModelMotionBindings';
import {
  type FoodAppearance,
  type ModelType,
  type PetAction,
  type PetModelMotionBinding,
  type PetModelMotionKey,
  type PetModelPreset,
} from '../../types';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { MAX_CUSTOM_PET_MODELS } from './settingsModelImportUtils';
import { FoodAppearanceCard, ModelPresetCard } from './SettingsModelCards';

function MotionBindingCard({
  binding,
  modelId,
  onRemove,
  onUpdateDuration,
  onUpdateMotionKey,
  onUpdateSemantic,
}: {
  binding: PetModelMotionBinding;
  modelId: string;
  onRemove: (modelId: string, bindingId: string) => void;
  onUpdateDuration: (modelId: string, bindingId: string, durationMs: number | null) => void;
  onUpdateMotionKey: (modelId: string, bindingId: string, motionKey: PetModelMotionKey) => void;
  onUpdateSemantic: (
    modelId: string,
    bindingId: string,
    updates: Pick<PetModelMotionBinding, 'semanticAliases' | 'semanticDescription' | 'semanticTags'>,
  ) => void;
}) {
  const [semanticExpanded, setSemanticExpanded] = useState(false);
  const updateSemanticList = (
    field: 'semanticAliases' | 'semanticTags',
    rawValue: string,
  ) => {
    onUpdateSemantic(modelId, binding.id, {
      semanticAliases: field === 'semanticAliases'
        ? rawValue.split(/[，,]/u).map((item) => item.trim()).filter(Boolean)
        : binding.semanticAliases ?? [],
      semanticDescription: binding.semanticDescription ?? '',
      semanticTags: field === 'semanticTags'
        ? rawValue.split(/[，,]/u).map((item) => item.trim()).filter(Boolean)
        : binding.semanticTags ?? [],
    });
  };
  const updateSemanticDescription = (semanticDescription: string) => {
    onUpdateSemantic(modelId, binding.id, {
      semanticAliases: binding.semanticAliases ?? [],
      semanticDescription,
      semanticTags: binding.semanticTags ?? [],
    });
  };
  const resolvedDurationMs = Number.isFinite(binding.durationMs) && binding.durationMs! > 0
    ? Math.round(binding.durationMs!)
    : null;
  const isExpressionBinding = isPetModelExpressionBinding(binding);
  const updateDurationMs = (rawValue: string) => {
    const trimmedValue = rawValue.trim();
    if (!trimmedValue) {
      onUpdateDuration(modelId, binding.id, null);
      return;
    }

    const nextDurationMs = Number(trimmedValue);
    onUpdateDuration(
      modelId,
      binding.id,
      Number.isFinite(nextDurationMs) && nextDurationMs > 0
        ? Math.round(nextDurationMs)
        : null,
    );
  };

  return (
    <div className="rounded-sm border border-border/80 bg-background/25 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-2xs font-medium text-foreground">{binding.name}</div>
          <div className="mt-1 font-mono text-3xs uppercase tracking-widest text-muted-foreground">
            {isExpressionBinding ? 'LIVE2D EXPRESSION' : binding.format.toUpperCase()}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:bg-white/10 hover:text-destructive"
          onClick={() => onRemove(modelId, binding.id)}
          title={`删除 ${binding.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {isExpressionBinding ? (
        <div className="mt-3 rounded-sm border border-primary/20 bg-primary/5 px-3 py-2 text-2xs text-muted-foreground">
          Live2D 表情不会占用动作槽位。导入后可以通过聊天里的动作 Agent，或下面的语义别名和描述触发。
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-3">
            <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">动作槽位</Label>
            <select
              value={binding.motionKey}
              onChange={(event) => onUpdateMotionKey(modelId, binding.id, event.target.value as PetModelMotionKey)}
              className="h-8 rounded-sm border border-border bg-secondary/40 px-2 text-2xs text-foreground outline-none transition-colors focus:border-primary"
            >
              {Object.entries(PET_ACTION_LABELS).map(([action, label]) => (
                <option key={action} value={action.toLowerCase()}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">PLAY MS</Label>
            <input
              type="number"
              min={1}
              max={120000}
              step={100}
              value={resolvedDurationMs ?? ''}
              onChange={(event) => updateDurationMs(event.target.value)}
              className="h-8 min-w-0 flex-1 rounded-sm border border-border bg-secondary/40 px-2 text-2xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary"
              placeholder="auto"
            />
            <span className="w-14 text-right font-mono text-2xs text-primary">
              {resolvedDurationMs ? `${(resolvedDurationMs / 1000).toFixed(2)}s` : 'AUTO'}
            </span>
          </div>
        </>
      )}

      <div className="mt-3 border-t border-border/60 pt-3">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left text-2xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
          onClick={() => setSemanticExpanded((current) => !current)}
          aria-expanded={semanticExpanded}
        >
          <span>语义信息</span>
          <span className="font-mono text-3xs text-primary">
            {(binding.semanticAliases?.length ?? 0) + (binding.semanticTags?.length ?? 0)} TAG
          </span>
        </button>

        {semanticExpanded ? (
          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">别名</Label>
              <input
                value={(binding.semanticAliases ?? []).join(', ')}
                onChange={(event) => updateSemanticList('semanticAliases', event.target.value)}
                className="h-8 w-full rounded-sm border border-border bg-secondary/40 px-2 text-2xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary"
                placeholder="挠头, 抓后脑勺, 尴尬"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">标签</Label>
              <input
                value={(binding.semanticTags ?? []).join(', ')}
                onChange={(event) => updateSemanticList('semanticTags', event.target.value)}
                className="h-8 w-full rounded-sm border border-border bg-secondary/40 px-2 text-2xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary"
                placeholder="表情, 害羞, 头部动作"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">描述</Label>
              <textarea
                value={binding.semanticDescription ?? ''}
                onChange={(event) => updateSemanticDescription(event.target.value)}
                className="min-h-16 w-full resize-y rounded-sm border border-border bg-secondary/40 px-2 py-2 text-2xs leading-5 text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary"
                placeholder="角色在尴尬、不好意思或思考时抓后脑勺。"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CollapsibleAssetSection({
  title,
  summary,
  actions,
  children,
}: {
  title: string;
  summary: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const toggleTitle = `${expanded ? '收起' : '展开'}${title}`;

  return (
    <div className="rounded-sm border border-border bg-secondary/15">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-label={toggleTitle}
          title={toggleTitle}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
        >
          <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
            {title}
          </Label>
          <span className="shrink-0 font-mono text-2xs text-primary">{summary}</span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            aria-label={toggleTitle}
            title={toggleTitle}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-primary/60 bg-primary text-primary-foreground shadow-[0_0_14px_rgba(0,209,255,0.18)] transition-colors hover:bg-primary/85 hover:text-primary-foreground"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-border px-4 py-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function Settings2DAnimationSection({
  currentAction,
  modelCount,
  selectedSlotIs2D,
  selectedSlotLabel,
}: {
  currentAction: PetAction;
  modelCount: number;
  selectedSlotIs2D: boolean;
  selectedSlotLabel: string;
}) {
  return (
    <div className="space-y-4 rounded-sm border border-border bg-secondary/15 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">2D 动画模块</Label>
          <div className="mt-1 text-xs text-muted-foreground">
            2D 使用图片或序列帧动作槽位。自定义 2D 图片会作为外观模型保存，当前不导入独立动作文件。
          </div>
        </div>
        <span className="font-mono text-2xs text-primary">{modelCount} MODEL</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-2xs">
        <div className="rounded-sm border border-border/80 bg-background/25 px-3 py-2">
          <div className="font-bold uppercase tracking-widest text-muted-foreground">当前槽位</div>
          <div className="mt-1 truncate text-foreground">{selectedSlotLabel}</div>
        </div>
        <div className="rounded-sm border border-border/80 bg-background/25 px-3 py-2">
          <div className="font-bold uppercase tracking-widest text-muted-foreground">动作状态</div>
          <div className="mt-1 font-mono text-primary">{PET_ACTION_LABELS[currentAction] ?? currentAction}</div>
        </div>
      </div>

      {!selectedSlotIs2D ? (
        <div className="rounded-sm border border-dashed border-border/80 bg-background/20 px-3 py-3 text-2xs text-muted-foreground">
          当前选中的槽位不是 2D；这个模块仍会固定显示，方便用户知道 2D 动画配置的位置。
        </div>
      ) : null}
    </div>
  );
}

export function SettingsModelMotionSection({
  canManageCurrentModelMotions,
  currentModelType,
  currentModelPresetId,
  currentMotionBindings,
  disabledMessage,
  isUploadingMotionFiles,
  modelOptions,
  motionLibraryFeedback,
  selectedModelId,
  onRemoveModelMotionBinding,
  onSelectModelId,
  onTriggerMotionUpload,
  onUpdateModelMotionBindingDuration,
  onUpdateModelMotionBindingKey,
  onUpdateModelMotionBindingSemantic,
}: {
  canManageCurrentModelMotions: boolean;
  currentModelType: ModelType;
  currentModelPresetId: string | null;
  currentMotionBindings: PetModelMotionBinding[];
  disabledMessage: string;
  isUploadingMotionFiles: boolean;
  modelOptions: PetModelPreset[];
  motionLibraryFeedback: string;
  selectedModelId: string;
  onRemoveModelMotionBinding: (modelId: string, bindingId: string) => void;
  onSelectModelId: (modelId: string) => void;
  onTriggerMotionUpload: () => void;
  onUpdateModelMotionBindingDuration: (modelId: string, bindingId: string, durationMs: number | null) => void;
  onUpdateModelMotionBindingKey: (modelId: string, bindingId: string, motionKey: PetModelMotionKey) => void;
  onUpdateModelMotionBindingSemantic: (
    modelId: string,
    bindingId: string,
    updates: Pick<PetModelMotionBinding, 'semanticAliases' | 'semanticDescription' | 'semanticTags'>,
  ) => void;
}) {
  const live2dExpressionBindings = currentMotionBindings.filter(isPetModelExpressionBinding);
  const playableMotionBindings = currentMotionBindings.filter((binding) => !isPetModelExpressionBinding(binding));
  const expressionBindingCount = currentMotionBindings.filter(isPetModelExpressionBinding).length;
  const motionBindingCount = currentMotionBindings.length - expressionBindingCount;
  const sectionTitle = currentModelType === 'live2d'
    ? 'Live2D 动作 / 表情模块'
    : currentModelType === '3d'
      ? '3D 动作模块'
      : '模型动作模块';
  const importButtonLabel = currentModelType === 'live2d'
    ? '导入 Live2D 动作/表情'
    : currentModelType === '3d'
      ? '导入 3D 动作'
      : '导入动作/表情';
  const sectionDescription = currentModelType === 'live2d'
    ? '给当前 Live2D 模型导入 .motion3.json 动作或 .exp3.json 表情。动作可接入右键动作切换，表情可由聊天里的动作 Agent 调用。'
    : currentModelType === '3d'
      ? '给当前 3D 模型绑定 VRMA / FBX / GLB / GLTF 动作，导入后右键菜单里的“动作”就能直接切换。'
      : '先选择自定义 3D 或 Live2D 模型，再导入动作或表情资源。';
  const emptyStateMessage = currentModelType === 'live2d'
    ? '这个 Live2D 模型还没有导入 .motion3.json 动作或 .exp3.json 表情。点击上方按钮导入后，动作 Agent 会按文件名、别名和描述调用。'
    : '这个模型还没有绑定动作文件。导入后会自动接入右键动作切换。';
  const supportSummary = currentModelType === 'live2d'
    ? `支持 Live2D .motion3.json 动作和 .exp3.json 表情。当前动作 ${motionBindingCount} 个，Live2D 表情 ${expressionBindingCount} 个。`
    : `支持 3D 动作 VRMA / FBX / GLB / GLTF。当前动作 ${motionBindingCount} 个。`;

  return (
    <div className="space-y-4 rounded-sm border border-border bg-secondary/15 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">{sectionTitle}</Label>
          <div className="mt-1 text-xs text-muted-foreground">
            {sectionDescription}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="h-8 rounded-sm border-border px-3 text-2xs uppercase tracking-widest"
          onClick={onTriggerMotionUpload}
          disabled={!canManageCurrentModelMotions || isUploadingMotionFiles}
        >
          <ImagePlus className="mr-1 h-3.5 w-3.5" />
          {isUploadingMotionFiles ? '导入中' : importButtonLabel}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-border/80 bg-background/25 px-3 py-2">
        <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">目标模型</Label>
        {modelOptions.length > 0 ? (
          <select
            value={selectedModelId}
            onChange={(event) => onSelectModelId(event.target.value)}
            className="h-8 min-w-0 flex-1 rounded-sm border border-border bg-secondary/40 px-2 text-2xs text-foreground outline-none transition-colors focus:border-primary"
          >
            {modelOptions.map((modelPreset) => (
              <option key={modelPreset.id} value={modelPreset.id}>
                {modelPreset.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="min-w-0 flex-1 text-2xs text-muted-foreground">
            暂无可配置的自定义模型
          </div>
        )}
      </div>

      <div className="text-2xs text-muted-foreground">
        建议一个文件放一个动作或表情。3D / .motion3.json 会按文件名自动猜测“待机 / 走路 / 跑步 / 开心 / 难过”等槽位；.exp3.json 表情可在导入后填写别名、标签和描述，供动作 Agent 选择。
      </div>

      <div className="rounded-sm border border-primary/20 bg-primary/5 px-3 py-2 text-2xs text-muted-foreground">
        {supportSummary}
      </div>

      {motionLibraryFeedback && (
        <div className="rounded-sm border border-border/80 bg-background/30 px-3 py-2 text-2xs text-muted-foreground">
          {motionLibraryFeedback}
        </div>
      )}

      {!canManageCurrentModelMotions ? (
        <div className="rounded-sm border border-dashed border-border/80 bg-background/20 px-3 py-5 text-2xs text-muted-foreground">
          {disabledMessage}
        </div>
      ) : currentMotionBindings.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border/80 bg-background/20 px-3 py-5 text-2xs text-muted-foreground">
          {emptyStateMessage}
        </div>
      ) : (
        <div className="space-y-3">
          {currentModelPresetId && playableMotionBindings.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">动作文件</Label>
              <div className="space-y-3">
                {playableMotionBindings.map((binding) => (
                  <MotionBindingCard
                    key={binding.id}
                    binding={binding}
                    modelId={currentModelPresetId}
                    onRemove={onRemoveModelMotionBinding}
                    onUpdateDuration={onUpdateModelMotionBindingDuration}
                    onUpdateMotionKey={onUpdateModelMotionBindingKey}
                    onUpdateSemantic={onUpdateModelMotionBindingSemantic}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {currentModelPresetId && live2dExpressionBindings.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">Live2D 表情文件</Label>
              <div className="space-y-3">
                {live2dExpressionBindings.map((binding) => (
                  <MotionBindingCard
                    key={binding.id}
                    binding={binding}
                    modelId={currentModelPresetId}
                    onRemove={onRemoveModelMotionBinding}
                    onUpdateDuration={onUpdateModelMotionBindingDuration}
                    onUpdateMotionKey={onUpdateModelMotionBindingKey}
                    onUpdateSemantic={onUpdateModelMotionBindingSemantic}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function SettingsModelPresetSection({
  allModelPresets,
  customModelCount,
  canUploadMoreCustomModels,
  hiddenBuiltinModelPresetCount,
  isUploadingCustomModels,
  modelLibraryFeedback,
  onRemoveModelPreset,
  onResetFolders,
  onRestoreBuiltinModelPresets,
  onTriggerModelUpload,
  onUpdateModel,
  selectedModelType,
  selectedModelUrl,
}: {
  allModelPresets: PetModelPreset[];
  customModelCount: number;
  canUploadMoreCustomModels: boolean;
  hiddenBuiltinModelPresetCount: number;
  isUploadingCustomModels: boolean;
  modelLibraryFeedback: string;
  onRemoveModelPreset: (modelId: string) => void;
  onResetFolders: () => void;
  onRestoreBuiltinModelPresets: () => void;
  onTriggerModelUpload: () => void;
  onUpdateModel: (url: string, type: ModelType) => void;
  selectedModelType: ModelType;
  selectedModelUrl: string;
}) {
  return (
    <CollapsibleAssetSection
      title="模型库"
      summary={`${allModelPresets.length} 个 / ${customModelCount}/${MAX_CUSTOM_PET_MODELS}`}
      actions={(
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-sm border-border px-3 text-2xs uppercase tracking-widest"
            onClick={onTriggerModelUpload}
            disabled={!canUploadMoreCustomModels || isUploadingCustomModels}
          >
            <ImagePlus className="mr-1 h-3.5 w-3.5" />
            {isUploadingCustomModels ? '上传中' : '上传模型'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-sm border-border px-3 text-2xs uppercase tracking-widest"
            onClick={onRestoreBuiltinModelPresets}
            disabled={hiddenBuiltinModelPresetCount === 0}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            恢复内置
          </Button>
          <Button
            variant="outline"
            onClick={onResetFolders}
            className="h-8 rounded-sm border-border px-3 text-2xs uppercase tracking-widest"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            重置桌面道具
          </Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="text-2xs text-muted-foreground">
          上传后的模型会和内置模型放在同一列表里。当前选择会应用到你上面选中的桌宠槽位。支持 {getSupported3DModelLabel()} 与 Live2D .model3.json；桌面版会优先读取原始本地文件，这样模型贴图和关联资源会更稳定。
        </div>

        {modelLibraryFeedback && (
          <div className="rounded-sm border border-border/80 bg-background/30 px-3 py-2 text-2xs text-muted-foreground">
            {modelLibraryFeedback}
          </div>
        )}

        {allModelPresets.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {allModelPresets.map((preset) => (
              <ModelPresetCard
                key={preset.id}
                preset={preset}
                isActive={selectedModelType === preset.type && selectedModelUrl === preset.url}
                onClick={() => onUpdateModel(preset.url, preset.type)}
                onRemove={onRemoveModelPreset}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-sm border border-dashed border-border/80 bg-background/20 px-3 py-6 text-center text-2xs text-muted-foreground">
            模型库已经清空。你可以恢复内置模型，或者先上传自定义模型。
          </div>
        )}
      </div>
    </CollapsibleAssetSection>
  );
}

export function SettingsFoodAppearanceSection({
  allowCustomVideoActions,
  canUploadMoreFoodImages,
  foodAppearanceCount,
  foodAppearances,
  isUploadingFoodImages,
  onRemoveFoodAppearance,
  onUpdateFoodInteractionLabel,
  onUpdateFoodInteractionType,
  onRestoreFoodAppearances,
  onTriggerFoodUpload,
}: {
  allowCustomVideoActions: boolean;
  canUploadMoreFoodImages: boolean;
  foodAppearanceCount: number;
  foodAppearances: FoodAppearance[];
  isUploadingFoodImages: boolean;
  onRemoveFoodAppearance: (appearanceId: string) => void;
  onUpdateFoodInteractionLabel: (appearanceId: string, label: string) => void;
  onUpdateFoodInteractionType: (appearanceId: string, interactionType: 'eat' | 'toy' | 'custom') => void;
  onRestoreFoodAppearances: () => void;
  onTriggerFoodUpload: () => void;
}) {
  return (
    <CollapsibleAssetSection
      title="道具库"
      summary={`${foodAppearanceCount}/${MAX_FOOD_APPEARANCES}`}
      actions={(
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-sm border-border px-3 text-2xs uppercase tracking-widest"
            onClick={onTriggerFoodUpload}
            disabled={!canUploadMoreFoodImages || isUploadingFoodImages}
          >
            <ImagePlus className="mr-1 h-3.5 w-3.5" />
            {isUploadingFoodImages ? '上传中' : '上传道具图'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-sm border-border px-3 text-2xs uppercase tracking-widest"
            onClick={onRestoreFoodAppearances}
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            恢复预设道具
          </Button>
        </div>
      )}
    >
      <div className="space-y-3">
        <div className="text-2xs text-muted-foreground">
          当前 {foodAppearanceCount}/{MAX_FOOD_APPEARANCES} 个道具。创建道具时可在桌面状态控制中选择外观。
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {foodAppearances.map((appearance) => (
            <FoodAppearanceCard
              key={appearance.id}
              appearance={appearance}
              allowCustomVideoActions={allowCustomVideoActions}
              onRemove={onRemoveFoodAppearance}
              onUpdateInteractionLabel={onUpdateFoodInteractionLabel}
              onUpdateInteractionType={onUpdateFoodInteractionType}
            />
          ))}
        </div>
      </div>
    </CollapsibleAssetSection>
  );
}
