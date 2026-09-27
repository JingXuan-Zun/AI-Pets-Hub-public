import type {
  DirectedRelationshipCandidate,
  DirectedRelationshipDimensions,
} from './directedRelationshipTypes';

export type DirectedRelationshipCandidateGroup = {
  approvableCandidateIds: string[];
  blockedCount: number;
  candidateIds: string[];
  deltas: DirectedRelationshipDimensions;
  id: string;
  sourceRoleId: string;
  sourceRoleName: string;
  targetRoleId: string;
  targetRoleName: string;
};

function addDeltas(
  left: DirectedRelationshipDimensions,
  right: DirectedRelationshipDimensions,
) {
  return {
    intimacy: left.intimacy + right.intimacy,
    trust: left.trust + right.trust,
    vigilance: left.vigilance + right.vigilance,
  };
}

export function buildDirectedRelationshipCandidateGroups(
  candidates: DirectedRelationshipCandidate[],
): DirectedRelationshipCandidateGroup[] {
  const groups = new Map<string, DirectedRelationshipCandidate[]>();
  candidates.filter((candidate) => candidate.status === 'pending')
    .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))
    .forEach((candidate) => {
      const id = `${candidate.sourceRoleId}->${candidate.targetRoleId}`;
      groups.set(id, [...(groups.get(id) ?? []), candidate]);
    });
  return [...groups.entries()].map(([id, items]) => {
    const first = items[0]!;
    const approvable = items.filter((item) => item.screeningDecision === 'manual-review');
    return {
      approvableCandidateIds: approvable.map((item) => item.id),
      blockedCount: items.length - approvable.length,
      candidateIds: items.map((item) => item.id),
      deltas: approvable.reduce((sum, item) => addDeltas(sum, item.deltas), {
        intimacy: 0, trust: 0, vigilance: 0,
      }),
      id, sourceRoleId: first.sourceRoleId, sourceRoleName: first.sourceRoleName,
      targetRoleId: first.targetRoleId, targetRoleName: first.targetRoleName,
    };
  }).sort((left, right) => right.candidateIds.length - left.candidateIds.length
    || left.id.localeCompare(right.id));
}
