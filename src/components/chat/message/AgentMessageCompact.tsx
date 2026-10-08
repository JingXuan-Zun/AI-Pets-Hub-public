import { Loader2 } from 'lucide-react';
import { resolveChatAgentRuntimeContinuation } from '../chatAgentRuntimeCompatibility';
import { countAgentStateSummaryItems } from './agentMessageEvidence';
import { compactAgentPanelText, resolveAgentProcessStateSummary, resolveAgentSessionV2CurrentTitle, resolveAgentSessionV2LatestUnderstanding, resolveAgentSessionV2Progress } from './agentMessageProgress';
import { resolveAgentCompactTimelineDotClassName, resolveAgentProcessCompactTimeline, resolveAgentProcessStageProgress } from './agentMessageTimeline';
import { type ChatAgentCompactTimelineItem, type ChatAgentProcessPanelSource } from './agentMessageTypes';
import { resolveAgentVisualObservations } from './agentMessageVisualObservation';

function PetChatAgentCompactTimeline({
  items,
}: {
  items: ChatAgentCompactTimelineItem[];
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="mt-1.5 space-y-1 border-t border-white/70 pt-1.5">
      {items.map((item) => {
        const isRunning = item.status === 'running';
        return (
          <div key={item.id} className="grid grid-cols-[14px_minmax(0,1fr)] items-start gap-1.5 text-2xs leading-snug">
            <span className={`mt-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border ${resolveAgentCompactTimelineDotClassName(item.status)}`}>
              {isRunning ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : null}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-foreground">{item.label}</span>
              {item.detail ? (
                <span className="block line-clamp-1 break-words text-muted-foreground">
                  {compactAgentPanelText(item.detail, 96)}
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function PetChatAgentProcessCompact({
  isActive,
  process,
  summaryText,
  statusText,
}: {
  isActive: boolean;
  process: ChatAgentProcessPanelSource;
  summaryText?: string;
  statusText: string;
}) {
  const timelineItems = resolveAgentProcessCompactTimeline(process);
  const agentRuntime = resolveChatAgentRuntimeContinuation(process);

  if (agentRuntime) {
    const v2Progress = resolveAgentSessionV2Progress(process);
    const understanding = resolveAgentSessionV2LatestUnderstanding(agentRuntime);
    const currentTitle = resolveAgentSessionV2CurrentTitle(process, statusText);
    const visualObservations = resolveAgentVisualObservations(process);
    const latestVisualObservation = visualObservations[visualObservations.length - 1] ?? null;
    const barClassName = process.status === 'failed' || process.status === 'denied'
      ? 'bg-rose-400'
      : process.status === 'blocked'
        ? 'bg-amber-400'
        : isActive
          ? 'bg-primary'
          : 'bg-emerald-500';

    return (
      <div className="mb-2 rounded-md border border-border bg-muted/45 px-2 py-1.5">
        <div className="mb-1 flex items-center justify-between gap-2 text-2xs">
          <span className="min-w-0 truncate font-semibold text-primary">
            {currentTitle}
          </span>
          <span className="shrink-0 text-muted-foreground">
            {statusText}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${barClassName}`}
            style={{ width: `${v2Progress.percent}%` }}
          />
        </div>
        {summaryText ? (
          <div className="mt-1 line-clamp-2 break-words text-2xs leading-relaxed text-muted-foreground">
            {summaryText}
          </div>
        ) : null}
        <div className="mt-1 flex flex-wrap gap-1 text-2xs text-muted-foreground">
          <span className="rounded-full border border-white bg-white/70 px-1.5 py-0.5">
            {v2Progress.stepCount} 步循环
          </span>
          {v2Progress.toolResultCount ? (
            <span className="rounded-full border border-white bg-white/70 px-1.5 py-0.5">
              {v2Progress.toolResultCount} 个工具结果
            </span>
          ) : null}
          {visualObservations.length ? (
            <span className="rounded-full border border-white bg-white/70 px-1.5 py-0.5">
              视觉 {visualObservations.length} 次
            </span>
          ) : null}
          {latestVisualObservation?.confidence ? (
            <span className="min-w-0 max-w-full rounded-full border border-white bg-white/70 px-1.5 py-0.5">
              <span className="block truncate">置信度 {latestVisualObservation.confidence}</span>
            </span>
          ) : null}
          {understanding?.neededCapability ? (
            <span className="min-w-0 max-w-full rounded-full border border-white bg-white/70 px-1.5 py-0.5">
              <span className="block truncate">{understanding.neededCapability}</span>
            </span>
          ) : null}
        </div>
        <PetChatAgentCompactTimeline items={timelineItems} />
      </div>
    );
  }

  const progress = resolveAgentProcessStageProgress(process.stages);
  const stateSummary = resolveAgentProcessStateSummary(process);
  const evidenceCount = countAgentStateSummaryItems(stateSummary);
  const currentStage = progress.currentStage;
  const barClassName = progress.failed
    ? 'bg-rose-400'
    : progress.blocked
      ? 'bg-amber-400'
      : isActive
        ? 'bg-primary'
        : 'bg-emerald-500';

  return (
    <div className="mb-2 rounded-md border border-border bg-muted/45 px-2 py-1.5">
      <div className="mb-1 flex items-center justify-between gap-2 text-2xs">
        <span className="min-w-0 truncate font-semibold text-primary">
          {currentStage ? currentStage.title : statusText}
        </span>
        <span className="shrink-0 text-muted-foreground">
          {progress.total ? `${progress.completed}/${progress.total}` : statusText}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${barClassName}`}
          style={{ width: `${Math.max(6, progress.percent)}%` }}
        />
      </div>
      {summaryText ? (
        <div className="mt-1 line-clamp-2 break-words text-2xs leading-relaxed text-muted-foreground">
          {summaryText}
        </div>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-1 text-2xs text-muted-foreground">
        <span className="rounded-full border border-white bg-white/70 px-1.5 py-0.5">
          {process.plan.steps.length} 个工具步骤
        </span>
        {evidenceCount ? (
          <span className="rounded-full border border-white bg-white/70 px-1.5 py-0.5">
            {evidenceCount} 条状态证据
          </span>
        ) : null}
        {process.rounds?.length ? (
          <span className="rounded-full border border-white bg-white/70 px-1.5 py-0.5">
            {process.rounds.length} 轮
          </span>
        ) : null}
      </div>
      <PetChatAgentCompactTimeline items={timelineItems} />
    </div>
  );
}
