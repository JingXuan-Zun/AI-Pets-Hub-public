import { ScanSearch } from 'lucide-react';
import {
  createAgentSkillExecutionScopeReport,
  type AgentSkillExecutionScopeStatus,
  type AgentSkillInstalledPackageHandlerPreviewRegistry,
  type AgentSkillInstalledPackageLoaderBoundaryOptions,
  type AgentSkillInstalledPackageRegistry,
} from '../../agent';

const STATUS_CLASS: Record<AgentSkillExecutionScopeStatus, string> = {
  blocked: 'text-red-400',
  'review-required': 'text-amber-500',
  scoped: 'text-primary',
};

export function SettingsAgentSkillExecutionScopePanel({
  installedRegistry,
  loaderOptions,
  previewRegistry,
}: {
  installedRegistry: AgentSkillInstalledPackageRegistry;
  loaderOptions: AgentSkillInstalledPackageLoaderBoundaryOptions;
  previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry;
}) {
  const report = createAgentSkillExecutionScopeReport(installedRegistry, previewRegistry, loaderOptions);

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <ScanSearch className="h-3 w-3 text-primary" />
          Execution scope
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          scoped {report.summary.scoped} / review {report.summary['review-required']} / blocked {report.summary.blocked}
        </div>
      </div>
      <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
        {report.rows.length ? report.rows.map((row) => (
          <div key={row.packageId} className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 truncate font-mono text-3xs text-foreground">{row.skillId}</div>
              <div className={`shrink-0 font-mono text-3xs ${STATUS_CLASS[row.status]}`}>{row.status}</div>
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              inputs {row.packageInputKeys.length}/{row.allowedInputKeys.length} / contract {row.contractStatus} / boundary {row.boundaryStatus}
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              {row.permissionScope} / {row.sandboxBoundary}
            </div>
            {row.issues[0] ? (
              <div className="truncate text-3xs text-muted-foreground">
                {row.issues[0].code}{row.issues.length > 1 ? ` +${row.issues.length - 1}` : ''}
              </div>
            ) : null}
          </div>
        )) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No execution scope rows.
          </div>
        )}
      </div>
    </div>
  );
}
