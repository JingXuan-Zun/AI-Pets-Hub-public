import { FileJson, PencilLine } from 'lucide-react';
import { Button } from '../../../components/ui/button';

export type SettingsMcpSoakReadinessSourceMode = 'draft-config' | 'saved-config';

interface SettingsMcpSoakReadinessSourceModePanelProps {
  mode: SettingsMcpSoakReadinessSourceMode;
  onModeChange: (mode: SettingsMcpSoakReadinessSourceMode) => void;
}

const MODE_OPTIONS: Array<{
  Icon: typeof FileJson;
  detail: string;
  label: string;
  mode: SettingsMcpSoakReadinessSourceMode;
}> = [{
  Icon: FileJson,
  detail: 'Uses the saved .desktop-pet-mcp.json file and can support external-soak closure.',
  label: 'Saved config',
  mode: 'saved-config',
}, {
  Icon: PencilLine,
  detail: 'Uses the current editor JSON as preview evidence only; save and regenerate before estimate review.',
  label: 'Draft config',
  mode: 'draft-config',
}];

export function SettingsMcpSoakReadinessSourceModePanel({
  mode,
  onModeChange,
}: SettingsMcpSoakReadinessSourceModePanelProps) {
  return (
    <div className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="mb-2 font-mono text-3xs text-foreground">
        Readiness generation source / {mode}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {MODE_OPTIONS.map(({ Icon, detail, label, mode: optionMode }) => (
          <Button
            key={optionMode}
            type="button"
            variant={mode === optionMode ? 'secondary' : 'outline'}
            className="h-auto justify-start rounded-sm px-2 py-2 text-left"
            onClick={() => onModeChange(optionMode)}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0">
              <span className="block font-mono text-3xs">{label}</span>
              <span className="block whitespace-normal text-3xs font-normal text-muted-foreground">
                {detail}
              </span>
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
