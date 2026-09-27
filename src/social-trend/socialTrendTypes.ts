import type { DirectedRelationshipDimensions } from '../character-relationship';

export type DirectedRelationshipDimensionDelta = DirectedRelationshipDimensions;

export type SocialTrendMemoryGroupTopics = {
  memoryGroupId: string;
  sharedTopicCount: number;
  sharedTopicIds: string[];
};

export type DirectedRelationshipSocialTrend = {
  active: boolean;
  approvedReviewCount: number;
  baselineDimensions: DirectedRelationshipDimensions;
  claimLevel: 'shadow-readonly';
  currentDimensions: DirectedRelationshipDimensions;
  delta: DirectedRelationshipDimensionDelta;
  formalAuditCount: number;
  historyTruncated: boolean;
  operationRollbackCount: number;
  policySuppliedCount: number;
  relationshipId: string;
  reviewRollbackCount: number;
  sharedMemoryGroups: SocialTrendMemoryGroupTopics[];
  sharedTopicCount: number;
  sharedTopicIds: string[];
  sourceRoleId: string;
  targetRoleId: string;
  targetRoleName: string;
  windowEndAt: number;
  windowStartAt: number;
};
