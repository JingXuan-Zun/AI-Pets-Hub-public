import { type RefObject, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileJson, Route, TestTube2 } from 'lucide-react';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { SettingsMcpSoakReadinessActions } from './SettingsMcpSoakReadinessActions';
import { SettingsMcpSoakReadinessExportButton } from './SettingsMcpSoakReadinessExportButton';
import { SettingsMcpSoakReadinessNextActionsPanel } from './SettingsMcpSoakReadinessNextActionsPanel';
import { SettingsMcpSoakReadinessRunbookPanel } from './SettingsMcpSoakReadinessRunbookPanel';
import {
  SettingsMcpSoakReadinessSourceModePanel,
  type SettingsMcpSoakReadinessSourceMode,
} from './SettingsMcpSoakReadinessSourceModePanel';
import {
  parseSettingsMcpSoakReadinessText,
  type SettingsMcpSoakReadinessServerStatus,
  type SettingsMcpSoakReadinessServerSummary,
  type SettingsMcpSoakReadinessSummaryResult,
} from './settingsMcpSoakReadiness';

interface SettingsMcpSoakReadinessPanelProps {
  configText?: string;
  disabled?: boolean;
  onFeedback?: (message: string) => void;
  onSummaryChange?: (summary: SettingsMcpSoakReadinessSummaryResult) => void;
}

function getServerStatusIcon(status: SettingsMcpSoakReadinessServerStatus) {
  if (status === 'ready') {
    return CheckCircle2;
  }

  if (status === 'fixture') {
    return FileJson;
  }

  if (status === 'reference') {
    return TestTube2;
  }

  return AlertTriangle;
}

function getStatusClassName(status: SettingsMcpSoakReadinessServerStatus | 'blocked' | 'ready') {
  if (status === 'ready') {
    return 'text-primary';
  }

  if (status === 'fixture' || status === 'reference') {
    return 'text-amber-600';
  }

  return 'text-destructive';
}

function formatPathCheck(label: string, value: boolean | null) {
  if (value == null) {
    return `${label}: not checked`;
  }

  return `${label}: ${value ? 'ok' : 'missing'}`;
}

function SettingsMcpSoakReadinessServerRow({
  server,
}: {
  server: SettingsMcpSoakReadinessServerSummary;
}) {
  const Icon = getServerStatusIcon(server.status);
  const blockers = server.blockers.length ? server.blockers.join(' / ') : server.warning;

  return (
    <div className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(server.status)}`} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-2xs text-foreground">
            {server.id || 'unknown-server'}
          </div>
          <div className="truncate text-3xs text-muted-foreground">
            {server.status} / {server.command || 'no command'}
          </div>
          <div className="truncate text-3xs text-muted-foreground">
            {server.cwd || 'no cwd'} / {formatPathCheck('cwd', server.cwdExists)}
          </div>
        </div>
        <div className="shrink-0 text-right text-3xs text-muted-foreground">
          <div>{formatPathCheck('cmd', server.commandPathExists)}</div>
          {server.readyForRealSoak ? <div>soak candidate</div> : null}
        </div>
      </div>
      {blockers ? (
        <div className="mt-1 truncate text-3xs text-muted-foreground">
          {blockers}
        </div>
      ) : null}
    </div>
  );
}

function SettingsMcpSoakReadinessContent({
  onFeedback,
  summary,
}: {
  onFeedback?: (message: string) => void;
  summary: SettingsMcpSoakReadinessSummaryResult;
}) {
  const Icon = summary.status === 'ready' ? CheckCircle2 : AlertTriangle;

  return (
    <div className="space-y-2">
      <div className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
        <div className="flex items-start gap-2">
          <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(summary.status)}`} />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-2xs text-foreground">{summary.status}</div>
            <div className="truncate text-3xs text-muted-foreground">
              {summary.totals.servers} servers / {summary.totals.readyServers} ready / {summary.totals.fakeFixtureServers} fixtures / {summary.totals.referenceServers} references
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              {summary.source} / {summary.inputPath}
            </div>
          </div>
          <div className="shrink-0 text-right text-3xs text-muted-foreground">
            <div>{summary.configPresent ? 'config present' : 'no config'}</div>
            <SettingsMcpSoakReadinessExportButton summary={summary} />
          </div>
        </div>
      </div>
      {summary.servers.map((server) => (
        <SettingsMcpSoakReadinessServerRow key={server.id || server.title} server={server} />
      ))}
      <SettingsMcpSoakReadinessNextActionsPanel actions={summary.nextActions} />
      <SettingsMcpSoakReadinessRunbookPanel summary={summary} onFeedback={onFeedback} />
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-3xs text-muted-foreground">
        {summary.recommendations.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  );
}

function SettingsMcpSoakReadinessImportHeader({
  disabled,
  fileInputRef,
  isGenerating,
  onGenerate,
  onImportFile,
  sourceMode,
  summary,
}: {
  disabled: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  isGenerating: boolean;
  onGenerate: () => void;
  onImportFile: (file: File) => void;
  sourceMode: SettingsMcpSoakReadinessSourceMode;
  summary: SettingsMcpSoakReadinessSummaryResult | null;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Route className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="font-mono text-2xs text-foreground">MCP soak readiness</div>
          <div className="truncate text-3xs text-muted-foreground">
            {summary ? `${summary.status} / ${summary.totals.readyServers} ready` : `Generate from ${sourceMode}.`}
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
            onImportFile(file);
          }
        }}
      />
      <SettingsMcpSoakReadinessActions
        disabled={disabled}
        isGenerating={isGenerating}
        onGenerate={onGenerate}
        onImport={() => fileInputRef.current?.click()}
      />
    </div>
  );
}

export function SettingsMcpSoakReadinessPanel({
  configText = '',
  disabled = false,
  onFeedback,
  onSummaryChange,
}: SettingsMcpSoakReadinessPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [summary, setSummary] = useState<SettingsMcpSoakReadinessSummaryResult | null>(null);
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [sourceMode, setSourceMode] = useState<SettingsMcpSoakReadinessSourceMode>('saved-config');

  const applyReadinessResult = (result: SettingsMcpSoakReadinessSummaryResult) => {
    setSummary(result);
    setError('');
    onSummaryChange?.(result);
    onFeedback?.(`MCP soak readiness: ${result.source}, ${result.status}, ${result.totals.readyServers} ready server(s).`);
  };

  const importReadinessReport = async (file: File) => {
    try {
      applyReadinessResult(parseSettingsMcpSoakReadinessText(await file.text(), file.name));
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : 'MCP soak readiness import failed.';
      setError(message);
      onFeedback?.(message);
    }
  };

  const generateReadinessReport = async () => {
    setIsGenerating(true);
    try {
      const rawText = sourceMode === 'draft-config' && configText.trim() ? configText : undefined;
      const report = await desktopPetShellRuntime.getMcpSoakReadiness({ rawText, rounds: 10 });
      const inputPath = sourceMode === 'draft-config' ? 'draft-mcp-config' : 'saved-mcp-config';
      applyReadinessResult(parseSettingsMcpSoakReadinessText(JSON.stringify(report), inputPath));
    } catch (generateError) {
      const message = generateError instanceof Error ? generateError.message : 'MCP soak readiness generation failed.';
      setError(message);
      onFeedback?.(message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-2">
      <SettingsMcpSoakReadinessSourceModePanel mode={sourceMode} onModeChange={setSourceMode} />
      <SettingsMcpSoakReadinessImportHeader
        disabled={disabled}
        fileInputRef={fileInputRef}
        isGenerating={isGenerating}
        sourceMode={sourceMode}
        summary={summary}
        onGenerate={() => void generateReadinessReport()}
        onImportFile={(file) => void importReadinessReport(file)}
      />
      {error ? (
        <div className="rounded-sm border border-dashed border-destructive/40 bg-background/30 px-3 py-2 text-3xs text-destructive">
          {error}
        </div>
      ) : null}
      {summary ? (
        <SettingsMcpSoakReadinessContent summary={summary} onFeedback={onFeedback} />
      ) : null}
    </div>
  );
}
