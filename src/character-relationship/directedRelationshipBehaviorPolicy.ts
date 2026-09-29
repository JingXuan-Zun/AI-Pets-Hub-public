import type {
  DirectedRelationshipBehaviorPolicy,
  DirectedRelationshipRecord,
  DirectedRelationshipRepositoryData,
} from './directedRelationshipTypes';

function addressStyle(record: DirectedRelationshipRecord) {
  if (record.dimensions.vigilance >= 70 || record.dimensions.intimacy <= 30) return 'formal-distance' as const;
  if (record.dimensions.intimacy >= 70 && record.dimensions.vigilance < 70) return 'familiar-warm' as const;
  return 'neutral-polite' as const;
}

function verificationStyle(record: DirectedRelationshipRecord) {
  if (record.dimensions.trust <= 30 || record.dimensions.vigilance >= 70) return 'strict-verify' as const;
  if (record.dimensions.trust >= 70 && record.dimensions.vigilance < 70) return 'cooperative-verify' as const;
  return 'standard-verify' as const;
}

function sharingStyle(record: DirectedRelationshipRecord) {
  if (record.dimensions.trust <= 30 || record.dimensions.vigilance >= 70) return 'minimal' as const;
  if (record.dimensions.trust >= 70 && record.dimensions.intimacy >= 70
    && record.dimensions.vigilance <= 30) return 'open-with-boundaries' as const;
  return 'selective' as const;
}

function disagreementStyle(record: DirectedRelationshipRecord) {
  if (record.dimensions.trust <= 30 || record.dimensions.vigilance >= 70) return 'firm-boundary' as const;
  if (record.dimensions.trust >= 70 && record.dimensions.intimacy >= 70) return 'warm-clarification' as const;
  return 'evidence-first' as const;
}

function engagementStyle(record: DirectedRelationshipRecord) {
  if (record.dimensions.vigilance >= 70) return 'direct-and-limited' as const;
  if (record.dimensions.trust >= 70 && record.dimensions.intimacy >= 70) return 'acknowledge-and-build' as const;
  return 'normal-response' as const;
}

function supportStyle(record: DirectedRelationshipRecord) {
  if (record.dimensions.trust <= 30 || record.dimensions.vigilance >= 70) return 'withhold-automatic-defense' as const;
  if (record.dimensions.trust >= 70 && record.dimensions.intimacy >= 70) return 'support-with-evidence' as const;
  return 'independent-evaluation' as const;
}

export function deriveDirectedRelationshipBehaviorPolicy(
  record: DirectedRelationshipRecord,
): DirectedRelationshipBehaviorPolicy {
  return {
    addressStyle: addressStyle(record), disagreementStyle: disagreementStyle(record),
    engagementStyle: engagementStyle(record), policyVersion: 1, relationshipId: record.id,
    sharingStyle: sharingStyle(record), supportStyle: supportStyle(record),
    sourceDimensions: { ...record.dimensions }, sourceUpdatedAt: record.updatedAt,
    targetRoleId: record.targetRoleId, targetRoleName: record.targetRoleName || record.targetRoleId,
    verificationStyle: verificationStyle(record),
  };
}

export function buildDirectedRelationshipBehaviorPolicies(options: {
  repository: DirectedRelationshipRepositoryData;
  roleId: string;
  targetRoleIds?: string[];
}) {
  const targets = options.targetRoleIds ? new Set(options.targetRoleIds) : null;
  return options.repository.records.filter((record) => (
    record.invalidatedAt === undefined && record.sourceRoleId === options.roleId
    && (!targets || targets.has(record.targetRoleId))
  )).map(deriveDirectedRelationshipBehaviorPolicy);
}
