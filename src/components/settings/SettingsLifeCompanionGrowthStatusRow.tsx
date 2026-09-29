import { createLifeCompanionGrowthStatus } from '../../life-companion/lifeCompanionGrowthStatus';
import type { PetStats } from '../../types';

const PRIORITY_CLASS = {
  critical: 'text-red-400',
  normal: 'text-primary',
  watch: 'text-amber-400',
} as const;

interface SettingsLifeCompanionGrowthStatusRowProps {
  stats: PetStats;
}

export function SettingsLifeCompanionGrowthStatusRow({
  stats,
}: SettingsLifeCompanionGrowthStatusRowProps) {
  const status = createLifeCompanionGrowthStatus(stats);

  return (
    <div className="mb-3 grid grid-cols-3 gap-2 rounded-sm border border-border/70 bg-background/40 p-2 font-mono text-3xs">
      <div>
        <div className="text-3xs uppercase tracking-widest text-muted-foreground">affection</div>
        <div>{status.affectionLabel}</div>
      </div>
      <div>
        <div className="text-3xs uppercase tracking-widest text-muted-foreground">hunger</div>
        <div>{status.hungerLabel}</div>
      </div>
      <div>
        <div className="text-3xs uppercase tracking-widest text-muted-foreground">fatigue</div>
        <div>{status.fatigueLabel}</div>
      </div>
      <div className={PRIORITY_CLASS[status.priority]}>{status.priority}</div>
      <div className="col-span-2 truncate text-muted-foreground">{status.summary}</div>
    </div>
  );
}
