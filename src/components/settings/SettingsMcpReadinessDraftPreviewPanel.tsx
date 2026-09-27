import { AlertTriangle, CheckCircle2, Info, Route } from 'lucide-react';
import {
  createSettingsMcpReadinessDraftPreview,
  type SettingsMcpReadinessDraftPreviewStatus,
} from './settingsMcpReadinessDraftPreview';
import type { SettingsMcpServerDraft } from './settingsMcpConfigFormUtils';

interface SettingsMcpReadinessDraftPreviewPanelProps {
  configText: string;
  draft: SettingsMcpServerDraft;
}

function getStatusClassName(status: SettingsMcpReadinessDraftPreviewStatus) {
  if (status === 'ready') {
    return 'text-primary';
  }

  return status === 'blocked' ? 'text-destructive' : 'text-amber-600';
}

function getStatusIcon(status: SettingsMcpReadinessDraftPreviewStatus) {
  if (status === 'ready') {
    return CheckCircle2;
  }

  return status === 'blocked' ? AlertTriangle : Info;
}

export function SettingsMcpReadinessDraftPreviewPanel({
  configText,
  draft,
}: SettingsMcpReadinessDraftPreviewPanelProps) {
  const preview = createSettingsMcpReadinessDraftPreview({ configText, draft });
  const Icon = getStatusIcon(preview.status);

  return (
    <div className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(preview.status)}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-1 font-mono text-2xs text-foreground">
              <Route className="h-3 w-3 shrink-0 text-muted-foreground" />
              Draft readiness preview / {preview.status}
            </div>
            <div className="text-3xs text-muted-foreground">{preview.blocker}</div>
          </div>
        </div>
        <div className="shrink-0 text-right font-mono text-3xs text-muted-foreground">
          <div>draft {preview.draftStatus}</div>
          <div>config {preview.configStatus}</div>
          <div>{preview.serverCount} server(s)</div>
        </div>
      </div>
    </div>
  );
}
