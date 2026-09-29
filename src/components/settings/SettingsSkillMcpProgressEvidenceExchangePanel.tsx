import { AlertTriangle, CheckCircle2, Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { downloadJsonTextFile } from './settingsDownloadUtils';
import {
  createSettingsSkillMcpProgressEvidenceText,
  createSettingsSkillMcpProgressImportedSummary,
  parseSettingsSkillMcpProgressEvidenceImportText,
  type SettingsSkillMcpProgressImportedEvidence,
} from './settingsSkillMcpProgress';
import {
  formatSettingsSkillMcpImportDetail,
  formatSettingsSkillMcpSummaryStatus,
} from './settingsSkillMcpProgressLocale';

function downloadProgressEvidence() {
  downloadJsonTextFile('skill-mcp-progress-evidence.json', createSettingsSkillMcpProgressEvidenceText());
}

export function SettingsSkillMcpProgressEvidenceExchangePanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imported, setImported] = useState<SettingsSkillMcpProgressImportedEvidence | null>(null);
  const [importError, setImportError] = useState('');
  const importedSummary = imported ? createSettingsSkillMcpProgressImportedSummary(imported) : null;
  const ImportedIcon = importedSummary?.currentMatch ? CheckCircle2 : AlertTriangle;

  const importFile = async (file: File) => {
    try {
      setImported(parseSettingsSkillMcpProgressEvidenceImportText(await file.text(), file.name));
      setImportError('');
    } catch (error) {
      setImported(null);
      setImportError(error instanceof Error ? error.message : 'Skill/MCP 进度导入失败。');
    }
  };

  return (
    <div className="mt-3 space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-3xs text-foreground">进度证据导入/导出</div>
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
            导入进度
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={downloadProgressEvidence}>
            <Download className="h-3.5 w-3.5" />
            导出进度
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
              已导入进度 / {formatSettingsSkillMcpSummaryStatus(importedSummary)}
            </div>
            <div className="truncate text-muted-foreground">
              {importedSummary.inputPath} / {importedSummary.exportedAt}
            </div>
            <div className="text-muted-foreground">{formatSettingsSkillMcpImportDetail(importedSummary)}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
