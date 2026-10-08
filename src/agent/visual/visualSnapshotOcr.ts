import { type AgentStructuredToolCandidateEvidence } from '../agentChatCommand';
import { scoreVisualSnapshotCandidateChoice } from './visualSnapshotCandidateRanking';
import { getVisualSnapshotCandidateLabel, getVisualSnapshotCandidateSearchText, isVisualSnapshotActionCandidateText, normalizeVisualSnapshotBooleanField } from './visualSnapshotCandidates';
import { getVisualSnapshotObjectField, normalizeVisualSnapshotCandidateConfidence, normalizeVisualSnapshotPointObject, normalizeVisualSnapshotRatioPointObject, normalizeVisualSnapshotRectObject } from './visualSnapshotCoordinateValues';
import { compactVisualSnapshotSummary, getVisualSnapshotRawListField, getVisualSnapshotStringField } from './visualSnapshotParsing';

function normalizeVisualSnapshotOcrTextCandidate(value: unknown): AgentStructuredToolCandidateEvidence | null {
  if (typeof value === 'string' && value.trim()) {
    return {
      confidence: null,
      label: compactVisualSnapshotSummary(value, 140),
      source: 'visual-ocr',
    } satisfies AgentStructuredToolCandidateEvidence;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const label = getVisualSnapshotStringField(record, ['text', 'label', 'name', 'title', 'value', 'snippet', 'content']);
  if (!label) {
    return null;
  }

  return {
    bounds: normalizeVisualSnapshotRectObject(
      getVisualSnapshotObjectField(record, ['bounds', 'elementBounds', 'rect', 'regionBox']),
    ),
    center: normalizeVisualSnapshotPointObject(
      getVisualSnapshotObjectField(record, ['center', 'elementCenter', 'point', 'coordinates']),
    ),
    centerRatio: normalizeVisualSnapshotRatioPointObject(
      getVisualSnapshotObjectField(record, ['centerRatio', 'elementCenterRatio', 'normalizedCenter', 'relativeCenter']),
    ),
    confidence: normalizeVisualSnapshotCandidateConfidence(record.confidence ?? record.score),
    description: getVisualSnapshotStringField(record, ['description', 'summary', 'details']),
    label,
    region: getVisualSnapshotStringField(record, ['region', 'location', 'position']),
    relation: getVisualSnapshotStringField(record, ['relation', 'targetRelation', 'association']),
    selected: normalizeVisualSnapshotBooleanField(record, ['selected', 'isSelected', 'current', 'active', 'highlighted', 'focused']),
    selectionItem: normalizeVisualSnapshotBooleanField(record, ['selectionItem', 'selectable', 'isSelectable']),
    source: 'visual-ocr',
  } satisfies AgentStructuredToolCandidateEvidence;
}

export function getVisualSnapshotOcrTextCandidates(record: Record<string, unknown>) {
  return getVisualSnapshotRawListField(record, [
    'visibleTextCandidates',
    'textCandidates',
    'readableTextCandidates',
    'ocrTextCandidates',
    'ocrCandidates',
    'visibleTexts',
  ])
    .map(normalizeVisualSnapshotOcrTextCandidate)
    .filter((candidate): candidate is AgentStructuredToolCandidateEvidence => Boolean(candidate))
    .slice(0, 8);
}

export function mergeVisualSnapshotCandidates(
  primary: AgentStructuredToolCandidateEvidence[],
  derived: AgentStructuredToolCandidateEvidence[],
) {
  const keys = new Set<string>();
  const makeKey = (candidate: AgentStructuredToolCandidateEvidence) => [
    candidate.label?.normalize('NFKC').trim().toLowerCase() ?? '',
    candidate.region?.normalize('NFKC').trim().toLowerCase() ?? '',
    Number.isFinite(Number(candidate.centerRatio?.x)) ? Number(candidate.centerRatio?.x).toFixed(3) : '',
    Number.isFinite(Number(candidate.centerRatio?.y)) ? Number(candidate.centerRatio?.y).toFixed(3) : '',
    Number.isFinite(Number(candidate.bounds?.x)) ? Number(candidate.bounds?.x).toFixed(3) : '',
    Number.isFinite(Number(candidate.bounds?.y)) ? Number(candidate.bounds?.y).toFixed(3) : '',
  ].join('|');

  return [...primary, ...derived].filter((candidate) => {
    const key = makeKey(candidate);
    if (keys.has(key)) {
      return false;
    }

    keys.add(key);
    return true;
  }).slice(0, 8);
}

export function deriveVisualSnapshotCandidatesFromOcr(options: {
  explicitPrimaryAction: string;
  explicitTargetMatched: string;
  ocrCandidates: AgentStructuredToolCandidateEvidence[];
  summaryText: string;
}) {
  const targetHint = options.explicitTargetMatched || options.summaryText;
  const actionHint = [
    options.explicitTargetMatched,
    options.explicitPrimaryAction,
    options.summaryText,
  ].filter(Boolean).join(' ');
  const targetCandidates = options.ocrCandidates
    .filter((candidate) => !isVisualSnapshotActionCandidateText(getVisualSnapshotCandidateSearchText(candidate)))
    .sort((first, second) => (
      scoreVisualSnapshotCandidateChoice({
        candidate: second,
        index: 0,
        kind: 'target',
        targetHint,
      }).score
      - scoreVisualSnapshotCandidateChoice({
        candidate: first,
        index: 0,
        kind: 'target',
        targetHint,
      }).score
    ))
    .slice(0, 4);
  const actionCandidates = options.ocrCandidates
    .filter((candidate) => isVisualSnapshotActionCandidateText(getVisualSnapshotCandidateSearchText(candidate)))
    .sort((first, second) => (
      scoreVisualSnapshotCandidateChoice({
        candidate: second,
        index: 0,
        kind: 'action',
        targetHint: actionHint,
      }).score
      - scoreVisualSnapshotCandidateChoice({
        candidate: first,
        index: 0,
        kind: 'action',
        targetHint: actionHint,
      }).score
    ))
    .slice(0, 4);

  return {
    actionCandidates,
    targetCandidates,
  };
}

export function createVisualSnapshotOcrDerivedRelation(options: {
  actionCandidate: AgentStructuredToolCandidateEvidence | null;
  actionCandidates: AgentStructuredToolCandidateEvidence[];
  targetCandidate: AgentStructuredToolCandidateEvidence | null;
  targetCandidates: AgentStructuredToolCandidateEvidence[];
  targetMatched: string;
}) {
  if (!options.targetMatched || !options.targetCandidate || !options.actionCandidate) {
    return '';
  }

  const targetFromOcr = options.targetCandidate.source === 'visual-ocr'
    || options.targetCandidates.some((candidate) => candidate.source === 'visual-ocr');
  const actionFromOcr = options.actionCandidate.source === 'visual-ocr'
    || options.actionCandidates.some((candidate) => candidate.source === 'visual-ocr');
  if (!targetFromOcr || !actionFromOcr) {
    return '';
  }

  const actionLabel = getVisualSnapshotCandidateLabel(options.actionCandidate);
  return actionLabel
    ? `OCR matched "${actionLabel}" as the primary action near/with "${options.targetMatched}".`
    : `OCR matched a primary action candidate near/with "${options.targetMatched}".`;
}
