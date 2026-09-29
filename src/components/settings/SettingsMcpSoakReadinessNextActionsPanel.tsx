import { AlertTriangle, CheckCircle2, ListChecks } from 'lucide-react';
import type {
  SettingsMcpSoakReadinessNextAction,
  SettingsMcpSoakReadinessNextActionStatus,
} from './settingsMcpSoakReadinessNextActions';

interface SettingsMcpSoakReadinessNextActionsPanelProps {
  actions?: SettingsMcpSoakReadinessNextAction[];
}

function getActionStatusClassName(status: SettingsMcpSoakReadinessNextActionStatus) {
  if (status === 'ready') {
    return 'text-primary';
  }

  if (status === 'blocked') {
    return 'text-destructive';
  }

  return 'text-amber-600';
}

function getActionStatusIcon(status: SettingsMcpSoakReadinessNextActionStatus) {
  return status === 'ready' ? CheckCircle2 : AlertTriangle;
}

export function SettingsMcpSoakReadinessNextActionsPanel({
  actions = [],
}: SettingsMcpSoakReadinessNextActionsPanelProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
        <ListChecks className="h-3.5 w-3.5" />
        Next actions
      </div>
      <div className="space-y-1">
        {actions.map((action) => {
          const Icon = getActionStatusIcon(action.status);
          return (
            <div key={action.id} className="flex items-start gap-2 text-3xs">
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getActionStatusClassName(action.status)}`} />
              <div className="min-w-0">
                <div className="font-mono text-foreground">{action.status} / {action.label}</div>
                <div className="text-muted-foreground">{action.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
