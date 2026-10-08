import { Check, ChevronDown, ChevronUp, Loader2, StopCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { type DesktopPetChatSendOptions } from '../../../chatState';
import { type ChatAgentApprovalDecision, type ChatMessage } from '../../../types';
import { PetChatAgentAssessmentPanel, PetChatAgentRunRoundsPanel, PetChatAgentStepList } from './AgentMessageAssessment';
import { resolveAgentApprovalCollapsedSummary, shouldShowAgentFollowUpOutsideDetails } from './AgentMessageCollapsedNotice';
import { PetChatAgentProcessCompact } from './AgentMessageCompact';
import { PetChatAgentApprovalSummary, PetChatAgentFollowUpActionButtons, resolveChatAgentFollowUpActions } from './AgentMessageFollowUp';
import { PetChatAgentProcessSummary } from './AgentMessageProcessSummary';
import { resolveAgentApprovalStatusText } from './agentMessageStatus';
import { PetChatAgentTraceList, PetChatAgentWorkStageList } from './AgentMessageTraceLists';

export function PetChatAgentApprovalPanel({
  message,
  onResolveAgentApproval,
  onSendMessage,
  onStopAgentRun,
}: {
  message: ChatMessage;
  onResolveAgentApproval?: (messageId: string, decision: ChatAgentApprovalDecision) => void | Promise<void>;
  onSendMessage: (
    textOverride?: string,
    options?: DesktopPetChatSendOptions,
  ) => void | Promise<void>;
  onStopAgentRun?: (messageId?: string | null) => void;
}) {
  const approval = message.agentApproval;
  const messageId = message.id ?? '';
  const isActiveApproval = approval?.status === 'pending' || approval?.status === 'running' || approval?.status === 'awaiting-approval';
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsExpanded(false);
  }, [approval?.id]);

  if (!approval) {
    return null;
  }

  const isPending = approval.status === 'pending';
  const isRunning = approval.status === 'running';
  const shouldShowDetails = isExpanded;
  const canResolve = Boolean(messageId && onResolveAgentApproval && isPending);
  const canStopApproval = Boolean(messageId && onStopAgentRun && isActiveApproval);
  const statusText = resolveAgentApprovalStatusText(approval.status);
  const collapsedSummary = resolveAgentApprovalCollapsedSummary(approval, statusText);
  const pendingPrimaryText = `\u51c6\u5907\u6267\u884c\uff1a${approval.plan.goal}`;
  const pendingHelperText = isPending
    ? '\u786e\u8ba4\u540e\u4f1a\u76f4\u63a5\u6267\u884c\u8fd9\u4e00\u6b65\uff1b\u8be6\u60c5\u53ea\u662f\u7ed9\u4f60\u68c0\u67e5\u7528\u3002'
    : isRunning
      ? '\u6b63\u5728\u6267\u884c\u521a\u624d\u786e\u8ba4\u7684\u64cd\u4f5c\u3002'
      : collapsedSummary;

  const resolveApproval = (decision: ChatAgentApprovalDecision) => {
    if (!canResolve) {
      return;
    }

    void onResolveAgentApproval?.(messageId, decision);
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0 text-2xs font-semibold text-foreground">
          <span className="block truncate">确认这一步：{approval.plan.goal}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-2xs font-medium text-primary">
            {isRunning ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            {statusText}
          </span>
          {canStopApproval ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onStopAgentRun?.(messageId)}
              className="h-6 rounded-full border border-rose-100 px-2 text-2xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              title={'\u7ec8\u6b62\u5f53\u524d Agent \u6267\u884c'}
            >
              <StopCircle className="mr-1 h-3 w-3" />
              {'\u7ec8\u6b62'}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded((current) => !current)}
            className="h-6 rounded-full border border-border px-2 text-2xs text-primary hover:bg-muted"
            title={isExpanded ? '收起处理详情' : '展开处理详情'}
          >
            {isExpanded ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
            {isExpanded ? '收起' : '详情'}
          </Button>
        </div>
      </div>
      {!shouldShowDetails ? (
        <PetChatAgentProcessCompact
          process={approval}
          statusText={statusText}
          isActive={isActiveApproval}
          summaryText={collapsedSummary}
        />
      ) : null}
      {shouldShowDetails ? <PetChatAgentProcessSummary process={approval} /> : null}
      {shouldShowDetails ? <PetChatAgentApprovalSummary summary={approval.approvalSummary} /> : null}
      {shouldShowDetails ? <PetChatAgentWorkStageList stages={approval.stages} /> : null}
      {shouldShowDetails ? <PetChatAgentAssessmentPanel assessment={approval.assessment} /> : null}
      {shouldShowDetails ? <PetChatAgentRunRoundsPanel rounds={approval.rounds} /> : null}
      {shouldShowDetails ? <PetChatAgentTraceList trace={approval.trace} /> : null}
      {shouldShowDetails ? <PetChatAgentStepList plan={approval.plan} /> : null}
      {approval.resultText && approval.status !== 'pending' && shouldShowDetails && (
        <div className="mt-2 break-words text-2xs leading-relaxed text-primary">
          {approval.resultText}
        </div>
      )}
      {approval.errorText && shouldShowDetails && (
        <div className="mt-2 break-words text-2xs leading-relaxed text-rose-600">
          {approval.errorText}
        </div>
      )}
      {approval.followUpText && approval.status !== 'pending' && (shouldShowDetails || shouldShowAgentFollowUpOutsideDetails(approval)) && (
        <div className="mt-2 rounded-md border border-amber-100 bg-amber-50 px-2 py-1.5 text-2xs leading-relaxed text-amber-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 flex-1">
              <span className="font-semibold">下一步：</span>
              <span className="break-words">{approval.followUpText}</span>
            </span>
            <PetChatAgentFollowUpActionButtons
              actions={resolveChatAgentFollowUpActions(approval.followUpAction, approval.followUpActions)}
              onSendMessage={onSendMessage}
            />
          </div>
        </div>
      )}
      {isPending || isRunning ? (
        <div className="mt-2 rounded-md border border-amber-100 bg-amber-50 px-2 py-1.5 text-2xs leading-relaxed text-amber-900">
          <div className="font-semibold">{pendingPrimaryText}</div>
          <div className="mt-0.5 text-2xs text-amber-800">{pendingHelperText}</div>
        </div>
      ) : null}
      {isPending || isRunning ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!canResolve || isRunning}
            onClick={() => resolveApproval('approve')}
            className="h-7 rounded-full bg-primary px-3 text-2xs text-white hover:bg-primary disabled:opacity-70"
            title="允许这一步"
          >
            {isRunning ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
            允许
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canResolve || isRunning}
            onClick={() => resolveApproval('deny')}
            className="h-7 rounded-full border border-border px-3 text-2xs text-primary hover:bg-muted"
            title="拒绝这一步"
          >
            <X className="mr-1 h-3 w-3" />
            拒绝
          </Button>
        </div>
      ) : null}
    </div>
  );
}
