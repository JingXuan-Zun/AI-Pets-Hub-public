import type { AgentChatEntryRouteDecision } from '../../../../agent/agentChatEntryRouter';
import type { DesktopPetSlot } from '../../../../multiPetRoster';
import { resolveUserAddressedGroupChatSlots } from '../../chatGroupUserAddressing';
import { arbitrateGroupTask } from './groupTaskArbiter';
import { createGroupTaskCandidate, type GroupTaskCandidate } from './groupTaskBridge';
import { canSubmitGroupTaskProposal } from './groupTaskProposalPolicy';
import { createGroupTaskCollaborationPlan } from './groupTaskCollaborationPlan';

export function resolveRoutedGroupTask(options: {
  decision: AgentChatEntryRouteDecision;
  groupSessionId: string;
  sourceText: string;
  targetSlots: DesktopPetSlot[];
  topicId: string | null;
}): GroupTaskCandidate | null {
  if (options.decision.mode !== 'agent') {
    return null;
  }
  const addressedSlots = resolveUserAddressedGroupChatSlots(options.sourceText, options.targetSlots);
  const roleId = addressedSlots[0]?.id;
  if (!roleId) {
    return null;
  }
  const proposal = {
    groupSessionId: options.groupSessionId,
    topicId: options.topicId,
    turnId: `user-${options.groupSessionId}`,
    roleId,
    summary: options.decision.rewrittenGoal || options.sourceText,
    requestedCapability: 'agent-runtime-routing',
  };
  if (!canSubmitGroupTaskProposal(proposal, {
    userDirectedTask: true,
    userAddressedRoleIds: addressedSlots.map((slot) => slot.id),
  })) {
    return null;
  }
  const collaborationPlan = createGroupTaskCollaborationPlan(
    options.targetSlots.map((slot) => slot.id), roleId,
  );
  const candidate = createGroupTaskCandidate([proposal], collaborationPlan);
  if (!candidate || arbitrateGroupTask(candidate).action !== 'submit-to-agent-runtime') {
    return null;
  }
  return candidate;
}
