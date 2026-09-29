import { AlertTriangle, CheckCircle2, Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { downloadJsonTextFile } from './settingsDownloadUtils';
import {
  createSettingsMcpExternalSoakClosureReviewEvidenceName,
  createSettingsMcpExternalSoakClosureReviewImportedSummary,
  formatSettingsMcpExternalSoakClosureReviewEvidenceText,
  parseSettingsMcpExternalSoakClosureReviewEvidenceText,
  type SettingsMcpExternalSoakClosureReviewImportedPayload,
  type SettingsMcpExternalSoakClosureReviewSnapshot,
} from './settingsMcpExternalSoakClosureReviewEvidence';

interface SettingsMcpExternalSoakClosureReviewEvidenceExchangePanelProps {
  snapshot: SettingsMcpExternalSoakClosureReviewSnapshot;
}

export function SettingsMcpExternalSoakClosureReviewEvidenceExchangePanel({
  snapshot,
}: SettingsMcpExternalSoakClosureReviewEvidenceExchangePanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imported, setImported] = useState<SettingsMcpExternalSoakClosureReviewImportedPayload | null>(null);
  const [importError, setImportError] = useState('');
  const importedSummary = imported
    ? createSettingsMcpExternalSoakClosureReviewImportedSummary(imported, snapshot)
    : null;
  const ImportedIcon = importedSummary?.currentMatch ? CheckCircle2 : AlertTriangle;

  const importFile = async (file: File) => {
    try {
      setImported(parseSettingsMcpExternalSoakClosureReviewEvidenceText(await file.text(), file.name));
      setImportError('');
    } catch (error) {
      setImported(null);
      setImportError(error instanceof Error ? error.message : 'MCP closure review import failed.');
    }
  };

  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-3xs text-foreground">
          Closure review snapshot / {snapshot.drift.status} / {snapshot.drift.alignedCount} of {snapshot.drift.totalCount}
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            className="hidden"
            accept="application/json,.json"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = '';
              if (file) {
                void importFile(file);
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" />
            Import review
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => downloadJsonTextFile(
              createSettingsMcpExternalSoakClosureReviewEvidenceName(snapshot),
              formatSettingsMcpExternalSoakClosureReviewEvidenceText(snapshot),
            )}
          >
            <Download className="h-3.5 w-3.5" />
            Export review
          </Button>
        </div>
      </div>
      {importError ? (
        <div className="text-3xs text-destructive">{importError}</div>
      ) : null}
      {importedSummary && ImportedIcon ? (
        <div className="flex items-start gap-2 text-3xs">
          <ImportedIcon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${importedSummary.currentMatch ? 'text-primary' : 'text-amber-600'}`} />
          <div className="min-w-0">
            <div className="font-mono text-foreground">
              Imported review / {importedSummary.driftStatus} / {importedSummary.statusText}
            </div>
            <div className="truncate text-muted-foreground">
              {importedSummary.inputPath} / {importedSummary.exportedAt}
            </div>
            <div className="text-muted-foreground">{importedSummary.readyText}</div>
            <div className="text-muted-foreground">{importedSummary.detail}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
