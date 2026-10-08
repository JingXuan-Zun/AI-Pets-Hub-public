import { Loader2 } from 'lucide-react';
import { type ChatAgentRunTraceItem, type ChatAgentWorkStage } from '../../../types';

function resolveAgentTraceStatusText(status: ChatAgentRunTraceItem['status']) {
  switch (status) {
    case 'running':
      return '进行中';
    case 'completed':
      return '完成';
    case 'failed':
      return '失败';
    case 'blocked':
      return '停止';
    default:
      return '等待';
  }
}

function resolveAgentTraceStatusClassName(status: ChatAgentRunTraceItem['status']) {
  switch (status) {
    case 'running':
      return 'border-border bg-muted text-primary';
    case 'completed':
      return 'border-emerald-100 bg-emerald-50 text-emerald-700';
    case 'failed':
      return 'border-rose-100 bg-rose-50 text-rose-700';
    case 'blocked':
      return 'border-amber-100 bg-amber-50 text-amber-700';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

export function PetChatAgentTraceList({
  trace,
}: {
  trace?: ChatAgentRunTraceItem[];
}) {
  if (!trace?.length) {
    return null;
  }

  return (
    <div className="mb-3 space-y-1.5 rounded-md border border-border/50 bg-muted/45 p-2">
      <div className="mb-1.5 text-2xs font-semibold tracking-normal text-primary">
        执行事件
      </div>
      {trace.map((item) => {
        const isRunning = item.status === 'running';
        return (
          <div key={item.id} className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-2 text-2xs leading-relaxed text-foreground">
            <span className="mt-1 flex h-2.5 w-2.5 items-center justify-center rounded-full border border-border bg-white">
              {isRunning ? <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" /> : null}
            </span>
            <span className="min-w-0">
              <span className="block break-words">{item.label}</span>
              {item.detail ? (
                <span className="mt-0.5 block line-clamp-2 break-words text-2xs text-primary">
                  {item.detail}
                </span>
              ) : null}
            </span>
            <span className={`rounded-full border px-1.5 py-0.5 text-2xs ${resolveAgentTraceStatusClassName(item.status)}`}>
              {resolveAgentTraceStatusText(item.status)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function resolveAgentWorkStageStatusText(status: ChatAgentWorkStage['status']) {
  switch (status) {
    case 'running':
      return '进行中';
    case 'completed':
      return '完成';
    case 'failed':
      return '失败';
    case 'blocked':
      return '停止';
    default:
      return '等待';
  }
}

export function resolveAgentWorkStageStatusClassName(status: ChatAgentWorkStage['status']) {
  switch (status) {
    case 'running':
      return 'border-border bg-muted text-primary';
    case 'completed':
      return 'border-emerald-100 bg-emerald-50 text-emerald-700';
    case 'failed':
      return 'border-rose-100 bg-rose-50 text-rose-700';
    case 'blocked':
      return 'border-amber-100 bg-amber-50 text-amber-700';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

export function PetChatAgentWorkStageList({
  stages,
}: {
  stages?: ChatAgentWorkStage[];
}) {
  if (!stages?.length) {
    return null;
  }

  return (
    <div className="mb-3 rounded-md border border-border bg-muted/70 p-2">
      <div className="mb-1.5 text-2xs font-semibold tracking-normal text-muted-foreground">
        详细阶段
      </div>
      <div className="space-y-1.5">
        {stages.map((stage, index) => (
          <div key={stage.id} className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-2 text-2xs leading-relaxed text-foreground">
            <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-white text-3xs text-muted-foreground">
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block break-words font-medium">{stage.title}</span>
              {stage.summary ? (
                <span className="mt-0.5 block line-clamp-2 break-words text-2xs text-muted-foreground">
                  {stage.summary}
                </span>
              ) : null}
              {stage.details?.length ? (
                <span className="mt-1 block space-y-0.5 text-2xs leading-relaxed text-muted-foreground">
                  {stage.details.slice(0, 3).map((detail) => (
                    <span key={detail} className="block line-clamp-1 break-words">
                      {detail}
                    </span>
                  ))}
                </span>
              ) : null}
            </span>
            <span className={`rounded-full border px-1.5 py-0.5 text-2xs ${resolveAgentWorkStageStatusClassName(stage.status)}`}>
              {resolveAgentWorkStageStatusText(stage.status)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
