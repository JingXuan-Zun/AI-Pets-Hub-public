import { AlertTriangle, Check, CheckCircle2, ClipboardList, Download, Info, Terminal } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { copySettingsTextToClipboard } from './settingsClipboardUtils';
import { downloadJsonTextFile } from './settingsDownloadUtils';
import {
  createSettingsMcpPerServerSoakCommandReview,
  createSettingsMcpPerServerSoakCommandReviewExportName,
  formatSettingsMcpPerServerSoakCommandReviewExportText,
  type SettingsMcpPerServerSoakCommand,
  type SettingsMcpPerServerSoakCommandReviewStatus,
} from './settingsMcpPerServerSoakCommandReview';
import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';

interface SettingsMcpPerServerSoakCommandReviewPanelProps {
  configText: string;
  onFeedback?: (message: string) => void;
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null;
}

function getStatusClassName(status: SettingsMcpPerServerSoakCommandReviewStatus) {
  if (status === 'ready') {
    return 'text-primary';
  }

  return status === 'blocked' ? 'text-destructive' : 'text-amber-600';
}

function getStatusIcon(status: SettingsMcpPerServerSoakCommandReviewStatus) {
  if (status === 'ready') {
    return CheckCircle2;
  }

  return status === 'blocked' ? AlertTriangle : Info;
}

function CommandRow({ command }: { command: SettingsMcpPerServerSoakCommand }) {
  return (
    <div className="rounded-sm border border-border/70 bg-background/50 px-2 py-1">
      <div className="font-mono text-3xs text-foreground">{command.serverId}</div>
      <div className="break-all font-mono text-3xs leading-4 text-muted-foreground">
        {command.command}
      </div>
    </div>
  );
}

export function SettingsMcpPerServerSoakCommandReviewPanel({
  configText,
  onFeedback,
  readinessSummary,
}: SettingsMcpPerServerSoakCommandReviewPanelProps) {
  const [copyStatus, setCopyStatus] = useState<'copied' | 'failed' | 'idle'>('idle');
  const review = createSettingsMcpPerServerSoakCommandReview(readinessSummary, configText);
  const Icon = getStatusIcon(review.status);
  const CopyIcon = copyStatus === 'copied' ? Check : ClipboardList;

  const copyCommands = async () => {
    try {
      const copied = await copySettingsTextToClipboard(review.commandsText);
      setCopyStatus(copied ? 'copied' : 'failed');
      onFeedback?.(copied ? 'MCP per-server soak commands copied.' : 'MCP per-server soak command copy failed.');
    } catch {
      setCopyStatus('failed');
      onFeedback?.('MCP per-server soak command copy failed.');
    }
  };

  const exportReview = () => {
    downloadJsonTextFile(
      createSettingsMcpPerServerSoakCommandReviewExportName(review),
      formatSettingsMcpPerServerSoakCommandReviewExportText(review),
    );
    onFeedback?.('MCP per-server soak command review exported.');
  };

  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(review.status)}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-1 font-mono text-2xs text-foreground">
              <Terminal className="h-3 w-3 shrink-0 text-muted-foreground" />
              Per-server soak commands / {review.status} / {review.commandCount} command(s)
            </div>
            <div className="text-3xs text-muted-foreground">{review.nextAction}</div>
          </div>
        </div>
        <div className="shrink-0 text-right font-mono text-3xs text-muted-foreground">
          <div>{review.source}</div>
          <div>{review.configPresent ? 'config present' : 'no saved config'}</div>
          <div>candidate consistency: {review.consistency.status}</div>
          <div>{review.supportsExternalSoakCollection ? 'external soak ready' : 'review only'}</div>
        </div>
      </div>
      {review.consistency.status !== 'ready' ? (
        <div className="space-y-1 rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
          {review.consistency.rows.slice(0, 3).map((row) => (
            <div key={row.serverId} className="text-3xs text-muted-foreground">
              <span className={`font-mono ${getStatusClassName(row.status)}`}>{row.status}</span>
              {' / '}
              <span className="font-mono text-foreground">{row.serverId}</span>
              {' / '}
              {row.detail}
            </div>
          ))}
        </div>
      ) : null}
      {review.commands.length ? (
        <div className="space-y-1">
          {review.commands.map((command) => (
            <CommandRow key={command.serverId} command={command} />
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-3xs text-muted-foreground">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!review.commandsText}
          onClick={() => void copyCommands()}
        >
          <CopyIcon className="h-3.5 w-3.5" />
          Copy all per-server commands
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={exportReview}>
          <Download className="h-3.5 w-3.5" />
          Export command review
        </Button>
        {copyStatus !== 'idle' ? (
          <span className={copyStatus === 'copied' ? 'text-primary' : 'text-destructive'}>
            {copyStatus === 'copied' ? 'copied' : 'copy failed'}
          </span>
        ) : null}
      </div>
    </div>
  );
}
