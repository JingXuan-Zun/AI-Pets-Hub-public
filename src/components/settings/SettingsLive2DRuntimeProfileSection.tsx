import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Slider } from '../../../components/ui/slider';
import {
  resolveLive2DDefaultParameterId,
  type Live2DLayoutFitMode,
  type Live2DParameterSemantic,
  type Live2DRuntimeProfileConfigV1,
  type Live2DRuntimeProfileParameterConfig,
} from '../../pet-runtime/live2d/live2dRuntimeProfile';
import { loadLive2DDeclaredParameterIdsFromModelUrl } from '../../pet-runtime/live2d/live2dDisplayInfoParameters';
import { type PetModelPreset } from '../../types';
import {
  resolveLive2DRuntimeProfileEditorState,
  updateLive2DRuntimeProfileCapability,
  updateLive2DRuntimeProfileLayout,
  updateLive2DRuntimeProfileParameter,
  type Live2DRuntimeProfileCapability,
  type Live2DRuntimeProfileCapabilityMode,
} from './settingsLive2DRuntimeProfile';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';

const FIT_MODE_OPTIONS: Array<{ label: string; value: Live2DLayoutFitMode }> = [
  { label: '智能', value: 'visible-overflow' },
  { label: '模型画布', value: 'canvas' },
  { label: '可见区域', value: 'visible' },
];

const CAPABILITY_OPTIONS: Array<{
  key: Live2DRuntimeProfileCapability;
  label: string;
}> = [
  { key: 'pointerLook', label: '鼠标视线' },
  { key: 'dragLook', label: '拖动朝向' },
  { key: 'eyeLook', label: '眼球跟随' },
  { key: 'bodyTurn', label: '身体转向' },
  { key: 'bodySway', label: '身体摆动' },
  { key: 'breathing', label: '呼吸表现' },
];

const PARAMETER_OPTIONS: Array<{
  key: Live2DParameterSemantic;
  label: string;
}> = [
  { key: 'lookX', label: '头部水平' },
  { key: 'lookY', label: '头部垂直' },
  { key: 'headRoll', label: '头部侧倾' },
  { key: 'eyeLookX', label: '眼球水平' },
  { key: 'eyeLookY', label: '眼球垂直' },
  { key: 'eyeLOpen', label: '左眼开合' },
  { key: 'eyeROpen', label: '右眼开合' },
  { key: 'bodyTurnX', label: '身体转向' },
  { key: 'bodySwayY', label: '身体纵向摆动' },
  { key: 'bodySwayZ', label: '身体侧向摆动' },
  { key: 'breath', label: '呼吸' },
  { key: 'mouthOpen', label: '嘴部开合' },
];

function ProfileSliderField({
  displayValue,
  label,
  max,
  min,
  onCommit,
  onPreview,
  step,
  value,
}: {
  displayValue: string;
  label: string;
  max: number;
  min: number;
  onCommit: (value: number) => void;
  onPreview: (value: number) => void;
  step: number;
  value: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-2xs font-bold text-muted-foreground">{label}</Label>
        <span className="font-mono text-2xs text-primary">{displayValue}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(nextValue) => onPreview(nextValue[0] ?? value)}
        onValueCommit={(nextValue) => onCommit(nextValue[0] ?? value)}
      />
    </div>
  );
}

export function SettingsLive2DRuntimeProfileSection({
  onCommitProfile,
  preset,
}: {
  onCommitProfile: (modelId: string, profile: Live2DRuntimeProfileConfigV1 | null) => void;
  preset: PetModelPreset;
}) {
  const persistedProfileSignature = useMemo(
    () => JSON.stringify(preset.live2dRuntimeProfile ?? null),
    [preset.live2dRuntimeProfile],
  );
  const [draftProfile, setDraftProfile] = useState<Live2DRuntimeProfileConfigV1 | null>(
    preset.live2dRuntimeProfile ?? null,
  );
  const [declaredParameterIds, setDeclaredParameterIds] = useState<string[] | null>(null);
  const [parameterMetadataLoading, setParameterMetadataLoading] = useState(false);
  const lastCommittedSignatureRef = useRef(persistedProfileSignature);

  useEffect(() => {
    setDraftProfile(preset.live2dRuntimeProfile ?? null);
    lastCommittedSignatureRef.current = persistedProfileSignature;
  }, [persistedProfileSignature, preset.id, preset.live2dRuntimeProfile]);

  useEffect(() => {
    let cancelled = false;
    setDeclaredParameterIds(null);
    setParameterMetadataLoading(true);
    void loadLive2DDeclaredParameterIdsFromModelUrl(preset.url).then((parameterIds) => {
      if (cancelled) {
        return;
      }
      setDeclaredParameterIds(parameterIds ? [...parameterIds].sort((left, right) => left.localeCompare(right)) : []);
      setParameterMetadataLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [preset.url]);

  const editorState = resolveLive2DRuntimeProfileEditorState(draftProfile);
  const commitProfile = (profile: Live2DRuntimeProfileConfigV1) => {
    setDraftProfile(profile);
    const nextSignature = JSON.stringify(profile);
    if (lastCommittedSignatureRef.current === nextSignature) {
      return;
    }
    lastCommittedSignatureRef.current = nextSignature;
    onCommitProfile(preset.id, profile);
  };
  const previewLayout = (updates: Parameters<typeof updateLive2DRuntimeProfileLayout>[1]) => {
    setDraftProfile((currentProfile) => updateLive2DRuntimeProfileLayout(currentProfile, updates));
  };
  const commitLayout = (updates: Parameters<typeof updateLive2DRuntimeProfileLayout>[1]) => {
    commitProfile(updateLive2DRuntimeProfileLayout(draftProfile, updates));
  };
  const previewParameter = (
    parameter: Live2DParameterSemantic,
    updates: Partial<Live2DRuntimeProfileParameterConfig>,
  ) => {
    setDraftProfile((currentProfile) => (
      updateLive2DRuntimeProfileParameter(currentProfile, parameter, updates)
    ));
  };
  const commitParameter = (
    parameter: Live2DParameterSemantic,
    updates: Partial<Live2DRuntimeProfileParameterConfig>,
  ) => {
    commitProfile(updateLive2DRuntimeProfileParameter(draftProfile, parameter, updates));
  };
  const commitCapability = (
    capability: Live2DRuntimeProfileCapability,
    mode: Live2DRuntimeProfileCapabilityMode,
  ) => {
    commitProfile(updateLive2DRuntimeProfileCapability(draftProfile, capability, mode));
  };
  const declaredParameterIdSet = useMemo(
    () => new Set(declaredParameterIds ?? []),
    [declaredParameterIds],
  );
  const parameterDataListId = `live2d-parameter-ids-${preset.id.replace(/[^a-z0-9_-]/giu, '-')}`;

  return (
    <section className="space-y-4 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
            Live2D 模型适配
          </div>
          <div className="mt-1 truncate text-xs text-foreground">{preset.name}</div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-8 shrink-0 rounded-sm border-border px-3 text-2xs"
          onClick={() => {
            setDraftProfile(null);
            lastCommittedSignatureRef.current = 'null';
            onCommitProfile(preset.id, null);
          }}
          disabled={!preset.live2dRuntimeProfile}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          恢复自动
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-2xs font-bold text-muted-foreground">构图适配</Label>
        <div className="grid grid-cols-3 gap-1 rounded-sm border border-border bg-secondary/30 p-1">
          {FIT_MODE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant="ghost"
              className={`h-8 rounded-sm px-2 text-2xs ${
                editorState.fitMode === option.value
                  ? 'bg-primary/15 text-primary hover:bg-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => commitLayout({ fitMode: option.value })}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ProfileSliderField
          label="模型缩放"
          value={editorState.scale}
          displayValue={`${Math.round(editorState.scale * 100)}%`}
          min={0.1}
          max={4}
          step={0.05}
          onPreview={(value) => previewLayout({ scale: value })}
          onCommit={(value) => commitLayout({ scale: value })}
        />
        <ProfileSliderField
          label="水平位置"
          value={editorState.offsetX}
          displayValue={`${Math.round(editorState.offsetX * 100)}%`}
          min={-2}
          max={2}
          step={0.01}
          onPreview={(value) => previewLayout({ offsetX: value })}
          onCommit={(value) => commitLayout({ offsetX: value })}
        />
        <ProfileSliderField
          label="垂直位置"
          value={editorState.offsetY}
          displayValue={`${Math.round(editorState.offsetY * 100)}%`}
          min={-2}
          max={2}
          step={0.01}
          onPreview={(value) => previewLayout({ offsetY: value })}
          onCommit={(value) => commitLayout({ offsetY: value })}
        />
        {editorState.fitMode === 'canvas' ? (
          <>
            <ProfileSliderField
              label="画布水平锚点"
              value={editorState.canvasAnchorX}
              displayValue={`${Math.round(editorState.canvasAnchorX * 100)}%`}
              min={0}
              max={1}
              step={0.01}
              onPreview={(value) => previewLayout({ canvasAnchorX: value })}
              onCommit={(value) => commitLayout({ canvasAnchorX: value })}
            />
            <ProfileSliderField
              label="画布垂直锚点"
              value={editorState.canvasAnchorY}
              displayValue={`${Math.round(editorState.canvasAnchorY * 100)}%`}
              min={0}
              max={1}
              step={0.01}
              onPreview={(value) => previewLayout({ canvasAnchorY: value })}
              onCommit={(value) => commitLayout({ canvasAnchorY: value })}
            />
          </>
        ) : (
          <>
            <ProfileSliderField
              label="可见区域水平锚点"
              value={editorState.visibleBoundsAnchorX}
              displayValue={`${Math.round(editorState.visibleBoundsAnchorX * 100)}%`}
              min={0}
              max={1}
              step={0.01}
              onPreview={(value) => previewLayout({ visibleBoundsAnchorX: value })}
              onCommit={(value) => commitLayout({ visibleBoundsAnchorX: value })}
            />
            <ProfileSliderField
              label="可见区域垂直锚点"
              value={editorState.visibleBoundsAnchorY}
              displayValue={`${Math.round(editorState.visibleBoundsAnchorY * 100)}%`}
              min={0}
              max={1}
              step={0.01}
              onPreview={(value) => previewLayout({ visibleBoundsAnchorY: value })}
              onCommit={(value) => commitLayout({ visibleBoundsAnchorY: value })}
            />
          </>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-2xs font-bold text-muted-foreground">参数映射</Label>
          <span className="text-2xs text-muted-foreground">
            {parameterMetadataLoading
              ? '读取模型参数...'
              : declaredParameterIds?.length
                ? `${declaredParameterIds.length} 个公开参数`
                : '未提供公开参数清单'}
          </span>
        </div>
        <datalist id={parameterDataListId}>
          {(declaredParameterIds ?? []).map((parameterId) => (
            <option key={parameterId} value={parameterId} />
          ))}
        </datalist>
        <div className="divide-y divide-border border-y border-border">
          {PARAMETER_OPTIONS.map((option) => {
            const parameter = editorState.parameters[option.key];
            const automaticParameterId = resolveLive2DDefaultParameterId(option.key, declaredParameterIdSet);
            return (
              <div key={option.key} className="grid gap-3 py-3 md:grid-cols-[112px_minmax(180px,1fr)_150px] md:items-center">
                <div>
                  <div className="text-2xs font-medium text-foreground">{option.label}</div>
                  <div className="mt-0.5 font-mono text-3xs text-muted-foreground">{option.key}</div>
                </div>
                <div className="min-w-0">
                  <Input
                    value={parameter.id}
                    list={parameterDataListId}
                    placeholder={automaticParameterId ?? '自动检测'}
                    className="h-8 rounded-sm border-border bg-secondary/40 font-mono text-2xs"
                    onChange={(event) => previewParameter(option.key, { id: event.target.value })}
                    onBlur={(event) => commitParameter(option.key, { id: event.target.value.trim() || undefined })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.currentTarget.blur();
                      }
                    }}
                  />
                  <div className="mt-1 truncate font-mono text-3xs text-muted-foreground">
                    {parameter.id
                      ? `覆盖：${parameter.id}`
                      : automaticParameterId
                        ? `自动：${automaticParameterId}`
                        : declaredParameterIds?.length
                          ? '自动：当前公开参数中不支持'
                          : '自动：运行时检测'}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <SettingsToggleSwitch
                      checked={parameter.enabled}
                      className="text-3xs text-muted-foreground"
                      label="启用"
                      onChange={(checked) => commitParameter(option.key, { enabled: checked })}
                    />
                    <SettingsToggleSwitch
                      checked={parameter.invert}
                      className="text-3xs text-muted-foreground"
                      label="反向"
                      onChange={(checked) => commitParameter(option.key, { invert: checked })}
                    />
                    <span className="font-mono text-3xs text-primary">
                      {Math.round(parameter.sensitivity * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[parameter.sensitivity]}
                    min={0}
                    max={4}
                    step={0.05}
                    onValueChange={(nextValue) => previewParameter(option.key, {
                      sensitivity: nextValue[0] ?? parameter.sensitivity,
                    })}
                    onValueCommit={(nextValue) => commitParameter(option.key, {
                      sensitivity: nextValue[0] ?? parameter.sensitivity,
                    })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {CAPABILITY_OPTIONS.map((option) => (
          <label key={option.key} className="flex items-center justify-between gap-3">
            <span className="text-2xs font-medium text-muted-foreground">{option.label}</span>
            <select
              className="h-8 w-24 rounded-sm border border-border bg-secondary px-2 text-2xs outline-none focus:border-primary"
              value={editorState.capabilities[option.key]}
              onChange={(event) => commitCapability(
                option.key,
                event.target.value as Live2DRuntimeProfileCapabilityMode,
              )}
            >
              <option value="auto">自动</option>
              <option value="enabled">开启</option>
              <option value="disabled">关闭</option>
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}
