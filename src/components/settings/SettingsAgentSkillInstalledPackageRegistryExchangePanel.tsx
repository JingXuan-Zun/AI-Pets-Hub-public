import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  createAgentSkillInstalledPackageAudit,
  createAgentSkillInstalledPackageRegistryExport,
  parseAgentSkillInstalledPackageRegistryImportJson,
  type AgentSkillInstalledPackageRegistry,
} from '../../agent';

function formatRegistryExportJson(registry: AgentSkillInstalledPackageRegistry) {
  return JSON.stringify(createAgentSkillInstalledPackageRegistryExport(registry, 'preview'), null, 2);
}

export function SettingsAgentSkillInstalledPackageRegistryExchangePanel({
  registry,
  onImportRegistry,
}: {
  registry: AgentSkillInstalledPackageRegistry;
  onImportRegistry: (registry: AgentSkillInstalledPackageRegistry) => string | null;
}) {
  const [importJson, setImportJson] = useState('');
  const [feedback, setFeedback] = useState('');
  const audit = createAgentSkillInstalledPackageAudit(registry);
  const importPreview = importJson.trim()
    ? parseAgentSkillInstalledPackageRegistryImportJson(importJson, registry)
    : null;
  const saveImport = () => {
    if (!importPreview?.registry) {
      return;
    }

    const error = onImportRegistry(importPreview.registry);
    setFeedback(error || `Imported ${importPreview.importedCount} installed package record(s).`);
    if (!error) {
      setImportJson('');
    }
  };

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <Download className="h-3 w-3 text-primary" />
          Installed registry exchange
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          total {audit.total} / unknown {audit.unknownSkillCount} / runtime {audit.runtimeEnabledCount}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <pre className="max-h-28 overflow-auto rounded-sm border border-border/60 bg-secondary/20 p-2 text-3xs text-muted-foreground">
          {formatRegistryExportJson(registry)}
        </pre>
        <div className="space-y-2">
          <textarea
            className="h-20 w-full resize-y rounded-sm border border-border bg-background/50 p-2 font-mono text-3xs text-foreground outline-none"
            placeholder="Paste installed registry export JSON"
            spellCheck={false}
            value={importJson}
            onChange={(event) => setImportJson(event.target.value)}
          />
          <div className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1 font-mono text-3xs text-muted-foreground">
            {importPreview
              ? `${importPreview.ok ? 'ok' : 'blocked'} / input ${importPreview.inputCount} / import ${importPreview.importedCount} / skipped ${importPreview.skippedDuplicateCount}`
              : 'installed import idle'}
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="outline" size="xs" disabled={!importPreview?.ok || !importPreview.registry} onClick={saveImport}>
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
