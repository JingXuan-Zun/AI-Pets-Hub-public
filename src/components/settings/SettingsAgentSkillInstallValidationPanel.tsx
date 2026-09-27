import { ShieldCheck } from 'lucide-react';
import { createAgentSkillInstallValidationReport } from '../../agent/agentSkillInstallValidation';
import { type PetConfig } from '../../types';
import { useSettingsAgentSkillMcpConfigSnapshot } from './useSettingsAgentSkillMcpConfigSnapshot';

const STATUS_CLASS = {
  blocked: 'text-red-400',
  ready: 'text-primary',
  unknown: 'text-muted-foreground',
  warning: 'text-amber-500',
} as const;

export function SettingsAgentSkillInstallValidationPanel({
  localConfig,
}: {
  localConfig: PetConfig;
}) {
  const mcpSnapshot = useSettingsAgentSkillMcpConfigSnapshot();
  const report = createAgentSkillInstallValidationReport({
    config: localConfig,
    mcpConfig: mcpSnapshot.config,
  });

  return (
    <div className="mt-3 rounded-sm border border-border/80 bg-background/25 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Install validation
        </div>
        <div className="font-mono text-2xs text-muted-foreground">
          ready {report.summary.ready}/{report.summary.total}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {(['ready', 'warning', 'unknown', 'blocked'] as const).map((status) => (
          <div key={status} className="rounded-sm border border-border/70 bg-secondary/20 px-2 py-1">
            <div className="text-3xs uppercase tracking-widest text-muted-foreground">{status}</div>
            <div className={`mt-1 font-mono text-2xs ${STATUS_CLASS[status]}`}>{report.summary[status]}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 rounded-sm border border-border/60 bg-background/30 px-2 py-1 font-mono text-3xs text-muted-foreground">
        MCP config: {mcpSnapshot.status} / {mcpSnapshot.detail}
      </div>
      <div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
        {report.validations.map((validation) => (
          <div key={validation.skillId} className="flex items-center justify-between gap-3 rounded-sm border border-border/60 bg-background/30 px-2 py-1">
            <span className="truncate font-mono text-3xs text-muted-foreground">{validation.skillId}</span>
            <span className={`shrink-0 font-mono text-3xs ${STATUS_CLASS[validation.status]}`}>{validation.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
