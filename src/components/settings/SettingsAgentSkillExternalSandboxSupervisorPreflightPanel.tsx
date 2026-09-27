import { ClipboardCheck } from 'lucide-react';
import {
  createAgentSkillExternalSandboxBootstrapProcessProfile,
  createAgentSkillExternalSandboxSupervisorContract,
  createAgentSkillExternalSandboxSupervisorPreflightReport,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillInstalledPackageRuntimePolicy,
  type AgentSkillPackageSignatureVerifier,
  type AgentSkillExternalSandboxSupervisorPreflightRow,
  type AgentSkillTrustEvidenceRegistry,
} from '../../agent';

function formatIssue(codes: readonly string[]) {
  return codes[0] ? `${codes[0]}${codes.length > 1 ? ` +${codes.length - 1}` : ''}` : 'no-issues';
}

function SettingsAgentSkillExternalSandboxSupervisorPreflightRowCard({
  row,
}: {
  row: AgentSkillExternalSandboxSupervisorPreflightRow;
}) {
  return (
    <div className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 truncate font-mono text-3xs text-foreground">{row.skillId}</div>
        <div className="shrink-0 font-mono text-3xs text-primary">{row.status}</div>
      </div>
      <div className="truncate text-3xs text-muted-foreground">
        start {row.startStatus} / launch {String(row.supervisorLaunchAttempted)} / spawn {String(row.spawnAttempted)}
      </div>
      <div className="truncate text-3xs text-muted-foreground">
        contract {row.contractCodes.length}/{row.requiredContractCodes.length} / {formatIssue(row.issueCodes)}
      </div>
    </div>
  );
}

export function SettingsAgentSkillExternalSandboxSupervisorPreflightPanel({
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
  const report = createAgentSkillExternalSandboxSupervisorPreflightReport(
    installedRegistry,
    policy,
    evidenceRegistry,
    {
      contractCodes,
      evidenceCodes,
      processProfile: createAgentSkillExternalSandboxBootstrapProcessProfile(),
      signatureVerifier,
      supervisorContract: createAgentSkillExternalSandboxSupervisorContract(),
      trustedPackageIds,
    },
  );

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <ClipboardCheck className="h-3 w-3 text-primary" />
          Sandbox supervisor preflight
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          ready {report.summary['supervisor-ready-if-bootstrap-enabled']} / launch {report.summary.supervisorLaunchAttempted}
        </div>
      </div>
      <div className="max-h-28 space-y-1 overflow-y-auto pr-1">
        {report.rows.length ? report.rows.map((row) => (
          <SettingsAgentSkillExternalSandboxSupervisorPreflightRowCard key={row.packageId} row={row} />
        )) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No sandbox supervisor preflight rows.
          </div>
        )}
      </div>
    </div>
  );
}
