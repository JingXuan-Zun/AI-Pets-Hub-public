import { Check, ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { copySettingsTextToClipboard } from './settingsClipboardUtils';
import type { SettingsMcpExternalSoakClosureCoverage } from './settingsMcpExternalSoakClosureCoverage';

interface SettingsMcpExternalSoakClosureCoverageMissingCommandsPanelProps {
  coverage: SettingsMcpExternalSoakClosureCoverage;
}

export function SettingsMcpExternalSoakClosureCoverageMissingCommandsPanel({
  coverage,
}: SettingsMcpExternalSoakClosureCoverageMissingCommandsPanelProps) {
  const [copyStatus, setCopyStatus] = useState<'copied' | 'failed' | 'idle'>('idle');
  const CopyIcon = copyStatus === 'copied' ? Check : ClipboardList;
  const hasCommands = Boolean(coverage.missingCommandsText);

  const copyCommands = async () => {
    try {
      setCopyStatus(await copySettingsTextToClipboard(coverage.missingCommandsText) ? 'copied' : 'failed');
    } catch {
      setCopyStatus('failed');
    }
  };

  if (!coverage.missingCommandCount) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border/70 bg-background/50 px-2 py-1 text-3xs">
      <div className="min-w-0 text-muted-foreground">
        {coverage.missingCommandCount} missing ready-server command(s) available to copy.
      </div>
      <div className="flex basis-full flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
        {coverage.closureSteps.map((step) => (
          <span key={step.id}>
            {step.label}: {step.status}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={!hasCommands} onClick={() => void copyCommands()}>
          <CopyIcon className="h-3.5 w-3.5" />
          Copy all missing commands
        </Button>
        {copyStatus !== 'idle' ? (
          <span className={copyStatus === 'copied' ? 'text-primary' : 'text-destructive'}>
            {copyStatus === 'copied' ? 'copied' : 'copy failed'}
          </span>
        ) : null}
      </div>
    </div>
  );
}
