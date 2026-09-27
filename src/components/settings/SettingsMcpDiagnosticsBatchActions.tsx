import { ListChecks } from 'lucide-react';
import { Button } from '../../../components/ui/button';

interface SettingsMcpDiagnosticsBatchActionsProps {
  disabled?: boolean;
  serverCount: number;
  onTestAll: () => void;
}

export function SettingsMcpDiagnosticsBatchActions({
  disabled = false,
  onTestAll,
  serverCount,
}: SettingsMcpDiagnosticsBatchActionsProps) {
  if (!serverCount) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="min-w-0">
        <div className="font-mono text-2xs text-foreground">diagnostics</div>
        <div className="truncate text-3xs text-muted-foreground">
          {serverCount} saved MCP server(s)
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-8 rounded-sm text-xs"
        disabled={disabled}
        onClick={onTestAll}
      >
        <ListChecks className="h-3.5 w-3.5" />
        Test all
      </Button>
    </div>
  );
}
