import { AlertTriangle, CheckCircle2, FileCheck2, Info } from 'lucide-react';
import {
  createSettingsMcpSavedConfigReadinessReview,
  type SettingsMcpSavedConfigReadinessReviewStatus,
  type SettingsMcpSavedConfigReadinessReviewStep,
} from './settingsMcpSavedConfigReadinessReview';
import type { SettingsMcpServerDraft } from './settingsMcpConfigFormUtils';

interface SettingsMcpSavedConfigReadinessReviewPanelProps {
  configText: string;
  draft: SettingsMcpServerDraft;
}

function getStatusClassName(status: SettingsMcpSavedConfigReadinessReviewStatus) {
  if (status === 'ready') {
    return 'text-primary';
  }

  return status === 'blocked' ? 'text-destructive' : 'text-amber-600';
}

function getStatusIcon(status: SettingsMcpSavedConfigReadinessReviewStatus) {
  if (status === 'ready') {
    return CheckCircle2;
  }

  return status === 'blocked' ? AlertTriangle : Info;
}

function ReviewStepRow({ step }: { step: SettingsMcpSavedConfigReadinessReviewStep }) {
  const Icon = getStatusIcon(step.status);
  return (
    <div className="flex items-start gap-2 text-3xs">
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(step.status)}`} />
      <div className="min-w-0">
        <div className="font-mono text-foreground">{step.status} / {step.label}</div>
        <div className="text-muted-foreground">{step.detail}</div>
      </div>
    </div>
  );
}

export function SettingsMcpSavedConfigReadinessReviewPanel({
  configText,
  draft,
}: SettingsMcpSavedConfigReadinessReviewPanelProps) {
  const review = createSettingsMcpSavedConfigReadinessReview({ configText, draft });

  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <FileCheck2 className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(review.status)}`} />
          <div className="min-w-0">
            <div className="font-mono text-2xs text-foreground">
              Saved-config readiness review / {review.status} / {review.serverCount} server(s)
            </div>
            <div className="text-3xs text-muted-foreground">{review.nextAction}</div>
          </div>
        </div>
        <div className="shrink-0 text-right font-mono text-3xs text-muted-foreground">
          save={review.canSaveConfig ? 'yes' : 'no'} / readiness={review.readyForSavedConfigReadiness ? 'saved-config' : 'hold'}
        </div>
      </div>
      <div className="grid gap-1 sm:grid-cols-2">
        {review.steps.map((step) => (
          <ReviewStepRow key={step.id} step={step} />
        ))}
      </div>
    </div>
  );
}
