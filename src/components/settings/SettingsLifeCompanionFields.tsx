import { type CSSProperties } from 'react';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { type PetLifeCompanionSettings } from '../../life-companion/lifeCompanionSettings';
import { toggleButtonClass } from './settingsVoiceUtils';

type UpdateLifeCompanionSettings = (updates: Partial<PetLifeCompanionSettings>) => void;

interface LifeCompanionFieldsProps {
  noDragRegionStyle?: CSSProperties;
  onUpdate: UpdateLifeCompanionSettings;
  settings: PetLifeCompanionSettings;
}

function numberInputValue(value: number) {
  return Number.isFinite(value) ? String(value) : '';
}

function parseMinutesInput(value: string, fallback: number, min = 5) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.round(parsed)) : fallback;
}

function LifeCompanionNumberField({
  label,
  min,
  noDragRegionStyle,
  onChange,
  value,
}: {
  label: string;
  min: number;
  noDragRegionStyle?: CSSProperties;
  onChange: (value: string) => void;
  value: number;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      <Input
        type="number"
        min={min}
        value={numberInputValue(value)}
        onChange={(event) => onChange(event.target.value)}
        style={noDragRegionStyle}
        className="h-9 rounded-sm border-border bg-secondary text-xs focus-visible:ring-primary"
      />
    </div>
  );
}

export function SettingsLifeCompanionToggleGrid({
  onUpdate,
  settings,
}: LifeCompanionFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <button type="button" onClick={() => onUpdate({ proactiveEnabled: !settings.proactiveEnabled })} className={toggleButtonClass(settings.proactiveEnabled)}>
        Proactive {settings.proactiveEnabled ? 'on' : 'off'}
      </button>
      <button type="button" onClick={() => onUpdate({ randomInteractionEnabled: !settings.randomInteractionEnabled })} className={toggleButtonClass(settings.randomInteractionEnabled)}>
        Random {settings.randomInteractionEnabled ? 'on' : 'off'}
      </button>
      <button type="button" onClick={() => onUpdate({ textPromptEnabled: !settings.textPromptEnabled })} className={toggleButtonClass(settings.textPromptEnabled)}>
        Text prompt {settings.textPromptEnabled ? 'on' : 'off'}
      </button>
      <button type="button" onClick={() => onUpdate({ llmTextPromptEnabled: !settings.llmTextPromptEnabled })} className={toggleButtonClass(settings.llmTextPromptEnabled)}>
        LLM prompt {settings.llmTextPromptEnabled ? 'on' : 'off'}
      </button>
      <button type="button" onClick={() => onUpdate({ startupGreetingEnabled: !settings.startupGreetingEnabled })} className={toggleButtonClass(settings.startupGreetingEnabled)}>
        Startup LLM greeting {settings.startupGreetingEnabled ? 'on' : 'off'}
      </button>
      <button type="button" onClick={() => onUpdate({ affectionEnabled: !settings.affectionEnabled })} className={toggleButtonClass(settings.affectionEnabled)}>
        Affection {settings.affectionEnabled ? 'on' : 'off'}
      </button>
      <button type="button" onClick={() => onUpdate({ hungerEnabled: !settings.hungerEnabled })} className={toggleButtonClass(settings.hungerEnabled)}>
        Hunger {settings.hungerEnabled ? 'on' : 'off'}
      </button>
    </div>
  );
}

export function SettingsLifeCompanionIntervalFields({
  noDragRegionStyle,
  onUpdate,
  settings,
}: LifeCompanionFieldsProps) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
      <LifeCompanionNumberField
        label="Min minutes"
        min={5}
        value={settings.minRandomIntervalMinutes}
        onChange={(value) => onUpdate({
          minRandomIntervalMinutes: parseMinutesInput(value, settings.minRandomIntervalMinutes),
        })}
        noDragRegionStyle={noDragRegionStyle}
      />
      <LifeCompanionNumberField
        label="Max minutes"
        min={5}
        value={settings.maxRandomIntervalMinutes}
        onChange={(value) => onUpdate({
          maxRandomIntervalMinutes: parseMinutesInput(value, settings.maxRandomIntervalMinutes),
        })}
        noDragRegionStyle={noDragRegionStyle}
      />
      <LifeCompanionNumberField
        label="Text cooldown"
        min={15}
        value={settings.textPromptCooldownMinutes}
        onChange={(value) => onUpdate({
          textPromptCooldownMinutes: parseMinutesInput(value, settings.textPromptCooldownMinutes, 15),
        })}
        noDragRegionStyle={noDragRegionStyle}
      />
      <LifeCompanionNumberField
        label="LLM cooldown"
        min={30}
        value={settings.llmTextPromptCooldownMinutes}
        onChange={(value) => onUpdate({
          llmTextPromptCooldownMinutes: parseMinutesInput(
            value,
            settings.llmTextPromptCooldownMinutes,
            30,
          ),
        })}
        noDragRegionStyle={noDragRegionStyle}
      />
    </div>
  );
}

export function SettingsLifeCompanionQuietHoursFields({
  noDragRegionStyle,
  onUpdate,
  settings,
}: LifeCompanionFieldsProps) {
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr_1fr] items-end gap-3">
      <button type="button" onClick={() => onUpdate({ quietHoursEnabled: !settings.quietHoursEnabled })} className={toggleButtonClass(settings.quietHoursEnabled)}>
        Quiet {settings.quietHoursEnabled ? 'on' : 'off'}
      </button>
      <div className="space-y-2">
        <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          Start
        </Label>
        <Input
          value={settings.quietHoursStart}
          onChange={(event) => onUpdate({ quietHoursStart: event.target.value })}
          style={noDragRegionStyle}
          className="h-9 rounded-sm border-border bg-secondary text-xs focus-visible:ring-primary"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          End
        </Label>
        <Input
          value={settings.quietHoursEnd}
          onChange={(event) => onUpdate({ quietHoursEnd: event.target.value })}
          style={noDragRegionStyle}
          className="h-9 rounded-sm border-border bg-secondary text-xs focus-visible:ring-primary"
        />
      </div>
    </div>
  );
}
