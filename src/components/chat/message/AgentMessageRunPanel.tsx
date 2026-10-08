import { ChevronDown, ChevronUp, Loader2, StopCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { type DesktopPetChatSendOptions } from '../../../chatState';
import { type ChatMessage } from '../../../types';
import { PetChatAgentAssessmentPanel, PetChatAgentRunRoundsPanel, PetChatAgentStepList } from './AgentMessageAssessment';
import { resolveAgentProcessCollapsedSummary, shouldShowAgentFollowUpOutsideDetails } from './AgentMessageCollapsedNotice';
import { PetChatAgentProcessCompact } from './AgentMessageCompact';
import { PetChatAgentFollowUpActionButtons, resolveChatAgentFollowUpActions } from './AgentMessageFollowUp';
import { PetChatAgentProcessSummary } from './AgentMessageProcessSummary';
import { resolveAgentRunStatusText } from './agentMessageStatus';
import { PetChatAgentTraceList, PetChatAgentWorkStageList } from './AgentMessageTraceLists';

export function PetChatAgentRunPanel({
  message,
  onSendMessage,
  onStopAgentRun,
}: {
  message: ChatMessage;
  onSendMessage: (
    textOverride?: string,
    options?: DesktopPetChatSendOptions,
  ) => void | Promise<void>;
  onStopAgentRun?: (messageId?: string | null) => void;
}) {
  const run = message.agentRun;
  const isActiveRun = run?.status === 'running' || run?.status === 'planned' || run?.status === 'awaiting-approval';
  const canStopRun = Boolean(message.id && onStopAgentRun && (run?.status === 'running' || run?.status === 'planned'));
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsExpanded(false);
  }, [run?.id]);

  if (!run) {
    return null;
  }

  const statusText = resolveAgentRunStatusText(run.status);
  const shouldShowDetails = isExpanded;
  const collapsedSummary = resolveAgentProcessCollapsedSummary(run, statusText);

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0 text-2xs font-semibold text-foreground">
          <span className="block truncate">正在处理：{run.plan.goal}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-2xs font-medium text-primary">
            {isActiveRun ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            {statusText}
          </span>
          {canStopRun ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onStopAgentRun?.(message.id ?? null)}
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
          process={run}
          statusText={statusText}
          isActive={isActiveRun}
          summaryText={collapsedSummary}
        />
      ) : null}
      {shouldShowDetails ? <PetChatAgentProcessSummary process={run} /> : null}
      {shouldShowDetails ? <PetChatAgentWorkStageList stages={run.stages} /> : null}
      {shouldShowDetails ? <PetChatAgentAssessmentPanel assessment={run.assessment} /> : null}
      {shouldShowDetails ? <PetChatAgentRunRoundsPanel rounds={run.rounds} /> : null}
      {shouldShowDetails ? <PetChatAgentTraceList trace={run.trace} /> : null}
      {shouldShowDetails ? <PetChatAgentStepList plan={run.plan} /> : null}
      {run.resultText && shouldShowDetails && (
        <div className="mt-2 break-words text-2xs leading-relaxed text-primary">
          {run.resultText}
        </div>
      )}
      {run.errorText && shouldShowDetails && (
        <div className="mt-2 break-words text-2xs leading-relaxed text-rose-600">
          {run.errorText}
        </div>
      )}
      {run.followUpText && (shouldShowDetails || shouldShowAgentFollowUpOutsideDetails(run)) && (
        <div className="mt-2 rounded-md border border-amber-100 bg-amber-50 px-2 py-1.5 text-2xs leading-relaxed text-amber-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 flex-1">
              <span className="font-semibold">下一步：</span>
              <span className="break-words">{run.followUpText}</span>
            </span>
            <PetChatAgentFollowUpActionButtons
              actions={resolveChatAgentFollowUpActions(run.followUpAction, run.followUpActions)}
              onSendMessage={onSendMessage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
