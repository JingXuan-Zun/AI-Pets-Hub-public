import { buildDirectedRelationshipBehaviorPolicies } from './directedRelationshipBehaviorPolicy';
import type {
  DirectedRelationshipBehaviorPolicy,
  DirectedRelationshipBehaviorTrace,
  DirectedRelationshipDimensions,
  DirectedRelationshipRepositoryData,
} from './directedRelationshipTypes';

const MAX_BEHAVIOR_TRACES = 300;
const STYLES = {
  addressStyle: ['familiar-warm', 'neutral-polite', 'formal-distance'],
  disagreementStyle: ['evidence-first', 'firm-boundary', 'warm-clarification'],
  engagementStyle: ['acknowledge-and-build', 'direct-and-limited', 'normal-response'],
  sharingStyle: ['open-with-boundaries', 'minimal', 'selective'],
  supportStyle: ['independent-evaluation', 'support-with-evidence', 'withhold-automatic-defense'],
  verificationStyle: ['cooperative-verify', 'standard-verify', 'strict-verify'],
} as const;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim().slice(0, maxLength) : '';
}

function cleanIds(value: unknown) {
  const items = Array.isArray(value) ? value : [];
  return [...new Set(items.map((item) => cleanText(item, 120)).filter(Boolean))];
}

function dimensions(value: unknown): DirectedRelationshipDimensions {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const score = (current: unknown) => Math.max(0, Math.min(100, Math.round(Number(current) || 0)));
  return { intimacy: score(input.intimacy), trust: score(input.trust), vigilance: score(input.vigilance) };
}

function policy(value: unknown): DirectedRelationshipBehaviorPolicy | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const relationshipId = cleanText(input.relationshipId, 241);
  const targetRoleId = cleanText(input.targetRoleId, 120);
  const sourceUpdatedAt = Number(input.sourceUpdatedAt);
  if (!relationshipId || !targetRoleId || input.policyVersion !== 1 || !Number.isFinite(sourceUpdatedAt)) return null;
  const validStyles = Object.entries(STYLES).every(([key, allowed]) => (
    typeof input[key] === 'string' && (allowed as readonly string[]).includes(input[key] as string)
  ));
  if (!validStyles) return null;
  return {
    addressStyle: input.addressStyle as DirectedRelationshipBehaviorPolicy['addressStyle'],
    disagreementStyle: input.disagreementStyle as DirectedRelationshipBehaviorPolicy['disagreementStyle'],
    engagementStyle: input.engagementStyle as DirectedRelationshipBehaviorPolicy['engagementStyle'],
    policyVersion: 1, relationshipId,
    sharingStyle: input.sharingStyle as DirectedRelationshipBehaviorPolicy['sharingStyle'],
    sourceDimensions: dimensions(input.sourceDimensions), sourceUpdatedAt,
    supportStyle: input.supportStyle as DirectedRelationshipBehaviorPolicy['supportStyle'],
    targetRoleId, targetRoleName: cleanText(input.targetRoleName, 120) || targetRoleId,
    verificationStyle: input.verificationStyle as DirectedRelationshipBehaviorPolicy['verificationStyle'],
  };
}

function trace(value: unknown): DirectedRelationshipBehaviorTrace | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const id = cleanText(input.id, 400);
  const groupSessionId = cleanText(input.groupSessionId, 200);
  const occurredAt = Number(input.occurredAt);
  const sourceMessageId = cleanText(input.sourceMessageId, 300);
  const sourceRoleId = cleanText(input.sourceRoleId, 120);
  const policies = (Array.isArray(input.policies) ? input.policies : [])
    .map(policy).filter((item): item is DirectedRelationshipBehaviorPolicy => item !== null);
  if (!id || !groupSessionId || !sourceMessageId || !sourceRoleId
    || !Number.isFinite(occurredAt) || !policies.length) return null;
  return {
    addressedRoleIds: cleanIds(input.addressedRoleIds),
    claimLevel: 'policy-supplied-only', eventKind: 'relationship-behavior-context',
    groupSessionId, id, occurredAt,
    outputExcerpt: '', policies,
    sourceMessageId, sourceRoleId,
    sourceRoleName: cleanText(input.sourceRoleName, 120) || sourceRoleId,
    topicId: input.topicId === null ? null : cleanText(input.topicId, 300) || null,
  };
}

export function normalizeDirectedRelationshipBehaviorTraces(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(trace).filter((item): item is DirectedRelationshipBehaviorTrace => item !== null)
    .slice(-MAX_BEHAVIOR_TRACES);
}

export function recordDirectedRelationshipBehaviorTrace(repository: DirectedRelationshipRepositoryData,
  input: {
    addressedRoleIds?: string[]; behaviorTargetRoleIds: string[]; groupSessionId: string;
    sourceMessageId: string; sourceRoleId: string;
    sourceRoleName: string; topicId: string | null;
  }, now = Date.now()) {
  const groupSessionId = cleanText(input.groupSessionId, 200);
  const sourceMessageId = cleanText(input.sourceMessageId, 300);
  const sourceRoleId = cleanText(input.sourceRoleId, 120);
  if (!groupSessionId || !sourceMessageId || !sourceRoleId) return repository;
  if (repository.behaviorTraces.some((item) => item.sourceMessageId === sourceMessageId
    && item.sourceRoleId === sourceRoleId)) return repository;
  const policies = buildDirectedRelationshipBehaviorPolicies({
    repository, roleId: sourceRoleId,
    targetRoleIds: cleanIds(input.behaviorTargetRoleIds).filter((roleId) => roleId !== sourceRoleId),
  });
  if (!policies.length) return repository;
  const next: DirectedRelationshipBehaviorTrace = {
    addressedRoleIds: cleanIds(input.addressedRoleIds),
    claimLevel: 'policy-supplied-only', eventKind: 'relationship-behavior-context',
    groupSessionId, id: `relationship-behavior-${now}-${sourceMessageId}-${sourceRoleId}`,
    occurredAt: now, outputExcerpt: '', policies,
    sourceMessageId, sourceRoleId,
    sourceRoleName: cleanText(input.sourceRoleName, 120) || sourceRoleId, topicId: input.topicId,
  };
  return { ...repository, behaviorTraces: [...repository.behaviorTraces, next].slice(-MAX_BEHAVIOR_TRACES) };
}
