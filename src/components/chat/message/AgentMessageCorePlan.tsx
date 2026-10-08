import { type ChatAgentProcessPanelSource } from './agentMessageTypes';

function resolveAgentCoreStepPhaseText(phase: NonNullable<ChatAgentProcessPanelSource['corePlanSummary']>['taskSteps'][number]['phase']) {
  switch (phase) {
    case 'observe':
      return '观察';
    case 'plan':
      return '计划';
    case 'execute':
      return '执行';
    case 'verify':
      return '验证';
    case 'recover':
      return '恢复';
    default:
      return '步骤';
  }
}

export function PetChatAgentCorePlanSummary({
  summary,
}: {
  summary?: ChatAgentProcessPanelSource['corePlanSummary'];
}) {
  if (!summary?.taskSteps.length) {
    return null;
  }

  return (
    <div className="mt-2 rounded-md border border-violet-100 bg-violet-50/40 px-2 py-1.5 text-2xs leading-relaxed text-foreground">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-semibold text-violet-800">Agent Core 计划</span>
        <span className="shrink-0 rounded-full border border-violet-100 bg-white/70 px-1.5 py-0.5 text-violet-600">
          {summary.status}
        </span>
      </div>
      <div className="mb-1 break-words text-violet-700">
        {summary.taskSummary}
      </div>
      <div className="space-y-0.5">
        {summary.taskSteps.slice(0, 5).map((step) => (
          <div key={`core-step-${step.index}`} className="flex items-start gap-1.5">
            <span className="shrink-0 font-semibold text-violet-500">
              {step.index}. {resolveAgentCoreStepPhaseText(step.phase)}
            </span>
            <span className="min-w-0 flex-1 break-words">
              {step.tool}
              {step.selected ? <span className="ml-1 text-violet-500">当前</span> : null}
              <span className="ml-1 text-muted-foreground">
                {step.requiresApproval ? '需要确认' : step.permissionStatus}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
