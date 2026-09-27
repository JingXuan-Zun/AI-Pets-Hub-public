import { AlertCircle, CheckCircle2, Clock3, Wrench } from 'lucide-react';
import type {
  SettingsMcpServerHealthStatus,
  SettingsMcpServerHealthSummary,
} from './settingsMcpHealthSummary';

interface SettingsMcpBeginnerOverviewProps {
  summaries: SettingsMcpServerHealthSummary[];
  toolCount: number;
}

const STATUS_LABELS: Record<SettingsMcpServerHealthStatus, string> = {
  error: '需要处理',
  ok: '可以使用',
  pending: '等待检测',
  warning: '未发现操作',
};

function StatusIcon({ status }: { status: SettingsMcpServerHealthStatus }) {
  if (status === 'ok') return <CheckCircle2 className="h-4 w-4 text-primary" />;
  if (status === 'error') return <AlertCircle className="h-4 w-4 text-destructive" />;
  return <Clock3 className="h-4 w-4 text-amber-600" />;
}

function ToolSourceCard({ summary }: { summary: SettingsMcpServerHealthSummary }) {
  return (
    <div className="rounded-sm border border-border bg-background/45 p-3">
      <div className="flex items-start gap-2">
        <StatusIcon status={summary.status} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-foreground">
            {summary.server.title || summary.server.id || '未命名工具来源'}
          </div>
          <div className="mt-1 text-2xs text-muted-foreground">
            {STATUS_LABELS[summary.status]} · {summary.toolCount} 个可用操作
          </div>
        </div>
      </div>
      {summary.error ? (
        <div className="mt-2 text-2xs leading-5 text-destructive">检测未通过，请打开高级设置查看原因。</div>
      ) : null}
    </div>
  );
}

function EmptyToolSourceState() {
  return (
    <div className="rounded-sm border border-dashed border-border bg-background/30 px-4 py-5 text-center">
      <Wrench className="mx-auto h-5 w-5 text-muted-foreground" />
      <div className="mt-2 text-xs font-semibold text-foreground">还没有添加外部工具</div>
      <div className="mt-1 text-2xs leading-5 text-muted-foreground">
        需要时打开高级设置添加工具来源。添加后先检测，再交给桌宠使用。
      </div>
    </div>
  );
}

export function SettingsMcpBeginnerOverview({
  summaries,
  toolCount,
}: SettingsMcpBeginnerOverviewProps) {
  const usableCount = summaries.filter((summary) => summary.status === 'ok').length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-sm border border-border bg-background/35 p-3">
          <div className="text-3xs text-muted-foreground">工具来源</div>
          <div className="mt-1 text-lg font-semibold text-foreground">{summaries.length}</div>
        </div>
        <div className="rounded-sm border border-border bg-background/35 p-3">
          <div className="text-3xs text-muted-foreground">可以使用</div>
          <div className="mt-1 text-lg font-semibold text-primary">{usableCount}</div>
        </div>
        <div className="rounded-sm border border-border bg-background/35 p-3">
          <div className="text-3xs text-muted-foreground">可用操作</div>
          <div className="mt-1 text-lg font-semibold text-foreground">{toolCount}</div>
        </div>
      </div>

      {summaries.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {summaries.map((summary) => (
            <ToolSourceCard key={summary.server.id || summary.server.title} summary={summary} />
          ))}
        </div>
      ) : <EmptyToolSourceState />}
    </div>
  );
}
