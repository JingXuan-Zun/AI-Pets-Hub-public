import type { GroupTaskProposal } from '../task/groupTaskBridge';
import type { GroupTopicSignal } from './groupTopicSignalProtocol';
import type { GroupRelationshipSignal } from '../relationship/groupRelationshipSignalProtocol';
import type { GroupContributionSignal } from './groupContributionSignalProtocol';

export type GroupRoleTurnOutput = {
  text: string;
  contributionSignal?: GroupContributionSignal;
  relationshipSignal?: GroupRelationshipSignal;
  topicSignal?: GroupTopicSignal;
  taskProposal?: Omit<GroupTaskProposal, 'groupSessionId' | 'topicId' | 'turnId' | 'roleId'>;
};

export function attachGroupRoleTaskProposal(options: {
  output: GroupRoleTurnOutput;
  groupSessionId: string;
  roleId: string;
  topicId: string | null;
  turnId: string;
}): GroupTaskProposal | null {
  if (!options.output.taskProposal) {
    return null;
  }

  return {
    ...options.output.taskProposal,
    groupSessionId: options.groupSessionId,
    topicId: options.topicId,
    turnId: options.turnId,
    roleId: options.roleId,
  };
}
