import type { GroupTaskProposal } from './groupTaskBridge';

export type GroupTaskProposalContext = {
  userDirectedTask: boolean;
  userAddressedRoleIds: string[];
};

export function canSubmitGroupTaskProposal(
  proposal: GroupTaskProposal,
  context: GroupTaskProposalContext,
) {
  return context.userDirectedTask
    && context.userAddressedRoleIds.includes(proposal.roleId)
    && Boolean(proposal.requestedCapability.trim())
    && Boolean(proposal.summary.trim());
}
