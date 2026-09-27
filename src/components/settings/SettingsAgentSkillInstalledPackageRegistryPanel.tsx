import { HardDriveDownload, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  type AgentSkillPackageExport,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillPackageDraftLibrary,
} from '../../agent';

function getPublisherId(packageValue: AgentSkillPackageExport) {
  const publisher = (packageValue as unknown as { publisher?: { id?: unknown } }).publisher;
  return typeof publisher?.id === 'string' && publisher.id.trim() ? publisher.id.trim() : 'local';
}

export function SettingsAgentSkillInstalledPackageRegistryPanel({
  draftLibrary,
  registry,
  onInstallEnabledDrafts,
  onRemoveInstalledPackage,
}: {
  draftLibrary: AgentSkillPackageDraftLibrary;
  registry: AgentSkillInstalledPackageRegistry;
  onInstallEnabledDrafts: () => void;
  onRemoveInstalledPackage: (packageId: string) => void;
}) {
  const enabledDraftCount = draftLibrary.drafts.filter((draft) => draft.enabled).length;

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <HardDriveDownload className="h-3 w-3 text-primary" />
          Installed package registry
        </div>
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={!enabledDraftCount}
          onClick={onInstallEnabledDrafts}
        >
          Gate enabled
        </Button>
      </div>
      <div className="mb-2 font-mono text-3xs text-muted-foreground">
        installed {registry.packages.length} / enabled drafts {enabledDraftCount} / runtime disabled by default
      </div>
      <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
        {registry.packages.length ? registry.packages.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
            <div className="min-w-0">
              <div className="truncate font-mono text-3xs text-foreground">{item.skillId}</div>
              <div className="truncate text-3xs text-muted-foreground">
                {getPublisherId(item.package)} / {item.id} / {item.package.scaffold.package.version}
              </div>
              <div className="truncate text-3xs text-muted-foreground">
                runtime {item.runtimeEnabled ? 'enabled' : 'disabled'} / {item.installedAt}
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon-xs" title="Uninstall or remove package" onClick={() => onRemoveInstalledPackage(item.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No installed package records.
          </div>
        )}
      </div>
    </div>
  );
}
