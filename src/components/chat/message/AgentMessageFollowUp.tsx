import { Play } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { type DesktopPetChatSendOptions } from '../../../chatState';
import { type ChatMessage } from '../../../types';

export function PetChatAgentApprovalSummary({
  summary,
}: {
  summary?: NonNullable<ChatMessage['agentApproval']>['approvalSummary'];
}) {
  if (!summary?.lines.length) {
    return null;
  }

  return (
    <div className="mb-3 rounded-md border border-amber-100 bg-amber-50/70 p-2 text-2xs leading-relaxed text-amber-950">
      <div className="mb-1.5 font-semibold text-amber-900">
        {summary.title}
      </div>
      <div className="space-y-1">
        {summary.lines.slice(0, 5).map((line) => (
          <div key={line} className="break-words">
            {line}
          </div>
        ))}
      </div>
      {summary.warning ? (
        <div className="mt-1.5 rounded-md border border-amber-200 bg-white/65 px-2 py-1 text-2xs text-amber-800">
          {summary.warning}
        </div>
      ) : null}
    </div>
  );
}

export function resolveChatAgentFollowUpActions(
  followUpAction?: NonNullable<ChatMessage['agentRun']>['followUpAction'],
  followUpActions?: NonNullable<ChatMessage['agentRun']>['followUpActions'],
) {
  return followUpActions?.length
    ? followUpActions
    : followUpAction
      ? [followUpAction]
      : [];
}

export function PetChatAgentFollowUpActionButtons({
  actions,
  onSendMessage,
}: {
  actions?: NonNullable<ChatMessage['agentRun']>['followUpActions'];
  onSendMessage: (
    textOverride?: string,
    options?: DesktopPetChatSendOptions,
  ) => void | Promise<void>;
}) {
  if (!actions?.length) {
    return null;
  }

  const handleClick = (action: NonNullable<ChatMessage['agentRun']>['followUpAction']) => {
    if (action.kind === 'run-command') {
      void onSendMessage(`继续：${action.label}`, {
        agentFollowUpAction: action,
        browserSearchMode: 'block',
      });
      return;
    }

    void onSendMessage(action.prompt, {
      browserSearchMode: 'block',
    });
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1">
      {actions.map((action, index) => (
        <Button
          key={`${action.kind}-${action.label}-${index}`}
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => handleClick(action)}
          className="h-6 max-w-[168px] rounded-full border border-amber-200 bg-white/70 px-2 text-2xs font-medium text-amber-800 hover:bg-white"
          title={action.kind === 'run-command' ? `继续执行：${action.label}` : action.prompt}
        >
          <Play className="mr-1 h-3 w-3 shrink-0" />
          <span className="truncate">{action.label}</span>
        </Button>
      ))}
    </div>
  );
}
