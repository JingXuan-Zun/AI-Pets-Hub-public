import { FileClock, Play } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  createAgentSkillSignedPackageUpdateApplicationPreviewReport,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillPackageDraftLibrary,
  type AgentSkillPackageSignatureVerifier,
  type AgentSkillSignedPackageUpdateApplicationPreviewRow,
  type AgentSkillSignedPackageUpdateApplicationPreviewStatus,
} from '../../agent';

const STATUS_CLASS: Record<AgentSkillSignedPackageUpdateApplicationPreviewStatus, string> = {
  blocked: 'text-red-400',
  'install-planned': 'text-primary',
  'replace-planned': 'text-primary',
  unchanged: 'text-muted-foreground',
};

function formatIssue(codes: readonly string[]) {
  return codes[0] ? `${codes[0]}${codes.length > 1 ? ` +${codes.length - 1}` : ''}` : 'no-issues';
}

function SettingsAgentSkillSignedPackageUpdateApplicationRowCard({
  row,
  onApplyMetadataUpdate,
}: {
  row: AgentSkillSignedPackageUpdateApplicationPreviewRow;
  onApplyMetadataUpdate: (candidateDraftId: string) => void;
}) {
  return (
    <div className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 truncate font-mono text-3xs text-foreground">{row.skillId}</div>
        <div className={`shrink-0 font-mono text-3xs ${STATUS_CLASS[row.status]}`}>{row.status}</div>
      </div>
      <div className="truncate text-3xs text-muted-foreground">
        action {row.plannedAction} / target {row.targetInstalledPackageId ?? 'new-install'}
      </div>
      <div className="truncate text-3xs text-muted-foreground">
        rollback {row.rollbackSnapshotId ?? 'none'} / {formatIssue(row.issueCodes)}
      </div>
      {row.plannedAction === 'install' || row.plannedAction === 'replace' ? (
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="mt-1 h-5 px-1.5 text-3xs"
          onClick={() => onApplyMetadataUpdate(row.candidateDraftId)}
        >
          <Play className="h-2.5 w-2.5" />
          Apply metadata
        </Button>
      ) : null}
    </div>
  );
}

export function SettingsAgentSkillSignedPackageUpdateApplicationPreviewPanel({
  installedRegistry,
  library,
  onApplyMetadataUpdate,
  signatureVerifier,
}: {
  installedRegistry: AgentSkillInstalledPackageRegistry;
  library: AgentSkillPackageDraftLibrary;
  onApplyMetadataUpdate: (candidateDraftId: string) => void;
  signatureVerifier?: AgentSkillPackageSignatureVerifier | null;
}) {
  const report = createAgentSkillSignedPackageUpdateApplicationPreviewReport(
    library,
    installedRegistry,
    { signatureVerifier },
  );

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <FileClock className="h-3 w-3 text-primary" />
          Signed update application preview
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          replace {report.summary['replace-planned']} / install {report.summary['install-planned']} / applied {report.summary.applicationAttempted}
        </div>
      </div>
      <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
        {report.rows.length ? report.rows.map((row) => (
          <SettingsAgentSkillSignedPackageUpdateApplicationRowCard
            key={row.candidateDraftId}
            row={row}
            onApplyMetadataUpdate={onApplyMetadataUpdate}
          />
        )) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No signed update application rows.
          </div>
        )}
      </div>
    </div>
  );
}
