import { AlertTriangle, CheckCircle2, Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { downloadJsonTextFile } from './settingsDownloadUtils';
import type { SettingsMcpExternalSoakClosureChecklist } from './settingsMcpExternalSoakClosureChecklist';
import {
  createSettingsMcpExternalSoakClosureEvidenceName,
  createSettingsMcpExternalSoakClosureImportedSummary,
  formatSettingsMcpExternalSoakClosureEvidenceText,
  parseSettingsMcpExternalSoakClosureEvidenceText,
  type SettingsMcpExternalSoakClosureImportedPayload,
} from './settingsMcpExternalSoakClosureEvidence';

interface SettingsMcpExternalSoakClosureEvidenceExchangePanelProps {
  checklist: SettingsMcpExternalSoakClosureChecklist;
}

export function SettingsMcpExternalSoakClosureEvidenceExchangePanel({
  checklist,
}: SettingsMcpExternalSoakClosureEvidenceExchangePanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imported, setImported] = useState<SettingsMcpExternalSoakClosureImportedPayload | null>(null);
  const [importError, setImportError] = useState('');
  const importedSummary = imported
    ? createSettingsMcpExternalSoakClosureImportedSummary(imported, checklist)
    : null;
  const ImportedIcon = importedSummary?.currentMatch ? CheckCircle2 : AlertTriangle;

  const importFile = async (file: File) => {
    try {
      setImported(parseSettingsMcpExternalSoakClosureEvidenceText(await file.text(), file.name));
      setImportError('');
    } catch (error) {
      setImported(null);
      setImportError(error instanceof Error ? error.message : 'MCP external soak closure import failed.');
    }
  };

  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-3xs text-foreground">
          Closure evidence exchange / {checklist.status} / {checklist.readyCount} of {checklist.steps.length}
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
            Import closure
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => downloadJsonTextFile(
              createSettingsMcpExternalSoakClosureEvidenceName(checklist),
              formatSettingsMcpExternalSoakClosureEvidenceText(checklist),
            )}
          >
            <Download className="h-3.5 w-3.5" />
            Export closure
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
              Imported closure / {importedSummary.status} / {importedSummary.readyCount} ready
            </div>
            <div className="truncate text-muted-foreground">
              {importedSummary.inputPath} / {importedSummary.exportedAt}
            </div>
            <div className="text-muted-foreground">{importedSummary.detail}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
