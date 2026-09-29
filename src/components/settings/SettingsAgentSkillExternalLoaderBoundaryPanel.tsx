import { LockKeyhole } from 'lucide-react';
import {
  createAgentSkillExternalPackageLoaderBoundaryReport,
  type AgentSkillExternalPackageLoaderBoundaryReadinessStatus,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillInstalledPackageRuntimePolicy,
  type AgentSkillPackageSignatureVerifier,
  type AgentSkillTrustEvidenceRegistry,
} from '../../agent';

const STATUS_CLASS: Record<AgentSkillExternalPackageLoaderBoundaryReadinessStatus, string> = {
  blocked: 'text-red-400',
  'ready-if-loader-enabled': 'text-primary',
  'review-required': 'text-amber-500',
};

function formatIssue(codes: readonly string[]) {
  return codes[0] ? `${codes[0]}${codes.length > 1 ? ` +${codes.length - 1}` : ''}` : 'no-issues';
}

export function SettingsAgentSkillExternalLoaderBoundaryPanel({
  evidenceRegistry,
  installedRegistry,
  policy,
  signatureVerifier,
  trustedPackageIds,
}: {
  evidenceRegistry: AgentSkillTrustEvidenceRegistry;
  installedRegistry: AgentSkillInstalledPackageRegistry;
  policy: AgentSkillInstalledPackageRuntimePolicy;
  signatureVerifier?: AgentSkillPackageSignatureVerifier | null;
  trustedPackageIds?: readonly string[];
}) {
  const report = createAgentSkillExternalPackageLoaderBoundaryReport(
    installedRegistry,
    policy,
    evidenceRegistry,
    { signatureVerifier, trustedPackageIds },
  );

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <LockKeyhole className="h-3 w-3 text-primary" />
          External loader boundary
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          disabled {report.summary.disabled} / ready {report.summary['ready-if-loader-enabled']} / blocked {report.summary.blocked}
        </div>
      </div>
      <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
        {report.rows.length ? report.rows.map((row) => (
          <div key={row.packageId} className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 truncate font-mono text-3xs text-foreground">{row.skillId}</div>
              <div className={`shrink-0 font-mono text-3xs ${STATUS_CLASS[row.readinessStatus]}`}>
                {row.readinessStatus}
              </div>
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              loader {row.loaderState} / {row.boundaryMode} / {row.permissionBoundary}
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              signature {row.signatureStatus} / trust {row.trustEvidenceStatus} / sandbox {row.sandboxBoundary}
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              {formatIssue(row.blockingIssueCodes)}
            </div>
          </div>
        )) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No external loader boundary rows.
          </div>
        )}
      </div>
    </div>
  );
}
