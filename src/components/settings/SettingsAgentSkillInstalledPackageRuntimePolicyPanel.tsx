import { ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillInstalledPackageRuntimePolicy,
  type AgentSkillInstalledPackageRuntimePolicyPatch,
} from '../../agent';

function getPolicyRecord(policy: AgentSkillInstalledPackageRuntimePolicy, packageId: string) {
  return policy.records.find((record) => record.packageId === packageId) ?? null;
}

function createTogglePatch(
  key: keyof AgentSkillInstalledPackageRuntimePolicyPatch,
  enabled: boolean,
): AgentSkillInstalledPackageRuntimePolicyPatch {
  return { [key]: enabled };
}

export function SettingsAgentSkillInstalledPackageRuntimePolicyPanel({
  onClearRecord,
  onSetRecord,
  policy,
  registry,
}: {
  onClearRecord: (packageId: string) => void;
  onSetRecord: (packageId: string, patch: AgentSkillInstalledPackageRuntimePolicyPatch) => void;
  policy: AgentSkillInstalledPackageRuntimePolicy;
  registry: AgentSkillInstalledPackageRegistry;
}) {
  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <ShieldCheck className="h-3 w-3 text-primary" />
          Runtime policy
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          policy {policy.records.length} / installed {registry.packages.length}
        </div>
      </div>
      <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
        {registry.packages.length ? registry.packages.map((item) => {
          const record = getPolicyRecord(policy, item.id);
          return (
            <div key={item.id} className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="min-w-0 truncate font-mono text-3xs text-foreground">{item.skillId}</div>
                <Button type="button" variant="ghost" size="icon-xs" title="Clear runtime policy" onClick={() => onClearRecord(item.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {(['trusted', 'runtimeEnabled', 'sandboxed'] as const).map((key) => (
                  <Button
                    key={key}
                    type="button"
                    variant={record?.[key] ? 'default' : 'outline'}
                    size="xs"
                    onClick={() => onSetRecord(item.id, createTogglePatch(key, !record?.[key]))}
                  >
                    {key}
                  </Button>
                ))}
              </div>
              <div className="mt-1 truncate text-3xs text-muted-foreground">
                reviewed {record?.reviewedAt ?? 'never'} / executable handler still separate
              </div>
            </div>
          );
        }) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No installed packages need runtime policy.
          </div>
        )}
      </div>
    </div>
  );
}
