import { type CSSProperties } from 'react';
import { Input } from '../../../components/ui/input';
import { type PetLifeCompanionSettings } from '../../life-companion/lifeCompanionSettings';
import { type PetStats } from '../../types';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';

// The smaller life-companion switches: quiet hours, the startup greeting, and the pet's
// affection / hunger stats.

interface SettingsLifeCompanionPanelProps {
  noDragRegionStyle?: CSSProperties;
  onUpdateSettings: (settings: PetLifeCompanionSettings) => void;
  settings: PetLifeCompanionSettings;
  stats: PetStats;
}

function Row(props: { checked: boolean; label: string; hint: string; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="space-y-0.5">
        <span className="block text-xs font-semibold text-foreground">{props.label}</span>
        <span className="block text-2xs leading-5 text-muted-foreground">{props.hint}</span>
      </span>
      <SettingsToggleSwitch checked={props.checked} hideLabel label={props.label} onChange={props.onChange} />
    </div>
  );
}

export function SettingsLifeCompanionPanel({
  noDragRegionStyle,
  onUpdateSettings,
  settings,
  stats,
}: SettingsLifeCompanionPanelProps) {
  const update = (updates: Partial<PetLifeCompanionSettings>) => onUpdateSettings({ ...settings, ...updates });
  const timeInput = (key: 'quietHoursStart' | 'quietHoursEnd', label: string) => (
    <label className="flex items-center gap-2 text-2xs text-muted-foreground">
      {label}
      <Input
        value={settings[key]}
        onChange={(event) => update({ [key]: event.target.value })}
        placeholder="23:00"
        style={noDragRegionStyle}
        className="h-8 w-20 rounded-sm border-border bg-secondary text-xs focus-visible:ring-primary"
      />
    </label>
  );

  return (
    <div className="space-y-3 rounded-sm border border-border bg-background/30 p-3">
      <Row
        checked={settings.quietHoursEnabled}
        label="安静时段"
        hint="这段时间里角色不会主动开口（主动聊天、桌面活动感知、看屏幕都算）。"
        onChange={(checked) => update({ quietHoursEnabled: checked })}
      />
      {settings.quietHoursEnabled ? (
        <div className="flex flex-wrap gap-4">
          {timeInput('quietHoursStart', '从')}
          {timeInput('quietHoursEnd', '到')}
        </div>
      ) : null}
      <Row
        checked={settings.startupGreetingEnabled}
        label="开机打招呼"
        hint="启动时角色用自己的语气说一句。"
        onChange={(checked) => update({ startupGreetingEnabled: checked })}
      />
      <Row
        checked={settings.hungerEnabled}
        label="会饿"
        hint="角色会慢慢变饿，可以拖食物或在聊天里喂她。"
        onChange={(checked) => update({ hungerEnabled: checked })}
      />
      <Row
        checked={settings.affectionEnabled}
        label="好感度"
        hint="照顾她、陪她聊天会让好感度变化（打开“对你的感情只增不减”时一直是最高）。"
        onChange={(checked) => update({ affectionEnabled: checked })}
      />
      <div className="text-2xs text-muted-foreground">
        现在：好感 {Math.round(stats.affection)} · 饥饿 {Math.round(stats.hunger)} · 疲劳 {Math.round(stats.fatigue)}
      </div>
    </div>
  );
}
