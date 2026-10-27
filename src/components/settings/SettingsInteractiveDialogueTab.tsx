import { useEffect, type CSSProperties } from 'react';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Slider } from '../../../components/ui/slider';
import type { PetConfig } from '../../types';
import {
  INTERACTIVE_DIALOGUE_LIMITS,
  normalizeInteractiveDialogueSettings,
  resolveInteractiveDialogueLayout,
  type InteractiveDialogueLayout,
  type InteractiveDialogueLayoutKey,
} from '../../interactiveDialogueSettings';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';
import { publishInteractiveDialoguePreview } from '../chat/interactive/interactiveDialoguePreview';

interface SettingsInteractiveDialogueTabProps {
  config: PetConfig;
  noDragRegionStyle?: CSSProperties;
  onApplyConfig: (config: PetConfig) => void;
  /** 正在调整的角色：左侧宠物槽位里选中的那个。 */
  petId: string;
  petName: string;
}

const ROWS: Array<{
  key: InteractiveDialogueLayoutKey;
  label: string;
  hint: string;
  format: (value: number) => string;
  minLabel: string;
  maxLabel: string;
}> = [
  {
    key: 'modelScale',
    label: '角色大小',
    hint: '角色整身高度是窗口高度的多少倍。越大越像半身特写，腰以下会落在对话面板后面。',
    format: (value) => `${value.toFixed(1)} 倍`,
    minLabel: '0.8 倍（全身）',
    maxLabel: '4 倍（脸部特写）',
  },
  {
    key: 'modelOffsetYPercent',
    label: '上下位置',
    hint: '角色越大头会越往下沉，往上移一点就能让脸露出来。',
    format: (value) => (value === 0 ? '不移动' : value < 0 ? `上移 ${-value}%` : `下移 ${value}%`),
    minLabel: '上移 100%',
    maxLabel: '下移 50%',
  },
  {
    key: 'modelOffsetXPercent',
    label: '左右位置',
    hint: '想让角色站在一侧、留出背景时用。',
    format: (value) => (value === 0 ? '居中' : value < 0 ? `左移 ${-value}%` : `右移 ${value}%`),
    minLabel: '左移 45%',
    maxLabel: '右移 45%',
  },
  {
    key: 'panelHeightPercent',
    label: '对话面板高度',
    hint: '面板越低，角色露出的部分越多；太低时一次只能看到一两句。',
    format: (value) => `窗口高度的 ${value}%`,
    minLabel: '20%',
    maxLabel: '60%',
  },
  {
    key: 'panelMaxWidth',
    label: '对话面板宽度',
    hint: '面板最宽多少像素；窗口比这个窄时面板跟着窗口变窄。',
    format: (value) => `最宽 ${value} 像素`,
    minLabel: '600',
    maxLabel: '2000',
  },
];

export function SettingsInteractiveDialogueTab({ config, noDragRegionStyle, onApplyConfig, petId, petName }: SettingsInteractiveDialogueTabProps) {
  const settings = normalizeInteractiveDialogueSettings(config.settings.interactiveDialogue);
  const layout = resolveInteractiveDialogueLayout(settings, petId);
  const hasOwnLayout = Boolean(settings.layoutsByPetId[petId]);
  const applySettings = (next: typeof settings) => onApplyConfig({
    ...config,
    settings: { ...config.settings, interactiveDialogue: normalizeInteractiveDialogueSettings(next) },
  });
  const applyLayout = (next: InteractiveDialogueLayout) => {
    // 互动对话窗口正在和这个角色通话的话马上跟着变；保存前只是预览。
    publishInteractiveDialoguePreview({ layout: next, petId });
    applySettings({ ...settings, layoutsByPetId: { ...settings.layoutsByPetId, [petId]: next } });
  };
  const resetLayout = () => {
    const { [petId]: _removed, ...rest } = settings.layoutsByPetId;
    void _removed;
    publishInteractiveDialoguePreview(null);
    applySettings({ ...settings, layoutsByPetId: rest });
  };
  // 换了角色、离开这个页面或关掉设置窗：预览结束，画面回到已保存的值（保存过的话就是新值）。
  useEffect(() => () => publishInteractiveDialoguePreview(null), [petId]);

  return (
    <section className="space-y-4 rounded-sm border border-border bg-secondary/20 p-4">
      <div>
        <div className="text-2xs font-bold uppercase tracking-widest text-primary">互动对话</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          调整互动对话（视频通话）画面里角色的大小和位置，以及下方对话面板的大小。右键桌宠 → 对话 → 互动对话 打开。
        </p>
      </div>
      <label
        style={noDragRegionStyle}
        className="flex cursor-pointer items-start gap-3 rounded-sm border border-border bg-background/30 p-3"
      >
        <span className="flex-1 space-y-1">
          <span className="block text-xs font-semibold text-foreground">互动对话时隐藏桌面上的所有角色</span>
          <span className="block text-2xs leading-5 text-muted-foreground">
            开着：通话期间桌面上一个角色都不显示，只看通话窗口里的她，挂断后全部回来。
            关掉：只隐藏正在通话的那个角色，其他角色照常留在桌面。
            设置里每个角色的“模型显示”只管桌面（普通对话）；通话窗口里不管这个开关，谁在通话就显示谁。
          </span>
        </span>
        <SettingsToggleSwitch
          checked={settings.hideDesktopPets}
          hideLabel
          label="互动对话时隐藏桌面上的所有角色"
          onChange={(checked) => applySettings({ ...settings, hideDesktopPets: checked })}
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-primary/30 bg-primary/5 px-3 py-2.5">
        <div className="text-xs leading-5 text-foreground">
          正在调整：<span className="font-semibold text-primary">{petName || '当前角色'}</span>
          <span className="ml-2 text-2xs text-muted-foreground">
            {hasOwnLayout ? '这个角色有自己的设置' : '还没调过，用的是默认值'}；每个角色分开保存，换角色在左侧宠物槽位里选。
          </span>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={!hasOwnLayout} onClick={resetLayout}>
          恢复默认
        </Button>
      </div>
      {ROWS.map(({ key, label, hint, format, minLabel, maxLabel }) => {
        const limits = INTERACTIVE_DIALOGUE_LIMITS[key];
        return (
          <div key={key} className="space-y-3 rounded-sm border border-border bg-background/30 p-3">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">{label}</Label>
              <span className="font-mono text-2xs text-primary">{format(layout[key])}</span>
            </div>
            <p className="text-2xs leading-5 text-muted-foreground">{hint}</p>
            <Slider
              aria-label={label}
              min={limits.min}
              max={limits.max}
              step={limits.step}
              value={[layout[key]]}
              onValueChange={(value) => {
                if (value[0] !== undefined) applyLayout({ ...layout, [key]: value[0] });
              }}
              style={noDragRegionStyle}
            />
            <div className="flex justify-between text-2xs text-muted-foreground">
              <span>{minLabel}</span>
              <span>{maxLabel}</span>
            </div>
          </div>
        );
      })}
      <div className="rounded-sm border border-sky-200 bg-sky-50 px-3 py-2 text-2xs leading-5 text-sky-800">
        角色大小按 3D 模型的整身高度计算；2D 和 Live2D 用同一个画框缩放，图片本身留白多的话会显得小一些，可以再调大一点。
        正在和这个角色互动对话时，拖动滑块画面会马上跟着变，点保存后才会记住；不保存就关掉设置，画面会回到原来的样子。
      </div>
    </section>
  );
}
