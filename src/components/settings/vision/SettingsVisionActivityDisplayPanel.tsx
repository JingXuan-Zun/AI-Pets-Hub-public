import { Check, Monitor } from 'lucide-react';
import { Label } from '../../../../components/ui/label';
import { type ActivityDisplayOption } from './types';

interface SettingsVisionActivityDisplayPanelProps {
  activityDisplayOptions: ActivityDisplayOption[];
  currentDisplayId: ActivityDisplayOption['value'];
  panelTitle: string;
  selectedLabel: string;
  onUpdateDisplay: (displayId: ActivityDisplayOption['value']) => void;
}

export function SettingsVisionActivityDisplayPanel({
  activityDisplayOptions,
  currentDisplayId,
  panelTitle,
  selectedLabel,
  onUpdateDisplay,
}: SettingsVisionActivityDisplayPanelProps) {
  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          {panelTitle}
        </Label>
        <span className="font-mono text-2xs text-primary">
          {selectedLabel}
        </span>
      </div>
      <div className="grid gap-2 rounded-sm border border-primary/20 bg-background/90 p-2">
        {activityDisplayOptions.map((displayOption) => {
          const isSelected = currentDisplayId === displayOption.value;
          const resolutionLabel = displayOption.width > 0 && displayOption.height > 0
            ? `${displayOption.width}x${displayOption.height}`
            : 'Unavailable';

          return (
            <button
              key={displayOption.value}
              type="button"
              onClick={() => onUpdateDisplay(displayOption.value)}
              className={`flex w-full items-center justify-between rounded-sm border px-3 py-2 text-left transition-all ${
                isSelected
                  ? 'border-primary bg-primary/10 shadow-[0_0_16px_rgba(0,209,255,0.12)]'
                  : 'border-border bg-secondary/40 hover:border-primary/50 hover:bg-secondary/60'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border ${
                  isSelected
                    ? 'border-primary/60 bg-primary/10 text-primary'
                    : 'border-border bg-background/40 text-muted-foreground'
                }`}>
                  {isSelected ? <Check className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className={`truncate text-2xs font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {displayOption.title}
                  </div>
                  <div className="font-mono text-2xs text-muted-foreground">
                    {resolutionLabel}
                  </div>
                </div>
              </div>
              <div className={`shrink-0 rounded-sm border px-2 py-1 font-mono text-2xs ${
                isSelected
                  ? 'border-primary/60 bg-primary/10 text-primary'
                  : 'border-border bg-background/50 text-muted-foreground'
              }`}>
                {displayOption.tag}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
