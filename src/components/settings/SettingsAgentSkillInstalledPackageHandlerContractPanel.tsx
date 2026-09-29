import { ScrollText } from 'lucide-react';
import {
  createAgentSkillInstalledPackageHandlerContractReport,
  type AgentSkillInstalledPackageHandlerPreviewRegistry,
  type AgentSkillInstalledPackageRegistry,
} from '../../agent';

export function SettingsAgentSkillInstalledPackageHandlerContractPanel({
  installedRegistry,
  previewRegistry,
}: {
  installedRegistry: AgentSkillInstalledPackageRegistry;
  previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry;
}) {
  const report = createAgentSkillInstalledPackageHandlerContractReport(installedRegistry, previewRegistry);

  return (
    <div className="mt-2 rounded-sm border border-border/70 bg-background/25 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          <ScrollText className="h-3 w-3 text-primary" />
          Handler contract
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          valid {report.summary.valid} / missing {report.summary.missing} / invalid {report.summary.invalid}
        </div>
      </div>
      <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
        {report.rows.length ? report.rows.map((row) => (
          <div key={row.packageId} className="rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 truncate font-mono text-3xs text-foreground">{row.skillId}</div>
              <div className="shrink-0 font-mono text-3xs text-muted-foreground">{row.status}</div>
            </div>
            <div className="truncate text-3xs text-muted-foreground">
              {row.contract ? `${row.contract.inputContract} / ${row.contract.permissionScope} / ${row.contract.receiptShape}` : row.issues.join(', ')}
            </div>
          </div>
        )) : (
          <div className="rounded-sm border border-dashed border-border/70 bg-background/20 px-2 py-3 text-center text-3xs text-muted-foreground">
            No handler contract rows.
          </div>
        )}
      </div>
    </div>
  );
}
