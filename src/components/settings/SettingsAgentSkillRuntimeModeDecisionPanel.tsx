import { Route } from 'lucide-react';
import {
  createAgentSkillRuntimeModeDecisionReport,
  type AgentSkillExecutableHandlerRegistry,
  type AgentSkillInstalledPackageHandlerPreviewRegistry,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillInstalledPackageRuntimePolicy,
  type AgentSkillPackageSignatureVerifier,
  type AgentSkillRuntimeModeDecisionStatus,
  type AgentSkillTrustEvidenceRegistry,
} from '../../agent';

const STATUS_CLASS: Record<AgentSkillRuntimeModeDecisionStatus, string> = {
  blocked: 'text-red-400',
  'local-resolver-active': 'text-primary',
  'local-resolver-registerable': 'text-amber-500',
};

function formatIssues(issues: string[]) {
  return issues[0]
    ? `${issues[0]}${issues.length > 1 ? ` +${issues.length - 1}` : ''}`
    : 'no-issues';
}

export function SettingsAgentSkillRuntimeModeDecisionPanel({
  executableHandlerRegistry,
  evidenceRegistry,
  installedRegistry,
  policy,
  previewRegistry,
  signatureVerifier,
  trustedPackageIds,
}: {
  executableHandlerRegistry: AgentSkillExecutableHandlerRegistry;
  evidenceRegistry: AgentSkillTrustEvidenceRegistry;
  installedRegistry: AgentSkillInstalledPackageRegistry;
  policy: AgentSkillInstalledPackageRuntimePolicy;
  previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry;
  signatureVerifier?: AgentSkillPackageSignatureVerifier | null;
  trustedPackageIds?: readonly string[];
}) {
  const report = createAgentSkillRuntimeModeDecisionReport(
    installedRegistry,
    policy,
    previewRegistry,
    evidenceRegistry,
    { executableHandlerRegistry, signatureVerifier, trustedPackageIds },
  );

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <Route className="h-3 w-3 text-primary" />
          Runtime mode decision
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          active {report.summary['local-resolver-active']} / ready {report.summary['local-resolver-registerable']} / blocked {report.summary.blocked}
        </div>
      </div>
      <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
        {report.rows.length ? report.rows.map((row) => (
          <div key={row.packageId} className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 truncate font-mono text-3xs text-foreground">{row.skillId}</div>
              <div className={`shrink-0 font-mono text-3xs ${STATUS_CLASS[row.status]}`}>{row.status}</div>
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              mode {row.activeMode} / local {row.localResolverStatus} / external {row.externalPackageStatus}
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              signature {row.signatureStatus} / trust {row.trustEvidenceStatus} / boundary {row.boundaryStatus} / scope {row.scopeStatus}
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              local {formatIssues(row.localResolverIssueCodes)} / external {formatIssues(row.externalPackageIssueCodes)}
            </div>
          </div>
        )) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No installed packages need runtime mode decisions.
          </div>
        )}
      </div>
    </div>
  );
}
