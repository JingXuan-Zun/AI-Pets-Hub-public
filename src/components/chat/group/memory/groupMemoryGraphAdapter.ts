import {
  buildCharacterContextPacket,
  createReadonlyCharacterGraphStore,
  type CharacterContextPacket,
  type CharacterGraphNode,
} from '../../../../character-graph';
import type {
  GroupMemoryRepositoryData,
  StoredGroupMemoryRecord,
} from '../../../../group-memory';
import { getReadableGroupMemoryGroupIds } from '../../../../group-memory';

function toGraphNode(record: StoredGroupMemoryRecord): CharacterGraphNode {
  return {
    confidence: record.confidence,
    createdAt: record.createdAt,
    eventAt: record.createdAt,
    groupId: record.groupId,
    id: record.id,
    invalidatedAt: record.invalidatedAt,
    kind: record.kind === 'role-perspective' ? 'character-belief' : 'episodic-memory',
    participantRoleIds: record.sourceRoleId === 'user' ? [] : [record.sourceRoleId],
    source: record.sourceRoleId,
    summary: record.summary,
    supersedesId: record.supersedesId,
    updatedAt: record.updatedAt,
    visibility: 'group',
  };
}

export function createGroupMemoryGraphNodes(repository: GroupMemoryRepositoryData) {
  return repository.records.map(toGraphNode);
}

export function buildGroupMemoryContextPacket(options: {
  groupId: string;
  now?: number;
  query: string;
  repository: GroupMemoryRepositoryData;
  roleId: string;
}): CharacterContextPacket {
  const now = options.now ?? Date.now();
  const store = createReadonlyCharacterGraphStore(createGroupMemoryGraphNodes(options.repository));
  const request = {
    groupIds: getReadableGroupMemoryGroupIds(
      options.repository, options.roleId, options.groupId,
    ),
    maxCharacters: 720, maxNodes: 3,
    now, query: options.query, roleId: options.roleId,
  };
  const packet = buildCharacterContextPacket(store, request);
  if (packet.items.length || !options.query.trim()) return packet;
  return buildCharacterContextPacket(store, { ...request, query: '' });
}
