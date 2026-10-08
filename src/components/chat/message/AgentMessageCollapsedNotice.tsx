import { type ChatMessage } from '../../../types';
import { resolveChatAgentRuntimeContinuation } from '../chatAgentRuntimeCompatibility';
import { compactAgentPanelText, resolveAgentProcessCurrentStage, resolveAgentSessionV2CurrentTitle } from './agentMessageProgress';
import { type ChatAgentProcessPanelSource } from './agentMessageTypes';

export function resolveAgentProcessCollapsedSummary(
  process: ChatAgentProcessPanelSource,
  statusText: string,
) {
  const isWaiting = process.status === 'awaiting-approval' || process.status === 'pending';
  const isActive = process.status === 'running' || process.status === 'planned';
  const isProblem = process.status === 'failed' || process.status === 'blocked';
  if (!isWaiting && !isActive && !isProblem) {
    return '';
  }

  const agentRuntime = resolveChatAgentRuntimeContinuation(process);
  if (agentRuntime) {
    const latestStep = agentRuntime.steps[agentRuntime.steps.length - 1] ?? null;
    const summary = isProblem
      ? process.errorText || process.followUpText || latestStep?.summary || statusText
      : isWaiting
        ? process.followUpText || latestStep?.summary || statusText
        : resolveAgentSessionV2CurrentTitle(process, statusText);

    return compactAgentPanelText(summary, 110);
  }

  const urgentStage = resolveAgentProcessCurrentStage(process.stages);
  const urgentSummary = isProblem
    ? process.errorText || process.followUpText || process.assessment?.summary || urgentStage?.summary || statusText
    : isWaiting
      ? process.followUpText || urgentStage?.summary || statusText
      : urgentStage?.title || statusText;

  return compactAgentPanelText(urgentSummary, 110);
}

export function resolveAgentApprovalCollapsedSummary(
  approval: NonNullable<ChatMessage['agentApproval']>,
  statusText: string,
) {
  if (approval.status === 'pending') {
    const title = approval.approvalSummary?.title?.trim() ?? '';
    const firstLine = approval.approvalSummary?.lines[0]?.trim() ?? '';
    return compactAgentPanelText(
      (title && firstLine ? `${title}: ${firstLine}` : firstLine || title)
      || `这一步要动到电脑，需要你确认`,
    );
  }

  return resolveAgentProcessCollapsedSummary(approval, statusText);
}

function resolveAgentCollapsedNoticeClassName(status: ChatAgentProcessPanelSource['status']) {
  if (status === 'failed') {
    return 'border-rose-100 bg-rose-50/70 text-rose-700';
  }

  if (status === 'blocked' || status === 'awaiting-approval' || status === 'pending') {
    return 'border-amber-100 bg-amber-50/70 text-amber-800';
  }

  return 'border-border bg-muted/55 text-primary';
}

export function shouldShowAgentFollowUpOutsideDetails(process: ChatAgentProcessPanelSource) {
  return process.status === 'blocked'
    || process.status === 'failed'
    || process.status === 'awaiting-approval'
    || process.status === 'pending';
}

function PetChatAgentCollapsedNotice({
  process,
  text,
}: {
  process: ChatAgentProcessPanelSource;
  text: string;
}) {
  if (!text) {
    return null;
  }

  return (
    <div className={`mb-2 rounded-md border px-2 py-1 text-2xs leading-relaxed ${resolveAgentCollapsedNoticeClassName(process.status)}`}>
      <span className="line-clamp-2 break-words">{text}</span>
    </div>
  );
}
