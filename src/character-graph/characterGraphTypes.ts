export type CharacterGraphNodeKind =
  | 'character-belief'
  | 'directed-relationship'
  | 'episodic-memory'
  | 'world-canon';

export type CharacterGraphVisibility =
  | 'character-private'
  | 'group'
  | 'user-private'
  | 'world/public';

export interface CharacterGraphNode {
  confidence: number;
  createdAt: number;
  eventAt: number;
  groupId?: string;
  id: string;
  invalidatedAt?: number;
  kind: CharacterGraphNodeKind;
  ownerRoleId?: string;
  participantRoleIds: string[];
  source: string;
  summary: string;
  supersedesId?: string;
  updatedAt: number;
  visibility: CharacterGraphVisibility;
}

export interface CharacterContextRequest {
  groupIds: string[];
  includeUserPrivate?: boolean;
  maxCharacters: number;
  maxNodes: number;
  now: number;
  query: string;
  roleId: string;
}

export interface CharacterContextPacketItem {
  confidence: number;
  eventAt: number;
  kind: CharacterGraphNodeKind;
  nodeId: string;
  reason: string[];
  source: string;
  summary: string;
  visibility: CharacterGraphVisibility;
}

export interface CharacterContextPacket {
  droppedNodeCount: number;
  items: CharacterContextPacketItem[];
  requestRoleId: string;
  totalCharacters: number;
}
