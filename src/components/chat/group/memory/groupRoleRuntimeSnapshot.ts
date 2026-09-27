import type { DesktopPetSlot } from '../../../../multiPetRoster';
import type { CharacterContextPacket } from '../../../../character-graph';
import {
  buildDirectedRelationshipContextPacket,
  buildDirectedRelationshipBehaviorPolicies,
  buildDirectedRelationshipBehaviorPromptLines,
  EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  type DirectedRelationshipBehaviorPolicy,
  type DirectedRelationshipRepositoryData,
} from '../../../../character-relationship';
import {
  CURRENT_GROUP_MEMORY_GROUP_ID,
  type GroupMemoryRepositoryData,
} from '../../../../group-memory';
import { buildGroupMemoryContextPacket } from './groupMemoryGraphAdapter';

export interface GroupRoleRuntimeSnapshot {
  groupMemorySummaries: string[];
  memoryContextPacket: CharacterContextPacket;
  relationshipContextPacket: CharacterContextPacket;
  relationshipBehaviorPolicies: DirectedRelationshipBehaviorPolicy[];
  relationshipSummaries: string[];
  hasPrivateMemory: boolean;
  personaAnchor: string;
  roleId: string;
}

export function createGroupRoleRuntimeSnapshot(
  targetSlot: Pick<DesktopPetSlot, 'id' | 'personality'>,
  options: {
    activeRoleIds?: string[];
    behaviorTargetRoleIds?: string[];
    groupId?: string;
    now?: number;
    query?: string;
    repository: GroupMemoryRepositoryData;
    relationshipRepository?: DirectedRelationshipRepositoryData;
  },
): GroupRoleRuntimeSnapshot {
  const memoryContextPacket = buildGroupMemoryContextPacket({
    groupId: options.groupId ?? CURRENT_GROUP_MEMORY_GROUP_ID,
    now: options.now,
    query: options.query ?? '',
    repository: options.repository,
    roleId: targetSlot.id,
  });
  const relationshipContextPacket = buildDirectedRelationshipContextPacket({
    now: options.now,
    repository: options.relationshipRepository ?? EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
    roleId: targetSlot.id,
    targetRoleIds: options.activeRoleIds?.filter((roleId) => roleId !== targetSlot.id),
  });
  const relationshipBehaviorPolicies = buildDirectedRelationshipBehaviorPolicies({
    repository: options.relationshipRepository ?? EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
    roleId: targetSlot.id,
    targetRoleIds: options.behaviorTargetRoleIds
      ?? options.activeRoleIds?.filter((roleId) => roleId !== targetSlot.id),
  });
  return {
    groupMemorySummaries: memoryContextPacket.items.map((item) => (
      `[${item.kind}｜source=${item.source}｜confidence=${item.confidence.toFixed(2)}]\n${item.summary}`
    )),
    hasPrivateMemory: Boolean(targetSlot.personality.userMemory.trim()),
    memoryContextPacket,
    personaAnchor: targetSlot.personality.systemInstruction.trim(),
    relationshipContextPacket,
    relationshipBehaviorPolicies,
    relationshipSummaries: relationshipContextPacket.items.map((item) => item.summary),
    roleId: targetSlot.id,
  };
}

export function buildGroupMemorySnapshotPromptLines(snapshot?: GroupRoleRuntimeSnapshot) {
  if (!snapshot) return [];
  const memoryLines = snapshot.groupMemorySummaries.length ? [
    `可参考的群体记忆摘要：\n${snapshot.groupMemorySummaries.join('\n')}`,
    '群体记忆仅作背景参考，不得覆盖当前角色人格、身份、称呼和本轮明确事实。',
  ] : [];
  const relationshipLines = snapshot.relationshipSummaries.length ? [
    `你对其他角色的定向关系参考：\n${snapshot.relationshipSummaries.join('\n')}`,
    '关系只影响语气、距离、信任和信息分享倾向；不得覆盖人格、篡改事实、替代发言调度或直接触发工具。',
  ] : [];
  return [
    ...memoryLines,
    ...relationshipLines,
    ...buildDirectedRelationshipBehaviorPromptLines(snapshot.relationshipBehaviorPolicies),
  ];
}
