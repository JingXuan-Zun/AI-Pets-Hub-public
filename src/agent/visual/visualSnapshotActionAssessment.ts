import { type AgentStructuredToolCandidateEvidence, type AgentStructuredToolEvidence, type AgentStructuredToolPointEvidence, type AgentStructuredToolRectEvidence } from '../agentChatCommand';
import { createAgentCoordinateAuditEvidence } from '../agentCoordinateAudit';
import { normalizeVisualSnapshotScreenPointEvidence, normalizeVisualSnapshotScreenRectEvidence } from './visualSnapshotCoordinateSpaces';
import { isVisualSnapshotPrimaryActionUseful, isVisualSnapshotTargetActionRelationNeeded, isVisualSnapshotTextUseful } from './visualSnapshotEvidenceFormatting';

export function createVisualSnapshotActionEvidenceAssessment(options: {
  actionCandidates?: AgentStructuredToolCandidateEvidence[];
  confidenceValue: number | null;
  coordinateAudit?: ReturnType<typeof createAgentCoordinateAuditEvidence> | null;
  elementBounds: AgentStructuredToolRectEvidence | null;
  elementCenter: AgentStructuredToolPointEvidence | null;
  elementCenterRatio: AgentStructuredToolPointEvidence | null;
  elementRegion: string;
  mode: 'desktop' | 'game';
  primaryAction: string;
  relation: string;
  selectionVerificationStatus?: AgentStructuredToolEvidence['selectionVerificationStatus'];
  targetCandidates?: AgentStructuredToolCandidateEvidence[];
  targetMatched: string;
}) {
  if (options.mode === 'game') {
    return {
      missingEvidence: [] as string[],
      readiness: null as AgentStructuredToolEvidence['visualActionReadiness'],
      recommendedRecovery: [] as string[],
      relationRequired: false,
      verificationEvidence: [] as string[],
    };
  }

  const targetUseful = isVisualSnapshotTextUseful(options.targetMatched);
  const primaryActionUseful = isVisualSnapshotPrimaryActionUseful(options.primaryAction);
  const hasScreenCoordinate = Boolean(
    normalizeVisualSnapshotScreenPointEvidence(options.elementCenter)
      || normalizeVisualSnapshotScreenRectEvidence(options.elementBounds),
  );
  const coordinateAuditFailed = Boolean(
    hasScreenCoordinate
      && options.coordinateAudit
      && options.coordinateAudit.status !== 'coordinate_ok',
  );
  const hasLocationHint = Boolean(
    options.elementRegion
      || options.elementCenterRatio
      || options.elementCenter
      || options.elementBounds,
  );
  const relationRequired = isVisualSnapshotTargetActionRelationNeeded(
    options.targetMatched,
    options.primaryAction,
  );
  const relationUseful = isVisualSnapshotTextUseful(options.relation);
  const hasActionSignal = Boolean(
    targetUseful
      || primaryActionUseful
      || hasLocationHint
      || relationUseful,
  );

  if (!hasActionSignal) {
    return {
      missingEvidence: [] as string[],
      readiness: null as AgentStructuredToolEvidence['visualActionReadiness'],
      recommendedRecovery: [] as string[],
      relationRequired,
      verificationEvidence: [] as string[],
    };
  }

  const missingEvidence: string[] = [];
  const recommendedRecovery: string[] = [];
  let readiness: AgentStructuredToolEvidence['visualActionReadiness'] = 'ready';

  if (options.selectionVerificationStatus === 'mismatch' || options.selectionVerificationStatus === 'visible-only') {
    readiness = 'needs-target-selection';
    missingEvidence.push(options.selectionVerificationStatus === 'mismatch'
      ? 'Visual selection verification says the current selected/detail item does not match the requested target.'
      : 'Visual target appears visible, but the current selected/detail item is not confirmed.');
    recommendedRecovery.push('Select the target item first, then rerun locate_screen_elements or post-action visual verification before looking for the primary action.');
  } else if (options.confidenceValue !== null && options.confidenceValue < 0.6) {
    readiness = 'low-confidence';
    missingEvidence.push('Visual confidence is below the action threshold, so the UI action is not safe to execute yet.');
    recommendedRecovery.push('Refresh visual evidence or ask one short confirmation question before taking desktop input.');
  } else if (!targetUseful) {
    readiness = 'needs-target-selection';
    missingEvidence.push(options.targetCandidates?.length
      ? 'Visual returned target candidates, but no single target item was matched clearly for the requested action.'
      : 'Visual target item was not matched clearly for the requested action.');
    recommendedRecovery.push(options.targetCandidates?.length
      ? 'Use the targetCandidates centerRatio/bounds/region evidence to rerun locate_screen_elements with focus crop params around the most relevant candidate, or ask one short selection question if candidates remain equally plausible.'
      : 'Retry locate_screen_elements with a narrower sourceQuery/sourceId and a concrete targetText or targetDescription.');
  } else if (!primaryActionUseful) {
    readiness = 'needs-primary-action';
    missingEvidence.push(options.actionCandidates?.length
      ? 'Visual returned action candidates, but no single primary open/start/play/launch action was identified.'
      : 'Visual target was matched, but no clear primary open/start/play/launch action was identified.');
    recommendedRecovery.push(options.actionCandidates?.length
      ? 'Use the actionCandidates centerRatio/bounds/region evidence to rerun locate_screen_elements with focus crop params around the likely primary action, rerun for the target detail area, or ask one short confirmation question.'
      : 'If the target item has an approximate region, select that item first, then rerun locate_screen_elements with forceRefresh: true.');
    recommendedRecovery.push('If the visible page is a list/store/recommendation page, navigate to the target detail/library page before looking for the primary action.');
  } else if (!hasScreenCoordinate || coordinateAuditFailed) {
    readiness = 'needs-coordinate';
    missingEvidence.push(coordinateAuditFailed && options.coordinateAudit
      ? `Visual coordinate audit failed: ${options.coordinateAudit.status} (${options.coordinateAudit.reason})`
      : hasLocationHint
        ? 'Visual primary action was identified, but only relative/approximate location evidence was available; no safe native-screen coordinate was resolved for desktop input.'
        : 'Visual primary action was identified, but no native-screen coordinate or elementBounds could be resolved for safe desktop input.');
    recommendedRecovery.push('Rerun locate_screen_elements with forceRefresh: true and request elementCenterRatio or elementCenter for the primary action.');
    recommendedRecovery.push('If the capture source has no bounds, call list_capture_sources or inspect the active window before converting visual location to input coordinates.');
  } else if (relationRequired && !relationUseful) {
    readiness = 'needs-relation';
    missingEvidence.push('Visual target/action relation was not stated clearly, so the primary action may not belong to the matched target.');
    recommendedRecovery.push('Rerun locate_screen_elements and ask it to state whether the primary action is visually associated with the matched target.');
  }

  return {
    missingEvidence,
    readiness,
    recommendedRecovery,
    relationRequired,
    verificationEvidence: readiness === 'ready'
      ? [
          relationRequired
            ? 'Visual action readiness is ready: target, primary action, relation, and native-screen coordinate evidence are present.'
            : 'Visual action readiness is ready: target, primary action, and native-screen coordinate evidence are present.',
        ]
      : [],
  };
}
