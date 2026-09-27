import type { GroupRoleTurnOutput } from '../role/groupRoleTurnOutput';
import { attachGroupRoleTaskProposal } from '../role/groupRoleTurnOutput';
import type { GroupTaskProposal } from './groupTaskBridge';
import { canSubmitGroupTaskProposal } from './groupTaskProposalPolicy';

export function resolveGroupTurnTaskProposal(options: {
  groupSessionId: string;
  output?: GroupRoleTurnOutput;
  roleId: string;
  topicId: string | null;
  turnId: string;
  userAddressedRoleIds: string[];
  userDirectedTask: boolean;
}): GroupTaskProposal | null {
  if (!options.output) {
    return null;
  }
  const proposal = attachGroupRoleTaskProposal({
    output: options.output,
    groupSessionId: options.groupSessionId,
    topicId: options.topicId,
    turnId: options.turnId,
    roleId: options.roleId,
  });
  if (!proposal) {
    return null;
  }

  return canSubmitGroupTaskProposal(proposal, options) ? proposal : null;
}
