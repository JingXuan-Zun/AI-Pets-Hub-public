import { useEffect, useRef, useState } from 'react';
import { type FoodAppearance, type PetConfig, type PetModelPreset } from '../../types';
import { Button } from '../../../components/ui/button';
import { SettingsVideoLibraryPanel } from './SettingsVideoLibraryPanel';

interface Props {
  appearances: FoodAppearance[];
  canUploadMoreAppearances: boolean;
  config: PetConfig;
  isUploadingAppearances: boolean;
  onApplyConfig: (config: PetConfig) => void;
  onTriggerAppearanceUpload: () => void;
  onUpdateInteractionType: (appearanceId: string, interactionType: 'eat' | 'toy' | 'custom') => void;
  preset: PetModelPreset;
}

export function SettingsVideoItemBindingsSection({
  appearances,
  canUploadMoreAppearances,
  config,
  isUploadingAppearances,
  onApplyConfig,
  onTriggerAppearanceUpload,
  onUpdateInteractionType,
  preset,
}: Props) {
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const requestIdRef = useRef(0);
  const configRef = useRef(config);
  configRef.current = config;
  useEffect(() => () => { requestIdRef.current += 1; }, [preset.id]);

  const updateBinding = (appearanceId: string, folderPath: string | null) => {
    const currentConfig = configRef.current;
    if (!currentConfig.customModelPresets.some((item) => item.id === preset.id)) return;
    onApplyConfig({
      ...currentConfig,
      customModelPresets: currentConfig.customModelPresets.map((item) => (
        item.id === preset.id
          ? {
              ...item,
              videoItemBindings: [
                ...(item.videoItemBindings ?? []).filter((binding) => binding.appearanceId !== appearanceId),
                ...(folderPath ? [{ appearanceId, folderPath }] : []),
              ],
            }
          : item
      )),
    });
  };

  const updateInteractionLabel = (appearanceId: string, interactionLabel: string) => {
    const currentConfig = configRef.current;
    onApplyConfig({
      ...currentConfig,
      foodAppearances: currentConfig.foodAppearances.map((appearance) => (
        appearance.id === appearanceId ? { ...appearance, interactionLabel } : appearance
      )),
    });
  };

  const handleSelectFolder = async (appearance: FoodAppearance) => {
    if (!window.desktopPetShell?.choose2DVideoFolder) {
      setFeedback('请在桌面版选择本地视频文件夹。');
      return;
    }
    setSelectingId(appearance.id);
    setFeedback('');
    const requestId = ++requestIdRef.current;
    try {
      const result = await window.desktopPetShell.choose2DVideoFolder();
      if (requestId !== requestIdRef.current || result.cancelled) return;
      if (!result.ok || !result.folderPath) throw new Error(result.error || '视频文件夹选择失败');
      updateBinding(appearance.id, result.folderPath);
      setFeedback(`已绑定「${appearance.name}」的视频文件夹，当前有 ${result.videoCount ?? 0} 个视频`);
    } catch (error) {
      if (requestId === requestIdRef.current) {
        setFeedback(error instanceof Error ? error.message : '视频文件夹选择失败');
      }
    } finally {
      if (requestId === requestIdRef.current) setSelectingId(null);
    }
  };

  return (
    <section className="rounded-sm border border-border bg-secondary/20 p-3">
      <h3 className="text-sm font-semibold text-foreground">2D 视频道具交互</h3>
      <p className="mt-1 text-2xs text-muted-foreground">
        上传道具图片，并为道具绑定视频文件夹；每次交给当前主视频桌宠时，随机播放文件夹中的一个视频，播完恢复待机。
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="h-8 border-primary/60 text-primary"
          onClick={onTriggerAppearanceUpload}
          disabled={!canUploadMoreAppearances || isUploadingAppearances}>
          {isUploadingAppearances ? '上传中' : '上传自定义道具'}
        </Button>
        <span className="text-2xs text-muted-foreground">
          自定义道具 {appearances.filter((appearance) => !appearance.builtIn).length} 个
          {!canUploadMoreAppearances ? '，道具库已满' : ''}
        </span>
      </div>
      <SettingsVideoLibraryPanel config={config} onApplyConfig={onApplyConfig} preset={preset} />
      <div className="mt-3 space-y-2">
        {appearances.map((appearance) => {
          const binding = preset.videoItemBindings?.find((item) => item.appearanceId === appearance.id);
          const bindingPath = binding?.folderPath ?? '';
          return (
            <div key={appearance.id} className="rounded-sm border border-border/70 bg-background/20 p-2">
              <div className="flex items-center gap-2 text-2xs">
              <span className="min-w-0 flex-1 truncate text-foreground">
                {appearance.name}{appearance.builtIn ? '（预设）' : '（自定义）'}
              </span>
              <select
                aria-label={`${appearance.name}交互类型`}
                value={appearance.interactionType ?? 'eat'}
                onChange={(event) => onUpdateInteractionType(appearance.id, event.target.value as 'eat' | 'toy' | 'custom')}
                className="h-7 rounded border border-primary/40 bg-background px-1 text-primary"
              >
                <option value="eat">吃掉</option>
                <option value="toy">玩具</option>
                <option value="custom">自定义动作</option>
              </select>
              <span className={binding ? 'text-primary' : 'text-muted-foreground'}>
                {binding ? '已绑定' : '未绑定'}
              </span>
              <button type="button" className="rounded border border-border px-2 py-1 text-primary hover:bg-primary/10"
                disabled={selectingId !== null}
                onClick={() => { void handleSelectFolder(appearance); }}>
                {selectingId === appearance.id ? '选择中' : binding ? '更换视频文件夹' : '选择视频文件夹'}
              </button>
              {binding ? (
                <button type="button" className="rounded border border-border px-2 py-1 text-destructive"
                  onClick={() => updateBinding(appearance.id, null)}>移除</button>
              ) : null}
            </div>
              {appearance.interactionType === 'custom' ? (
                <label className="mt-2 flex items-center gap-2 text-2xs text-muted-foreground">
                  动作名称
                  <input
                    type="text"
                    aria-label={`${appearance.name}动作名称`}
                    maxLength={30}
                    value={appearance.interactionLabel ?? ''}
                    placeholder="例如：抚摸"
                    onChange={(event) => updateInteractionLabel(appearance.id, event.target.value)}
                    className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-foreground"
                  />
                </label>
              ) : null}
              {bindingPath ? (
                <code className="mt-1 block break-all select-text font-mono text-3xs leading-relaxed text-muted-foreground">
                  已绑定文件夹：{bindingPath}
                </code>
              ) : null}
            </div>
          );
        })}
      </div>
      {feedback ? <p role="status" className="mt-2 text-2xs text-muted-foreground">{feedback}</p> : null}
    </section>
  );
}
