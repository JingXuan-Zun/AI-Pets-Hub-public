import { AlertTriangle, CheckCircle2, Info, ListChecks } from 'lucide-react';
import {
  createSettingsMcpRealServerConfigGuide,
  type SettingsMcpRealServerGuideStatus,
  type SettingsMcpRealServerGuideStep,
} from './settingsMcpRealServerConfigGuide';
import type { SettingsMcpServerDraft } from './settingsMcpConfigFormUtils';
import { SettingsMcpReadinessDraftPreviewPanel } from './SettingsMcpReadinessDraftPreviewPanel';

interface SettingsMcpRealServerConfigGuidePanelProps {
  configText: string;
  draft: SettingsMcpServerDraft;
}

function getStatusClassName(status: SettingsMcpRealServerGuideStatus) {
  if (status === 'ready') {
    return 'text-primary';
  }

  return status === 'blocked' ? 'text-destructive' : 'text-amber-600';
}

function getStatusIcon(status: SettingsMcpRealServerGuideStatus) {
  if (status === 'ready') {
    return CheckCircle2;
  }

  return status === 'blocked' ? AlertTriangle : Info;
}

function GuideStepRow({ step }: { step: SettingsMcpRealServerGuideStep }) {
  const Icon = getStatusIcon(step.status);
  return (
    <div className="flex items-start gap-2 text-3xs">
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(step.status)}`} />
      <div className="min-w-0">
        <div className="font-mono text-foreground">{step.label}</div>
        <div className="text-muted-foreground">{step.detail}</div>
      </div>
    </div>
  );
}

export function SettingsMcpRealServerConfigGuidePanel({
  configText,
  draft,
}: SettingsMcpRealServerConfigGuidePanelProps) {
  const guide = createSettingsMcpRealServerConfigGuide({ configText, draft });

  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          <ListChecks className={`h-3.5 w-3.5 ${getStatusClassName(guide.status)}`} />
          Real server setup / {guide.status}
        </div>
        <div className="font-mono text-3xs text-muted-foreground">
          draft {guide.draftStatus} / config {guide.configStatus}
        </div>
      </div>
      <div className="grid gap-1 sm:grid-cols-2">
        {guide.steps.map((step) => (
          <GuideStepRow key={step.id} step={step} />
        ))}
      </div>
      <SettingsMcpReadinessDraftPreviewPanel configText={configText} draft={draft} />
    </div>
  );
}
