import { Download, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { type AgentSkillPackageLifecycleState } from '../../agent';

export function SettingsAgentSkillPackageRecoveryPanel({
  lifecycle,
  onCleanupUninstallSnapshots,
  onExportReceipts,
  onRestoreQuarantined,
  onRollbackUninstall,
}: {
  lifecycle: AgentSkillPackageLifecycleState;
  onCleanupUninstallSnapshots: () => void;
  onExportReceipts: () => void;
  onRestoreQuarantined: (packageId: string) => void;
  onRollbackUninstall: (snapshotId: string) => void;
}) {
  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <ShieldCheck className="h-3 w-3 text-primary" />
          Package recovery
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon-xs" title="Clean expired uninstall snapshots" onClick={onCleanupUninstallSnapshots}>
            <Trash2 className="h-3 w-3" />
          </Button>
          <Button type="button" variant="outline" size="icon-xs" title="Export lifecycle receipts" onClick={onExportReceipts}>
            <Download className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="space-y-1">
        {lifecycle.quarantinedPackages.map((item) => (
          <div key={item.package.id} className="flex items-center justify-between gap-2 rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
            <div className="min-w-0">
              <div className="truncate font-mono text-3xs text-foreground">{item.package.skillId}</div>
              <div className="truncate text-3xs text-muted-foreground">quarantined / {item.reasonCodes.join(', ') || 'unspecified'}</div>
            </div>
            <Button type="button" variant="outline" size="icon-xs" title="Reverify and restore package" onClick={() => onRestoreQuarantined(item.package.id)}>
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {lifecycle.uninstallSnapshots.map((snapshot) => (
          <div key={snapshot.id} className="flex items-center justify-between gap-2 rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
            <div className="min-w-0">
              <div className="truncate font-mono text-3xs text-foreground">{snapshot.package.skillId}</div>
              <div className="truncate text-3xs text-muted-foreground">uninstalled / rollback available / {snapshot.createdAt}</div>
            </div>
            <Button type="button" variant="outline" size="icon-xs" title="Rollback package uninstall" onClick={() => onRollbackUninstall(snapshot.id)}>
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {!lifecycle.quarantinedPackages.length && !lifecycle.uninstallSnapshots.length ? (
          <div className="rounded-sm border border-dashed border-border/70 px-2 py-2 text-center text-3xs text-muted-foreground">
            No package recovery actions.
          </div>
        ) : null}
      </div>
    </div>
  );
}
