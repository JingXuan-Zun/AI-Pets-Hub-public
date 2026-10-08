import { type AgentStructuredToolCandidateEvidence } from '../agentChatCommand';
import { getVisualSnapshotObjectField, normalizeVisualSnapshotCandidateConfidence, normalizeVisualSnapshotPointObject, normalizeVisualSnapshotRatioPointObject, normalizeVisualSnapshotRectObject } from './visualSnapshotCoordinateValues';
import { compactVisualSnapshotSummary, getVisualSnapshotStringField } from './visualSnapshotParsing';

function normalizeVisualSnapshotCandidate(value: unknown): AgentStructuredToolCandidateEvidence | null {
  if (typeof value === 'string' && value.trim()) {
    return {
      label: compactVisualSnapshotSummary(value, 140),
    } satisfies AgentStructuredToolCandidateEvidence;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const label = getVisualSnapshotStringField(record, ['label', 'name', 'text', 'title', 'target', 'action']);
  const description = getVisualSnapshotStringField(record, ['description', 'summary', 'details']);
  const region = getVisualSnapshotStringField(record, ['region', 'elementRegion', 'location', 'position']);
  const relation = getVisualSnapshotStringField(record, ['relation', 'targetRelation', 'association']);
  const selected = normalizeVisualSnapshotBooleanField(record, ['selected', 'isSelected', 'current', 'active', 'highlighted', 'focused']);
  const selectionItem = normalizeVisualSnapshotBooleanField(record, ['selectionItem', 'selectable', 'isSelectable']);
  const center = normalizeVisualSnapshotPointObject(
    getVisualSnapshotObjectField(record, ['center', 'elementCenter', 'point', 'coordinates']),
  );
  const centerRatio = normalizeVisualSnapshotRatioPointObject(
    getVisualSnapshotObjectField(record, ['centerRatio', 'elementCenterRatio', 'normalizedCenter', 'relativeCenter']),
  );
  const bounds = normalizeVisualSnapshotRectObject(
    getVisualSnapshotObjectField(record, ['bounds', 'elementBounds', 'rect', 'regionBox']),
  );
  const confidence = normalizeVisualSnapshotCandidateConfidence(record.confidence ?? record.score);

  if (!label && !description && !region && !center && !centerRatio && !bounds && !relation) {
    return null;
  }

  return {
    bounds,
    center,
    centerRatio,
    confidence,
    description,
    label,
    region,
    relation,
    selected,
    selectionItem,
  } satisfies AgentStructuredToolCandidateEvidence;
}

export function normalizeVisualSnapshotBooleanField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const text = value.normalize('NFKC').trim().toLowerCase();
      if (/^(?:true|yes|selected|active|current|highlighted|focused|是|已选中|选中|当前|高亮)$/iu.test(text)) {
        return true;
      }
      if (/^(?:false|no|not selected|inactive|unselected|不是|未选中|没有选中|非当前)$/iu.test(text)) {
        return false;
      }
    }
  }

  return null;
}

export function getVisualSnapshotCandidateListField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value
        .map(normalizeVisualSnapshotCandidate)
        .filter((candidate): candidate is AgentStructuredToolCandidateEvidence => Boolean(candidate))
        .slice(0, 6);
    }

    const candidate = normalizeVisualSnapshotCandidate(value);
    if (candidate) {
      return [candidate];
    }
  }

  return [];
}

export function getSingleHighConfidenceVisualSnapshotCandidate(
  candidates: AgentStructuredToolCandidateEvidence[],
) {
  const highConfidenceCandidates = candidates.filter((candidate) => candidate.confidence === 'high');
  return highConfidenceCandidates.length === 1 ? highConfidenceCandidates[0] ?? null : null;
}

export function hasVisualSnapshotCandidateLocationEvidence(candidate: AgentStructuredToolCandidateEvidence) {
  return Boolean(
    candidate.center
      || candidate.centerRatio
      || candidate.bounds
      || candidate.region?.trim()
  );
}

export function getVisualSnapshotCandidateSearchText(candidate: AgentStructuredToolCandidateEvidence) {
  return [
    candidate.label,
    candidate.name,
    candidate.description,
    candidate.region,
    candidate.relation,
    candidate.controlType,
    candidate.automationId,
    ...(candidate.actions ?? []),
  ].filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    .join(' ')
    .normalize('NFKC')
    .toLowerCase();
}

export function isVisualSnapshotActionCandidateText(text: string) {
  return /(?:\b(?:start|open|launch|play|run|resume|continue|retry|enter|install|update|repair|button|primary)\b|\u5f00\u59cb|\u542f\u52a8|\u6253\u5f00|\u8fd0\u884c|\u7ee7\u7eed|\u91cd\u8bd5|\u8fdb\u5165|\u64ad\u653e|\u5b89\u88c5|\u66f4\u65b0|\u4fee\u590d|\u6309\u94ae|\u4e3b\u64cd\u4f5c)/iu.test(text);
}

export function isVisualSnapshotNegativeRelationText(text: string) {
  return /(?:\b(?:unrelated|not\s+(?:related|associated|connected|belongs?)|does\s+not\s+belong|wrong\s+target|separate)\b|\u65e0\u5173|\u4e0d\u76f8\u5173|\u4e0d\u5c5e\u4e8e|\u4e0d\u5bf9\u5e94|\u9519\u8bef\u76ee\u6807)/iu.test(text);
}

export function getVisualSnapshotCandidateLabel(candidate: AgentStructuredToolCandidateEvidence | null | undefined) {
  return candidate?.label?.trim() || candidate?.description?.trim() || '';
}
