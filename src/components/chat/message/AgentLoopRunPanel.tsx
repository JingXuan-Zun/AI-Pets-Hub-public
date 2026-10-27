import { Check, CheckCheck, ChevronDown, ChevronUp, Clock, Loader2, StopCircle, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { type ChatAgentApprovalDecision, type ChatAgentLoopRun, type ChatMessage } from '../../../types';

// The task card: one line with the step running now (or the question waiting for the user),
// and under 详情 the task's steps with whether each finished. Plain words only — the
// internal trace, tool arguments and diagnostics are not shown.

const STATUS_TEXT: Record<ChatAgentLoopRun['status'], string> = {
  budget: '步骤太多，先停下了',
  cancelled: '已终止',
  done: '已完成',
  failed: '没有完成',
  'needs-user': '等你确认',
  running: '进行中',
};

function resolveHeadline(run: ChatAgentLoopRun) {
  if (run.pendingApproval) return `等你确认：${run.pendingApproval.title}`;
  if (run.status === 'running') {
    const current = [...run.steps].reverse().find((step) => step.status === 'running') ?? run.steps[run.steps.length - 1];
    return current ? `正在${current.text}…` : '正在准备…';
  }
  const seconds = run.durationMs ? `，用时 ${Math.max(1, Math.round(run.durationMs / 1000))} 秒` : '';
  return `${STATUS_TEXT[run.status]}（${run.steps.length} 步${seconds}）`;
}

function StepIcon({ status }: { status: ChatAgentLoopRun['steps'][number]['status'] }) {
  if (status === 'running') return <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />;
  if (status === 'waiting') return <Clock className="h-3 w-3 shrink-0 text-amber-600" />;
  if (status === 'failed') return <X className="h-3 w-3 shrink-0 text-rose-500" />;
  return <Check className="h-3 w-3 shrink-0 text-emerald-600" />;
}

export function AgentLoopRunPanel({
  message,
  onResolveAgentApproval,
  onStopAgentRun,
}: {
  message: ChatMessage;
  onResolveAgentApproval?: (messageId: string, decision: ChatAgentApprovalDecision) => void | Promise<void>;
  onStopAgentRun?: (messageId?: string | null) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const run = message.agentLoopRun;
  if (!run) return null;
  const isActive = run.status === 'running' || run.status === 'needs-user';
  const pending = run.pendingApproval ?? null;

  return (
    <div className="mt-1 min-w-[16rem] rounded-xl border border-border bg-background/60 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 text-2xs text-foreground">
          {isActive && !pending ? <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" /> : null}
          {pending ? <Clock className="h-3 w-3 shrink-0 text-amber-600" /> : null}
          <span className="truncate">{resolveHeadline(run)}</span>
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {isActive && onStopAgentRun ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onStopAgentRun(message.id ?? null)}
              className="h-6 rounded-full border border-rose-100 px-2 text-2xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              title="终止这个任务"
            >
              <StopCircle className="mr-1 h-3 w-3" />
              终止
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded((current) => !current)}
            className="h-6 rounded-full border border-border px-2 text-2xs text-primary hover:bg-muted"
            title={isExpanded ? '收起步骤' : '查看这个任务的步骤'}
          >
            {isExpanded ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
            {isExpanded ? '收起' : '详情'}
          </Button>
        </div>
      </div>
      {pending ? (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          {pending.detail && pending.detail !== pending.title ? (
            <p className="whitespace-pre-wrap text-2xs leading-snug text-muted-foreground">{pending.detail}</p>
          ) : null}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!onResolveAgentApproval}
              onClick={() => void onResolveAgentApproval?.(pending.id, 'approve')}
              className="h-7 rounded-full px-3 text-2xs"
            >
              <Check className="mr-1 h-3 w-3" />
              允许
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!onResolveAgentApproval}
              onClick={() => void onResolveAgentApproval?.(pending.id, 'approve-task')}
              className="h-7 rounded-full border border-primary/40 px-3 text-2xs text-primary"
              title="这个任务后面的步骤都不再问，下一个任务会重新问"
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              这次都允许
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!onResolveAgentApproval}
              onClick={() => void onResolveAgentApproval?.(pending.id, 'deny')}
              className="h-7 rounded-full border border-border px-3 text-2xs"
            >
              <X className="mr-1 h-3 w-3" />
              拒绝
            </Button>
            <span className="text-2xs text-muted-foreground">也可以直接说“同意”“都同意”或“拒绝”</span>
          </div>
        </div>
      ) : null}
      {isExpanded ? (
        <ol className="mt-2 space-y-1.5 border-t border-border pt-2 text-2xs leading-snug">
          <li className="text-muted-foreground">任务：{run.goal}</li>
          {run.steps.map((step) => (
            <li key={step.key ?? step.index} className="flex items-start gap-1.5 break-words">
              <span className="mt-0.5"><StepIcon status={step.status} /></span>
              <span className="text-foreground">
                {step.index}. {step.text}
                {step.status === 'waiting' ? <span className="ml-1 text-amber-600">（等你确认）</span> : null}
                {step.result ? <span className="ml-1 text-muted-foreground">（{step.result}）</span> : null}
              </span>
            </li>
          ))}
          {run.summary && !isActive ? <li className="text-primary">{run.summary}</li> : null}
        </ol>
      ) : null}
    </div>
  );
}
