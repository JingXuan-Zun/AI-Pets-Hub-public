import { ShieldPlus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  createAgentSkillTrustEvidenceReport,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillTrustEvidenceRegistry,
  type AgentSkillTrustEvidenceStatus,
} from '../../agent';

const STATUS_CLASS: Record<AgentSkillTrustEvidenceStatus, string> = {
  missing: 'text-amber-500',
  stale: 'text-red-400',
  valid: 'text-primary',
};

export function SettingsAgentSkillTrustEvidencePanel({
  evidenceRegistry,
  installedRegistry,
  onCreateEvidence,
  onRemoveEvidence,
}: {
  evidenceRegistry: AgentSkillTrustEvidenceRegistry;
  installedRegistry: AgentSkillInstalledPackageRegistry;
  onCreateEvidence: (packageId: string) => void;
  onRemoveEvidence: (packageId: string) => void;
}) {
  const report = createAgentSkillTrustEvidenceReport(installedRegistry, evidenceRegistry);

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <ShieldPlus className="h-3 w-3 text-primary" />
          Trust evidence
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          valid {report.summary.valid} / stale {report.summary.stale} / missing {report.summary.missing}
        </div>
      </div>
      <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
        {report.rows.length ? report.rows.map((row) => (
          <div key={row.packageId} className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-mono text-3xs text-foreground">{row.skillId}</div>
                <div className="truncate text-3xs text-muted-foreground">
                  {row.evidence ? `${row.evidence.source} / ${row.evidence.reviewedAt}` : row.issueCodes.join(', ') || 'no-evidence'}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className={`font-mono text-3xs ${STATUS_CLASS[row.status]}`}>{row.status}</span>
                {row.evidence ? (
                  <Button type="button" variant="ghost" size="icon-xs" title="Remove trust evidence" onClick={() => onRemoveEvidence(row.packageId)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                ) : (
                  <Button type="button" variant="outline" size="xs" onClick={() => onCreateEvidence(row.packageId)}>
                    Review
                  </Button>
                )}
              </div>
            </div>
          </div>
        )) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No installed packages need trust evidence.
          </div>
        )}
      </div>
    </div>
  );
}
