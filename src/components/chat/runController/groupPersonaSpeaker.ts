import { type GroupTaskLifecycleCallbacks, runGroupTaskExplanationLifecycle } from '../group/task/groupTaskApprovalLifecycle';
import { speakAgentProductionSessionResult } from './productionPersonaSpeaker';

export async function speakGroupTaskProductionResult(options: {
  groupTaskLifecycle?: GroupTaskLifecycleCallbacks;
  speakOptions: Parameters<typeof speakAgentProductionSessionResult>[0];
}) {
  const event = options.speakOptions.preparedRequest.groupTaskConversationEvent;
  const request = options.speakOptions.preparedRequest;
  const reporterRoleId = request.groupTaskCandidate?.collaborationPlan?.reporterRoleId;
  const reporterSlot = request.targetSlots.find((slot) => slot.id === reporterRoleId);
  const speakOptions = reporterSlot ? { ...options.speakOptions, targetSlot: reporterSlot } : options.speakOptions;
  const roleId = speakOptions.targetSlot?.id;
  await runGroupTaskExplanationLifecycle({
    callbacks: options.groupTaskLifecycle,
    event,
    execute: () => speakAgentProductionSessionResult(speakOptions),
    roleId,
  });
}
