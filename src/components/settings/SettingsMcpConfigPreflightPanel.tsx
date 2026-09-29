import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import {
  createSettingsMcpConfigPreflight,
  type SettingsMcpConfigPreflightStatus,
} from './settingsMcpConfigPreflight';
import { SettingsMcpConfigPreflightExportButton } from './SettingsMcpConfigPreflightExportButton';
import { SettingsMcpConfigPreflightImportedEvidencePanel } from './SettingsMcpConfigPreflightImportedEvidencePanel';
import { SettingsMcpConfigPreflightImportButton } from './SettingsMcpConfigPreflightImportButton';
import type { SettingsMcpConfigPreflightImportedPayload } from './settingsMcpConfigPreflightExport';

interface SettingsMcpConfigPreflightPanelProps {
  configText: string;
  onFeedback?: (message: string) => void;
}

function getStatusClassName(status: SettingsMcpConfigPreflightStatus) {
  if (status === 'ready') {
    return 'text-primary';
  }

  return status === 'blocked' ? 'text-destructive' : 'text-amber-600';
}

function getStatusIcon(status: SettingsMcpConfigPreflightStatus) {
  if (status === 'ready') {
    return CheckCircle2;
  }

  return status === 'blocked' ? AlertTriangle : Info;
}

export function SettingsMcpConfigPreflightPanel({
  configText,
  onFeedback,
}: SettingsMcpConfigPreflightPanelProps) {
  const [importError, setImportError] = useState('');
  const [importedEvidence, setImportedEvidence] = useState<SettingsMcpConfigPreflightImportedPayload | null>(null);
  const preflight = useMemo(
    () => createSettingsMcpConfigPreflight(configText),
    [configText],
  );
  const Icon = getStatusIcon(preflight.status);
  const applyImportedEvidence = (payload: SettingsMcpConfigPreflightImportedPayload) => {
    setImportedEvidence(payload);
    setImportError('');
    onFeedback?.(`MCP config preflight evidence imported: ${payload.preflight.status}.`);
  };
  const applyImportError = (message: string) => {
    setImportError(message);
    onFeedback?.(message);
  };

  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          <Icon className={`h-3.5 w-3.5 ${getStatusClassName(preflight.status)}`} />
          Config preflight / {preflight.status} / {preflight.serverCount} server(s) /
          {' '}
          {preflight.statusCounts.blocked} blocked /
          {' '}
          {preflight.statusCounts.warning} warning /
          {' '}
          {preflight.statusCounts.ready} ready
        </div>
        <div className="flex items-center gap-2">
          <SettingsMcpConfigPreflightImportButton
            onError={applyImportError}
            onImported={applyImportedEvidence}
          />
          <SettingsMcpConfigPreflightExportButton preflight={preflight} />
        </div>
      </div>
      {importError ? (
        <div className="rounded-sm border border-dashed border-destructive/40 bg-background/30 px-3 py-2 text-3xs text-destructive">
          {importError}
        </div>
      ) : null}
      {importedEvidence ? (
        <SettingsMcpConfigPreflightImportedEvidencePanel
          current={preflight}
          imported={importedEvidence}
        />
      ) : null}
      <div className="grid gap-1 sm:grid-cols-2">
        {preflight.checks.map((check) => {
          const CheckIcon = getStatusIcon(check.status);
          return (
            <div key={check.id} className="flex items-start gap-2 text-3xs">
              <CheckIcon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(check.status)}`} />
              <div className="min-w-0">
                <div className="font-mono text-foreground">{check.label}</div>
                <div className="text-muted-foreground">{check.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
