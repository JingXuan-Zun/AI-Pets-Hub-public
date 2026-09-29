import { useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, FileJson, Upload } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { parseSettingsMcpSoakReportText } from './settingsMcpSoakImport';
import {
  type SettingsMcpSoakServerSummary,
  type SettingsMcpSoakSummaryResult,
  type SettingsMcpSoakSummaryStatus,
} from './settingsMcpSoakSummary';

interface SettingsMcpSoakSummaryPanelProps {
  disabled?: boolean;
  onFeedback?: (message: string) => void;
  onSummaryChange?: (summary: SettingsMcpSoakSummaryResult) => void;
  summary?: SettingsMcpSoakSummaryResult | null;
}

function getStatusIcon(status: SettingsMcpSoakSummaryStatus) {
  if (status === 'healthy') {
    return CheckCircle2;
  }

  if (status === 'empty') {
    return FileJson;
  }

  return AlertTriangle;
}

function getStatusClassName(status: SettingsMcpSoakSummaryStatus) {
  if (status === 'failed') {
    return 'text-destructive';
  }

  if (status === 'degraded') {
    return 'text-amber-600';
  }

  if (status === 'healthy') {
    return 'text-primary';
  }

  return 'text-muted-foreground';
}

function formatServerMeta(server: SettingsMcpSoakServerSummary) {
  return [
    `${server.roundCount} rounds`,
    `${server.maxToolCount} max tools`,
    `${server.failureCount} failures`,
    `${server.restartEventCount} restarts`,
  ].join(' / ');
}

function SettingsMcpSoakServerRow({ server }: { server: SettingsMcpSoakServerSummary }) {
  const Icon = getStatusIcon(server.status);
  return (
    <div className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(server.status)}`} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-2xs text-foreground">
            {server.id || 'unknown-server'}
          </div>
          <div className="truncate text-3xs text-muted-foreground">
            {server.status} / {formatServerMeta(server)}
          </div>
        </div>
        <div className="shrink-0 text-right text-3xs text-muted-foreground">
          <div>{server.maxDurationMs}ms max</div>
          {server.toolCountChanged ? <div>tool drift</div> : null}
        </div>
      </div>
      {server.errorSamples.length ? (
        <div className="mt-1 truncate text-3xs text-destructive">
          {server.errorSamples[0]}
        </div>
      ) : null}
    </div>
  );
}

function SettingsMcpSoakSummaryContent({ summary }: { summary: SettingsMcpSoakSummaryResult }) {
  const Icon = getStatusIcon(summary.status);
  return (
    <div className="space-y-2">
      <div className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
        <div className="flex items-start gap-2">
          <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(summary.status)}`} />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-2xs text-foreground">{summary.status}</div>
            <div className="truncate text-3xs text-muted-foreground">
              {summary.totals.servers} servers / {summary.totals.rounds} rounds / {summary.totals.restartEvents} restarts
            </div>
          </div>
        </div>
      </div>
      {summary.servers.map((server) => (
        <SettingsMcpSoakServerRow key={server.id || server.title} server={server} />
      ))}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-3xs text-muted-foreground">
        {summary.recommendations.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  );
}

export function SettingsMcpSoakSummaryPanel({
  disabled = false,
  onFeedback,
  onSummaryChange,
  summary: controlledSummary,
}: SettingsMcpSoakSummaryPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [summary, setSummary] = useState<SettingsMcpSoakSummaryResult | null>(null);
  const [error, setError] = useState('');
  const visibleSummary = controlledSummary === undefined ? summary : controlledSummary;

  const importReport = async (file: File) => {
    try {
      const result = parseSettingsMcpSoakReportText(await file.text(), file.name);
      setSummary(result);
      setError('');
      onSummaryChange?.(result);
      onFeedback?.(`Imported MCP soak evidence: ${result.status}, ${result.totals.servers} server(s).`);
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : 'MCP soak report import failed.';
      setError(message);
      onFeedback?.(message);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Activity className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="font-mono text-2xs text-foreground">MCP soak summary</div>
            <div className="truncate text-3xs text-muted-foreground">
              {visibleSummary ? `${visibleSummary.status} / ${visibleSummary.totals.rounds} rounds` : 'No soak report imported.'}
            </div>
          </div>
        </div>
        <input
          ref={fileInputRef}
          className="hidden"
          accept="application/json,.json"
          type="file"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = '';
            if (file) {
              void importReport(file);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          Import
        </Button>
      </div>
      {error ? (
        <div className="rounded-sm border border-dashed border-destructive/40 bg-background/30 px-3 py-2 text-3xs text-destructive">
          {error}
        </div>
      ) : null}
      {visibleSummary ? <SettingsMcpSoakSummaryContent summary={visibleSummary} /> : null}
    </div>
  );
}
