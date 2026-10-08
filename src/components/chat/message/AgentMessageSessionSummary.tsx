import { resolveChatAgentRuntimeContinuation } from '../chatAgentRuntimeCompatibility';
import { compactAgentPanelText, formatAgentSessionV2TimingDuration, resolveAgentSessionV2LatestUnderstanding, resolveAgentSessionV2StepClassName, resolveAgentSessionV2StepStatusText, resolveAgentSessionV2StepTitle, resolveAgentSessionV2TimingStopReasonText } from './agentMessageProgress';
import { PetChatAgentSessionV2TracePanel } from './AgentMessageTracePanel';
import { type ChatAgentProcessPanelSource } from './agentMessageTypes';
import { isAgentVisualToolName } from './agentMessageVisualObservation';
import { PetChatAgentVisualObservationPanel } from './AgentMessageVisualPanel';

export function PetChatAgentSessionV2Summary({
  process,
}: {
  process: ChatAgentProcessPanelSource;
}) {
  const session = resolveChatAgentRuntimeContinuation(process);
  if (!session) {
    return null;
  }

  const latestUnderstanding = resolveAgentSessionV2LatestUnderstanding(session);
  const understandingRows = [
    latestUnderstanding?.userNeed ? ['理解到的需求', latestUnderstanding.userNeed] : null,
    latestUnderstanding?.neededCapability ? ['需要的能力', latestUnderstanding.neededCapability] : null,
    latestUnderstanding?.successCriteria ? ['成功标准', latestUnderstanding.successCriteria] : null,
    latestUnderstanding?.capabilityGap ? ['能力缺口', latestUnderstanding.capabilityGap] : null,
  ].filter(Boolean) as Array<[string, string]>;
  const genericToolResults = session.toolResults.filter((entry) => (
    !isAgentVisualToolName(entry.command.toolCall?.name ?? entry.command.kind)
  ));
  const isLiveAgentRun = process.status === 'running' || process.status === 'planned';
  const timing = session.timing ?? null;
  const slowestTimingEntry = timing?.entries
    .filter((entry) => typeof entry.durationMs === 'number')
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))[0] ?? null;
  const stopReasonText = resolveAgentSessionV2TimingStopReasonText(timing?.stopReason);

  return (
    <div className="mb-3 rounded-md border border-border bg-white/80 p-2 text-2xs leading-relaxed text-foreground">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">处理过程</span>
        <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">
          {session.steps.length} 步
        </span>
      </div>

      {timing ? (
        <div className="mb-2 flex flex-wrap gap-1 text-2xs text-muted-foreground">
          <span className="rounded-full border border-border bg-muted px-1.5 py-0.5">
            总耗时 {formatAgentSessionV2TimingDuration(timing.elapsedMs)}
          </span>
          <span className="rounded-full border border-border bg-muted px-1.5 py-0.5">
            大脑 {timing.modelCallCount} 次 / {formatAgentSessionV2TimingDuration(timing.modelDurationMs)}
          </span>
          <span className="rounded-full border border-border bg-muted px-1.5 py-0.5">
            工具 {timing.toolCallCount} 次 / {formatAgentSessionV2TimingDuration(timing.toolDurationMs)}
          </span>
          {slowestTimingEntry ? (
            <span className="min-w-0 max-w-full rounded-full border border-border bg-muted px-1.5 py-0.5">
              <span className="block truncate">
                最慢 {slowestTimingEntry.label} {formatAgentSessionV2TimingDuration(slowestTimingEntry.durationMs)}
              </span>
            </span>
          ) : null}
          {stopReasonText ? (
            <span className="rounded-full border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-amber-700">
              {stopReasonText}
            </span>
          ) : null}
        </div>
      ) : null}

      {understandingRows.length ? (
        <div className="mb-2 grid gap-1.5 sm:grid-cols-2">
          {understandingRows.map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-md border border-border bg-muted/80 px-2 py-1">
              <div className="mb-0.5 text-2xs font-semibold text-muted-foreground">{label}</div>
              <div className="break-words text-foreground">{compactAgentPanelText(value, 180)}</div>
            </div>
          ))}
        </div>
      ) : null}

      <PetChatAgentVisualObservationPanel process={process} />
      {!isLiveAgentRun ? <PetChatAgentSessionV2TracePanel session={session} /> : null}

      {session.steps.length ? (
        <div className="space-y-1.5">
          {session.steps.slice(-8).map((step) => (
            <div key={`agent-v2-step-${step.index}`} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-2 rounded-md border border-border bg-white/75 px-2 py-1.5">
              <span className="mt-0.5 text-2xs font-semibold text-muted-foreground">{step.index}</span>
              <span className="min-w-0">
                <span className="block break-words font-medium text-foreground">
                  {resolveAgentSessionV2StepTitle(step)}
                </span>
                {step.summary ? (
                  <span className="mt-0.5 block line-clamp-2 break-words text-2xs text-muted-foreground">
                    {compactAgentPanelText(step.summary, 180)}
                  </span>
                ) : null}
                {step.reason ? (
                  <span className="mt-0.5 block line-clamp-2 break-words text-2xs text-muted-foreground">
                    {compactAgentPanelText(step.reason, 160)}
                  </span>
                ) : null}
              </span>
              <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-2xs ${resolveAgentSessionV2StepClassName(step)}`}>
                {step.timing?.durationMs
                  ? `${resolveAgentSessionV2StepStatusText(step)} · ${formatAgentSessionV2TimingDuration(step.timing.durationMs)}`
                  : resolveAgentSessionV2StepStatusText(step)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-border bg-muted px-2 py-1.5 text-2xs text-muted-foreground">
          正在读取当前任务上下文。
        </div>
      )}

      {!isLiveAgentRun && genericToolResults.length ? (
        <div className="mt-2 rounded-md border border-emerald-100 bg-emerald-50/45 px-2 py-1.5">
          <div className="mb-1 text-2xs font-semibold text-emerald-700">工具结果</div>
          <div className="space-y-1">
            {genericToolResults.slice(-4).map((entry, index) => {
              const toolName = entry.command.toolCall?.name ?? entry.command.kind;
              const resultText = entry.result.ok === false
                ? entry.result.errorText ?? entry.result.responseText
                : entry.result.responseText;

              return (
                <div key={`agent-v2-tool-result-${index}-${toolName}`} className="min-w-0 rounded-md border border-emerald-100 bg-white/75 px-2 py-1">
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-semibold text-emerald-800">{toolName}</span>
                    <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-2xs ${
                      entry.result.ok === false
                        ? 'border-rose-100 bg-rose-50 text-rose-700'
                        : 'border-emerald-100 bg-emerald-50 text-emerald-700'
                    }`}>
                      {entry.result.ok === false ? '失败' : '成功'}
                    </span>
                  </div>
                  {resultText ? (
                    <div className="line-clamp-3 break-words text-2xs text-emerald-700">
                      {compactAgentPanelText(resultText, 220)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
