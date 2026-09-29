import {
  buildCharacterContextPacket,
  createReadonlyCharacterGraphStore,
  type CharacterGraphNode,
} from '../character-graph';
import type {
  DirectedRelationshipRecord,
  DirectedRelationshipRepositoryData,
} from './directedRelationshipTypes';

function tendency(label: string, value: number, low: string, high: string) {
  if (value >= 70) return `${label}:${high}`;
  if (value <= 30) return `${label}:${low}`;
  return `${label}:中性`;
}

export function summarizeDirectedRelationship(record: DirectedRelationshipRecord) {
  const target = record.targetRoleName || record.targetRoleId;
  const behavior = [
    tendency('信任', record.dimensions.trust, '谨慎核验对方说法', '较愿意采纳但仍以事实证据为准'),
    tendency('亲密', record.dimensions.intimacy, '保持礼貌距离', '表达可以更熟悉温和'),
    tendency('警惕', record.dimensions.vigilance, '正常开放交流', '减少私人信息并注意边界'),
  ].join('；');
  return `你对“${target}”的定向关系：信任 ${record.dimensions.trust}，亲密 ${record.dimensions.intimacy}，警惕 ${record.dimensions.vigilance}。行为倾向：${behavior}。`;
}

function toGraphNode(record: DirectedRelationshipRecord): CharacterGraphNode {
  return {
    confidence: 1, createdAt: record.createdAt, eventAt: record.updatedAt,
    id: `relationship:${record.id}`, invalidatedAt: record.invalidatedAt,
    kind: 'directed-relationship', ownerRoleId: record.sourceRoleId,
    participantRoleIds: [record.sourceRoleId, record.targetRoleId],
    source: 'directed-relationship-repository', summary: summarizeDirectedRelationship(record),
    updatedAt: record.updatedAt, visibility: 'character-private',
  };
}

export function buildDirectedRelationshipContextPacket(options: {
  now?: number;
  repository: DirectedRelationshipRepositoryData;
  roleId: string;
  targetRoleIds?: string[];
}) {
  const targetRoleIds = new Set(options.targetRoleIds ?? []);
  const records = options.repository.records.filter((record) => (
    record.sourceRoleId === options.roleId
    && (targetRoleIds.size === 0 || targetRoleIds.has(record.targetRoleId))
  ));
  const store = createReadonlyCharacterGraphStore(records.map(toGraphNode));
  return buildCharacterContextPacket(store, {
    groupIds: [], maxCharacters: 900, maxNodes: 6, now: options.now ?? Date.now(),
    query: '', roleId: options.roleId,
  });
}
