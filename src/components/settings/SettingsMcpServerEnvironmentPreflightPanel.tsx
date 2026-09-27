import { AlertTriangle, CheckCircle2, Info, ScanSearch } from 'lucide-react';

function statusClassName(status: 'blocked' | 'ready' | 'warning') {
  if (status === 'ready') return 'text-primary';
  return status === 'blocked' ? 'text-destructive' : 'text-amber-600';
}

function statusIcon(status: 'blocked' | 'ready' | 'warning') {
  if (status === 'ready') return CheckCircle2;
  return status === 'blocked' ? AlertTriangle : Info;
}

export function SettingsMcpServerEnvironmentPreflightPanel({
  result,
}: {
  result: DesktopPetMcpServerEnvironmentPreflightLike;
}) {
  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          <ScanSearch className={`h-3.5 w-3.5 ${statusClassName(result.status)}`} />
          Host environment / {result.status}
        </div>
        <div className="max-w-full truncate font-mono text-3xs text-muted-foreground">
          {result.resolvedCommand || 'command unresolved'}
        </div>
      </div>
      <div className="grid gap-1 sm:grid-cols-2">
        {result.checks.map((check) => {
          const Icon = statusIcon(check.status);
          return (
            <div key={check.id} className="flex items-start gap-2 text-3xs">
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${statusClassName(check.status)}`} />
              <div className="min-w-0">
                <div className="font-mono text-foreground">{check.label}</div>
                <div className="break-words text-muted-foreground">{check.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
