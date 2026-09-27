import type { DirectedRelationshipDimensions } from '../character-relationship';

export type SmallGroupCandidateRelationshipSnapshot = {
  dimensions: DirectedRelationshipDimensions;
  relationshipId: string;
  updatedAt: number;
};

export type SmallGroupCandidate = {
  claimLevel: 'read-only-candidate';
  id: string;
  memberRoleIds: [string, string];
  memberRoleNames: [string, string];
  publicMemoryRecordCount: number;
  relationships: [
    SmallGroupCandidateRelationshipSnapshot,
    SmallGroupCandidateRelationshipSnapshot,
  ];
  sharedTopicCount: number;
};
