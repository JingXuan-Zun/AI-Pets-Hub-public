import type { CSSProperties } from 'react';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';

/** Per-role switch for the neural memory loop in private chat. */
export function NeuralMemoryChatToggle(props: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  roleName: string;
}) {
  return (
    <label
      data-neural-memory-chat-toggle
      style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
      className="flex cursor-pointer items-start gap-3 rounded-sm border border-primary/30 bg-primary/5 p-4"
    >
      <span className="flex-1 space-y-1">
        <span className="block text-xs font-semibold text-foreground">在私聊中启用神经记忆（{props.roleName || '当前角色'}）</span>
        <span className="block text-2xs leading-4 text-muted-foreground">
          开启后，{props.roleName || '角色'}会在聊天中提议想记住的内容，显示在聊天窗口左侧角色列表下方，由你决定记不记。
          确认生效的记忆会在相关话题中被想起，影响角色的理解和回应。提议判断会额外调用一次当前模型。
        </span>
      </span>
      <SettingsToggleSwitch checked={props.enabled} hideLabel label="在私聊中启用神经记忆" onChange={props.onChange} />
    </label>
  );
}
