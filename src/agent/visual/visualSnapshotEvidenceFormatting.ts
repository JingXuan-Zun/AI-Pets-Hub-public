import { type AgentStructuredToolCandidateEvidence, type AgentStructuredToolPointEvidence } from '../agentChatCommand';
import { getVisualSnapshotCandidateLabel } from './visualSnapshotCandidates';

import { createVisualSnapshotCandidatePointFromBounds } from './visualSnapshotCoordinateSpaces';
import { getVisualSnapshotObjectField, normalizeVisualSnapshotPointObject, normalizeVisualSnapshotRatioPointObject, normalizeVisualSnapshotRectObject } from './visualSnapshotCoordinateValues';

export function formatVisualSnapshotCandidateLine(
  kind: 'target' | 'action',
  candidate: AgentStructuredToolCandidateEvidence,
  index: number,
) {
  const center = candidate.center
    && Number.isFinite(Number(candidate.center.x))
    && Number.isFinite(Number(candidate.center.y))
    ? ` center=${Math.round(Number(candidate.center.x))},${Math.round(Number(candidate.center.y))}`
    : '';
  const centerRatio = candidate.centerRatio
    && Number.isFinite(Number(candidate.centerRatio.x))
    && Number.isFinite(Number(candidate.centerRatio.y))
    ? ` centerRatio=${Number(candidate.centerRatio.x).toFixed(3)},${Number(candidate.centerRatio.y).toFixed(3)}`
    : '';
  const bounds = candidate.bounds
    && Number.isFinite(Number(candidate.bounds.x))
    && Number.isFinite(Number(candidate.bounds.y))
    && Number.isFinite(Number(candidate.bounds.width))
    && Number.isFinite(Number(candidate.bounds.height))
    ? ` bounds=${Math.round(Number(candidate.bounds.x))},${Math.round(Number(candidate.bounds.y))},${Math.round(Number(candidate.bounds.width))}x${Math.round(Number(candidate.bounds.height))}`
    : '';
  const label = getVisualSnapshotCandidateLabel(candidate) || '(unlabeled)';
  return [
    `Visual ${kind} candidate ${index + 1}: ${label}`,
    candidate.confidence ? `confidence=${candidate.confidence}` : '',
    candidate.region ? `region=${candidate.region}` : '',
    candidate.relation ? `relation=${candidate.relation}` : '',
    candidate.selected === true ? 'selected=true' : candidate.selected === false ? 'selected=false' : '',
    center.trim(),
    centerRatio.trim(),
    bounds.trim(),
  ].filter(Boolean).join(' | ');
}

function parseVisualSnapshotPointFromText(value: string) {
  const match = value.match(/\b(?:x|cx|centerX|center x)\s*[=:：]\s*(-?\d+(?:\.\d+)?).{0,24}\b(?:y|cy|centerY|center y)\s*[=:：]\s*(-?\d+(?:\.\d+)?)/iu)
    ?? value.match(/\((\s*-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)\s*\)/u);
  if (!match) {
    return null;
  }

  const x = Number(match[1]);
  const y = Number(match[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    coordinateSpace: 'native-screen',
    source: 'elementRegion-text',
    x: Math.round(x),
    y: Math.round(y),
  } satisfies AgentStructuredToolPointEvidence;
}

export function resolveVisualSnapshotPointEvidence(parsed: Record<string, unknown>, elementRegion: string) {
  const explicitCenter = normalizeVisualSnapshotPointObject(
    getVisualSnapshotObjectField(parsed, ['elementCenter', 'center', 'point', 'coordinates']),
  );
  const ratioCenter = normalizeVisualSnapshotRatioPointObject(
    getVisualSnapshotObjectField(parsed, ['elementCenterRatio', 'centerRatio', 'normalizedCenter', 'relativeCenter']),
  );
  const bounds = normalizeVisualSnapshotRectObject(
    getVisualSnapshotObjectField(parsed, ['elementBounds', 'bounds', 'rect', 'regionBox']),
  );
  const regionTextPoint = parseVisualSnapshotPointFromText(elementRegion);
  const elementCenter = explicitCenter
    ?? regionTextPoint
    ?? createVisualSnapshotCandidatePointFromBounds(bounds);

  return {
    bounds,
    center: elementCenter,
    ratioCenter,
  };
}

export function formatVisualSnapshotConfidence(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.max(0, Math.min(1, value)));
  }

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return '';
}



export function isVisualSnapshotPrimaryActionMissingText(value: string) {
  return /(?:未找到|没有|未识别|看不到|不明确|无法确认).{0,24}(?:启动|打开|开始|运行|进入|播放|按钮|主操作|primary|launch|start|play|open)|(?:did not find|not found|no clear|no visible|cannot identify).{0,32}(?:button|primary action|launch|start|play|open)/iu
    .test(value);
}

export function isVisualSnapshotPrimaryActionUseful(value: string | null | undefined) {
  return Boolean(value?.trim()) && !isVisualSnapshotPrimaryActionMissingText(value ?? '');
}

function normalizeVisualSnapshotRelationText(value: string | null | undefined) {
  return (value ?? '').normalize('NFKC').replace(/\s+/gu, '').trim().toLowerCase();
}

export function isVisualSnapshotTextUseful(value: string | null | undefined) {
  const text = (value ?? '').normalize('NFKC').trim().toLowerCase();
  return Boolean(text)
    && !/(?:unknown|unclear|not\s+(?:found|visible|clear)|none|null|n\/a|不确定|不清楚|未知|未找到|没有|无)/iu.test(text);
}

export function isVisualSnapshotTargetActionRelationNeeded(
  targetMatched: string,
  primaryAction: string,
) {
  const targetText = normalizeVisualSnapshotRelationText(targetMatched);
  const actionText = normalizeVisualSnapshotRelationText(primaryAction);
  if (!targetText || !actionText) {
    return false;
  }

  return targetText !== actionText
    && !targetText.includes(actionText)
    && !actionText.includes(targetText);
}
