import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type {
  SettingsMcpServerDraftPreflightCheck,
  SettingsMcpServerDraftPreflightStatus,
} from './settingsMcpServerDraftPreflight';

interface SettingsMcpServerDraftPreflightPanelProps {
  checks: SettingsMcpServerDraftPreflightCheck[];
  status: SettingsMcpServerDraftPreflightStatus;
}

function getStatusClassName(status: SettingsMcpServerDraftPreflightStatus) {
  if (status === 'ready') {
    return 'text-primary';
  }

  return status === 'blocked' ? 'text-destructive' : 'text-amber-600';
}

function getStatusIcon(status: SettingsMcpServerDraftPreflightStatus) {
  if (status === 'ready') {
    return CheckCircle2;
  }

  return status === 'blocked' ? AlertTriangle : Info;
}

export function SettingsMcpServerDraftPreflightPanel({
  checks,
  status,
}: SettingsMcpServerDraftPreflightPanelProps) {
  const Icon = getStatusIcon(status);

  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${getStatusClassName(status)}`} />
        Draft preflight / {status}
      </div>
      <div className="grid gap-1 sm:grid-cols-2">
        {checks.map((check) => {
          const CheckIcon = getStatusIcon(check.status);
          return (
            <div key={check.id} className="flex items-start gap-2 text-3xs">
              <CheckIcon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(check.status)}`} />
              <div className="min-w-0">
                <div className="font-mono text-foreground">{check.label}</div>
                <div className="text-muted-foreground">{check.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
