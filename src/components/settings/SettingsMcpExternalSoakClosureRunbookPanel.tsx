import { Clipboard, Terminal } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';
import {
  createSettingsMcpExternalSoakClosureRunbook,
  formatSettingsMcpExternalSoakClosureRunbookText,
} from './settingsMcpExternalSoakClosureRunbook';

interface SettingsMcpExternalSoakClosureRunbookPanelProps {
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null;
}

export function SettingsMcpExternalSoakClosureRunbookPanel({
  readinessSummary,
}: SettingsMcpExternalSoakClosureRunbookPanelProps) {
  const runbook = createSettingsMcpExternalSoakClosureRunbook(readinessSummary);
  const runbookText = formatSettingsMcpExternalSoakClosureRunbookText(runbook);

  const copyRunbook = async () => {
    if (!runbookText) {
      return;
    }

    await navigator.clipboard.writeText(runbookText);
  };

  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="font-mono text-2xs text-foreground">
              Closure runbook / {runbook.status} / {runbook.commands.length} command(s)
            </div>
            <div className="text-3xs text-muted-foreground">{runbook.detail}</div>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={!runbookText} onClick={() => void copyRunbook()}>
          <Clipboard className="h-3.5 w-3.5" />
          Copy closure runbook
        </Button>
      </div>
      {runbook.commands.length ? (
        <div className="space-y-1">
          {runbook.commands.map((item) => (
            <div key={item.id} className="rounded-sm border border-border/70 bg-background/50 px-2 py-1">
              <div className="font-mono text-3xs text-foreground">{item.label}</div>
              <div className="break-all font-mono text-3xs leading-4 text-muted-foreground">{item.command}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
