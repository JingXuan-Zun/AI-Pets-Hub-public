import { RefreshCcwDot } from 'lucide-react';
import {
  createAgentSkillSignedPackageUpdatePreviewReport,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillPackageDraftLibrary,
  type AgentSkillPackageSignatureVerifier,
  type AgentSkillSignedPackageUpdatePreviewStatus,
} from '../../agent';

const STATUS_CLASS: Record<AgentSkillSignedPackageUpdatePreviewStatus, string> = {
  blocked: 'text-red-400',
  'install-ready': 'text-primary',
  unchanged: 'text-muted-foreground',
  'update-ready': 'text-primary',
};

function formatIssue(codes: readonly string[]) {
  return codes[0] ? `${codes[0]}${codes.length > 1 ? ` +${codes.length - 1}` : ''}` : 'no-issues';
}

export function SettingsAgentSkillSignedPackageUpdatePreviewPanel({
  installedRegistry,
  library,
  signatureVerifier,
}: {
  installedRegistry: AgentSkillInstalledPackageRegistry;
  library: AgentSkillPackageDraftLibrary;
  signatureVerifier?: AgentSkillPackageSignatureVerifier | null;
}) {
  const report = createAgentSkillSignedPackageUpdatePreviewReport(
    library,
    installedRegistry,
    { signatureVerifier },
  );

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <RefreshCcwDot className="h-3 w-3 text-primary" />
          Signed update preview
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          install {report.summary['install-ready']} / update {report.summary['update-ready']} / blocked {report.summary.blocked}
        </div>
      </div>
      <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
        {report.rows.length ? report.rows.map((row) => (
          <div key={row.candidateDraftId} className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 truncate font-mono text-3xs text-foreground">{row.skillId}</div>
              <div className={`shrink-0 font-mono text-3xs ${STATUS_CLASS[row.status]}`}>{row.status}</div>
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              candidate {row.candidateVersion} / installed {row.installedVersion ?? 'none'}
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              signature {row.signatureStatus} / {formatIssue(row.issueCodes)}
            </div>
          </div>
        )) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No enabled package drafts to preview.
          </div>
        )}
      </div>
    </div>
  );
}
