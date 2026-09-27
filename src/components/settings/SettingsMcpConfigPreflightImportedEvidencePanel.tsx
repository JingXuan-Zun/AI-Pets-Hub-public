import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { SettingsMcpConfigPreflightResult } from './settingsMcpConfigPreflight';
import { createSettingsMcpConfigPreflightEvidenceSummary } from './settingsMcpConfigPreflightEvidence';
import type { SettingsMcpConfigPreflightImportedPayload } from './settingsMcpConfigPreflightExport';

interface SettingsMcpConfigPreflightImportedEvidencePanelProps {
  current: SettingsMcpConfigPreflightResult;
  imported: SettingsMcpConfigPreflightImportedPayload;
}

export function SettingsMcpConfigPreflightImportedEvidencePanel({
  current,
  imported,
}: SettingsMcpConfigPreflightImportedEvidencePanelProps) {
  const summary = createSettingsMcpConfigPreflightEvidenceSummary(imported, current);
  const Icon = summary.currentMatch ? CheckCircle2 : AlertTriangle;

  return (
    <div className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex items-start gap-2 text-3xs">
        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${summary.currentMatch ? 'text-primary' : 'text-amber-600'}`} />
        <div className="min-w-0">
          <div className="font-mono text-foreground">
            Imported evidence / {summary.status} / {summary.serverCount} server(s)
          </div>
          <div className="truncate text-muted-foreground">
            {summary.inputPath} / {summary.exportedAt}
          </div>
          <div className="text-muted-foreground">{summary.detail}</div>
        </div>
      </div>
    </div>
  );
}
