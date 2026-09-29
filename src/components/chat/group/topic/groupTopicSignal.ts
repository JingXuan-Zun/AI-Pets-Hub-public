import type { GroupRoleTurnOutput } from '../role/groupRoleTurnOutput';
import type { GroupTopicSignal } from '../role/groupTopicSignalProtocol';
import type { GroupChatRuntime } from '../runtime/groupChatRuntime';
import type { GroupTopicLifecycleInput } from './topicLifecycle';

export type GroupTopicSignalDecision = {
  lifecycleInput: GroupTopicLifecycleInput | null;
  suggestsDerivedTopic: boolean;
};

export function mapGroupTopicSignal(signal: GroupTopicSignal): GroupTopicSignalDecision {
  if (signal === 'disagreement') {
    return { lifecycleInput: { hasDisagreement: true }, suggestsDerivedTopic: false };
  }
  if (signal === 'waiting-information') {
    return { lifecycleInput: { waitingForInformation: true }, suggestsDerivedTopic: false };
  }
  if (signal === 'stage-conclusion') {
    return { lifecycleInput: { hasStageConclusion: true }, suggestsDerivedTopic: false };
  }
  return {
    lifecycleInput: null,
    suggestsDerivedTopic: signal === 'derive-topic',
  };
}

export function applyGroupRoleTopicSignal(
  runtime: GroupChatRuntime,
  output?: GroupRoleTurnOutput,
  context?: { roleId: string; turnId: string },
) {
  if (!output?.topicSignal || output.topicSignal === 'none') return false;
  const decision = mapGroupTopicSignal(output.topicSignal);
  if (decision.lifecycleInput) runtime.controller.updateTopic(decision.lifecycleInput, {
    reason: `role-${output.topicSignal}`,
    source: 'role-signal',
  });
  if (decision.suggestsDerivedTopic && context) {
    runtime.controller.suggestTopicDerivation(context);
  }
  return true;
}
