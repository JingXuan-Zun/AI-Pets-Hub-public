import { type AgentChatCommand } from '../../../agent';
import { type ChatMessage } from '../../../types';

export function getApprovalCommandDesktopOrganization(command: AgentChatCommand) {
  if (command.desktopOrganization) {
    return command.desktopOrganization;
  }

  if (command.toolCall?.name !== 'organize_desktop_icons') {
    return null;
  }

  const input = command.toolCall.input;
  const displayTarget = input.targetDisplay === 'primary'
    || input.targetDisplay === 'secondary'
    || input.targetDisplay === 'current'
    || input.targetDisplay === 'all'
    ? input.targetDisplay
    : input.displayTarget === 'primary'
      || input.displayTarget === 'secondary'
      || input.displayTarget === 'current'
      || input.displayTarget === 'all'
      ? input.displayTarget
      : undefined;
  const sourceDisplay = input.sourceDisplay === 'primary'
    || input.sourceDisplay === 'secondary'
    || input.sourceDisplay === 'current'
    || input.sourceDisplay === 'all'
    ? input.sourceDisplay
    : undefined;
  const scope = input.sourceScope === 'all-icons' || input.sourceScope === 'display-icons'
    ? input.sourceScope
    : input.scope === 'all-icons' || input.scope === 'display-icons'
      ? input.scope
      : undefined;
  return {
    displayTarget,
    groupBy: input.groupBy === 'none'
      || input.groupBy === 'kind'
      || input.groupBy === 'category'
      || input.groupBy === 'extension'
      ? input.groupBy
      : undefined,
    mode: input.mode === 'preview' || input.mode === 'execute'
      ? input.mode
      : undefined,
    scope,
    sourceDisplay,
    sourceScope: scope,
    targetDisplay: displayTarget,
  } satisfies NonNullable<AgentChatCommand['desktopOrganization']>;
}

export function findLatestDesktopOrganizationPreviewSummary(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const context = messages[index]?.agentRun?.context ?? messages[index]?.agentApproval?.context ?? null;
    const organization = context?.desktopOrganization;
    if (context?.kind === 'desktop-organization' && organization?.previewSummaryLines?.length) {
      return {
        lines: organization.previewSummaryLines,
        warning: organization.previewWarning ?? null,
      };
    }
  }

  return null;
}
