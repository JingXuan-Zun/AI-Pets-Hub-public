import { FileSearch } from 'lucide-react';
import {
  createAgentSkillInstalledPackageLoaderBoundaryReport,
  createAgentSkillInstalledPackageRuntimeMetadataReport,
  createAgentSkillInstalledPackageRuntimePreflightReport,
  type AgentSkillInstalledPackageLoaderBoundaryStatus,
  type AgentSkillInstalledPackageLoaderBoundaryOptions,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillInstalledPackageRuntimeMetadataStatus,
  type AgentSkillInstalledPackageRuntimePreflightOptions,
  type AgentSkillInstalledPackageRuntimePreflightStatus,
} from '../../agent';

const STATUS_CLASS: Record<AgentSkillInstalledPackageRuntimeMetadataStatus, string> = {
  'metadata-ready': 'text-primary',
  'runtime-disabled': 'text-amber-500',
  'unknown-skill': 'text-red-400',
};

const PREFLIGHT_STATUS_CLASS: Record<AgentSkillInstalledPackageRuntimePreflightStatus, string> = {
  blocked: 'text-red-400',
  'preflight-passed': 'text-primary',
  'review-required': 'text-amber-500',
};

const LOADER_STATUS_CLASS: Record<AgentSkillInstalledPackageLoaderBoundaryStatus, string> = {
  'execution-ready': 'text-primary',
  'metadata-only': 'text-amber-500',
  'review-required': 'text-amber-500',
  unavailable: 'text-red-400',
};

export function SettingsAgentSkillInstalledPackageRuntimeMetadataPanel({
  policyOptions,
  registry,
}: {
  policyOptions?: AgentSkillInstalledPackageRuntimePreflightOptions & AgentSkillInstalledPackageLoaderBoundaryOptions;
  registry: AgentSkillInstalledPackageRegistry;
}) {
  const report = createAgentSkillInstalledPackageRuntimeMetadataReport(registry);
  const preflightReport = createAgentSkillInstalledPackageRuntimePreflightReport(registry, policyOptions);
  const loaderReport = createAgentSkillInstalledPackageLoaderBoundaryReport(registry, {
    executableHandlerPackageIds: policyOptions?.loaderPackageIds,
    previewHandlerPackageIds: policyOptions?.handlerPreviewPackageIds,
    runtimeEnabledPackageIds: policyOptions?.runtimeEnabledPackageIds,
    sandboxedPackageIds: policyOptions?.sandboxedPackageIds,
    trustedPackageIds: policyOptions?.trustedPackageIds,
  });

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <FileSearch className="h-3 w-3 text-primary" />
          Runtime metadata
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          ready {report.summary['metadata-ready']} / disabled {report.summary['runtime-disabled']} / unknown {report.summary['unknown-skill']}
        </div>
      </div>
      <div className="max-h-28 space-y-1 overflow-y-auto pr-1">
        {report.rows.length ? report.rows.map((row) => (
          <div key={row.packageId} className="flex items-center justify-between gap-2 rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
            <div className="min-w-0">
              <div className="truncate font-mono text-3xs text-foreground">{row.skillId}</div>
              <div className="truncate text-3xs text-muted-foreground">
                {row.registryVersion ?? 'unknown'} / {row.runtime} / {row.installStatus}
              </div>
            </div>
            <div className={`shrink-0 font-mono text-3xs ${STATUS_CLASS[row.status]}`}>{row.status}</div>
          </div>
        )) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No installed package metadata.
          </div>
        )}
      </div>
      <div className="mt-2 rounded-sm border border-border/60 bg-secondary/10 p-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="font-mono text-3xs uppercase tracking-widest text-muted-foreground">
            Runtime preflight
          </div>
          <div className="font-mono text-3xs text-muted-foreground">
            passed {preflightReport.summary['preflight-passed']} / review {preflightReport.summary['review-required']} / blocked {preflightReport.summary.blocked}
          </div>
        </div>
        <div className="max-h-28 space-y-1 overflow-y-auto pr-1">
          {preflightReport.rows.length ? preflightReport.rows.map((row) => (
            <div key={row.packageId} className="rounded-sm border border-border/60 bg-background/25 px-2 py-1">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 truncate font-mono text-3xs text-foreground">{row.skillId}</div>
                <div className={`shrink-0 font-mono text-3xs ${PREFLIGHT_STATUS_CLASS[row.status]}`}>{row.status}</div>
              </div>
              <div className="truncate text-3xs text-muted-foreground">
                trust {row.trustState} / sandbox {row.sandboxBoundary} / handler {row.handlerSource} / {row.permissionRoute}
              </div>
              {row.issues[0] ? (
                <div className="truncate text-3xs text-muted-foreground">
                  {row.issues[0].code}{row.issues.length > 1 ? ` +${row.issues.length - 1}` : ''}
                </div>
              ) : null}
            </div>
          )) : (
            <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
              No runtime preflight rows.
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 rounded-sm border border-border/60 bg-secondary/10 p-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="font-mono text-3xs uppercase tracking-widest text-muted-foreground">
            Loader boundary
          </div>
          <div className="font-mono text-3xs text-muted-foreground">
            ready {loaderReport.summary['execution-ready']} / metadata {loaderReport.summary['metadata-only']} / unavailable {loaderReport.summary.unavailable}
          </div>
        </div>
        <div className="max-h-28 space-y-1 overflow-y-auto pr-1">
          {loaderReport.rows.length ? loaderReport.rows.map((row) => (
            <div key={row.packageId} className="rounded-sm border border-border/60 bg-background/25 px-2 py-1">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 truncate font-mono text-3xs text-foreground">{row.boundaryId ?? row.runtime}</div>
                <div className={`shrink-0 font-mono text-3xs ${LOADER_STATUS_CLASS[row.status]}`}>{row.status}</div>
              </div>
              <div className="truncate text-3xs text-muted-foreground">
                {row.skillId} / {row.boundaryMode} / handler {row.handlerRegistration}
              </div>
              <div className="truncate text-3xs text-muted-foreground">
                {row.permissionBoundary} / {row.sandboxBoundary}
              </div>
            </div>
          )) : (
            <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
              No loader boundary rows.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
