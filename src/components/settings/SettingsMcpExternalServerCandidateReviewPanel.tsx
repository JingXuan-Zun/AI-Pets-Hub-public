import { AlertTriangle, CheckCircle2, FileSearch, Info, ServerCog } from 'lucide-react';
import {
  createSettingsMcpExternalServerCandidateReview,
  type SettingsMcpExternalServerCandidate,
  type SettingsMcpExternalServerCandidateStatus,
} from './settingsMcpExternalServerCandidateReview';

interface SettingsMcpExternalServerCandidateReviewPanelProps {
  configText: string;
}

function getStatusClassName(status: SettingsMcpExternalServerCandidateStatus | 'blocked' | 'ready' | 'warning') {
  if (status === 'ready' || status === 'candidate') {
    return 'text-primary';
  }

  if (status === 'blocked' || status === 'template') {
    return 'text-destructive';
  }

  return 'text-amber-600';
}

function getStatusIcon(status: SettingsMcpExternalServerCandidateStatus | 'blocked' | 'ready' | 'warning') {
  if (status === 'ready' || status === 'candidate') {
    return CheckCircle2;
  }

  return status === 'blocked' || status === 'template' ? AlertTriangle : Info;
}

function CandidateRow({ row }: { row: SettingsMcpExternalServerCandidate }) {
  const Icon = getStatusIcon(row.status);

  return (
    <div className="flex items-start gap-2 text-3xs">
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(row.status)}`} />
      <div className="min-w-0">
        <div className="font-mono text-foreground">
          {row.id} / {row.status}
        </div>
        <div className="text-muted-foreground">{row.detail}</div>
        {row.command ? (
          <div className="mt-0.5 break-all font-mono text-muted-foreground">{row.command}</div>
        ) : null}
      </div>
    </div>
  );
}

export function SettingsMcpExternalServerCandidateReviewPanel({
  configText,
}: SettingsMcpExternalServerCandidateReviewPanelProps) {
  const review = createSettingsMcpExternalServerCandidateReview(configText);
  const Icon = getStatusIcon(review.status);

  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(review.status)}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-1 font-mono text-2xs text-foreground">
              <ServerCog className="h-3 w-3 shrink-0 text-muted-foreground" />
              External server candidates / {review.status}
            </div>
            <div className="text-3xs text-muted-foreground">{review.nextAction}</div>
          </div>
        </div>
        <div className="shrink-0 text-right font-mono text-3xs text-muted-foreground">
          <div>{review.candidateCount} candidate(s)</div>
          <div>{review.serverCount} server(s)</div>
          <div>{review.parseError ? 'json blocked' : 'static review'}</div>
        </div>
      </div>
      {review.rows.length ? (
        <div className="grid gap-1 sm:grid-cols-2">
          {review.rows.map((row) => (
            <CandidateRow key={row.id} row={row} />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-3xs text-muted-foreground">
          <FileSearch className="h-3.5 w-3.5 shrink-0" />
          No server rows are available for static candidate review.
        </div>
      )}
    </div>
  );
}
