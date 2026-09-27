import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  createAgentSkillPackageDraftLibraryExport,
  parseAgentSkillPackageDraftLibraryImportJson,
  type AgentSkillPackageDraftLibrary,
} from '../../agent';

function formatLibraryExportJson(library: AgentSkillPackageDraftLibrary) {
  return JSON.stringify(createAgentSkillPackageDraftLibraryExport(library, 'preview'), null, 2);
}

export function SettingsAgentSkillPackageDraftLibraryExchangePanel({
  library,
  onImportLibrary,
}: {
  library: AgentSkillPackageDraftLibrary;
  onImportLibrary: (library: AgentSkillPackageDraftLibrary) => string | null;
}) {
  const [importJson, setImportJson] = useState('');
  const [feedback, setFeedback] = useState('');
  const importPreview = importJson.trim()
    ? parseAgentSkillPackageDraftLibraryImportJson(importJson, library)
    : null;
  const saveImport = () => {
    if (!importPreview?.library) {
      return;
    }

    const error = onImportLibrary(importPreview.library);
    setFeedback(error || `Imported ${importPreview.importedCount} package draft(s).`);
    if (!error) {
      setImportJson('');
    }
  };

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
        <Download className="h-3 w-3 text-primary" />
        Draft library exchange
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <pre className="max-h-32 overflow-auto rounded-sm border border-border/60 bg-secondary/20 p-2 text-3xs text-muted-foreground">
          {formatLibraryExportJson(library)}
        </pre>
        <div className="space-y-2">
          <textarea
            className="h-24 w-full resize-y rounded-sm border border-border bg-background/50 p-2 font-mono text-3xs text-foreground outline-none"
            placeholder="Paste draft library export JSON to preview merge"
            spellCheck={false}
            value={importJson}
            onChange={(event) => setImportJson(event.target.value)}
          />
          <div className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1 font-mono text-3xs text-muted-foreground">
            {importPreview
              ? `${importPreview.ok ? 'ok' : 'blocked'} / input ${importPreview.inputCount} / import ${importPreview.importedCount} / skipped ${importPreview.skippedDuplicateCount}`
              : 'library import idle'}
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="outline" size="xs" disabled={!importPreview?.ok || !importPreview.library} onClick={saveImport}>
              <Upload className="h-3 w-3" />
              Import
            </Button>
            {feedback ? (
              <span className="truncate font-mono text-3xs text-muted-foreground">{feedback}</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
