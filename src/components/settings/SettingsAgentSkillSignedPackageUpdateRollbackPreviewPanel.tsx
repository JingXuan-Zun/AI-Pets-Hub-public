import { History, RotateCcw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  createAgentSkillSignedPackageUpdateRollbackPreviewReport,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillPackageLifecycleState,
  type AgentSkillPackageDraftLibrary,
  type AgentSkillPackageSignatureVerifier,
  type AgentSkillSignedPackageUpdateRollbackPreviewRow,
  type AgentSkillSignedPackageUpdateRollbackPreviewStatus,
} from '../../agent';

const STATUS_CLASS: Record<AgentSkillSignedPackageUpdateRollbackPreviewStatus, string> = {
  blocked: 'text-red-400',
  'not-needed': 'text-muted-foreground',
  'rollback-ready-if-applied': 'text-primary',
};

function formatIssue(codes: readonly string[]) {
  return codes[0] ? `${codes[0]}${codes.length > 1 ? ` +${codes.length - 1}` : ''}` : 'no-issues';
}

function SettingsAgentSkillSignedPackageUpdateRollbackRowCard({
  row,
}: {
  row: AgentSkillSignedPackageUpdateRollbackPreviewRow;
}) {
  return (
    <div className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 truncate font-mono text-3xs text-foreground">{row.skillId}</div>
        <div className={`shrink-0 font-mono text-3xs ${STATUS_CLASS[row.status]}`}>{row.status}</div>
      </div>
      <div className="truncate text-3xs text-muted-foreground">
        rollback {String(row.rollbackAttempted)} / audit {String(row.auditWritten)} / action {row.updateAction}
      </div>
      <div className="truncate text-3xs text-muted-foreground">
        receipt {row.auditReceiptId ?? 'none'} / {formatIssue(row.issueCodes)}
      </div>
    </div>
  );
}

export function SettingsAgentSkillSignedPackageUpdateRollbackPreviewPanel({
  installedRegistry,
  library,
  lifecycle,
  onRollbackMetadataUpdate,
  signatureVerifier,
}: {
  installedRegistry: AgentSkillInstalledPackageRegistry;
  library: AgentSkillPackageDraftLibrary;
  lifecycle: AgentSkillPackageLifecycleState;
  onRollbackMetadataUpdate: (snapshotId: string) => void;
  signatureVerifier?: AgentSkillPackageSignatureVerifier | null;
}) {
  const report = createAgentSkillSignedPackageUpdateRollbackPreviewReport(
    library,
    installedRegistry,
    { signatureVerifier },
  );

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <History className="h-3 w-3 text-primary" />
          Signed update rollback preview
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          ready {report.summary['rollback-ready-if-applied']} / audit {report.summary.auditWritten} / rollback {report.summary.rollbackAttempted}
        </div>
      </div>
      <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
        {lifecycle.rollbackSnapshots.map((snapshot) => (
          <div key={snapshot.id} className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 truncate font-mono text-3xs text-foreground">{snapshot.package.skillId}</div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-5 w-5"
                onClick={() => onRollbackMetadataUpdate(snapshot.id)}
                title="Roll back metadata update"
              >
                <RotateCcw className="h-2.5 w-2.5" />
              </Button>
            </div>
            <div className="truncate text-3xs text-muted-foreground">{snapshot.id}</div>
          </div>
        ))}
        {report.rows.length ? report.rows.map((row) => (
          <SettingsAgentSkillSignedPackageUpdateRollbackRowCard key={row.candidateDraftId} row={row} />
        )) : !lifecycle.rollbackSnapshots.length ? (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No signed update rollback rows.
          </div>
        ) : null}
      </div>
    </div>
  );
}
