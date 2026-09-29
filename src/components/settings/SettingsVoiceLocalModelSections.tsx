import { type CSSProperties } from 'react';
import { type LocalVoiceAssets, type LocalVoiceHealth, type PetConfig } from '../../types';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Slider } from '../../../components/ui/slider';
import {
  getLocalTtsVoiceToneStabilityLabel,
  inputClassName,
  selectClassName,
} from './settingsVoiceUtils';

type SettingsUpdater = (updates: Partial<PetConfig['settings']>) => void;

export function SettingsLocalTtsSection({
  settings,
  noDragRegionStyle,
  localVoiceAssets,
  localVoiceHealth,
  hasLocalTtsModels,
  hasLocalReferences,
  localTtsRandomSeed,
  localTtsVoiceToneStability,
  applySettings,
  applyLocalTtsRandomSeed,
  applyLocalTtsVoiceToneStability,
  buildRandomSeed,
}: {
  settings: PetConfig['settings'];
  noDragRegionStyle?: CSSProperties;
  localVoiceAssets: LocalVoiceAssets;
  localVoiceHealth: LocalVoiceHealth;
  hasLocalTtsModels: boolean;
  hasLocalReferences: boolean;
  localTtsRandomSeed: string;
  localTtsVoiceToneStability: number;
  applySettings: SettingsUpdater;
  applyLocalTtsRandomSeed: (value: string) => void;
  applyLocalTtsVoiceToneStability: (value: number | number[]) => void;
  buildRandomSeed: () => string;
}) {
  if (settings.ttsProvider !== 'local') {
    return null;
  }

  return (
    <div className="space-y-3 rounded-sm border border-border bg-secondary/20 p-4">
      <div className="text-2xs font-bold uppercase tracking-widest text-primary">本地播报配置</div>

      <div className="rounded-sm border border-border bg-background/30 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">音色随机种子</div>
            <div className="text-2xs text-muted-foreground">
              给 Qwen3-TTS 长文本分段固定一个数字种子，尽量减少同一条回复里出现多种不同声音。
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-2xs text-primary">{localTtsRandomSeed || 'AUTO'}</div>
            <div className="text-3xs text-muted-foreground">{localTtsRandomSeed ? '固定种子' : '自动种子'}</div>
          </div>
        </div>
        <div className="flex gap-2" style={noDragRegionStyle}>
          <Input
            className={inputClassName()}
            value={localTtsRandomSeed}
            onChange={(event) => applyLocalTtsRandomSeed(event.target.value)}
            placeholder="输入数字，例如 20260429"
            inputMode="numeric"
          />
          <Button
            type="button"
            onClick={() => applyLocalTtsRandomSeed(buildRandomSeed())}
            className="h-9 rounded-sm border border-primary/40 bg-primary/10 px-3 text-2xs text-primary hover:bg-primary/20"
          >
            随机一个
          </Button>
          <Button
            type="button"
            onClick={() => applyLocalTtsRandomSeed('')}
            className="h-9 rounded-sm border border-border px-3 text-2xs text-muted-foreground hover:bg-secondary"
          >
            自动
          </Button>
        </div>
        <div className="mt-2 text-2xs text-muted-foreground">
          如果同一角色的一条长回复里仍然会出现多种语气，先固定一个种子反复测试；如果这组种子还是飘，再换下一组。
        </div>
      </div>

      <div className="rounded-sm border border-border bg-background/30 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">稳定音色</div>
            <div className="text-2xs text-muted-foreground">
              提高后会尽量延后流式拆段，让同一条回复少分几段，减少一段话里突然换语气。
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-2xs text-primary">{localTtsVoiceToneStability}%</div>
            <div className="text-3xs text-muted-foreground">{getLocalTtsVoiceToneStabilityLabel(localTtsVoiceToneStability)}</div>
          </div>
        </div>
        <div className="space-y-2" style={noDragRegionStyle}>
          <Slider
            value={[localTtsVoiceToneStability]}
            min={0}
            max={100}
            step={5}
            markers={[0, 25, 50, 75, 100]}
            onValueChange={applyLocalTtsVoiceToneStability}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-3xs text-muted-foreground">
          <span>0 关闭</span>
          <span>100 最稳</span>
        </div>
        <div className="text-2xs text-muted-foreground">
          数值越高，越优先保持同一条回复的语气一致，但第一段开始播报可能会稍微晚一点。
        </div>
      </div>

      <select
        value={settings.localTtsModelId}
        onChange={(event) => applySettings({ localTtsModelId: event.target.value })}
        className={selectClassName()}
        style={noDragRegionStyle}
      >
        <option value="">{hasLocalTtsModels ? '选择本地播报模型' : '未检测到本地播报模型'}</option>
        {localVoiceAssets.ttsModels.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
          </option>
        ))}
      </select>

      <select
        value={settings.localVoiceReferenceId}
        onChange={(event) => applySettings({ localVoiceReferenceId: event.target.value })}
        className={selectClassName()}
        style={noDragRegionStyle}
      >
        <option value="">{hasLocalReferences ? '选择参考音频组' : '未检测到参考音频组'}</option>
        {localVoiceAssets.references.map((reference) => (
          <option key={reference.id} value={reference.id}>
            {reference.label} ({reference.sampleCount} 条)
          </option>
        ))}
      </select>

      <textarea
        className="min-h-[88px] w-full rounded-sm border border-border bg-secondary p-3 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
        style={noDragRegionStyle}
        value={settings.localVoiceReferenceText}
        onChange={(event) => applySettings({ localVoiceReferenceText: event.target.value })}
        placeholder="可选：填写参考音频对应的原文。若留空，系统会优先读取参考目录里的 .txt 文本，再尝试用本地识别模型自动转写。"
      />

      <div className="text-2xs text-muted-foreground">
        当前状态：播报 {localVoiceHealth.ttsReady ? '已就绪' : '未就绪'} / 参考文本 {localVoiceHealth.referenceReady ? '已就绪' : '未就绪'}
      </div>
    </div>
  );
}

export function SettingsLocalSttSection({
  settings,
  noDragRegionStyle,
  localVoiceAssets,
  localVoiceHealth,
  hasLocalSttModels,
  applySettings,
}: {
  settings: PetConfig['settings'];
  noDragRegionStyle?: CSSProperties;
  localVoiceAssets: LocalVoiceAssets;
  localVoiceHealth: LocalVoiceHealth;
  hasLocalSttModels: boolean;
  applySettings: SettingsUpdater;
}) {
  if (settings.sttProvider !== 'local') {
    return null;
  }

  return (
    <div className="space-y-3 rounded-sm border border-border bg-secondary/20 p-4">
      <div className="text-2xs font-bold uppercase tracking-widest text-primary">本地识别配置</div>
      <select
        value={settings.localSttModelId}
        onChange={(event) => applySettings({ localSttModelId: event.target.value })}
        className={selectClassName()}
        style={noDragRegionStyle}
      >
        <option value="">{hasLocalSttModels ? '选择本地识别模型' : '未检测到本地识别模型'}</option>
        {localVoiceAssets.sttModels.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
          </option>
        ))}
      </select>

      <div className="text-2xs text-muted-foreground">
        当前状态：识别 {localVoiceHealth.sttReady ? '已就绪' : '未就绪'}。本地识别会在点击语音输入后开始录音，再次点击后结束并转写。
      </div>
    </div>
  );
}
