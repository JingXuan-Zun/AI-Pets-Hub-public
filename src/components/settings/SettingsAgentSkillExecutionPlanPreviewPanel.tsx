import { FileJson } from 'lucide-react';
import {
  createAgentSkillExecutionPlanPreview,
  type AgentSkillInstalledPackageHandlerPreviewRegistry,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillInstalledPackageRuntimePolicy,
} from '../../agent';

export function SettingsAgentSkillExecutionPlanPreviewPanel({
  executableHandlerPackageIds,
  installedRegistry,
  policy,
  previewRegistry,
  trustedPackageIds,
}: {
  executableHandlerPackageIds?: readonly string[];
  installedRegistry: AgentSkillInstalledPackageRegistry;
  policy: AgentSkillInstalledPackageRuntimePolicy;
  previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry;
  trustedPackageIds?: readonly string[];
}) {
  const preview = createAgentSkillExecutionPlanPreview(
    installedRegistry,
    policy,
    previewRegistry,
    'preview',
    { executableHandlerPackageIds, trustedPackageIds },
  );

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <FileJson className="h-3 w-3 text-primary" />
          Execution plan preview
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          planned {preview.summary.planned} / blocked {preview.summary.blocked}
        </div>
      </div>
      <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
        {preview.rows.length ? preview.rows.map((row) => (
          <div key={row.packageId} className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 truncate font-mono text-3xs text-foreground">{row.skillId}</div>
              <div className={`shrink-0 font-mono text-3xs ${row.planned ? 'text-primary' : 'text-red-400'}`}>
                {row.planned ? 'planned' : 'blocked'}
              </div>
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              {row.boundaryId ?? 'no-boundary'} / contract {row.contractStatus} / {row.guardIssueCodes[0] ?? 'guard-passed'}
            </div>
          </div>
        )) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No execution plan preview rows.
          </div>
        )}
      </div>
    </div>
  );
}
