import { Check, Loader2, X } from 'lucide-react';
import { resolveChatAgentRuntimeContinuation } from '../chatAgentRuntimeCompatibility';
import { resolveAgentRoundStatusText } from './AgentMessageAssessment';
import { PetChatAgentCorePlanSummary } from './AgentMessageCorePlan';
import { resolveAgentProcessCurrentStage, resolveAgentProcessLatestTrace, resolveAgentProcessStageClassName, resolveAgentProcessStageDotClassName, resolveAgentProcessStateSummary } from './agentMessageProgress';
import { PetChatAgentExecutionReceipt } from './AgentMessageReceipt';
import { PetChatAgentSessionV2Summary } from './AgentMessageSessionSummary';
import { PetChatAgentStateSummaryPanel } from './AgentMessageStateSummary';
import { resolveAgentWorkStageStatusClassName, resolveAgentWorkStageStatusText } from './AgentMessageTraceLists';
import { type ChatAgentProcessPanelSource } from './agentMessageTypes';

export function PetChatAgentProcessSummary({
  process,
}: {
  process: ChatAgentProcessPanelSource;
}) {
  if (resolveChatAgentRuntimeContinuation(process)) {
    return <PetChatAgentSessionV2Summary process={process} />;
  }

  const stateSummary = resolveAgentProcessStateSummary(process);
  const stages = process.stages ?? [];
  const currentStage = resolveAgentProcessCurrentStage(stages);
  const latestTrace = resolveAgentProcessLatestTrace(process.trace);
  const latestRound = process.rounds?.length ? process.rounds[process.rounds.length - 1] : null;
  const completedStageCount = stages.filter((stage) => stage.status === 'completed').length;
  const confirmStepCount = process.plan.steps.filter((step) => (
    step.decision.mode === 'confirm' || step.decision.mode === 'blocked'
  )).length;
  const toolSummary = process.plan.steps.length
    ? process.plan.steps.slice(0, 2).map((step) => step.summary).join('；')
    : '没有需要调用的工具';

  return (
    <div className="mb-3 rounded-md border border-border bg-white/80 p-2 text-2xs leading-relaxed text-foreground">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">处理过程</span>
        {stages.length ? (
          <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">
            阶段 {completedStageCount}/{stages.length}
          </span>
        ) : null}
      </div>
      {currentStage ? (
        <div className="mb-2 rounded-md border border-border bg-muted/80 px-2 py-1.5">
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="mr-1 text-2xs font-semibold text-muted-foreground">当前</span>
              <span className="break-words font-medium text-foreground">{currentStage.title}</span>
            </span>
            <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-2xs ${resolveAgentWorkStageStatusClassName(currentStage.status)}`}>
              {resolveAgentWorkStageStatusText(currentStage.status)}
            </span>
          </div>
          {currentStage.summary ? (
            <div className="mt-0.5 line-clamp-2 break-words text-2xs text-muted-foreground">
              {currentStage.summary}
            </div>
          ) : null}
        </div>
      ) : null}
      {stages.length ? (
        <div className="flex flex-wrap gap-1.5">
          {stages.map((stage, index) => (
            <span
              key={stage.id}
              className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-1 text-2xs ${resolveAgentProcessStageClassName(stage.status)}`}
              title={stage.summary ?? stage.title}
            >
              <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-3xs ${resolveAgentProcessStageDotClassName(stage.status)}`}>
                {stage.status === 'running'
                  ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  : stage.status === 'completed'
                    ? <Check className="h-2.5 w-2.5" />
                    : stage.status === 'failed' || stage.status === 'blocked'
                      ? <X className="h-2.5 w-2.5" />
                      : index + 1}
              </span>
              <span className="truncate">{stage.title}</span>
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1.5 text-2xs">
        <span className="min-w-0 flex-1 basis-[120px] rounded-md border border-border bg-muted px-2 py-1">
          <span className="mr-1 font-semibold text-muted-foreground">工具</span>
          <span className="break-words text-muted-foreground">{process.plan.steps.length} 个：{toolSummary}</span>
        </span>
        <span className="min-w-0 flex-1 basis-[110px] rounded-md border border-border bg-muted px-2 py-1">
          <span className="mr-1 font-semibold text-muted-foreground">权限</span>
          <span className="break-words text-muted-foreground">{confirmStepCount ? `${confirmStepCount} 个需要确认` : '无需额外确认'}</span>
        </span>
        {latestRound ? (
          <span className="min-w-0 flex-1 basis-[120px] rounded-md border border-border bg-muted px-2 py-1">
            <span className="mr-1 font-semibold text-muted-foreground">轮次</span>
            <span className="break-words text-muted-foreground">第 {latestRound.index} 轮：{resolveAgentRoundStatusText(latestRound.status)}</span>
          </span>
        ) : null}
        {latestTrace ? (
          <span className="min-w-0 flex-1 basis-[120px] rounded-md border border-border bg-muted px-2 py-1">
            <span className="mr-1 font-semibold text-muted-foreground">事件</span>
            <span className="break-words text-muted-foreground">{latestTrace.label}</span>
          </span>
        ) : null}
      </div>
      <PetChatAgentCorePlanSummary summary={process.corePlanSummary} />
      <PetChatAgentStateSummaryPanel stateSummary={stateSummary} />
      <PetChatAgentExecutionReceipt receipt={process.receipt} />
    </div>
  );
}
