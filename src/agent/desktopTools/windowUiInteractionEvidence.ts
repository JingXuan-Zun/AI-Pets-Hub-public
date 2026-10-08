import {
  type AgentChatCommandResult,
  type AgentStructuredToolCandidateEvidence,
  type AgentStructuredToolEvidence,
  type AgentStructuredToolWindowEvidence,
} from '../agentChatCommand';

interface WindowUiControlActionResultLike {
  actions?: string[] | null;
  automationId?: string | null;
  bounds?: { coordinateSpace?: string | null; height?: number | null; source?: string | null; width?: number | null; x?: number | null; y?: number | null } | null;
  centerX?: number | null;
  centerY?: number | null;
  controlType?: string | null;
  depth?: number | null;
  enabled?: boolean | null;
  hasKeyboardFocus?: boolean | null;
  keyboardFocusable?: boolean | null;
  matchScore?: number | null;
  name?: string | null;
  offscreen?: boolean | null;
  selected?: boolean | null;
  selectionItem?: boolean | null;
}

interface WindowUiActionWindowLike {
  bounds?: AgentStructuredToolWindowEvidence['bounds'];
  displayId?: string | null;
  displayLabel?: string | null;
  hwnd?: number | null;
  pid?: number | null;
  processName?: string | null;
  title?: string | null;
}

export interface WindowUiActionResultLike {
  candidates?: WindowUiControlActionResultLike[] | null;
  control?: WindowUiControlActionResultLike | null;
  error?: string | null;
  invoked?: boolean;
  method?: string | null;
  ok?: boolean;
  query?: string | null;
  resolvedAction?: string | null;
  targetText?: string | null;
  uiAction?: string | null;
  window?: WindowUiActionWindowLike | null;
}

function normalizeWindowUiActionRect(
  bounds: WindowUiControlActionResultLike['bounds'],
): AgentStructuredToolCandidateEvidence['bounds'] {
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

function normalizeWindowUiActionCenter(
  control: WindowUiControlActionResultLike | null | undefined,
): AgentStructuredToolCandidateEvidence['center'] {
  const centerX = Number(control?.centerX);
  const centerY = Number(control?.centerY);
  if (Number.isFinite(centerX) && Number.isFinite(centerY)) {
    return {
      coordinateSpace: 'native-screen',
      source: 'ui-automation',
      x: Math.round(centerX),
      y: Math.round(centerY),
    };
  }

  const bounds = normalizeWindowUiActionRect(control?.bounds);
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

function getWindowUiActionControlLabel(control: WindowUiControlActionResultLike | null | undefined) {
  return [
    control?.name?.trim(),
    control?.automationId?.trim() ? `id=${control.automationId.trim()}` : '',
    control?.controlType?.trim() ? `type=${control.controlType.trim()}` : '',
  ].filter(Boolean).join(' ');
}

function getWindowUiActionControlConfidence(
  control: WindowUiControlActionResultLike | null | undefined,
): AgentStructuredToolCandidateEvidence['confidence'] {
  const score = Number(control?.matchScore);
  if (Number.isFinite(score) && score >= 78) {
    return 'high';
  }
  if (Number.isFinite(score) && score >= 45) {
    return 'medium';
  }
  return 'low';
}

function isWindowUiActionControlActionable(control: WindowUiControlActionResultLike | null | undefined) {
  if (control?.enabled === false || control?.offscreen === true) {
    return false;
  }

  const actions = Array.isArray(control?.actions) ? control.actions : [];
  const controlType = control?.controlType?.trim().toLowerCase() ?? '';
  return control?.keyboardFocusable === true
    || actions.some((action) => ['invoke', 'select', 'toggle', 'expand-collapse', 'value', 'scroll-into-view', 'focus'].includes(action))
    || ['button', 'menuitem', 'hyperlink', 'listitem', 'tabitem', 'checkbox', 'radiobutton', 'combobox', 'edit'].includes(controlType);
}

function formatWindowUiActionControlStateTags(control: WindowUiControlActionResultLike) {
  return [
    typeof control.enabled === 'boolean' ? ` enabled=${control.enabled}` : '',
    typeof control.keyboardFocusable === 'boolean' ? ` keyboardFocusable=${control.keyboardFocusable}` : '',
    control.hasKeyboardFocus ? ' focused=true' : '',
    control.offscreen ? ' offscreen=true' : '',
    control.selectionItem ? ` selected=${control.selected === true}` : '',
  ].filter(Boolean).join('');
}

function createWindowUiActionCandidate(
  control: WindowUiControlActionResultLike,
  window: WindowUiActionWindowLike | null | undefined,
): AgentStructuredToolCandidateEvidence {
  const label = getWindowUiActionControlLabel(control) || 'UI control';
  const actions = Array.isArray(control.actions)
    ? control.actions.filter((action): action is string => typeof action === 'string' && Boolean(action.trim()))
    : null;
  const actionText = actions?.length ? ` actions=${actions.join(',')}` : '';
  const depth = Number.isFinite(Number(control.depth)) ? ` depth=${Math.round(Number(control.depth))}` : '';
  const stateTags = formatWindowUiActionControlStateTags(control);
  return {
    actions,
    automationId: control.automationId ?? null,
    bounds: normalizeWindowUiActionRect(control.bounds),
    center: normalizeWindowUiActionCenter(control),
    confidence: getWindowUiActionControlConfidence(control),
    controlType: control.controlType ?? null,
    description: `${label}${actionText}${depth}${stateTags}`.trim(),
    enabled: control.enabled ?? null,
    hasKeyboardFocus: control.hasKeyboardFocus ?? null,
    keyboardFocusable: control.keyboardFocusable ?? null,
    label,
    name: control.name ?? null,
    offscreen: control.offscreen ?? null,
    region: control.controlType ?? null,
    relation: isWindowUiActionControlActionable(control)
      ? 'UI Automation reports this control as actionable or near-actionable.'
      : 'UI Automation matched this control, but the requested UIA action was not available.',
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

function createWindowUiActionSelectionEvidence(options: {
  control: WindowUiControlActionResultLike | null;
  targetText: string;
  uiAction: string;
}) {
  if (options.uiAction !== 'select' && options.control?.selectionItem !== true) {
    return {
      currentSelection: null,
      selectionEvidence: [] as string[],
      selectionVerificationStatus: null as AgentStructuredToolEvidence['selectionVerificationStatus'],
    };
  }

  const controlLabel = getWindowUiActionControlLabel(options.control) || options.targetText || 'UI control';
  const selected = options.control?.selected === true;
  const status: AgentStructuredToolEvidence['selectionVerificationStatus'] = selected
    ? 'selected'
    : options.control?.selectionItem === true
      ? 'visible-only'
      : 'unknown';

  return {
    currentSelection: selected ? controlLabel : null,
    selectionEvidence: [
      `UIA selection action target: ${controlLabel}`,
      `UIA selection action result: selected=${selected}`,
      options.control?.selectionItem === true
        ? 'UIA target supports SelectionItemPattern.'
        : 'UIA target selection support was not confirmed after the action.',
    ],
    selectionVerificationStatus: status,
  };
}

function createWindowUiFallbackRecoveryEvidence(options: {
  controlLabel: string;
  error: string;
  point: NonNullable<AgentStructuredToolCandidateEvidence['center']>;
}) {
  return {
    nextArgs: {
      action: 'click',
      button: 'left',
      coordinateSpace: options.point.coordinateSpace ?? 'native-screen',
      x: options.point.x,
      y: options.point.y,
    },
    nextTool: 'execute_desktop_input' as const,
    reason: `UI Automation interaction failed (${options.error}), but the matched control "${options.controlLabel}" has a clear native-screen coordinate. Request approval for a coordinate click fallback instead of retrying the same UIA action.`,
    strategy: 're-locate-target' as const,
  };
}

function createWindowUiMissingValueStructuredEvidence(options: {
  automationId: string;
  controlType: string;
  query: string;
  targetText: string;
  uiAction: string;
}): AgentStructuredToolEvidence {
  const targetMatched = options.targetText || options.automationId || 'UI input control';
  return {
    actionCandidates: null,
    confidence: 'medium',
    coordinateConfidence: 'low',
    primaryAction: options.uiAction,
    postActionRecovery: {
      nextArgs: {
        action: 'inspect_window_ui',
        forceRefresh: true,
        query: options.query || undefined,
        targetText: options.targetText || options.automationId || undefined,
      },
      nextTool: 'execute_desktop_observation',
      reason: 'The requested UI Automation value action is missing the text to enter. Ask the user for the value before retrying; do not click or clear the field.',
      strategy: 'ask-user',
    },
    relation: 'UI Automation set_value requires an explicit text value from the user.',
    status: 'needs-user',
    targetMatched,
    visualActionReadiness: 'not-actionable',
    visibleTextCandidates: [
      options.targetText,
      options.automationId,
      options.controlType,
    ].filter((value): value is string => Boolean(value?.trim())),
  };
}

export function createWindowUiMissingValueResult(options: {
  automationId: string;
  controlType: string;
  normalizedDesktopAction: string;
  query: string;
  targetText: string;
  uiAction: string;
}): AgentChatCommandResult {
  const structuredEvidence = createWindowUiMissingValueStructuredEvidence(options);
  const observations = [
    `Desktop action: ${options.normalizedDesktopAction}`,
    options.query ? `Window query: ${options.query}` : '',
    `Control: ${options.targetText || options.automationId || 'target input control'}`,
    options.automationId ? `AutomationId: ${options.automationId}` : '',
    options.controlType ? `Control type: ${options.controlType}` : '',
    `Requested UI action: ${options.uiAction}`,
    'Missing value for UI Automation set_value.',
  ].filter(Boolean);

  const stateSummary = {
    missingEvidence: ['Missing text value for UI Automation set_value.'],
    observedState: observations,
    recommendedRecovery: [
      [
        'postActionRecoveryStrategy=ask-user',
        'nextTool=execute_desktop_observation',
        `nextArgs=${JSON.stringify(structuredEvidence.postActionRecovery?.nextArgs ?? {})}`,
        structuredEvidence.postActionRecovery?.reason
          ? `reason=${structuredEvidence.postActionRecovery.reason}`
          : '',
      ].filter(Boolean).join(' | '),
    ],
    structuredEvidence,
    verificationEvidence: [],
  };

  return {
    errorText: 'Missing text value for UI Automation set_value.',
    observations,
    ok: false,
    receipt: {
      evidenceLines: observations,
      status: 'blocked',
      summaryLines: [
        `Call: execute_desktop_action ${options.normalizedDesktopAction}`,
        `Control: ${options.targetText || options.automationId || 'target input control'}`,
        `UI action: ${options.uiAction}`,
        'Result: blocked because no text value was provided.',
      ],
      title: 'Agent window UI value input blocked',
      toolName: 'execute_desktop_action',
      verification: 'No text value was provided for UI Automation set_value.',
      stateSummary,
    },
    responseText: 'interact_window_ui set_value needs a non-empty value before it can change an input field.',
    stateSummary,
    verification: 'No UI value was changed because the text value is missing.',
  };
}

export function createWindowUiInteractionStructuredEvidence(
  result: WindowUiActionResultLike,
  options: {
    automationId: string;
    controlType: string;
    normalizedDesktopAction: string;
    targetText: string;
    uiAction: string;
  },
): AgentStructuredToolEvidence | null {
  const candidates = Array.isArray(result.candidates) ? result.candidates : [];
  const control = result.control ?? null;
  const candidateRecords = [
    ...(control ? [control] : []),
    ...candidates,
  ];
  const uniqueCandidates = candidateRecords.filter((candidate, index) => {
    const key = [
      candidate.name ?? '',
      candidate.automationId ?? '',
      candidate.controlType ?? '',
      candidate.centerX ?? '',
      candidate.centerY ?? '',
    ].join('\u0000');
    return candidateRecords.findIndex((item) => [
      item.name ?? '',
      item.automationId ?? '',
      item.controlType ?? '',
      item.centerX ?? '',
      item.centerY ?? '',
    ].join('\u0000') === key) === index;
  });
  const actionCandidates = uniqueCandidates
    .filter((candidate) => isWindowUiActionControlActionable(candidate) || normalizeWindowUiActionCenter(candidate))
    .slice(0, 8)
    .map((candidate) => createWindowUiActionCandidate(candidate, result.window));
  const targetCandidates = uniqueCandidates
    .filter((candidate) => normalizeWindowUiActionCenter(candidate) || normalizeWindowUiActionRect(candidate.bounds))
    .slice(0, 8)
    .map((candidate) => createWindowUiActionCandidate(candidate, result.window));
  const bestCandidate = control
    ? createWindowUiActionCandidate(control, result.window)
    : actionCandidates.at(0) ?? targetCandidates.at(0) ?? null;
  const bestPoint = bestCandidate?.center ?? null;
  const bestBounds = bestCandidate?.bounds ?? null;
  const controlLabel = getWindowUiActionControlLabel(control) || options.targetText || options.automationId || 'UI control';
  const error = result.error?.trim() || 'unknown error';
  if (!bestCandidate && !actionCandidates.length && !targetCandidates.length) {
    return null;
  }

  const canCoordinateFallback = Boolean(!result.ok && bestPoint);
  const matchedText = options.targetText
    || control?.name?.trim()
    || control?.automationId?.trim()
    || bestCandidate?.label
    || null;
  const selectionEvidence = createWindowUiActionSelectionEvidence({
    control,
    targetText: matchedText ?? options.targetText,
    uiAction: result.resolvedAction || result.uiAction || options.uiAction,
  });
  const actionStatus = result.ok && selectionEvidence.selectionVerificationStatus === 'visible-only'
    ? 'unverified'
    : result.ok ? 'success' : 'failed';
  return {
    actionCandidates: actionCandidates.length ? actionCandidates : null,
    confidence: result.ok
      ? bestCandidate?.confidence ?? 'medium'
      : canCoordinateFallback
        ? bestCandidate?.confidence ?? 'medium'
        : 'low',
    coordinateConfidence: bestPoint ? 'high' : bestBounds ? 'medium' : 'low',
    currentSelection: selectionEvidence.currentSelection,
    elementBounds: bestBounds,
    elementCenter: bestPoint,
    elementDescription: bestCandidate?.description ?? controlLabel,
    primaryAction: result.ok
      ? (result.resolvedAction || result.uiAction || options.uiAction || options.normalizedDesktopAction)
      : `fallback click for ${controlLabel}`,
    postActionRecovery: canCoordinateFallback && bestPoint
      ? createWindowUiFallbackRecoveryEvidence({
          controlLabel,
          error,
          point: bestPoint,
        })
      : {
          nextArgs: {
            action: 'inspect_window_ui',
            forceRefresh: true,
            query: result.query || undefined,
            targetText: options.targetText || options.automationId || controlLabel,
          },
          nextTool: 'execute_desktop_observation',
          reason: `UI Automation interaction failed (${error}) and no clear fallback coordinate was available. Refresh UI Automation evidence before retrying or asking the user.`,
          strategy: 're-locate-target',
        },
    relation: result.ok
      ? 'UI Automation applied the requested control action.'
      : canCoordinateFallback
        ? 'UI Automation matched the intended control but could not apply the requested pattern; the same control has a native-screen coordinate for a permission-gated click fallback.'
        : 'UI Automation interaction failed and needs refreshed control evidence.',
    selectionEvidence: selectionEvidence.selectionEvidence.length ? selectionEvidence.selectionEvidence : null,
    selectionVerificationStatus: selectionEvidence.selectionVerificationStatus,
    status: actionStatus,
    targetCandidates: targetCandidates.length ? targetCandidates : null,
    targetMatched: matchedText,
    visibleTextCandidates: uniqueCandidates
      .map((candidate) => candidate.name?.trim())
      .filter((name): name is string => Boolean(name))
      .slice(0, 16),
    visualActionReadiness: bestPoint
      ? 'ready'
      : targetCandidates.length
        ? 'needs-coordinate'
        : 'low-confidence',
  };
}
