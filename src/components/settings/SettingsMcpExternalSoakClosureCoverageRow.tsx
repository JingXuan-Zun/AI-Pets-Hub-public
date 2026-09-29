import { AlertTriangle, Check, CheckCircle2, CircleDot, Clipboard, Info } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { copySettingsTextToClipboard } from './settingsClipboardUtils';
import {
  type SettingsMcpExternalSoakClosureCoverageStatus,
  type SettingsMcpExternalSoakClosureServerCoverage,
} from './settingsMcpExternalSoakClosureCoverage';

interface SettingsMcpExternalSoakClosureCoverageRowProps {
  row: SettingsMcpExternalSoakClosureServerCoverage;
}

function getStatusClassName(status: SettingsMcpExternalSoakClosureCoverageStatus) {
  if (status === 'covered') {
    return 'text-primary';
  }

  if (status === 'blocked' || status === 'missing') {
    return 'text-destructive';
  }

  return 'text-amber-600';
}

function getStatusIcon(status: SettingsMcpExternalSoakClosureCoverageStatus) {
  if (status === 'covered') {
    return CheckCircle2;
  }

  if (status === 'warning') {
    return Info;
  }

  return status === 'missing' ? AlertTriangle : CircleDot;
}

export function SettingsMcpExternalSoakClosureCoverageRow({
  row,
}: SettingsMcpExternalSoakClosureCoverageRowProps) {
  const [copyStatus, setCopyStatus] = useState<'copied' | 'failed' | 'idle'>('idle');
  const Icon = getStatusIcon(row.status);
  const CopyIcon = copyStatus === 'copied' ? Check : Clipboard;

  const copyCommand = async () => {
    try {
      setCopyStatus(await copySettingsTextToClipboard(row.soakCommand) ? 'copied' : 'failed');
    } catch {
      setCopyStatus('failed');
    }
  };

  return (
    <div className="flex items-start gap-2 text-3xs">
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(row.status)}`} />
      <div className="min-w-0">
        <div className="font-mono text-foreground">
          {row.serverId} / {row.status} / {row.soakStatus}
        </div>
        <div className="text-muted-foreground">{row.detail}</div>
        <div className="mt-0.5 text-muted-foreground">
          {row.actionLabel}: {row.actionDetail}
        </div>
        {row.soakCommand ? (
          <div className="mt-1 space-y-1">
            <div className="break-all font-mono text-muted-foreground">{row.soakCommand}</div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void copyCommand()}>
                <CopyIcon className="h-3.5 w-3.5" />
                Copy command
              </Button>
              {copyStatus !== 'idle' ? (
                <span className={copyStatus === 'copied' ? 'text-primary' : 'text-destructive'}>
                  {copyStatus === 'copied' ? 'copied' : 'copy failed'}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
