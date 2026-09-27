import { Clipboard, Terminal } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';

interface SettingsMcpSoakReadinessRunbookPanelProps {
  onFeedback?: (message: string) => void;
  summary: SettingsMcpSoakReadinessSummaryResult;
}

function collectRunbookCommands(summary: SettingsMcpSoakReadinessSummaryResult) {
  return [
    summary.runbook.allServers,
    ...summary.runbook.perServer.map((item) => item.command),
    summary.runbook.indexReports,
  ].filter(Boolean);
}

function createRunbookText(summary: SettingsMcpSoakReadinessSummaryResult) {
  const commands = collectRunbookCommands(summary);
  return commands.map((command, index) => `${index + 1}. ${command}`).join('\n');
}

export function SettingsMcpSoakReadinessRunbookPanel({
  onFeedback,
  summary,
}: SettingsMcpSoakReadinessRunbookPanelProps) {
  const runbookText = createRunbookText(summary);
  if (!runbookText) {
    return null;
  }

  const copyRunbook = async () => {
    try {
      await navigator.clipboard.writeText(runbookText);
      onFeedback?.('MCP readiness runbook copied.');
    } catch {
      onFeedback?.('Failed to copy MCP readiness runbook.');
    }
  };

  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          <Terminal className="h-3.5 w-3.5" />
          Runbook
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void copyRunbook()}>
          <Clipboard className="h-3.5 w-3.5" />
          Copy
        </Button>
      </div>
      <textarea
        className="max-h-32 min-h-[72px] w-full resize-y rounded-sm border border-border bg-background/70 p-2 font-mono text-3xs leading-4 text-muted-foreground outline-none"
        readOnly
        spellCheck={false}
        value={runbookText}
      />
    </div>
  );
}
