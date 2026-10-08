import {
  type AgentStructuredToolCandidateEvidence,
  type AgentStructuredToolEvidence,
} from '../agentChatCommand';
import {
  type RunningAppWindowLike,
} from './windowAppObservation';

export interface WindowUiControlLike {
  actions?: string[] | null;
  automationId?: string | null;
  bounds?: { coordinateSpace?: string | null; height?: number | null; source?: string | null; width?: number | null; x?: number | null; y?: number | null } | null;
  centerX?: number | null;
  centerY?: number | null;
  className?: string | null;
  controlType?: string | null;
  depth?: number | null;
  enabled?: boolean | null;
  hasKeyboardFocus?: boolean | null;
  index?: number | null;
  keyboardFocusable?: boolean | null;
  matchScore?: number | null;
  name?: string | null;
  offscreen?: boolean | null;
  parentIndex?: number | null;
  selected?: boolean | null;
  selectionItem?: boolean | null;
}

export interface WindowUiInspectionResultLike {
  controlCount?: number | null;
  controls?: WindowUiControlLike[] | null;
  error?: string | null;
  matchedControls?: WindowUiControlLike[] | null;
  ok?: boolean;
  query?: string | null;
  targetDescription?: string | null;
  targetText?: string | null;
  window?: RunningAppWindowLike | null;
}

export function getWindowUiControlLabel(control: WindowUiControlLike) {
  return [
    control.name?.trim(),
    control.automationId?.trim() ? `id=${control.automationId.trim()}` : '',
    control.controlType?.trim() ? `type=${control.controlType.trim()}` : '',
  ].filter(Boolean).join(' ');
}

export function isWindowUiControlActionable(control: WindowUiControlLike) {
  if (control.enabled === false || control.offscreen === true) {
    return false;
  }

  const actions = Array.isArray(control.actions) ? control.actions : [];
  const controlType = control.controlType?.trim().toLowerCase() ?? '';
  return control.keyboardFocusable === true
    || actions.some((action) => ['invoke', 'select', 'toggle', 'expand-collapse', 'value'].includes(action))
    || ['button', 'menuitem', 'hyperlink', 'listitem', 'tabitem', 'checkbox', 'radiobutton', 'combobox', 'edit'].includes(controlType);
}

function formatWindowUiControlStateTags(control: WindowUiControlLike) {
  return [
    typeof control.enabled === 'boolean' ? ` enabled=${control.enabled}` : '',
    typeof control.keyboardFocusable === 'boolean' ? ` keyboardFocusable=${control.keyboardFocusable}` : '',
    control.hasKeyboardFocus ? ' focused=true' : '',
    control.offscreen ? ' offscreen=true' : '',
    control.selectionItem ? ` selected=${control.selected === true}` : '',
  ].filter(Boolean).join('');
}

export function getWindowUiControlBounds(control: WindowUiControlLike): AgentStructuredToolCandidateEvidence['bounds'] {
  const bounds = control.bounds;
  const x = Number(bounds?.x);
  const y = Number(bounds?.y);
  const width = Number(bounds?.width);
  const height = Number(bounds?.height);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }

  return {
    coordinateSpace: bounds?.coordinateSpace?.trim() || 'native-screen',
    height: Math.round(height),
    source: bounds?.source?.trim() || 'ui-automation',
    width: Math.round(width),
    x: Math.round(x),
    y: Math.round(y),
  };
}

export function getWindowUiControlCenter(control: WindowUiControlLike): AgentStructuredToolCandidateEvidence['center'] {
  const centerX = Number(control.centerX);
  const centerY = Number(control.centerY);
  if (Number.isFinite(centerX) && Number.isFinite(centerY)) {
    return {
      coordinateSpace: 'native-screen',
      source: 'ui-automation',
      x: Math.round(centerX),
      y: Math.round(centerY),
    };
  }

  const bounds = getWindowUiControlBounds(control);
  if (!bounds) {
    return null;
  }

  return {
    coordinateSpace: bounds.coordinateSpace,
    source: bounds.source,
    x: Math.round(Number(bounds.x) + Number(bounds.width) / 2),
    y: Math.round(Number(bounds.y) + Number(bounds.height) / 2),
  };
}

export function getWindowUiControlConfidence(control: WindowUiControlLike): AgentStructuredToolCandidateEvidence['confidence'] {
  const score = Number(control.matchScore);
  if (Number.isFinite(score) && score >= 78) {
    return 'high';
  }

  if (Number.isFinite(score) && score >= 45) {
    return 'medium';
  }

  return 'low';
}

export function createWindowUiCandidate(
  control: WindowUiControlLike,
  window: RunningAppWindowLike | null | undefined,
): AgentStructuredToolCandidateEvidence {
  const label = getWindowUiControlLabel(control) || 'UI control';
  const actions = Array.isArray(control.actions) && control.actions.length
    ? ` actions=${control.actions.join(',')}`
    : '';
  const depth = Number.isFinite(Number(control.depth)) ? ` depth=${Math.round(Number(control.depth))}` : '';
  const stateTags = formatWindowUiControlStateTags(control);
  return {
    actions: Array.isArray(control.actions) ? control.actions.filter((action): action is string => typeof action === 'string' && Boolean(action.trim())) : null,
    automationId: control.automationId ?? null,
    bounds: getWindowUiControlBounds(control),
    center: getWindowUiControlCenter(control),
    confidence: getWindowUiControlConfidence(control),
    controlType: control.controlType ?? null,
    description: `${label}${actions}${depth}${stateTags}`.trim(),
    enabled: control.enabled ?? null,
    hasKeyboardFocus: control.hasKeyboardFocus ?? null,
    keyboardFocusable: control.keyboardFocusable ?? null,
    label,
    name: control.name ?? null,
    offscreen: control.offscreen ?? null,
    region: control.controlType ?? null,
    relation: isWindowUiControlActionable(control)
      ? 'UI Automation reports this control as actionable or focusable.'
      : null,
    selected: control.selected ?? null,
    selectionItem: control.selectionItem ?? null,
    source: 'ui-automation',
    window: window
      ? {
          bounds: window.bounds ?? null,
          displayId: window.displayId ?? null,
          displayLabel: window.displayLabel ?? null,
          hwnd: window.hwnd ?? null,
          pid: window.pid ?? null,
          processName: window.processName ?? null,
          title: window.title ?? null,
        }
      : null,
  };
}

function getWindowUiSelectionCandidateLabel(control: WindowUiControlLike | null | undefined) {
  return control ? getWindowUiControlLabel(control) || control.name?.trim() || control.automationId?.trim() || null : null;
}

function normalizeWindowUiSelectionCompareText(value: string | null | undefined) {
  return (value ?? '').normalize('NFKC').replace(/[\s"'`“”‘’_\-:：;；,，.。|/\\()[\]{}<>《》]+/gu, '').trim().toLowerCase();
}

function isWindowUiSelectionTextMatch(currentSelection: string | null | undefined, targetText: string | null | undefined) {
  const current = normalizeWindowUiSelectionCompareText(currentSelection);
  const target = normalizeWindowUiSelectionCompareText(targetText);
  return Boolean(current && target && (current.includes(target) || target.includes(current)));
}

export function createWindowUiSelectionEvidence(options: {
  matchedControls: WindowUiControlLike[];
  result: WindowUiInspectionResultLike;
  targetCandidates: AgentStructuredToolCandidateEvidence[];
}) {
  const targetText = options.result.targetText?.trim()
    || options.targetCandidates[0]?.label?.trim()
    || '';
  const matchedSelectedControl = options.matchedControls.find((control) => control.selectionItem === true && control.selected === true) ?? null;
  const selectedControls = (options.result.controls ?? []).filter((control) => control.selectionItem === true && control.selected === true);
  const currentSelectedControl = matchedSelectedControl ?? selectedControls[0] ?? null;
  const currentSelection = getWindowUiSelectionCandidateLabel(currentSelectedControl);
  const targetSelectionItems = options.matchedControls.filter((control) => control.selectionItem === true);
  const targetSelected = Boolean(matchedSelectedControl);
  const hasVisibleTarget = options.matchedControls.length > 0 || options.targetCandidates.length > 0;
  const hasSelectionEvidence = targetSelectionItems.length > 0 || selectedControls.length > 0;
  const selectedTextMatchesTarget = isWindowUiSelectionTextMatch(currentSelection, targetText);

  let selectionVerificationStatus: AgentStructuredToolEvidence['selectionVerificationStatus'] = null;
  if (targetSelected || selectedTextMatchesTarget) {
    selectionVerificationStatus = 'selected';
  } else if (hasVisibleTarget && currentSelection) {
    selectionVerificationStatus = 'mismatch';
  } else if (hasVisibleTarget && hasSelectionEvidence) {
    selectionVerificationStatus = 'visible-only';
  } else if (hasVisibleTarget) {
    selectionVerificationStatus = 'unknown';
  }

  const selectionEvidence = [
    selectionVerificationStatus ? `UIA selection verification: ${selectionVerificationStatus}` : '',
    targetText ? `UIA selection target: ${targetText}` : '',
    currentSelection ? `UIA current selection: ${currentSelection}` : '',
    targetSelectionItems.length
      ? `UIA matched selection items: ${targetSelectionItems.map((control) => `${getWindowUiSelectionCandidateLabel(control) ?? 'control'} selected=${control.selected === true}`).join(' | ')}`
      : '',
  ].filter(Boolean);

  return {
    currentSelection,
    selectionEvidence,
    selectionVerificationStatus,
  };
}

export function createWindowUiLauncherVerification(options: {
  actionCandidates: AgentStructuredToolCandidateEvidence[];
  currentSelection: string | null | undefined;
  primaryAction: string | null | undefined;
  readiness: AgentStructuredToolEvidence['visualActionReadiness'];
  relation: string | null | undefined;
  selectionVerificationStatus?: AgentStructuredToolEvidence['selectionVerificationStatus'];
  targetCandidates: AgentStructuredToolCandidateEvidence[];
  targetMatched: string | null | undefined;
}): AgentStructuredToolEvidence['launcherVerification'] {
  const targetVisible = Boolean(options.targetMatched?.trim() || options.targetCandidates.length);
  const targetSelected = options.selectionVerificationStatus === 'selected'
    ? true
    : options.selectionVerificationStatus === 'mismatch' || options.selectionVerificationStatus === 'visible-only'
      ? false
      : targetVisible
        ? null
        : false;
  const detailMatchesTarget = options.selectionVerificationStatus === 'selected'
    ? true
    : options.selectionVerificationStatus === 'mismatch'
      ? false
      : null;
  const primaryActionMatchesTarget = !options.primaryAction?.trim()
    ? null
    : options.selectionVerificationStatus === 'mismatch' || options.selectionVerificationStatus === 'visible-only'
      ? false
      : options.readiness === 'ready'
        ? true
        : null;

  let status: NonNullable<AgentStructuredToolEvidence['launcherVerification']>['status'] = options.readiness ?? 'unknown';
  if (!targetVisible || targetSelected === false || detailMatchesTarget === false) {
    status = 'needs-target-selection';
  } else if (options.primaryAction?.trim() && primaryActionMatchesTarget === false) {
    status = 'needs-relation';
  }

  if (
    status === 'unknown'
    && !targetVisible
    && !options.primaryAction?.trim()
    && !options.currentSelection?.trim()
  ) {
    return null;
  }

  const reason = status === 'ready'
    ? 'UI Automation verification has target, selected/detail ownership, primary action ownership, and coordinate readiness.'
    : status === 'needs-target-selection'
      ? targetVisible
        ? 'UI Automation target is visible, but selected/detail ownership is not confirmed for the requested target.'
        : 'UI Automation did not clearly match the requested launcher target.'
      : status === 'needs-primary-action'
        ? 'UI Automation target evidence exists, but no primary open/start/play action is confirmed.'
        : status === 'needs-relation'
          ? 'UI Automation primary action ownership is not confirmed for the requested target.'
          : status === 'needs-coordinate'
            ? 'UI Automation primary action is identified, but no safe native-screen coordinate is resolved.'
            : status === 'low-confidence'
              ? 'UI Automation evidence confidence is too low for input.'
              : status === 'not-actionable'
                ? 'UI Automation evidence is not actionable.'
                : 'UI Automation launcher target/action state is still unknown.';

  return {
    currentSelection: options.currentSelection || null,
    detailMatchesTarget,
    evidence: [
      options.targetMatched ? `targetMatched=${options.targetMatched}` : '',
      options.currentSelection ? `currentSelection=${options.currentSelection}` : '',
      options.selectionVerificationStatus ? `selectionVerificationStatus=${options.selectionVerificationStatus}` : '',
      options.primaryAction ? `primaryAction=${options.primaryAction}` : '',
      options.relation ? `relation=${options.relation}` : '',
    ].filter(Boolean),
    primaryAction: options.primaryAction || null,
    primaryActionMatchesTarget,
    reason,
    status,
    targetMatched: options.targetMatched || null,
    targetSelected,
    targetVisible,
  };
}

function normalizeWindowUiInspectionText(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFKC').trim().toLowerCase()
    : '';
}

function getWindowUiControlSearchText(control: WindowUiControlLike) {
  return [
    control.name,
    control.automationId,
    control.className,
    control.controlType,
    getWindowUiControlLabel(control),
  ].map(normalizeWindowUiInspectionText).filter(Boolean).join(' ');
}

function isWindowUiAlternateActionText(text: string) {
  return /(?:\b(?:start|open|launch|play|run|resume|continue|retry|try\s*again|install|update|repair|enter)\b|\u5f00\u59cb|\u542f\u52a8|\u6253\u5f00|\u8fd0\u884c|\u7ee7\u7eed|\u91cd\u8bd5|\u91cd\u65b0\u5c1d\u8bd5|\u8fdb\u5165|\u64ad\u653e|\u5b89\u88c5|\u66f4\u65b0|\u4fee\u590d)/iu.test(text);
}

function getWindowUiControlTextOverlapScore(control: WindowUiControlLike, targetText: string) {
  const normalizedTarget = normalizeWindowUiInspectionText(targetText).replace(/\s+/gu, '');
  const controlText = getWindowUiControlSearchText(control).replace(/\s+/gu, '');
  if (!normalizedTarget || !controlText) {
    return 0;
  }

  if (controlText.includes(normalizedTarget) || normalizedTarget.includes(controlText)) {
    return 35;
  }

  const targetTokens = normalizedTarget.match(/[\p{L}\p{N}]{2,}/gu) ?? [];
  const matchedTokens = targetTokens.filter((token) => controlText.includes(token));
  return Math.min(24, matchedTokens.length * 8);
}

function getWindowUiControlCenterDistanceScore(
  control: WindowUiControlLike,
  matchedControls: WindowUiControlLike[],
) {
  const center = getWindowUiControlCenter(control);
  if (!center) {
    return 0;
  }

  const distances = matchedControls
    .map(getWindowUiControlCenter)
    .filter((candidate): candidate is NonNullable<ReturnType<typeof getWindowUiControlCenter>> => Boolean(candidate))
    .map((candidate) => Math.hypot(Number(center.x) - Number(candidate.x), Number(center.y) - Number(candidate.y)));
  if (!distances.length) {
    return 0;
  }

  const nearestDistance = Math.min(...distances);
  if (nearestDistance <= 220) {
    return 24;
  }
  if (nearestDistance <= 420) {
    return 14;
  }
  if (nearestDistance <= 720) {
    return 6;
  }

  return 0;
}

function scoreWindowUiEnabledAlternateAction(options: {
  control: WindowUiControlLike;
  matchedControls: WindowUiControlLike[];
  requireTargetAssociation?: boolean;
  targetText: string;
}) {
  if (!isWindowUiControlActionable(options.control) || !getWindowUiControlCenter(options.control)) {
    return null;
  }

  const controlText = getWindowUiControlSearchText(options.control);
  const matchScore = Number(options.control.matchScore);
  const numericMatchScore = Number.isFinite(matchScore) ? matchScore : 0;
  const actionTextScore = isWindowUiAlternateActionText(controlText) ? 34 : 0;
  const targetOverlapScore = getWindowUiControlTextOverlapScore(options.control, options.targetText);
  const distanceScore = getWindowUiControlCenterDistanceScore(options.control, options.matchedControls);
  const selectorScore = options.control.automationId?.trim() ? 8 : 0;
  const focusScore = options.control.keyboardFocusable === true ? 8 : 0;
  const actionScore = Array.isArray(options.control.actions) && options.control.actions.length ? 10 : 0;
  const disabledTargetScore = options.matchedControls.some((control) => control.enabled === false || control.offscreen === true)
    ? 12
    : 0;
  const hasTargetAssociation = targetOverlapScore > 0 || distanceScore > 0;
  if (options.requireTargetAssociation && !hasTargetAssociation) {
    return null;
  }

  const score = numericMatchScore
    + actionTextScore
    + targetOverlapScore
    + distanceScore
    + selectorScore
    + focusScore
    + actionScore
    + disabledTargetScore;

  if (
    score < 72
    && !(actionTextScore > 0 && score >= 58)
    && !(targetOverlapScore > 0 && score >= 62)
  ) {
    return null;
  }

  return {
    control: options.control,
    score,
  };
}

export function resolveWindowUiBestEnabledAlternateAction(options: {
  actionableControls: WindowUiControlLike[];
  matchedControls: WindowUiControlLike[];
  requireTargetAssociation?: boolean;
  targetText: string;
}) {
  const hasUnavailableMatchedTarget = options.matchedControls.some((control) => (
    control.enabled === false
    || control.offscreen === true
  ));
  const hasMatchedTarget = options.matchedControls.length > 0;
  if (!hasUnavailableMatchedTarget && (!hasMatchedTarget || !options.requireTargetAssociation)) {
    return null;
  }

  return options.actionableControls
    .map((control) => scoreWindowUiEnabledAlternateAction({
      control,
      matchedControls: options.matchedControls,
      requireTargetAssociation: options.requireTargetAssociation && !hasUnavailableMatchedTarget,
      targetText: options.targetText,
    }))
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort((first, second) => second.score - first.score)
    .at(0)?.control ?? null;
}

export function createWindowUiInspectionTextBlob(
  result: WindowUiInspectionResultLike,
  controls: WindowUiControlLike[],
  matchedControls: WindowUiControlLike[],
) {
  return [
    result.error,
    result.query,
    result.targetDescription,
    result.targetText,
    result.window?.processName,
    result.window?.title,
    ...matchedControls.flatMap((control) => [
      control.name,
      control.automationId,
      control.className,
      control.controlType,
    ]),
    ...controls.slice(0, 40).flatMap((control) => [
      control.name,
      control.automationId,
      control.className,
      control.controlType,
    ]),
  ].map(normalizeWindowUiInspectionText).filter(Boolean).join('\n');
}

export function formatWindowUiControlLine(control: WindowUiControlLike, index: number) {
  const label = getWindowUiControlLabel(control) || 'unnamed';
  const bounds = getWindowUiControlBounds(control);
  const center = getWindowUiControlCenter(control);
  const actionText = Array.isArray(control.actions) && control.actions.length
    ? ` actions=${control.actions.join(',')}`
    : '';
  const enabledText = typeof control.enabled === 'boolean' ? ` enabled=${control.enabled}` : '';
  const focusText = control.hasKeyboardFocus ? ' focused=true' : '';
  const scoreText = Number.isFinite(Number(control.matchScore)) && Number(control.matchScore) > 0
    ? ` matchScore=${Math.round(Number(control.matchScore))}`
    : '';
  const pointText = center ? ` center=${center.x},${center.y}` : '';
  const boundsText = bounds ? ` bounds=${bounds.x},${bounds.y},${bounds.width}x${bounds.height}` : '';
  return `${index + 1}. ${label}${pointText}${boundsText}${actionText}${enabledText}${focusText}${scoreText}`;
}
