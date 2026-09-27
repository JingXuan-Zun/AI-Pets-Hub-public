import { Cable } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  createAgentSkillExternalLoaderIpcContractPreviewReport,
  getAgentSkillExternalLoaderRequiredIpcContractCodes,
  type AgentSkillExternalLoaderIpcContractStatus,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillInstalledPackageRuntimePolicy,
  type AgentSkillPackageSignatureVerifier,
  type AgentSkillTrustEvidenceRegistry,
} from '../../agent';

const STATUS_CLASS: Record<AgentSkillExternalLoaderIpcContractStatus, string> = {
  blocked: 'text-red-400',
  'contract-ready-if-loader-enabled': 'text-primary',
};

function formatIssue(codes: readonly string[]) {
  return codes[0] ? `${codes[0]}${codes.length > 1 ? ` +${codes.length - 1}` : ''}` : 'no-issues';
}

export function SettingsAgentSkillExternalLoaderIpcContractPanel({
  contractCodes = [],
  evidenceCodes,
  evidenceRegistry,
  installedRegistry,
  onSetContractCode,
  policy,
  signatureVerifier,
  trustedPackageIds,
}: {
  contractCodes?: readonly string[];
  evidenceCodes?: readonly string[];
  evidenceRegistry: AgentSkillTrustEvidenceRegistry;
  installedRegistry: AgentSkillInstalledPackageRegistry;
  onSetContractCode?: (code: string, enabled: boolean) => void;
  policy: AgentSkillInstalledPackageRuntimePolicy;
  signatureVerifier?: AgentSkillPackageSignatureVerifier | null;
  trustedPackageIds?: readonly string[];
}) {
  const report = createAgentSkillExternalLoaderIpcContractPreviewReport(
    installedRegistry,
    policy,
    evidenceRegistry,
    { contractCodes, evidenceCodes, signatureVerifier, trustedPackageIds },
  );
  const contractSet = new Set(contractCodes);

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <Cable className="h-3 w-3 text-primary" />
          External loader IPC contract
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          ready {report.summary['contract-ready-if-loader-enabled']} / blocked {report.summary.blocked}
        </div>
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {getAgentSkillExternalLoaderRequiredIpcContractCodes().map((code) => (
          <Button
            key={code}
            type="button"
            variant={contractSet.has(code) ? 'default' : 'outline'}
            size="xs"
            onClick={() => onSetContractCode?.(code, !contractSet.has(code))}
          >
            {code.replace('ipc-', '')}
          </Button>
        ))}
      </div>
      <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
        {report.rows.length ? report.rows.map((row) => (
          <div key={row.packageId} className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 truncate font-mono text-3xs text-foreground">{row.skillId}</div>
              <div className={`shrink-0 font-mono text-3xs ${STATUS_CLASS[row.status]}`}>{row.status}</div>
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              loader {row.loaderState} / sandbox {row.sandboxStatus}
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              contracts {row.contractCodes.length}/{row.requiredContractCodes.length} / {formatIssue(row.issueCodes)}
            </div>
          </div>
        )) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No external loader IPC rows.
          </div>
        )}
      </div>
    </div>
  );
}
