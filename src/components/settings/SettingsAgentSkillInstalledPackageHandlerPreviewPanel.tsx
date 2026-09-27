import { PlugZap, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  type AgentSkillInstalledPackageHandlerPreviewRegistry,
  type AgentSkillInstalledPackageRegistry,
} from '../../agent';

function getPreview(
  registry: AgentSkillInstalledPackageHandlerPreviewRegistry,
  packageId: string,
) {
  return registry.previews.find((preview) => preview.packageId === packageId) ?? null;
}

export function SettingsAgentSkillInstalledPackageHandlerPreviewPanel({
  installedRegistry,
  onCreatePreview,
  onRemovePreview,
  previewRegistry,
}: {
  installedRegistry: AgentSkillInstalledPackageRegistry;
  onCreatePreview: (packageId: string) => void;
  onRemovePreview: (packageId: string) => void;
  previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry;
}) {
  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <PlugZap className="h-3 w-3 text-primary" />
          Handler preview registry
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          previews {previewRegistry.previews.length} / executable 0
        </div>
      </div>
      <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
        {installedRegistry.packages.length ? installedRegistry.packages.map((item) => {
          const preview = getPreview(previewRegistry, item.id);
          return (
            <div key={item.id} className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-mono text-3xs text-foreground">{item.skillId}</div>
                  <div className="truncate text-3xs text-muted-foreground">
                    {preview ? `${preview.handlerId} / ${preview.previewedAt}` : 'no handler preview'}
                  </div>
                </div>
                {preview ? (
                  <Button type="button" variant="ghost" size="icon-xs" title="Remove handler preview" onClick={() => onRemovePreview(item.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                ) : (
                  <Button type="button" variant="outline" size="xs" onClick={() => onCreatePreview(item.id)}>
                    Preview
                  </Button>
                )}
              </div>
            </div>
          );
        }) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No installed packages need handler previews.
          </div>
        )}
      </div>
    </div>
  );
}
