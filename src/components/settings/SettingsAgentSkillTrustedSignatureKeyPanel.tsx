import { useState } from 'react';
import { KeyRound, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  serializeAgentSkillTrustedSignatureKeyRegistry,
  type AgentSkillTrustedSignatureKeyRegistry,
} from '../../agent';

export function SettingsAgentSkillTrustedSignatureKeyPanel({
  registry,
  onImportRegistryJson,
  onRemoveKey,
}: {
  registry: AgentSkillTrustedSignatureKeyRegistry;
  onImportRegistryJson: (rawText: string) => void;
  onRemoveKey: (keyId: string) => void;
}) {
  const [importJson, setImportJson] = useState('');
  const exportJson = JSON.stringify(JSON.parse(serializeAgentSkillTrustedSignatureKeyRegistry(registry)), null, 2);

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <KeyRound className="h-3 w-3 text-primary" />
          Trusted signature keys
        </div>
        <div className="font-mono text-3xs text-muted-foreground">keys {registry.keys.length}</div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <pre className="max-h-28 overflow-auto rounded-sm border border-border/60 bg-secondary/20 p-2 text-3xs text-muted-foreground">
          {exportJson}
        </pre>
        <div className="space-y-1">
          <textarea
            className="h-20 w-full resize-y rounded-sm border border-border bg-background/50 p-2 font-mono text-3xs text-foreground outline-none"
            placeholder="Paste trusted signature key registry JSON"
            spellCheck={false}
            value={importJson}
            onChange={(event) => setImportJson(event.target.value)}
          />
          <Button type="button" variant="outline" size="xs" disabled={!importJson.trim()} onClick={() => onImportRegistryJson(importJson)}>
            Import keys
          </Button>
        </div>
      </div>
      <div className="mt-2 max-h-28 space-y-1 overflow-y-auto pr-1">
        {registry.keys.length ? registry.keys.map((key) => (
          <div key={key.keyId} className="flex items-center justify-between gap-2 rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
            <div className="min-w-0">
              <div className="truncate font-mono text-3xs text-foreground">{key.label}</div>
              <div className="truncate text-3xs text-muted-foreground">
                {key.algorithm} / {key.keyId} / {key.addedAt}
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon-xs" title="Remove trusted signature key" onClick={() => onRemoveKey(key.keyId)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No trusted signature keys are saved.
          </div>
        )}
      </div>
    </div>
  );
}
