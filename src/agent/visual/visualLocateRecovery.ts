import { type AgentChatCommandResult, type AgentStructuredToolEvidence } from '../agentChatCommand';
import { normalizeAgentRuntimeVisualLookupText } from './captureSourceFormatting';
import { isVisualSnapshotPrimaryActionMissingText, isVisualSnapshotPrimaryActionUseful, isVisualSnapshotTargetActionRelationNeeded, isVisualSnapshotTextUseful } from './visualSnapshotEvidenceFormatting';

export function isLocateScreenElementsActionTargetRequest(text: string) {
  return /启动|打开|开始|运行|进入|播放|主按钮|主操作|按钮|launch|start|open|play|primary action|button/iu.test(text);
}

export function enrichLocateScreenElementsMissingPrimaryAction(options: {
  action: string;
  question: string;
  result: AgentChatCommandResult;
  sourceQuery: string;
  targetLabel: string;
}) {
  const { action, question, result, sourceQuery, targetLabel } = options;
  if (result.ok === false || !targetLabel) {
    return result;
  }

  const structuredEvidence = result.stateSummary?.structuredEvidence
    ?? result.receipt?.stateSummary?.structuredEvidence
    ?? null;
  const evidenceText = [
    action,
    question,
    sourceQuery,
    targetLabel,
    result.responseText,
    result.observations?.join('\n'),
    result.stateSummary?.observedState?.join('\n'),
    result.stateSummary?.missingEvidence?.join('\n'),
  ].filter(Boolean).join('\n');
  const targetAppearsMatched = Boolean(structuredEvidence?.targetMatched)
    || normalizeAgentRuntimeVisualLookupText(evidenceText).includes(normalizeAgentRuntimeVisualLookupText(targetLabel));
  const requestNeedsPrimaryAction = isLocateScreenElementsActionTargetRequest(evidenceText);
  const primaryActionUseful = isVisualSnapshotPrimaryActionUseful(structuredEvidence?.primaryAction);
  const primaryActionMissing = !primaryActionUseful
    || isVisualSnapshotPrimaryActionMissingText(evidenceText);
  const hasScreenCoordinate = Boolean(structuredEvidence?.elementCenter || structuredEvidence?.elementBounds);
  const coordinateMissing = primaryActionUseful && !hasScreenCoordinate;
  const relationRequired = isVisualSnapshotTargetActionRelationNeeded(
    structuredEvidence?.targetMatched || targetLabel,
    structuredEvidence?.primaryAction || '',
  );
  const relationMissing = primaryActionUseful
    && hasScreenCoordinate
    && relationRequired
    && !isVisualSnapshotTextUseful(structuredEvidence?.relation);

  if (
    !requestNeedsPrimaryAction
    || !targetAppearsMatched
    || (!primaryActionMissing && !coordinateMissing && !relationMissing)
  ) {
    return result;
  }

  const readiness: AgentStructuredToolEvidence['visualActionReadiness'] = primaryActionMissing
    ? 'needs-primary-action'
    : coordinateMissing
      ? 'needs-coordinate'
      : 'needs-relation';
  const missingEvidence = [
    ...(result.stateSummary?.missingEvidence ?? []),
    primaryActionMissing
      ? 'locate_screen_elements did not identify a clear primary action button for the requested in-app target.'
      : '',
    primaryActionMissing
      ? 'The target item may be visible in a sidebar/list, but the current page may not be the target detail/action page.'
      : '',
    coordinateMissing
      ? 'locate_screen_elements identified a primary action, but did not resolve a usable native-screen coordinate or elementBounds for safe input.'
      : '',
    relationMissing
      ? 'locate_screen_elements did not clearly verify that the primary action belongs to the matched target.'
      : '',
  ];
  const recommendedRecovery = [
    ...(result.stateSummary?.recommendedRecovery ?? []),
    primaryActionMissing
      ? 'If the target item/menu entry has an approximate region, select or click that target item first, then rerun locate_screen_elements with forceRefresh: true.'
      : '',
    primaryActionMissing
      ? 'If the visible page is a store/recommendation/list page, navigate to the target detail/library page before looking for the launch/open/start button.'
      : '',
    coordinateMissing
      ? 'Rerun locate_screen_elements with forceRefresh: true and request elementCenterRatio or elementCenter for the primary action.'
      : '',
    coordinateMissing
      ? 'If the capture source has no bounds, call list_capture_sources or inspect the active window before converting visual location to input coordinates.'
      : '',
    relationMissing
      ? 'Rerun locate_screen_elements and ask it to state whether the primary action is visually associated with the matched target.'
      : '',
    'tool:locate_screen_elements',
    'tool:execute_desktop_input',
    'tool:execute_desktop_observation',
  ].filter(Boolean);
  const nextStructuredEvidence: AgentStructuredToolEvidence = {
    ...(structuredEvidence ?? {}),
    confidence: structuredEvidence?.confidence === 'high' ? 'medium' : structuredEvidence?.confidence ?? 'low',
    primaryAction: structuredEvidence?.primaryAction || null,
    status: 'unverified',
    targetMatched: structuredEvidence?.targetMatched || targetLabel,
    visualActionReadiness: readiness,
  };
  const nextStateSummary = {
    ...(result.stateSummary ?? {}),
    missingEvidence: [...new Set(missingEvidence.filter(Boolean))],
    recommendedRecovery: [...new Set(recommendedRecovery)],
    structuredEvidence: nextStructuredEvidence,
  };

  return {
    ...result,
    followUp: result.followUp
      || (primaryActionMissing
        ? '已看到目标线索，但还没有确认到对应的启动/打开按钮。需要先选择目标项或刷新目标页后再定位按钮。'
        : coordinateMissing
          ? '已看到目标和操作按钮，但还没有能安全点击的屏幕坐标。需要重新定位按钮坐标。'
          : '已看到目标和操作按钮，但还没有确认按钮确实属于这个目标。需要重新观察目标和按钮关系。'),
    receipt: result.receipt
      ? {
        ...result.receipt,
        status: 'unverified' as const,
        stateSummary: nextStateSummary,
        verification: primaryActionMissing
          ? 'locate_screen_elements found target evidence but did not verify a clear primary action button.'
          : coordinateMissing
            ? 'locate_screen_elements found target/action evidence but did not verify a usable input coordinate.'
            : 'locate_screen_elements found target/action evidence but did not verify their visual relation.',
      }
      : result.receipt,
    stateSummary: nextStateSummary,
    verification: primaryActionMissing
      ? 'locate_screen_elements found target evidence but did not verify a clear primary action button.'
      : coordinateMissing
        ? 'locate_screen_elements found target/action evidence but did not verify a usable input coordinate.'
        : 'locate_screen_elements found target/action evidence but did not verify their visual relation.',
  };
}
