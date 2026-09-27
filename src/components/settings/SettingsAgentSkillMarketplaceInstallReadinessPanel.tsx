import { useMemo, useState } from 'react';
import { Store } from 'lucide-react';
import {
  createAgentSkillMarketplaceIdentityMetadataPreviewReport,
  createAgentSkillMarketplaceInstallReadinessPreviewReport,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillMarketplaceInstallReadinessRow,
  type AgentSkillMarketplaceInstallReadinessStatus,
  type AgentSkillPackageDraftLibrary,
  type AgentSkillPackageSignatureVerifier,
} from '../../agent';

const STATUS_CLASS: Record<AgentSkillMarketplaceInstallReadinessStatus, string> = {
  blocked: 'text-red-400',
  'install-ready-if-marketplace-enabled': 'text-primary',
  'review-required': 'text-amber-500',
};

function formatIssue(codes: readonly string[]) {
  return codes[0] ? `${codes[0]}${codes.length > 1 ? ` +${codes.length - 1}` : ''}` : 'no-issues';
}

function SettingsAgentSkillMarketplaceIdentityInput({
  identityJson,
  onChange,
  parseError,
  readyCount,
}: {
  identityJson: string;
  onChange: (value: string) => void;
  parseError: string | null;
  readyCount: number;
}) {
  return (
    <div className="mb-2 grid gap-2 sm:grid-cols-[1fr_auto]">
      <textarea
        className="h-16 resize-y rounded-sm border border-border bg-background/50 p-2 font-mono text-3xs text-foreground outline-none"
        placeholder="Paste agent-skill-marketplace-identity-metadata.v1 JSON"
        spellCheck={false}
        value={identityJson}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1 font-mono text-3xs text-muted-foreground">
        identity ready {readyCount}
        <br />
        {parseError ?? 'metadata preview idle'}
      </div>
    </div>
  );
}

function SettingsAgentSkillMarketplaceInstallReadinessRowCard({
  row,
}: {
  row: AgentSkillMarketplaceInstallReadinessRow;
}) {
  return (
    <div className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 truncate font-mono text-3xs text-foreground">{row.skillId}</div>
        <div className={`shrink-0 font-mono text-3xs ${STATUS_CLASS[row.status]}`}>{row.status}</div>
      </div>
      <div className="truncate text-3xs text-muted-foreground">
        source {row.sourceIdentity} / review {row.reviewStatus} / signature {row.signatureStatus}
      </div>
      <div className="truncate text-3xs text-muted-foreground">
        download {String(row.downloadAttempted)} / install {String(row.installAttempted)} / {formatIssue(row.issueCodes)}
      </div>
    </div>
  );
}

export function SettingsAgentSkillMarketplaceInstallReadinessPanel({
  installedRegistry,
  library,
  signatureVerifier,
}: {
  installedRegistry: AgentSkillInstalledPackageRegistry;
  library: AgentSkillPackageDraftLibrary;
  signatureVerifier?: AgentSkillPackageSignatureVerifier | null;
}) {
  const [identityJson, setIdentityJson] = useState('');
  const identityReport = useMemo(
    () => createAgentSkillMarketplaceIdentityMetadataPreviewReport(identityJson, library),
    [identityJson, library],
  );
  const report = createAgentSkillMarketplaceInstallReadinessPreviewReport(
    library,
    installedRegistry,
    { identityRows: identityReport.rows, signatureVerifier },
  );

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <Store className="h-3 w-3 text-primary" />
          Marketplace install readiness
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          review {report.summary['review-required']} / blocked {report.summary.blocked} / install {report.summary.installAttempted}
        </div>
      </div>
      <SettingsAgentSkillMarketplaceIdentityInput
        identityJson={identityJson}
        onChange={setIdentityJson}
        parseError={identityReport.parseError}
        readyCount={identityReport.summary.ready}
      />
      <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
        {report.rows.length ? report.rows.map((row) => (
          <SettingsAgentSkillMarketplaceInstallReadinessRowCard key={row.candidateDraftId} row={row} />
        )) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No marketplace install readiness rows.
          </div>
        )}
      </div>
    </div>
  );
}
