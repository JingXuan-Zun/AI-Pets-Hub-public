import { PowerOff } from 'lucide-react';
import {
  createAgentSkillExternalSandboxBootstrapProcessProfile,
  createAgentSkillExternalSandboxBootstrapStartReport,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillInstalledPackageRuntimePolicy,
  type AgentSkillPackageSignatureVerifier,
  type AgentSkillTrustEvidenceRegistry,
} from '../../agent';

function formatIssue(codes: readonly string[]) {
  return codes[0] ? `${codes[0]}${codes.length > 1 ? ` +${codes.length - 1}` : ''}` : 'no-issues';
}

export function SettingsAgentSkillExternalSandboxBootstrapStartPanel({
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
  const report = createAgentSkillExternalSandboxBootstrapStartReport(
    installedRegistry,
    policy,
    evidenceRegistry,
    {
      contractCodes,
      evidenceCodes,
      processProfile: createAgentSkillExternalSandboxBootstrapProcessProfile(),
      signatureVerifier,
      trustedPackageIds,
    },
  );

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <PowerOff className="h-3 w-3 text-primary" />
          Sandbox bootstrap start
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          blocked {report.summary['blocked-disabled']} / spawn {report.summary.spawnAttempted}
        </div>
      </div>
      <div className="max-h-28 space-y-1 overflow-y-auto pr-1">
        {report.rows.length ? report.rows.map((row) => (
          <div key={row.packageId} className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 truncate font-mono text-3xs text-foreground">{row.skillId}</div>
              <div className="shrink-0 font-mono text-3xs text-red-400">{row.status}</div>
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              flag {String(row.featureFlagEnabled)} / spawn {String(row.spawnAttempted)} / import {String(row.packageImportAttempted)}
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              process {row.processProfileStatus} / {formatIssue(row.issueCodes)}
            </div>
          </div>
        )) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No sandbox bootstrap start rows.
          </div>
        )}
      </div>
    </div>
  );
}
