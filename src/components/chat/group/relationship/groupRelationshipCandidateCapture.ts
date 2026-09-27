import {
  createDirectedRelationshipCandidate,
  enqueueDirectedRelationshipCandidate,
  recordDirectedRelationshipBehaviorTrace,
} from '../../../../character-relationship';
import type { PetConfig, PetConfigUpdateHandler } from '../../../../types';
import type { ChatSendTargetSlot } from '../../chatMessageSendUtils';
import type { GroupRoleTurnOutput } from '../role/groupRoleTurnOutput';

export type GroupRelationshipTurnCaptureInput = {
  addressedRoleIds: string[];
  behaviorTargetRoleIds: string[];
  groupSessionId: string;
  groupRoleTurnOutput?: GroupRoleTurnOutput;
  sourceMessageId: string;
  sourceRoleId: string;
  sourceRoleName: string;
  topicId: string | null;
};

function resolveTargetSlot(name: string, targetSlots: ChatSendTargetSlot[]) {
  const normalized = name.trim().toLocaleLowerCase();
  return targetSlots.find((slot) => slot.personality.name.trim().toLocaleLowerCase() === normalized);
}

export function captureGroupRelationshipTurnArtifacts(options: {
  configRef: { current: PetConfig };
  input: GroupRelationshipTurnCaptureInput;
  onUpdateConfig: PetConfigUpdateHandler;
  targetSlots: ChatSendTargetSlot[];
}) {
  const repository = options.configRef.current.directedRelationshipRepository;
  let nextRepository = recordDirectedRelationshipBehaviorTrace(repository, {
    addressedRoleIds: options.input.addressedRoleIds,
    behaviorTargetRoleIds: options.input.behaviorTargetRoleIds,
    groupSessionId: options.input.groupSessionId,
    sourceMessageId: options.input.sourceMessageId,
    sourceRoleId: options.input.sourceRoleId,
    sourceRoleName: options.input.sourceRoleName,
    topicId: options.input.topicId,
  });
  const signal = options.input.groupRoleTurnOutput?.relationshipSignal;
  if (signal) {
    const targetSlot = resolveTargetSlot(signal.targetRoleName, options.targetSlots);
    const candidate = createDirectedRelationshipCandidate(nextRepository, {
      activeRoleIds: options.targetSlots.map((slot) => slot.id), deltas: signal.deltas,
      evidenceExcerpt: options.input.groupRoleTurnOutput?.text ?? '', reason: signal.reason,
      sourceMessageId: options.input.sourceMessageId, sourceRoleId: options.input.sourceRoleId,
      sourceRoleName: options.input.sourceRoleName,
      targetRoleId: targetSlot?.id ?? `unresolved:${signal.targetRoleName}`,
      targetRoleName: targetSlot?.personality.name ?? signal.targetRoleName,
    });
    nextRepository = enqueueDirectedRelationshipCandidate(nextRepository, candidate);
  }
  if (nextRepository === repository) return false;
  const nextConfig = { ...options.configRef.current, directedRelationshipRepository: nextRepository };
  options.configRef.current = nextConfig;
  options.onUpdateConfig(nextConfig, { normalize: false, persist: true, priority: 'low' });
  return true;
}
