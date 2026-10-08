import { ChevronDown, ChevronUp, Loader2, StopCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { type ChatAgentLoopRun, type ChatMessage } from '../../../types';

// Desktop agent loop progress: one line in the chat, the step list only under 详情.

const STATUS_TEXT: Record<ChatAgentLoopRun['status'], string> = {
  budget: '未在预算内完成',
  cancelled: '已终止',
  done: '已完成',
  failed: '失败',
  'needs-user': '需要你处理',
  running: '执行中',
};

function resolveHeadline(run: ChatAgentLoopRun) {
  if (run.status === 'running') {
    const current = run.steps[run.steps.length - 1];
    return current ? `第 ${current.index} 步：${current.text}` : '正在查看桌面…';
  }
  const seconds = run.durationMs ? `，${Math.round(run.durationMs / 1000)} 秒` : '';
  return `${STATUS_TEXT[run.status]}（${run.steps.length} 步${seconds}）`;
}

export function AgentLoopRunPanel({
  message,
  onStopAgentRun,
}: {
  message: ChatMessage;
  onStopAgentRun?: (messageId?: string | null) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const run = message.agentLoopRun;
  if (!run) return null;
  const isRunning = run.status === 'running';

  return (
    <div className="mt-1">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 text-2xs text-muted-foreground">
          {isRunning ? <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" /> : null}
          <span className="truncate">{resolveHeadline(run)}</span>
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {isRunning && onStopAgentRun ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onStopAgentRun(message.id ?? null)}
              className="h-6 rounded-full border border-rose-100 px-2 text-2xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              title="终止当前 Agent 执行"
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
            title={isExpanded ? '收起执行详情' : '展开执行详情'}
          >
            {isExpanded ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
            {isExpanded ? '收起' : '详情'}
          </Button>
        </div>
      </div>
      {isExpanded ? (
        <ol className="mt-2 space-y-1.5 border-t border-border pt-2 text-2xs leading-snug">
          <li className="text-muted-foreground">任务：{run.goal}</li>
          {run.steps.map((step) => (
            <li key={step.index} className="break-words">
              <span className="text-foreground">{step.index}. {step.text}</span>
              {step.changed === false ? <span className="ml-1 text-amber-600">（无变化）</span> : null}
              {step.result ? <span className="block text-muted-foreground">{step.result}</span> : null}
            </li>
          ))}
          {run.summary && !isRunning ? <li className="text-primary">{run.summary}</li> : null}
        </ol>
      ) : null}
    </div>
  );
}
