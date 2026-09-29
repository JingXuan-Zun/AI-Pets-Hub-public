import { BadgeCheck } from 'lucide-react';
import {
  createAgentSkillPackageSignatureVerificationReport,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillPackageSignatureStatus,
  type AgentSkillPackageSignatureVerifier,
} from '../../agent';

const STATUS_CLASS: Record<AgentSkillPackageSignatureStatus, string> = {
  blocked: 'text-red-400',
  invalid: 'text-red-400',
  unsigned: 'text-amber-500',
  unverified: 'text-amber-500',
  verified: 'text-primary',
};

export function SettingsAgentSkillPackageSignatureVerificationPanel({
  registry,
  verifier,
  verifierIssueCodes = [],
}: {
  registry: AgentSkillInstalledPackageRegistry;
  verifier?: AgentSkillPackageSignatureVerifier | null;
  verifierIssueCodes?: readonly string[];
}) {
  const report = createAgentSkillPackageSignatureVerificationReport(registry, { verifier });
  const verifierStatus = verifier?.verifier ?? verifierIssueCodes[0] ?? 'verifier-missing';

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <BadgeCheck className="h-3 w-3 text-primary" />
          Signature verification
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          verified {report.summary.verified} / unsigned {report.summary.unsigned} / invalid {report.summary.invalid} / blocked {report.summary.blocked}
        </div>
      </div>
      <div className="mb-1 truncate font-mono text-3xs text-muted-foreground">provider {verifierStatus}</div>
      <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
        {report.rows.length ? report.rows.map((row) => (
          <div key={row.packageId} className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 truncate font-mono text-3xs text-foreground">{row.skillId}</div>
              <div className={`shrink-0 font-mono text-3xs ${STATUS_CLASS[row.status]}`}>{row.status}</div>
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              verifier {row.verifier} / {row.metadata?.algorithm || 'no-algorithm'} / {row.metadata?.keyId || 'no-key'}
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              {row.issueCodes[0] ?? 'no-issues'}
            </div>
          </div>
        )) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No installed packages need signature checks.
          </div>
        )}
      </div>
    </div>
  );
}
