import { Gauge } from 'lucide-react';
import {
  createAgentSkillInstalledPackageRuntimeReadinessDashboard,
  type AgentSkillInstalledPackageHandlerPreviewRegistry,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillInstalledPackageRuntimePolicy,
  type AgentSkillInstalledPackageRuntimeReadinessStatus,
} from '../../agent';

const STATUS_CLASS: Record<AgentSkillInstalledPackageRuntimeReadinessStatus, string> = {
  blocked: 'text-red-400',
  'execution-ready': 'text-primary',
  'handler-preview': 'text-amber-500',
  'policy-ready': 'text-amber-500',
  unavailable: 'text-red-400',
};

export function SettingsAgentSkillInstalledPackageRuntimeReadinessPanel({
  executableHandlerPackageIds,
  handlerPreviews,
  policy,
  registry,
  trustedPackageIds,
}: {
  executableHandlerPackageIds?: readonly string[];
  handlerPreviews: AgentSkillInstalledPackageHandlerPreviewRegistry;
  policy: AgentSkillInstalledPackageRuntimePolicy;
  registry: AgentSkillInstalledPackageRegistry;
  trustedPackageIds?: readonly string[];
}) {
  const dashboard = createAgentSkillInstalledPackageRuntimeReadinessDashboard(
    registry,
    policy,
    handlerPreviews,
    { executableHandlerPackageIds, trustedPackageIds },
  );

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <Gauge className="h-3 w-3 text-primary" />
          Runtime readiness
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          ready {dashboard.summary['execution-ready']} / preview {dashboard.summary['handler-preview']} / blocked {dashboard.summary.blocked}
        </div>
      </div>
      <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
        {dashboard.rows.length ? dashboard.rows.map((row) => (
          <div key={row.packageId} className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 truncate font-mono text-3xs text-foreground">{row.skillId}</div>
              <div className={`shrink-0 font-mono text-3xs ${STATUS_CLASS[row.status]}`}>{row.status}</div>
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              policy t:{row.policyFlags.trusted ? '1' : '0'} r:{row.policyFlags.runtimeEnabled ? '1' : '0'} s:{row.policyFlags.sandboxed ? '1' : '0'} / handler {row.handlerRegistration} / contract {row.contractStatus}
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              {row.boundaryId ?? row.runtime} / {row.preflightIssueCodes[0] ?? 'no-issues'}
            </div>
          </div>
        )) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No runtime readiness rows.
          </div>
        )}
      </div>
    </div>
  );
}
