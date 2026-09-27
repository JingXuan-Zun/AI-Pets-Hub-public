import { Plug, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  createAgentSkillExecutableHandlerGuardReport,
  type AgentSkillExecutableHandlerRegistry,
  type AgentSkillInstalledPackageHandlerPreviewRegistry,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillInstalledPackageRuntimePolicy,
} from '../../agent';

function getHandler(
  registry: AgentSkillExecutableHandlerRegistry,
  packageId: string,
) {
  return registry.handlers.find((handler) => handler.packageId === packageId) ?? null;
}

export function SettingsAgentSkillExecutableHandlerRegistryPanel({
  installedRegistry,
  onRegisterFromPreviews,
  onRemoveHandler,
  policy,
  previewRegistry,
  registry,
  trustedPackageIds,
}: {
  installedRegistry: AgentSkillInstalledPackageRegistry;
  onRegisterFromPreviews: () => void;
  onRemoveHandler: (packageId: string) => void;
  policy: AgentSkillInstalledPackageRuntimePolicy;
  previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry;
  registry: AgentSkillExecutableHandlerRegistry;
  trustedPackageIds?: readonly string[];
}) {
  const guardReport = createAgentSkillExecutableHandlerGuardReport(
    installedRegistry,
    policy,
    previewRegistry,
    { trustedPackageIds },
  );
  const registerableCount = guardReport.summary.registerable;

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <Plug className="h-3 w-3 text-primary" />
          Executable handler registry
        </div>
        <Button type="button" variant="outline" size="xs" disabled={!registerableCount} onClick={onRegisterFromPreviews}>
          Register {registerableCount}
        </Button>
      </div>
      <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
        {installedRegistry.packages.length ? installedRegistry.packages.map((item) => {
          const handler = getHandler(registry, item.id);
          const guardRow = guardReport.rows.find((row) => row.packageId === item.id);
          return (
            <div key={item.id} className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-mono text-3xs text-foreground">{item.skillId}</div>
                  <div className="truncate text-3xs text-muted-foreground">
                    {handler ? `${handler.loaderKind} / ${handler.registeredAt}` : guardRow?.guardIssueCodes.join(', ') || 'not registered'}
                  </div>
                </div>
                {handler ? (
                  <Button type="button" variant="ghost" size="icon-xs" title="Remove executable handler" onClick={() => onRemoveHandler(item.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                ) : (
                  <div className="shrink-0 font-mono text-3xs text-muted-foreground">{guardRow?.status ?? 'missing'}</div>
                )}
              </div>
            </div>
          );
        }) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No installed packages can register executable handlers.
          </div>
        )}
      </div>
    </div>
  );
}
