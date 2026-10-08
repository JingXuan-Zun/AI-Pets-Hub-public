import { type ChatAgentRunLoopRound, type ChatMessage } from '../../../types';
import { resolveAgentApprovalPermissionText } from './agentMessageStatus';

type ChatAgentAssessment = NonNullable<NonNullable<ChatMessage['agentRun']>['assessment']>;

function resolveAgentAssessmentStatusText(status: ChatAgentAssessment['status']) {
  switch (status) {
    case 'completed':
      return '已验证';
    case 'can-continue':
      return '可继续';
    case 'needs-user':
      return '需补充';
    case 'failed':
      return '失败';
    default:
      return '未复核';
  }
}

function resolveAgentAssessmentStatusClassName(status: ChatAgentAssessment['status']) {
  switch (status) {
    case 'completed':
      return 'border-emerald-100 bg-emerald-50 text-emerald-700';
    case 'can-continue':
      return 'border-amber-100 bg-amber-50 text-amber-700';
    case 'needs-user':
      return 'border-orange-100 bg-orange-50 text-orange-700';
    case 'failed':
      return 'border-rose-100 bg-rose-50 text-rose-700';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

export function PetChatAgentAssessmentPanel({
  assessment,
}: {
  assessment?: ChatAgentAssessment | null;
}) {
  if (!assessment) {
    return null;
  }

  return (
    <div className="mb-3 rounded-md border border-border bg-white/70 p-2 text-2xs leading-relaxed text-foreground">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">执行评估</span>
        <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-2xs ${resolveAgentAssessmentStatusClassName(assessment.status)}`}>
          {resolveAgentAssessmentStatusText(assessment.status)}
        </span>
      </div>
      <div className="break-words text-foreground">{assessment.summary}</div>
      {assessment.evidence.length ? (
        <div className="mt-1.5 space-y-0.5 text-2xs text-muted-foreground">
          {assessment.evidence.slice(0, 4).map((evidence) => (
            <div key={evidence} className="line-clamp-2 break-words">
              {evidence}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function resolveAgentRoundStatusText(status: ChatAgentRunLoopRound['status']) {
  switch (status) {
    case 'auto-continued':
      return '已续步';
    case 'awaiting-approval':
      return '待确认';
    case 'needs-user':
      return '需补充';
    case 'failed':
      return '失败';
    case 'blocked':
      return '停止';
    case 'max-rounds':
      return '到上限';
    case 'unverified':
      return '待复查';
    default:
      return '完成';
  }
}

function resolveAgentRoundStatusClassName(status: ChatAgentRunLoopRound['status']) {
  switch (status) {
    case 'completed':
      return 'border-emerald-100 bg-emerald-50 text-emerald-700';
    case 'auto-continued':
      return 'border-border bg-muted text-primary';
    case 'awaiting-approval':
    case 'needs-user':
    case 'max-rounds':
      return 'border-amber-100 bg-amber-50 text-amber-700';
    case 'failed':
      return 'border-rose-100 bg-rose-50 text-rose-700';
    case 'blocked':
      return 'border-orange-100 bg-orange-50 text-orange-700';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

export function PetChatAgentRunRoundsPanel({
  rounds,
}: {
  rounds?: ChatAgentRunLoopRound[];
}) {
  if (!rounds?.length) {
    return null;
  }

  return (
    <div className="mb-3 rounded-md border border-indigo-100 bg-indigo-50/45 p-2 text-2xs leading-relaxed text-indigo-950">
      <div className="mb-1.5 text-2xs font-semibold tracking-normal text-indigo-500">
        执行轮次
      </div>
      <div className="space-y-1.5">
        {rounds.map((round) => (
          <div key={`${round.index}-${round.actionLabel}`} className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-start gap-2">
            <span className="rounded-full border border-indigo-100 bg-white px-1.5 py-0.5 text-2xs text-indigo-600">
              第 {round.index} 轮
            </span>
            <span className="min-w-0">
              <span className="block break-words font-medium">{round.actionLabel}</span>
              {round.assessmentSummary ? (
                <span className="mt-0.5 block line-clamp-2 break-words text-2xs text-indigo-700">
                  {round.assessmentSummary}
                </span>
              ) : null}
              <span className="mt-0.5 block line-clamp-2 break-words text-2xs text-indigo-500">
                {round.stopReason}
              </span>
            </span>
            <span className={`rounded-full border px-1.5 py-0.5 text-2xs ${resolveAgentRoundStatusClassName(round.status)}`}>
              {resolveAgentRoundStatusText(round.status)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PetChatAgentStepList({
  plan,
}: {
  plan: NonNullable<ChatMessage['agentApproval']>['plan'];
}) {
  if (!plan.steps.length) {
    return null;
  }

  return (
    <div className="mb-3 rounded-md border border-border/50 bg-white/75 p-2">
      <div className="mb-1.5 text-2xs font-semibold tracking-normal text-primary">
        工具计划
      </div>
      <div className="space-y-1.5">
        {plan.steps.map((step, index) => (
          <div key={step.id} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-2 text-2xs leading-relaxed text-primary">
            <span className="text-primary/60">{index + 1}</span>
            <span className="min-w-0 break-words">
              <span className="block">{step.summary}</span>
              {step.details?.length ? (
                <span className="mt-1 block space-y-0.5 text-2xs leading-relaxed text-primary">
                  {step.details.map((detail) => (
                    <span key={detail} className="block break-words">
                      {detail}
                    </span>
                  ))}
                </span>
              ) : null}
            </span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-2xs text-primary">
              {resolveAgentApprovalPermissionText(step.decision.mode)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
