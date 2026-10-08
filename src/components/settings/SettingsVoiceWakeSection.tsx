import { type CSSProperties } from 'react';
import { type PetConfig } from '../../types';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';

type SettingsUpdater = (updates: Partial<PetConfig['settings']>) => void;

// Background wake listening. Each character answers to its own phrases (set per character);
// the general phrases here wake whichever character is selected.
export function SettingsVoiceWakeSection({ settings, noDragRegionStyle, applySettings }: {
  settings: PetConfig['settings'];
  noDragRegionStyle?: CSSProperties;
  applySettings: SettingsUpdater;
}) {
  if (!settings.voiceInputEnabled) return null;
  return (
    <div className="space-y-4 rounded-sm border border-border bg-secondary/20 p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <span className="flex-1 space-y-1">
          <span className="block text-2xs font-bold uppercase tracking-widest text-primary">
            语音唤醒{settings.voiceWakeEnabled ? ' · 待唤醒' : ''}
          </span>
          <span className="block text-2xs leading-5 text-muted-foreground">
            开启后麦克风在后台持续收音，听到唤醒词就开始实时语音对话，不用打开聊天窗口；对话结束后回到待唤醒。识别只在本机进行（自动使用 SenseVoice-Small），不上传。
          </span>
        </span>
        <SettingsToggleSwitch
          checked={settings.voiceWakeEnabled}
          hideLabel
          label="语音唤醒"
          onChange={(checked) => applySettings({ voiceWakeEnabled: checked })}
        />
      </label>
      <div className="space-y-2">
        <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">通用唤醒词（唤醒当前选中的角色）</Label>
        <Input
          className="h-8 text-xs"
          style={noDragRegionStyle}
          value={settings.voiceWakeWords}
          onChange={(event) => applySettings({ voiceWakeWords: event.target.value })}
          placeholder="可留空，多个用逗号分隔，例如：你好，在吗"
        />
      </div>
      <div className="space-y-1 text-2xs leading-5 text-muted-foreground">
        <div>每个角色还会响应自己的唤醒词：在下面的「角色语音」里给每个角色单独设置，不设置就用角色名。叫谁的唤醒词就唤醒谁，并切换到和她私聊。</div>
        <div>唤醒词后面接着说的话会直接发给角色，比如「高冷，现在几点了」。唤醒词按读音比对，同音字也能唤醒；建议用 3–4 个字、彼此差别大的词。</div>
      </div>
    </div>
  );
}
