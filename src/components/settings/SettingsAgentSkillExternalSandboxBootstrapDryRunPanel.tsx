import { FlaskConical } from 'lucide-react';
import {
  createAgentSkillExternalSandboxBootstrapDryRunReport,
  type AgentSkillExternalSandboxBootstrapDryRunStatus,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillInstalledPackageRuntimePolicy,
  type AgentSkillPackageSignatureVerifier,
  type AgentSkillTrustEvidenceRegistry,
} from '../../agent';

const STATUS_CLASS: Record<AgentSkillExternalSandboxBootstrapDryRunStatus, string> = {
  blocked: 'text-red-400',
  'ready-if-loader-enabled': 'text-primary',
};

function formatIssue(codes: readonly string[]) {
  return codes[0] ? `${codes[0]}${codes.length > 1 ? ` +${codes.length - 1}` : ''}` : 'no-issues';
}

export function SettingsAgentSkillExternalSandboxBootstrapDryRunPanel({
  contractCodes,
  evidenceCodes,
  evidenceRegistry,
  installedRegistry,
  policy,
  signatureVerifier,
  trustedPackageIds,
}: {
  contractCodes?: readonly string[];
  evidenceCodes?: readonly string[];
  evidenceRegistry: AgentSkillTrustEvidenceRegistry;
  installedRegistry: AgentSkillInstalledPackageRegistry;
  policy: AgentSkillInstalledPackageRuntimePolicy;
  signatureVerifier?: AgentSkillPackageSignatureVerifier | null;
  trustedPackageIds?: readonly string[];
}) {
  const report = createAgentSkillExternalSandboxBootstrapDryRunReport(
    installedRegistry,
    policy,
    evidenceRegistry,
    { contractCodes, evidenceCodes, signatureVerifier, trustedPackageIds },
  );

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <FlaskConical className="h-3 w-3 text-primary" />
          Sandbox bootstrap dry-run
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          ready {report.summary['ready-if-loader-enabled']} / blocked {report.summary.blocked} / attempted {report.summary.attempted}
        </div>
      </div>
      <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
        {report.rows.length ? report.rows.map((row) => (
          <div key={row.packageId} className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 truncate font-mono text-3xs text-foreground">{row.skillId}</div>
              <div className={`shrink-0 font-mono text-3xs ${STATUS_CLASS[row.status]}`}>{row.status}</div>
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              attempted {String(row.attempted)} / loader {row.loaderState} / {row.sandboxProfile}
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              contract {row.contractStatus} / {formatIssue(row.issueCodes)}
            </div>
          </div>
        )) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No sandbox bootstrap dry-run rows.
          </div>
        )}
      </div>
    </div>
  );
}
