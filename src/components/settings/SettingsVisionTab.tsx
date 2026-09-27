import { Monitor, RotateCcw } from 'lucide-react';
import { type CSSProperties } from 'react';
import { type PetConfig } from '../../types';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  createDefaultModelRequestParams,
  normalizeModelRequestParams,
} from '../../modelProviderSettings';
import {
  resolveVisionModelSettings,
  type ResolvedVisionModelSettings,
} from '../../visionModelSettings';
import { SettingsVisionActivityDisplayPanel } from './vision/SettingsVisionActivityDisplayPanel';
import { SettingsVisionAreaPanel } from './vision/SettingsVisionAreaPanel';
import { SettingsVisionConnectionActions } from './vision/SettingsVisionConnectionActions';
import { SettingsVisionFolderPositionsPanel } from './vision/SettingsVisionFolderPositionsPanel';
import { SettingsVisionPetPositionPanel } from './vision/SettingsVisionPetPositionPanel';
import { SettingsVisionSourcePanel } from './vision/SettingsVisionSourcePanel';
import { type ActivityDisplayOption } from './vision/types';
import { inputClassName, selectClassName } from './settingsVoiceUtils';
import { SettingsModelRequestParamEditor } from './SettingsModelRequestParamEditor';
import { SettingsOpenAIModelPicker } from './SettingsOpenAIModelPicker';

export interface SettingsVisionTabProps {
  activePreviewSourceId: string;
  activityDisplayOptions: ActivityDisplayOption[];
  currentInteractiveDialogueDisplayLabel: string;
  currentActivityDisplayLabel: string;
  captureCropRect: DesktopPetCaptureRectLike;
  captureMode: DesktopPetCaptureMode;
  captureSourcesLoading: boolean;
  interactiveDialogueDisplayOptions: ActivityDisplayOption[];
  desktopAreaSelection: DesktopPetAreaSelectionLike | null;
  isDesktopConnected: boolean;
  isWindowAreaMode: boolean;
  localConfig: PetConfig;
  noDragRegionStyle?: CSSProperties;
  logs: string[];
  previewCaptureSources: DesktopPetCaptureSourceLike[];
  screenCaptureOptions: DesktopPetCaptureOptionsLike | null;
  selectedCaptureSource: DesktopPetCaptureSourceLike | null;
  onActivateWindowAreaMode: () => void;
  onApplyConfig: (config: PetConfig) => void;
  onPickDesktopCaptureArea: () => Promise<DesktopPetAreaSelectionLike | null>;
  onRefreshCaptureSources: () => void;
  onSetCaptureMode: (mode: DesktopPetCaptureMode) => void;
  onSetSelectedCaptureSourceId: (sourceId: string) => void;
  onStartConfiguredScreenCapture: () => Promise<void>;
  onStopScreenCapture: () => Promise<void> | void;
  onUpdateActivityDisplay: (activityDisplayId: PetConfig['settings']['activityDisplayId']) => void;
  onUpdateInteractiveDialogueDisplay: (displayId: PetConfig['settings']['interactiveDialogueDisplayId']) => void;
  onUpdateCaptureCropRect: (key: keyof DesktopPetCaptureRectLike, value: string) => void;
}

function parseCoordinate(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const VISION_LOG_KEYWORDS = ['视觉系统', '桌面连接', '桌面捕获'];

function getRecentVisionLogs(logs: string[]) {
  return logs
    .filter((log) => VISION_LOG_KEYWORDS.some((keyword) => log.includes(keyword)))
    .slice(0, 3);
}

function getCaptureModeLabel(mode?: DesktopPetCaptureMode) {
  switch (mode) {
    case 'window':
      return '窗口';
    case 'area':
      return '区域';
    case 'screen':
    default:
      return '屏幕';
  }
}

function getCaptureTargetLabel(
  options: DesktopPetCaptureOptionsLike | null,
  selectedCaptureSource: DesktopPetCaptureSourceLike | null,
) {
  if (options?.mode === 'area' && Array.isArray(options.areaSources) && options.areaSources.length > 1) {
    return `跨屏区域：${options.areaSources.length} 个显示器`;
  }

  if (options?.sourceName) {
    return options.sourceName;
  }

  if (selectedCaptureSource?.name) {
    return selectedCaptureSource.name;
  }

  return '真实桌面';
}

function getCaptureSizeLabel(
  options: DesktopPetCaptureOptionsLike | null,
  selectedCaptureSource: DesktopPetCaptureSourceLike | null,
) {
  const cropRect = options?.cropRect;
  if (options?.mode === 'area' && cropRect) {
    return `${Math.round(cropRect.width)} x ${Math.round(cropRect.height)}`;
  }

  const width = options?.cropBasisWidth ?? selectedCaptureSource?.width;
  const height = options?.cropBasisHeight ?? selectedCaptureSource?.height;
  if (!width || !height) {
    return '等待画面尺寸';
  }

  return `${Math.round(width)} x ${Math.round(height)}`;
}

function resolveVisionModeLabel(resolved: ResolvedVisionModelSettings) {
  if (resolved.disabled) {
    return 'DISABLED';
  }

  return resolved.inherited ? 'INHERIT' : 'DEDICATED';
}

function resolveVisionModelProviderLabel(settings: PetConfig['settings'], resolved: ResolvedVisionModelSettings) {
  const provider = resolved.provider ?? settings.llmProvider;

  return provider === 'openai' ? 'OPENAI' : 'GEMINI';
}

function resolveVisionModelNameLabel(settings: PetConfig['settings'], resolved: ResolvedVisionModelSettings) {
  if (resolved.disabled) {
    return 'Off';
  }

  if (!resolved.inherited && resolved.provider === 'gemini') {
    return settings.visionLlmModel || settings.llmModel;
  }

  if (!resolved.inherited && resolved.provider === 'openai') {
    return settings.visionCustomModelName || 'Vision model';
  }

  return settings.llmProvider === 'openai'
    ? settings.customModelName || 'Chat model'
    : settings.llmModel;
}

export function SettingsVisionTab({
  activePreviewSourceId,
  activityDisplayOptions,
  currentInteractiveDialogueDisplayLabel,
  currentActivityDisplayLabel,
  captureCropRect,
  captureMode,
  captureSourcesLoading,
  interactiveDialogueDisplayOptions,
  desktopAreaSelection,
  isDesktopConnected,
  isWindowAreaMode,
  localConfig,
  logs,
  noDragRegionStyle,
  previewCaptureSources,
  screenCaptureOptions,
  selectedCaptureSource,
  onActivateWindowAreaMode,
  onApplyConfig,
  onPickDesktopCaptureArea,
  onRefreshCaptureSources,
  onSetCaptureMode,
  onSetSelectedCaptureSourceId,
  onStartConfiguredScreenCapture,
  onStopScreenCapture,
  onUpdateActivityDisplay,
  onUpdateInteractiveDialogueDisplay,
  onUpdateCaptureCropRect,
}: SettingsVisionTabProps) {
  const activeCaptureOptions = isDesktopConnected ? screenCaptureOptions : null;
  const captureModeLabel = getCaptureModeLabel(activeCaptureOptions?.mode ?? captureMode);
  const captureTargetLabel = isDesktopConnected
    ? getCaptureTargetLabel(activeCaptureOptions, selectedCaptureSource)
    : (selectedCaptureSource?.name ?? '尚未连接');
  const captureSizeLabel = isDesktopConnected
    ? getCaptureSizeLabel(activeCaptureOptions, selectedCaptureSource)
    : '未接入';
  const recentVisionLogs = getRecentVisionLogs(logs);
  const { settings } = localConfig;
  const visionMode = settings.visionMode ?? 'auto';
  const visionModelProvider = settings.visionModelProvider ?? 'inherit';
  const resolvedVisionModel = resolveVisionModelSettings(settings);
  const visionRequestParams = normalizeModelRequestParams(settings.visionCustomModelRequestParams);
  const inheritedOpenAiVisionNeedsImageCapability = (
    !resolvedVisionModel.disabled
    && resolvedVisionModel.inherited
    && resolvedVisionModel.provider === 'openai'
    && !settings.customModelCapabilities?.image
  );

  const applySettings = (updates: Partial<PetConfig['settings']>) => {
    onApplyConfig({
      ...localConfig,
      settings: {
        ...settings,
        ...updates,
      },
    });
  };

  const handlePetPositionChange = (axis: 'x' | 'y', value: string) => {
    onApplyConfig({
      ...localConfig,
      position: {
        ...localConfig.position,
        [axis]: parseCoordinate(value, localConfig.position[axis]),
      },
    });
  };

  const handleFolderPositionChange = (folderId: string, axis: 'x' | 'y', value: string) => {
    onApplyConfig({
      ...localConfig,
      folders: localConfig.folders.map((folder) => (
        folder.id === folderId
          ? {
              ...folder,
              position: {
                ...folder.position,
                [axis]: parseCoordinate(value, folder.position[axis]),
              },
            }
          : folder
      )),
    });
  };

  const handleVisionModeChange = (nextMode: PetConfig['settings']['visionMode']) => {
    applySettings({
      visionMode: nextMode,
      ...(nextMode === 'inherit-brain' ? { visionModelProvider: 'inherit' as const } : {}),
      ...(nextMode === 'dedicated-vision-model' && visionModelProvider === 'inherit'
        ? { visionModelProvider: 'gemini' as const }
        : {}),
    });
  };

  const resetVisionModelSettings = () => {
    applySettings({
      visionMode: 'auto',
      visionModelProvider: 'inherit',
      visionLlmModel: 'gemini-1.5-flash',
      visionCustomApiUrl: '',
      visionCustomApiKey: '',
      visionCustomModelName: 'gpt-4o-mini',
      visionCustomModelRequestParams: createDefaultModelRequestParams(),
    });
  };

  return (
    <div className="m-0 space-y-6">
      <div className="space-y-4 rounded-sm border border-border bg-secondary/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-primary" />
            <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">桌面视觉连接</Label>
          </div>
          <span className={`font-mono text-3xs tracking-widest ${isDesktopConnected ? 'text-green-500' : 'text-muted-foreground'}`}>
            {isDesktopConnected ? '已连接' : '空闲'}
          </span>
        </div>

        <SettingsVisionSourcePanel
          activePreviewSourceId={activePreviewSourceId}
          captureMode={captureMode}
          captureSourcesLoading={captureSourcesLoading}
          desktopAreaSelection={desktopAreaSelection}
          isWindowAreaMode={isWindowAreaMode}
          previewCaptureSources={previewCaptureSources}
          selectedCaptureSource={selectedCaptureSource}
          onActivateWindowAreaMode={onActivateWindowAreaMode}
          onRefreshCaptureSources={onRefreshCaptureSources}
          onSetCaptureMode={onSetCaptureMode}
          onSetSelectedCaptureSourceId={onSetSelectedCaptureSourceId}
        />

        <SettingsVisionAreaPanel
          captureCropRect={captureCropRect}
          captureMode={captureMode}
          desktopAreaSelection={desktopAreaSelection}
          isWindowAreaMode={isWindowAreaMode}
          selectedCaptureSource={selectedCaptureSource}
          onPickDesktopCaptureArea={onPickDesktopCaptureArea}
          onSetCaptureMode={onSetCaptureMode}
          onUpdateCaptureCropRect={onUpdateCaptureCropRect}
        />
      </div>

      <div className="space-y-4 rounded-sm border border-border bg-secondary/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
              视觉模型调用
            </Label>
            <div className="mt-1 font-mono text-2xs text-primary">
              {resolveVisionModeLabel(resolvedVisionModel)} / {resolveVisionModelProviderLabel(settings, resolvedVisionModel)} / {resolveVisionModelNameLabel(settings, resolvedVisionModel)}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={resetVisionModelSettings}
            className="h-8 w-8 rounded-full border border-border/70 bg-background/60 text-muted-foreground hover:bg-primary/10 hover:text-primary"
            title="重置视觉模型配置"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <select
          value={visionMode}
          onChange={(event) => handleVisionModeChange(event.target.value as PetConfig['settings']['visionMode'])}
          className={selectClassName()}
        >
          <option value="auto">自动选择视觉路由</option>
          <option value="inherit-brain">继承主脑模型</option>
          <option value="dedicated-vision-model">使用独立视觉模型</option>
          <option value="disabled">关闭视觉模型</option>
        </select>

        <select
          value={visionModelProvider}
          onChange={(event) => applySettings({
            visionModelProvider: event.target.value as PetConfig['settings']['visionModelProvider'],
          })}
          className={selectClassName()}
          disabled={resolvedVisionModel.disabled}
        >
          <option value="inherit">沿用聊天模型</option>
          <option value="gemini">独立 Gemini 视觉模型</option>
          <option value="openai">独立 OpenAI 兼容视觉模型</option>
        </select>

        {inheritedOpenAiVisionNeedsImageCapability && (
          <div className="rounded-sm border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-2xs leading-4 text-amber-300">
            当前沿用的 OpenAI 兼容聊天模型未标记图像能力，视觉摘要会被拦截。可以在模型高级配置里启用图像能力，或改用独立视觉模型。
          </div>
        )}

        {!resolvedVisionModel.disabled && visionModelProvider === 'gemini' && (
          <select
            value={settings.visionLlmModel}
            onChange={(event) => applySettings({ visionLlmModel: event.target.value })}
            className={selectClassName()}
          >
            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash Exp</option>
            <option value="gemini-1.0-pro">Gemini 1.0 Pro</option>
          </select>
        )}

        {!resolvedVisionModel.disabled && visionModelProvider === 'openai' && (
          <div className="space-y-3">
            <SettingsOpenAIModelPicker
              apiKey={settings.visionCustomApiKey}
              apiUrl={settings.visionCustomApiUrl}
              inputClassName={inputClassName()}
              modelName={settings.visionCustomModelName}
              noDragRegionStyle={noDragRegionStyle}
              onModelNameChange={(modelName) => applySettings({ visionCustomModelName: modelName })}
            />
            <Input
              className={inputClassName()}
              style={noDragRegionStyle}
              value={settings.visionCustomApiUrl}
              onChange={(event) => applySettings({ visionCustomApiUrl: event.target.value })}
              placeholder="视觉接口地址"
            />
            <Input
              type="password"
              className={inputClassName()}
              style={noDragRegionStyle}
              value={settings.visionCustomApiKey}
              onChange={(event) => applySettings({ visionCustomApiKey: event.target.value })}
              placeholder="视觉 API Key"
            />
          </div>
        )}

        {!resolvedVisionModel.disabled && visionModelProvider !== 'inherit' && (
          <details className="rounded-sm border border-border/70 bg-background/35 p-3">
            <summary className="cursor-pointer text-2xs font-bold uppercase tracking-widest text-muted-foreground">
              视觉请求参数
            </summary>
            <div className="mt-3 space-y-3">
              <SettingsModelRequestParamEditor
                params={visionRequestParams}
                onChange={(params) => applySettings({
                  visionCustomModelRequestParams: normalizeModelRequestParams(params),
                })}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applySettings({ visionCustomModelRequestParams: createDefaultModelRequestParams() })}
                className="h-7 rounded-full px-3 text-2xs"
              >
                恢复预设
              </Button>
            </div>
          </details>
        )}
      </div>

      <SettingsVisionConnectionActions
        isDesktopConnected={isDesktopConnected}
        onStartConfiguredScreenCapture={onStartConfiguredScreenCapture}
        onStopScreenCapture={onStopScreenCapture}
      />

      <div className={`space-y-3 rounded-sm border p-4 ${
        isDesktopConnected
          ? 'border-green-500/35 bg-green-500/10'
          : 'border-border bg-secondary/20'
      }`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className={`h-2 w-2 shrink-0 rounded-full ${
              isDesktopConnected
                ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.55)]'
                : 'bg-muted-foreground/50'
            }`} />
            <Label className="truncate text-2xs font-bold uppercase tracking-widest text-muted-foreground">
              视觉连接反馈
            </Label>
          </div>
          <span className={`shrink-0 rounded-sm border px-2 py-1 font-mono text-3xs tracking-widest ${
            isDesktopConnected
              ? 'border-green-500/40 bg-green-500/15 text-green-500'
              : 'border-border bg-background/40 text-muted-foreground'
          }`}>
            {isDesktopConnected ? '连接中' : '未连接'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 text-2xs sm:grid-cols-3">
          <div className="rounded-sm border border-border/70 bg-background/40 px-3 py-2">
            <div className="mb-1 font-mono text-3xs uppercase tracking-widest text-muted-foreground">状态</div>
            <div className={isDesktopConnected ? 'font-semibold text-green-500' : 'font-semibold text-muted-foreground'}>
              {isDesktopConnected ? '画面已接入桌宠视觉' : '等待连接桌面'}
            </div>
          </div>
          <div className="rounded-sm border border-border/70 bg-background/40 px-3 py-2">
            <div className="mb-1 font-mono text-3xs uppercase tracking-widest text-muted-foreground">目标</div>
            <div className="truncate font-semibold text-foreground" title={captureTargetLabel}>
              {captureTargetLabel}
            </div>
          </div>
          <div className="rounded-sm border border-border/70 bg-background/40 px-3 py-2">
            <div className="mb-1 font-mono text-3xs uppercase tracking-widest text-muted-foreground">模式 / 尺寸</div>
            <div className="font-semibold text-foreground">
              {captureModeLabel} · {captureSizeLabel}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="font-mono text-3xs uppercase tracking-widest text-muted-foreground">最近反馈</div>
          {recentVisionLogs.length ? recentVisionLogs.map((log, index) => (
            <div key={`${log}-${index}`} className="whitespace-pre-wrap rounded-sm border-l border-primary/35 bg-background/45 px-2 py-1 font-mono text-3xs text-muted-foreground">
              {log}
            </div>
          )) : (
            <div className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-3 text-center text-2xs text-muted-foreground">
              暂无视觉连接记录
            </div>
          )}
        </div>
      </div>

      <SettingsVisionActivityDisplayPanel
        activityDisplayOptions={activityDisplayOptions}
        currentDisplayId={localConfig.settings.activityDisplayId}
        panelTitle="活动屏幕"
        selectedLabel={currentActivityDisplayLabel}
        onUpdateDisplay={(displayId) => onUpdateActivityDisplay(
          displayId as PetConfig['settings']['activityDisplayId'],
        )}
      />

      <SettingsVisionActivityDisplayPanel
        activityDisplayOptions={interactiveDialogueDisplayOptions}
        currentDisplayId={localConfig.settings.interactiveDialogueDisplayId}
        panelTitle="互动聊天屏幕"
        selectedLabel={currentInteractiveDialogueDisplayLabel}
        onUpdateDisplay={(displayId) => onUpdateInteractiveDialogueDisplay(
          displayId as PetConfig['settings']['interactiveDialogueDisplayId'],
        )}
      />

      <SettingsVisionPetPositionPanel
        position={localConfig.position}
        onPositionChange={handlePetPositionChange}
      />

      <SettingsVisionFolderPositionsPanel
        folders={localConfig.folders}
        onFolderPositionChange={handleFolderPositionChange}
      />
    </div>
  );
}


