import { Label } from '../../../components/ui/label';
import type { PetConfig } from '../../types';
import {
  GROUP_CHAT_MAX_DELAY_MS,
  GROUP_CHAT_MIN_DELAY_MS,
  normalizeGroupChatSpeedDelay,
} from '../chat/group/groupChatSpeed';

interface SettingsGroupChatSpeedProps {
  config: PetConfig;
  noDragRegionStyle?: React.CSSProperties;
  onApplyConfig: (config: PetConfig) => void;
}

export function SettingsGroupChatSpeed({
  config,
  noDragRegionStyle,
  onApplyConfig,
}: SettingsGroupChatSpeedProps) {
  const delayMs = normalizeGroupChatSpeedDelay(config.settings.groupChatTurnDelayMs);
  const updateDelay = (value: string) => onApplyConfig({
    ...config,
    settings: {
      ...config.settings,
      groupChatTurnDelayMs: normalizeGroupChatSpeedDelay(Number(value)),
    },
  });

  return (
    <section className="rounded-sm border border-border bg-secondary/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
            无限群聊生成速度
          </Label>
          <div className="mt-1 text-2xs leading-4 text-muted-foreground">
            控制角色之间的接话间隔，不改变角色选择和回复内容。
          </div>
        </div>
        <output className="shrink-0 font-mono text-xs text-primary">
          {delayMs / 1000} 秒
        </output>
      </div>
      <input
        aria-label="无限群聊生成速度"
        className="mt-4 w-full accent-primary"
        max={GROUP_CHAT_MAX_DELAY_MS}
        min={GROUP_CHAT_MIN_DELAY_MS}
        onChange={(event) => updateDelay(event.target.value)}
        step={1000}
        style={noDragRegionStyle}
        type="range"
        value={delayMs}
      />
      <div className="mt-2 flex justify-between text-2xs text-muted-foreground">
        <span>极速 · 5 秒</span>
        <span>慢速 · 30 秒</span>
      </div>
      <div className="mt-2 text-center font-mono text-2xs text-primary/80">
        可自由调整，当前接话间隔约 {delayMs / 1000} 秒
      </div>
    </section>
  );
}
