import { desktopPetChatStore } from '../../../../chatStore';
import type { PreparedChatSendRequest } from '../../chatMessageSendFlowTypes';
import type { UsePetChatMessageSenderOptions } from '../../petChatMessageSenderTypes';
import { advanceGroupTaskCollaborationPlan, failGroupTaskCollaborationPlan } from './groupTaskCollaborationPlan';

type RunPetResponseTurn = UsePetChatMessageSenderOptions['runPetResponseTurn'];

function resolveRole(request: PreparedChatSendRequest, roleId: string) {
  return request.targetSlots.find((slot) => slot.id === roleId) ?? null;
}

async function runCollaborationRole(options: {
  promptText: string;
  request: PreparedChatSendRequest;
  roleId: string;
  runPetResponseTurn: RunPetResponseTurn;
}) {
  const targetSlot = resolveRole(options.request, options.roleId);
  if (!targetSlot) return false;
  const result = await options.runPetResponseTurn(targetSlot, {
    chatMode: 'group',
    historyMessages: desktopPetChatStore.getState().messages,
    participantNames: options.request.targetSlots.map((slot) => slot.personality.name),
    promptText: options.promptText,
    shouldAutoSpeakReply: false,
    playbackToken: options.request.playbackToken,
    requestToken: options.request.requestToken,
  });
  return !result.cancelled;
}

export async function runGroupTaskCollaborationPreflight(options: {
  request: PreparedChatSendRequest;
  runPetResponseTurn: RunPetResponseTurn;
}) {
  const candidate = options.request.groupTaskCandidate;
  let plan = candidate?.collaborationPlan;
  if (!candidate || !plan || plan.currentStage !== 'analysis') return true;
  try {
    const analyzed = await runCollaborationRole({
      promptText: `用户任务：${candidate.summary}\n你负责先分析目标、风险和建议步骤。只说分析结论，不调用工具，不声称已经执行。`,
      request: options.request, roleId: plan.analystRoleId, runPetResponseTurn: options.runPetResponseTurn,
    });
    if (!analyzed) return false;
    plan = advanceGroupTaskCollaborationPlan(plan);
    candidate.collaborationPlan = plan;
    const reviewed = await runCollaborationRole({
      promptText: `用户任务：${candidate.summary}\n你负责复查上一位角色的分析，指出遗漏、风险或确认可执行。只做复查，不调用工具。`,
      request: options.request, roleId: plan.reviewerRoleId, runPetResponseTurn: options.runPetResponseTurn,
    });
    if (!reviewed) return false;
    candidate.collaborationPlan = advanceGroupTaskCollaborationPlan(plan);
    return true;
  } catch {
    candidate.collaborationPlan = failGroupTaskCollaborationPlan(plan);
    return false;
  }
}
