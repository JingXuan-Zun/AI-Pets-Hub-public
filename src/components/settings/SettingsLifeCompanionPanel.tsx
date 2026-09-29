import { type CSSProperties } from 'react';
import { Label } from '../../../components/ui/label';
import {
  createLifeCompanionStatus,
  type PetLifeCompanionSettings,
} from '../../life-companion/lifeCompanionSettings';
import { type PetStats } from '../../types';
import {
  SettingsLifeCompanionIntervalFields,
  SettingsLifeCompanionQuietHoursFields,
  SettingsLifeCompanionToggleGrid,
} from './SettingsLifeCompanionFields';
import { SettingsLifeCompanionGrowthStatusRow } from './SettingsLifeCompanionGrowthStatusRow';
import { SettingsLifeCompanionRuntimeControls } from './SettingsLifeCompanionRuntimeControls';
import { SettingsLifeCompanionRuntimeStatusRow } from './SettingsLifeCompanionRuntimeStatusRow';

interface SettingsLifeCompanionPanelProps {
  noDragRegionStyle?: CSSProperties;
  onUpdateSettings: (settings: PetLifeCompanionSettings) => void;
  settings: PetLifeCompanionSettings;
  stats: PetStats;
}

export function SettingsLifeCompanionPanel({
  noDragRegionStyle,
  onUpdateSettings,
  settings,
  stats,
}: SettingsLifeCompanionPanelProps) {
  const status = createLifeCompanionStatus(stats, settings);
  const updateSettings = (updates: Partial<PetLifeCompanionSettings>) => {
    onUpdateSettings({
      ...settings,
      ...updates,
    });
  };

  return (
    <section className="rounded-sm border border-border bg-secondary/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
            Life companion
          </Label>
          <div className="mt-1 font-mono text-2xs text-muted-foreground">
            {status.summary}
          </div>
        </div>
        <span className="font-mono text-2xs text-primary">{status.mood}</span>
      </div>

      <SettingsLifeCompanionRuntimeControls />
      <SettingsLifeCompanionGrowthStatusRow stats={stats} />
      <SettingsLifeCompanionRuntimeStatusRow />
      <SettingsLifeCompanionToggleGrid settings={settings} onUpdate={updateSettings} />
      <SettingsLifeCompanionIntervalFields
        settings={settings}
        onUpdate={updateSettings}
        noDragRegionStyle={noDragRegionStyle}
      />
      <SettingsLifeCompanionQuietHoursFields
        settings={settings}
        onUpdate={updateSettings}
        noDragRegionStyle={noDragRegionStyle}
      />
    </section>
  );
}
