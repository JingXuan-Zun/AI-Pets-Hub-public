import { AlertTriangle, CheckCircle2, Info, Route } from 'lucide-react';
import {
  createSettingsMcpPostSaveReadinessReview,
  type SettingsMcpPostSaveReadinessReviewStatus,
  type SettingsMcpPostSaveReadinessReviewStep,
} from './settingsMcpPostSaveReadinessReview';
import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';
import type { SettingsMcpSoakSummaryResult } from './settingsMcpSoakSummary';

interface SettingsMcpPostSaveReadinessReviewPanelProps {
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null;
  savedAt: number | null;
  soakSummary: SettingsMcpSoakSummaryResult | null;
}

function getStatusClassName(status: SettingsMcpPostSaveReadinessReviewStatus) {
  if (status === 'ready') {
    return 'text-primary';
  }

  if (status === 'blocked') {
    return 'text-destructive';
  }

  return 'text-amber-600';
}

function getStatusIcon(status: SettingsMcpPostSaveReadinessReviewStatus) {
  if (status === 'ready') {
    return CheckCircle2;
  }

  return status === 'blocked' ? AlertTriangle : Info;
}

function ReviewStepRow({ step }: { step: SettingsMcpPostSaveReadinessReviewStep }) {
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

export function SettingsMcpPostSaveReadinessReviewPanel({
  readinessSummary,
  savedAt,
  soakSummary,
}: SettingsMcpPostSaveReadinessReviewPanelProps) {
  const review = createSettingsMcpPostSaveReadinessReview({ readinessSummary, savedAt, soakSummary });

  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Route className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(review.status)}`} />
          <div className="min-w-0">
            <div className="font-mono text-2xs text-foreground">
              Post-save readiness review / {review.status}
            </div>
            <div className="text-3xs text-muted-foreground">{review.nextAction}</div>
          </div>
        </div>
        <div className="shrink-0 text-right font-mono text-3xs text-muted-foreground">
          per-server soak={review.readyForPerServerSoak ? 'ready' : 'hold'}
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
