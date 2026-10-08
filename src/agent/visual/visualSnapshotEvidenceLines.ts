import { formatAgentCaptureQualityLine, type AgentCaptureQualityAnalysis } from '../agentCaptureQuality';
import { formatAgentCoordinateAuditLine } from '../agentCoordinateAudit';
import { type assessVisualSnapshotEvidenceAction } from './visualSnapshotEvidenceAction';
import { type resolveVisualSnapshotEvidenceCandidates } from './visualSnapshotEvidenceCandidates';
import { type readVisualSnapshotEvidenceContent } from './visualSnapshotEvidenceContent';
import { type resolveVisualSnapshotEvidenceCoordinates } from './visualSnapshotEvidenceCoordinates';
import { formatVisualSnapshotCandidateLine } from './visualSnapshotEvidenceFormatting';
import { type resolveVisualSnapshotEvidenceSemantics } from './visualSnapshotEvidenceSemantics';
import { getVisualSnapshotStringField, getVisualSnapshotStringListField } from './visualSnapshotParsing';

export function formatVisualSnapshotEvidenceLines({
  resolvedElementCenter,
  derivedAbsoluteCenter,
  resolvedElementCenterRatio,
  coordinateAudit,
  captureContext,
  mode,
  targetCandidates,
  actionCandidates,
  summaryText,
  parsed,
  readableText,
  uncertainty,
  confidenceText,
  companionCue,
  visibleTextCandidates,
  currentSelection,
  selectionVerificationStatus,
  targetMatched,
  primaryAction,
  elementRegion,
  sourceGeometry,
  relation,
  launcherVerificationLine,
  resolvedPostActionState,
  actionEvidence,
}: {
  resolvedElementCenter: ReturnType<typeof resolveVisualSnapshotEvidenceCoordinates>['resolvedElementCenter'];
  derivedAbsoluteCenter: ReturnType<typeof resolveVisualSnapshotEvidenceCoordinates>['derivedAbsoluteCenter'];
  resolvedElementCenterRatio: ReturnType<typeof resolveVisualSnapshotEvidenceCoordinates>['resolvedElementCenterRatio'];
  coordinateAudit: ReturnType<typeof resolveVisualSnapshotEvidenceCoordinates>['coordinateAudit'];
  captureContext: {
    fallbackLine?: string | null;
    quality?: AgentCaptureQualityAnalysis | null;
    selectedSource?: DesktopPetCaptureSourceLike | null;
  } | undefined;
  mode: 'desktop' | 'game';
  targetCandidates: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['targetCandidates'];
  actionCandidates: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['actionCandidates'];
  summaryText: ReturnType<typeof readVisualSnapshotEvidenceContent>['summaryText'];
  parsed: Record<string, unknown>;
  readableText: ReturnType<typeof readVisualSnapshotEvidenceContent>['readableText'];
  uncertainty: ReturnType<typeof readVisualSnapshotEvidenceContent>['uncertainty'];
  confidenceText: ReturnType<typeof readVisualSnapshotEvidenceContent>['confidenceText'];
  companionCue: ReturnType<typeof readVisualSnapshotEvidenceContent>['companionCue'];
  visibleTextCandidates: ReturnType<typeof readVisualSnapshotEvidenceContent>['visibleTextCandidates'];
  currentSelection: ReturnType<typeof readVisualSnapshotEvidenceContent>['currentSelection'];
  selectionVerificationStatus: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['selectionVerificationStatus'];
  targetMatched: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['targetMatched'];
  primaryAction: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['primaryAction'];
  elementRegion: ReturnType<typeof resolveVisualSnapshotEvidenceSemantics>['elementRegion'];
  sourceGeometry: ReturnType<typeof resolveVisualSnapshotEvidenceCoordinates>['sourceGeometry'];
  relation: ReturnType<typeof resolveVisualSnapshotEvidenceSemantics>['relation'];
  launcherVerificationLine: ReturnType<typeof assessVisualSnapshotEvidenceAction>['launcherVerificationLine'];
  resolvedPostActionState: ReturnType<typeof resolveVisualSnapshotEvidenceSemantics>['resolvedPostActionState'];
  actionEvidence: ReturnType<typeof assessVisualSnapshotEvidenceAction>['actionEvidence'];
}) {
  const elementCenterLine = resolvedElementCenter
    && Number.isFinite(resolvedElementCenter.x)
    && Number.isFinite(resolvedElementCenter.y)
    ? `Visual element center: x=${Math.round(resolvedElementCenter.x ?? 0)} y=${Math.round(resolvedElementCenter.y ?? 0)}${resolvedElementCenter.source ? ` source=${resolvedElementCenter.source}` : ''}`
    : '';
  const derivedElementCenterLine = !resolvedElementCenter
    && derivedAbsoluteCenter
    && Number.isFinite(derivedAbsoluteCenter.x)
    && Number.isFinite(derivedAbsoluteCenter.y)
    ? `Visual element center: x=${Math.round(derivedAbsoluteCenter.x ?? 0)} y=${Math.round(derivedAbsoluteCenter.y ?? 0)} source=elementCenterRatio`
    : '';
  const elementRatioLine = resolvedElementCenterRatio
    && Number.isFinite(resolvedElementCenterRatio.x)
    && Number.isFinite(resolvedElementCenterRatio.y)
    ? `Visual element center ratio: x=${Number(resolvedElementCenterRatio.x).toFixed(3)} y=${Number(resolvedElementCenterRatio.y).toFixed(3)}`
    : '';
  const coordinateAuditLine = formatAgentCoordinateAuditLine(coordinateAudit, 'Visual coordinate audit');
  const captureQuality = captureContext?.quality ?? null;
  const captureQualityLine = captureQuality
    ? formatAgentCaptureQualityLine(captureQuality, mode === 'game' ? 'Game capture quality' : 'Visual capture quality')
    : '';
  const captureFallbackLine = captureContext?.fallbackLine?.trim() ?? '';
  const targetCandidateLines = targetCandidates.map((candidate, index) => formatVisualSnapshotCandidateLine('target', candidate, index));
  const actionCandidateLines = actionCandidates.map((candidate, index) => formatVisualSnapshotCandidateLine('action', candidate, index));
  const detailLines = mode === 'game'
    ? [
      `Game content analysis: ${summaryText}`,
      getVisualSnapshotStringField(parsed, ['detectedGameOrGenre', 'game', 'genre'])
        ? `Game detected game/genre: ${getVisualSnapshotStringField(parsed, ['detectedGameOrGenre', 'game', 'genre'])}`
        : '',
      getVisualSnapshotStringField(parsed, ['sceneState', 'scene'])
        ? `Game scene state: ${getVisualSnapshotStringField(parsed, ['sceneState', 'scene'])}`
        : '',
      getVisualSnapshotStringField(parsed, ['playerState', 'player'])
        ? `Game player state: ${getVisualSnapshotStringField(parsed, ['playerState', 'player'])}`
        : '',
      getVisualSnapshotStringField(parsed, ['hud', 'hudState'])
        ? `Game HUD: ${getVisualSnapshotStringField(parsed, ['hud', 'hudState'])}`
        : '',
      readableText.length ? `Game visible text: ${readableText.join(' | ')}` : '',
      uncertainty.length ? `Game uncertainty: ${uncertainty.join(' | ')}` : '',
      confidenceText ? `Game confidence: ${confidenceText}` : '',
      companionCue ? `Game companion cue: ${companionCue}` : '',
      captureQualityLine,
      captureFallbackLine,
    ]
    : [
      `Visual summary: ${summaryText}`,
      getVisualSnapshotStringField(parsed, ['visibleAppOrWindow', 'app', 'window'])
        ? `Visual app/window: ${getVisualSnapshotStringField(parsed, ['visibleAppOrWindow', 'app', 'window'])}`
        : '',
      getVisualSnapshotStringField(parsed, ['mainContent', 'content'])
        ? `Visual main content: ${getVisualSnapshotStringField(parsed, ['mainContent', 'content'])}`
        : '',
      getVisualSnapshotStringListField(parsed, ['visibleObjects', 'objects']).length
        ? `Visual visible objects: ${getVisualSnapshotStringListField(parsed, ['visibleObjects', 'objects']).join(' | ')}`
        : '',
      readableText.length ? `Visual readable text: ${readableText.join(' | ')}` : '',
      visibleTextCandidates.length ? `Visual text candidates: ${visibleTextCandidates.join(' | ')}` : '',
      currentSelection ? `Visual current selection: ${currentSelection}` : '',
      selectionVerificationStatus ? `Visual selection verification: ${selectionVerificationStatus}` : '',
      targetMatched ? `Visual target matched: ${targetMatched}` : '',
      ...targetCandidateLines,
      primaryAction ? `Visual primary action: ${primaryAction}` : '',
      ...actionCandidateLines,
      elementRegion ? `Visual element region: ${elementRegion}` : '',
      elementCenterLine,
      derivedElementCenterLine,
      elementRatioLine,
      sourceGeometry?.line ?? '',
      coordinateAuditLine,
      relation ? `Visual target/action relation: ${relation}` : '',
      launcherVerificationLine,
      resolvedPostActionState ? `Visual post-action state: ${resolvedPostActionState}` : '',
      resolvedPostActionState !== 'launched' && actionEvidence.readiness
        ? `Visual action readiness: ${actionEvidence.readiness}`
        : '',
      resolvedPostActionState !== 'launched' && actionEvidence.missingEvidence.length
        ? `Visual missing evidence: ${actionEvidence.missingEvidence.join(' | ')}`
        : '',
      uncertainty.length ? `Visual uncertainty: ${uncertainty.join(' | ')}` : '',
      confidenceText ? `Visual confidence: ${confidenceText}` : '',
      companionCue ? `Visual companion cue: ${companionCue}` : '',
      captureQualityLine,
      captureFallbackLine,
    ];
  const evidenceLines = detailLines.filter(Boolean);
  return {
    captureQuality,
    captureQualityLine,
    captureFallbackLine,
    evidenceLines,
  };
}
