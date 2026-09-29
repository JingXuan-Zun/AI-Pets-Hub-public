import type { CharacterGraphStore } from './characterGraphStore';
import type {
  CharacterContextPacket,
  CharacterContextRequest,
  CharacterGraphNode,
} from './characterGraphTypes';

function canReadNode(node: CharacterGraphNode, request: CharacterContextRequest) {
  if (node.invalidatedAt !== undefined) return false;
  if (node.visibility === 'world/public') return true;
  if (node.visibility === 'user-private') return request.includeUserPrivate === true;
  if (node.visibility === 'character-private') return node.ownerRoleId === request.roleId;
  return Boolean(node.groupId && request.groupIds.includes(node.groupId));
}

function keywords(text: string) {
  return [...new Set(text.normalize('NFKC').toLocaleLowerCase()
    .split(/[\s,，。！？!?、:：；;（）()]+/u)
    .map((word) => word.trim()).filter((word) => word.length >= 2))];
}

function scoreNode(node: CharacterGraphNode, request: CharacterContextRequest) {
  const queryKeywords = keywords(request.query);
  const searchable = `${node.summary} ${node.source}`.normalize('NFKC').toLocaleLowerCase();
  const matchCount = queryKeywords.filter((word) => searchable.includes(word)).length;
  const participantBonus = node.participantRoleIds.includes(request.roleId) ? 2 : 0;
  const ageDays = Math.max(0, request.now - node.eventAt) / 86_400_000;
  const recency = Math.max(0, 2 - Math.log2(ageDays + 1));
  return { matchCount, score: matchCount * 4 + participantBonus + recency + node.confidence * 2 };
}

function packetItem(node: CharacterGraphNode, matchCount: number) {
  const reason = [
    ...(matchCount > 0 ? [`query-match:${matchCount}`] : []),
    `visibility:${node.visibility}`,
    `confidence:${node.confidence.toFixed(2)}`,
  ];
  return {
    confidence: node.confidence, eventAt: node.eventAt, kind: node.kind,
    nodeId: node.id, reason, source: node.source, summary: node.summary,
    visibility: node.visibility,
  };
}

export function buildCharacterContextPacket(
  store: CharacterGraphStore,
  request: CharacterContextRequest,
): CharacterContextPacket {
  const readable = store.list().filter((node) => canReadNode(node, request));
  const ranked = readable.map((node) => ({ node, ...scoreNode(node, request) }))
    .filter((candidate) => candidate.matchCount > 0 || !request.query.trim())
    .sort((left, right) => right.score - left.score || right.node.eventAt - left.node.eventAt);
  const items = [] as CharacterContextPacket['items'];
  let totalCharacters = 0;
  for (const candidate of ranked) {
    if (items.length >= request.maxNodes) break;
    if (totalCharacters + candidate.node.summary.length > request.maxCharacters) continue;
    items.push(packetItem(candidate.node, candidate.matchCount));
    totalCharacters += candidate.node.summary.length;
  }
  return {
    droppedNodeCount: readable.length - items.length,
    items, requestRoleId: request.roleId, totalCharacters,
  };
}
