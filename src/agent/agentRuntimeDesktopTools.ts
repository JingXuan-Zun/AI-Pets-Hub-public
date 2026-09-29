import { desktopPetShellRuntime } from '../desktopShellRuntime';
import {
  type AgentChatCommandResult,
  type AgentDesktopActionEvidence,
  type AgentDesktopActionOutcome,
  type AgentDesktopActionTargetRef,
  type AgentStructuredToolCandidateEvidence,
  type AgentStructuredToolEvidence,
  type AgentStructuredToolWindowEvidence,
  type AgentToolCallCommand,
} from './agentChatCommand';
import {
  analyzeAgentCaptureDataUrl,
  compareAgentCaptureDataUrls,
  createAgentCaptureRedDotPreview,
  formatAgentCaptureQualityLine,
  type AgentCaptureQualityAnalysis,
  type AgentInputReplayPreview,
} from './agentCaptureQuality';
import {
  createAgentCoordinateAuditEvidence,
  formatAgentCoordinateAuditLine,
} from './agentCoordinateAudit';
import { evaluateAgentCoordinateReplayClosureHarness } from './agentCoordinateHarness';
import { type AgentRuntimeExecutorContext } from './agentRuntimeExecutor';
import { executeBrowserSearch } from './agentRuntimeBrowserTools';
import {
  executeAppLaunch,
  executeOpenResource,
} from './agentRuntimeDesktopLaunchTools';
import {
  executeGetActiveWindowInfo,
  executeGetDefaultAppForUri,
  executeListRunningApps,
} from './agentRuntimeDesktopObservationTools';
import {
  executeCloseWindow,
  executeControlWindow,
  executeFocusWindow,
  executeMoveWindowToDisplay,
} from './agentRuntimeWindowTools';
import {
  executeOpenOrFocusThenControlWindow,
  executeOpenOrFocusThenMoveWindowToDisplay,
} from './agentRuntimeWindowWorkflowTools';

export {
  executeAppLaunch,
  executeOpenResource,
} from './agentRuntimeDesktopLaunchTools';
export {
  executeCloseWindow,
  executeControlWindow,
  executeFocusWindow,
  executeMoveWindowToDisplay,
  waitForDesktopActionWindowSettle,
} from './agentRuntimeWindowTools';
export {
  executeOpenOrFocusThenControlWindow,
  executeOpenOrFocusThenMoveWindowToDisplay,
} from './agentRuntimeWindowWorkflowTools';

function getToolStringInput(toolCall: AgentToolCallCommand, keys: string[]) {
  const input = toolCall.input ?? {};
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function getToolBooleanInput(toolCall: AgentToolCallCommand, key: string) {
  const value = toolCall.input?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

function getToolNumberInput(toolCall: AgentToolCallCommand, key: string) {
  const value = toolCall.input?.[key];
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.trim())
      : NaN;

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function getToolNumberInputAny(toolCall: AgentToolCallCommand, keys: string[]) {
  for (const key of keys) {
    const value = getToolNumberInput(toolCall, key);
    if (typeof value === 'number') {
      return value;
    }
  }

  return undefined;
}

export function normalizeExecuteDesktopAction(value: string) {
  const normalizedValue = value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
  switch (normalizedValue) {
    case 'list_windows':
      return 'list_running_apps';
    case 'get_default_browser':
      return 'get_default_app_for_uri';
    case 'focus_browser_window':
      return 'focus_window';
    case 'resize_window':
    case 'snap_window':
    case 'maximize_window':
    case 'minimize_window':
    case 'restore_window':
      return 'control_window';
    case 'open_then_control_window':
    case 'launch_then_control_window':
    case 'focus_then_control_window':
      return 'open_or_focus_then_control_window';
    case 'open_then_move_window_to_display':
    case 'launch_then_move_window_to_display':
      return 'open_or_focus_then_move_window_to_display';
    case 'move_window':
    case 'move_window_to_screen':
    case 'move_window_to_monitor':
      return 'move_window_to_display';
    case 'close_app':
      return 'close_window';
    case 'open_url':
      return 'open_resource';
    case 'open_app':
      return 'launch_local_app';
    case 'invoke_ui':
    case 'invoke_control':
    case 'invoke_button':
    case 'click_window_ui':
      return 'invoke_window_ui';
    case 'ui_action':
    case 'uia_action':
    case 'interact_ui':
    case 'interact_control':
    case 'select_ui':
    case 'select_window_ui':
    case 'toggle_ui':
    case 'toggle_window_ui':
    case 'expand_ui':
    case 'expand_window_ui':
    case 'collapse_ui':
    case 'collapse_window_ui':
    case 'set_ui_value':
    case 'set_window_ui_value':
      return 'interact_window_ui';
    case 'list_running_apps':
    case 'get_default_app_for_uri':
    case 'get_active_window_info':
    case 'focus_window':
    case 'control_window':
    case 'open_or_focus_then_control_window':
    case 'open_or_focus_then_move_window_to_display':
    case 'move_window_to_display':
    case 'close_window':
    case 'open_resource':
    case 'launch_local_app':
    case 'interact_window_ui':
    case 'invoke_window_ui':
    case 'search_web':
      return normalizedValue;
    default:
      return '';
  }
}

export function normalizeExecuteDesktopInputAction(value: string) {
  const normalizedValue = value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
  switch (normalizedValue) {
    case 'move_pointer':
    case 'set_cursor':
      return 'move_mouse';
    case 'doubleclick':
      return 'double_click';
    case 'context_click':
      return 'right_click';
    case 'left_click':
      return 'click';
    case 'type':
    case 'text':
      return 'type_text';
    case 'keys':
    case 'press_keys':
      return 'send_keys';
    case 'shortcut':
      return 'hotkey';
    case 'drag_mouse':
      return 'drag';
    case 'move_mouse':
    case 'click':
    case 'double_click':
    case 'right_click':
    case 'type_text':
    case 'send_keys':
    case 'hotkey':
    case 'drag':
      return normalizedValue;
    default:
      return '';
  }
}

function getDesktopActionTargetInput(toolCall: AgentToolCallCommand) {
  return getToolStringInput(toolCall, [
    'target',
    'query',
    'url',
    'path',
    'website',
    'site',
    'appName',
    'name',
    'title',
    'processName',
  ]);
}

function annotateDesktopActionResult(
  action: string,
  result: AgentChatCommandResult,
): AgentChatCommandResult {
  const actionEvidence = result.stateSummary?.actionEvidence
    ?? result.receipt?.stateSummary?.actionEvidence
    ?? createGenericDesktopActionEvidence(action, result);
  const stateSummary = actionEvidence
    ? {
        ...(result.stateSummary ?? {}),
        actionEvidence,
      }
    : result.stateSummary;
  const receipt = result.receipt && actionEvidence
    ? {
        ...result.receipt,
        stateSummary: {
          ...(result.receipt.stateSummary ?? {}),
          actionEvidence,
        },
      }
    : result.receipt;

  return {
    ...result,
    observations: [
      `Desktop action: ${action}`,
      ...(result.observations ?? []),
    ],
    receipt,
    stateSummary,
  };
}

const AGENT_DESKTOP_ACTION_EVIDENCE_ACTIONS = new Set([
  'close_window',
  'control_window',
  'focus_window',
  'interact_window_ui',
  'invoke_window_ui',
  'launch_local_app',
  'move_window_to_display',
  'open_or_focus_then_control_window',
  'open_or_focus_then_move_window_to_display',
  'open_resource',
  'search_web',
]);

function clampAgentDesktopActionConfidence(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function getAgentDesktopActionEvidenceConfidence(outcome: AgentDesktopActionOutcome) {
  switch (outcome) {
    case 'changed':
      return 0.72;
    case 'no-op':
      return 0.68;
    case 'blocked':
      return 0.76;
    case 'uncertain':
    default:
      return 0.38;
  }
}

function resolveAgentDesktopActionOutcomeFromResult(
  result: AgentChatCommandResult,
): AgentDesktopActionOutcome {
  if (result.ok === false || result.receipt?.status === 'blocked' || result.receipt?.status === 'failed') {
    return 'blocked';
  }

  if (
    result.receipt?.status === 'unverified'
    || result.assessment?.status === 'unverified'
    || Boolean(result.stateSummary?.missingEvidence?.length)
  ) {
    return 'uncertain';
  }

  return 'changed';
}

function createDesktopActionTargetRefFromStructuredEvidence(
  action: string,
  structuredEvidence: AgentStructuredToolEvidence | null | undefined,
): AgentDesktopActionTargetRef | null {
  const finalWindow = structuredEvidence?.finalWindow ?? null;
  const firstTarget = structuredEvidence?.targetCandidates?.[0] ?? null;
  const label = structuredEvidence?.targetMatched
    || firstTarget?.label
    || finalWindow?.title
    || finalWindow?.processName
    || '';
  if (!label) {
    return null;
  }

  const kind: AgentDesktopActionTargetRef['kind'] = action === 'interact_window_ui' || action === 'invoke_window_ui'
    ? 'uia'
    : finalWindow
      ? 'window'
      : 'app';
  const stableId = [
    firstTarget?.automationId,
    firstTarget?.controlType,
    finalWindow?.hwnd,
    finalWindow?.pid,
  ].filter((value) => value !== undefined && value !== null && String(value).trim()).join(':');

  return {
    bounds: firstTarget?.bounds ?? finalWindow?.bounds ?? null,
    confidence: structuredEvidence?.confidence ?? firstTarget?.confidence ?? 'medium',
    kind,
    label,
    stableId: stableId || null,
  };
}

function createGenericDesktopActionEvidence(
  action: string,
  result: AgentChatCommandResult,
): AgentDesktopActionEvidence | null {
  if (!AGENT_DESKTOP_ACTION_EVIDENCE_ACTIONS.has(action)) {
    return null;
  }

  const structuredEvidence = result.stateSummary?.structuredEvidence
    ?? result.receipt?.stateSummary?.structuredEvidence
    ?? null;
  const outcome = resolveAgentDesktopActionOutcomeFromResult(result);
  const targetRef = createDesktopActionTargetRefFromStructuredEvidence(action, structuredEvidence);
  const observedState = [
    ...(result.stateSummary?.observedState ?? []),
    ...(result.observations ?? []),
  ].slice(0, 12);
  const changed = outcome === 'changed'
    ? true
    : outcome === 'no-op'
      ? false
      : null;

  return {
    action,
    after: observedState.length || structuredEvidence?.finalWindow
      ? {
          observedState,
          targetWindow: structuredEvidence?.finalWindow ?? null,
        }
      : null,
    confidence: getAgentDesktopActionEvidenceConfidence(outcome),
    diff: {
      changed,
      signals: [
        result.receipt?.status ? `receipt=${result.receipt.status}` : '',
        result.assessment?.status ? `assessment=${result.assessment.status}` : '',
        structuredEvidence?.status ? `structuredStatus=${structuredEvidence.status}` : '',
      ].filter(Boolean),
      summary: outcome === 'changed'
        ? 'Desktop action completed with available runtime evidence.'
        : outcome === 'blocked'
          ? 'Desktop action was blocked or failed before a verified state change.'
          : 'Desktop action completed, but runtime evidence did not verify a state change.',
    },
    phase: outcome === 'changed' ? 'confirmed' : outcome === 'blocked' ? undefined : 'dispatched',
    outcome,
    snapshotProfile: 'light',
    targetRef,
    timestamp: Date.now(),
    tool: 'execute_desktop_action',
  };
}

function createDesktopInputTargetRef(options: {
  action: string;
  point: { x: number; y: number } | null;
  preview?: AgentInputReplayPreview | null;
}): AgentDesktopActionTargetRef | null {
  if (!options.point) {
    return null;
  }

  const auditStatus = options.preview?.coordinateClosureStatus
    ?? options.preview?.coordinateAudit?.status
    ?? null;
  return {
    confidence: auditStatus && auditStatus !== 'coordinate_closure_ok' && auditStatus !== 'coordinate_ok'
      ? 'low'
      : 'medium',
    kind: 'pixel',
    label: `${options.action} at ${options.point.x},${options.point.y}`,
    stableId: `screen:${options.point.x}:${options.point.y}`,
  };
}

function resolveDesktopInputActionOutcome(options: {
  action: string;
  ok: boolean;
  preview?: AgentInputReplayPreview | null;
  replayExpected: boolean;
  replayMissingEvidence: string[];
}): AgentDesktopActionOutcome {
  if (!options.ok) {
    return 'blocked';
  }

  if (options.preview?.uiChanged === true) {
    return 'changed';
  }

  if (options.preview?.uiChanged === false) {
    return 'no-op';
  }

  if (options.replayExpected || options.replayMissingEvidence.length) {
    return 'uncertain';
  }

  return 'uncertain';
}

function createDesktopInputActionEvidence(options: {
  action: string;
  ok: boolean;
  point: { x: number; y: number } | null;
  preview?: AgentInputReplayPreview | null;
  replayExpected: boolean;
  replayLines: string[];
  replayMissingEvidence: string[];
}): AgentDesktopActionEvidence {
  const outcome = resolveDesktopInputActionOutcome({
    action: options.action,
    ok: options.ok,
    preview: options.preview,
    replayExpected: options.replayExpected,
    replayMissingEvidence: options.replayMissingEvidence,
  });
  const changed = outcome === 'changed'
    ? true
    : outcome === 'no-op'
      ? false
      : null;
  const beforeCaptureStatus = options.preview?.beforeCaptureStatus ?? null;
  const afterCaptureStatus = options.preview?.afterCaptureStatus ?? null;

  return {
    action: options.action,
    after: {
      captureStatus: afterCaptureStatus,
      cursor: options.point
        ? { coordinateSpace: 'native-screen', source: 'desktop-input-replay', x: options.point.x, y: options.point.y }
        : null,
      observedState: options.replayLines,
    },
    before: {
      captureStatus: beforeCaptureStatus,
      cursor: options.point
        ? { coordinateSpace: 'native-screen', source: 'desktop-input-replay', x: options.point.x, y: options.point.y }
        : null,
      observedState: beforeCaptureStatus ? [`beforeCaptureStatus=${beforeCaptureStatus}`] : [],
    },
    confidence: clampAgentDesktopActionConfidence(
      getAgentDesktopActionEvidenceConfidence(outcome)
      + (options.preview?.coordinateClosureStatus === 'coordinate_closure_ok' ? 0.1 : 0),
    ),
    diff: {
      changed,
      signals: [
        typeof options.preview?.uiChanged === 'boolean' ? `uiChanged=${options.preview.uiChanged}` : '',
        typeof options.preview?.visualDeltaRatio === 'number' ? `visualDeltaRatio=${options.preview.visualDeltaRatio}` : '',
        options.preview?.coordinateClosureStatus ? `coordinateClosure=${options.preview.coordinateClosureStatus}` : '',
        ...options.replayMissingEvidence.slice(0, 4),
      ].filter(Boolean),
      summary: outcome === 'changed'
        ? 'Desktop input replay detected a visible state change.'
        : outcome === 'no-op'
          ? 'Desktop input replay did not detect a visible state change.'
          : outcome === 'blocked'
            ? 'Desktop input failed or was blocked by the input bridge.'
            : 'Desktop input ran, but the available replay evidence is insufficient to prove a state change.',
    },
    phase: outcome === 'changed' ? 'confirmed' : outcome === 'blocked' ? undefined : 'dispatched',
    outcome,
    snapshotProfile: options.preview ? 'replay' : 'light',
    targetRef: createDesktopInputTargetRef({
      action: options.action,
      point: options.point,
      preview: options.preview,
    }),
    timestamp: Date.now(),
    tool: 'execute_desktop_input',
  };
}

function attachDesktopActionEvidenceToResult(
  result: AgentChatCommandResult,
  actionEvidence: AgentDesktopActionEvidence,
): AgentChatCommandResult {
  const stateSummary = {
    ...(result.stateSummary ?? {}),
    actionEvidence,
  };
  return {
    ...result,
    receipt: result.receipt
      ? {
          ...result.receipt,
          stateSummary: {
            ...(result.receipt.stateSummary ?? {}),
            actionEvidence,
          },
        }
      : result.receipt,
    stateSummary,
  };
}

function resolveDesktopInputReplayPoint(toolCall: AgentToolCallCommand, action: string) {
  if (action === 'drag') {
    const toX = getToolNumberInputAny(toolCall, ['toX', 'targetX', 'endX']);
    const toY = getToolNumberInputAny(toolCall, ['toY', 'targetY', 'endY']);
    if (typeof toX === 'number' && typeof toY === 'number') {
      return {
        x: Math.round(toX),
        y: Math.round(toY),
      };
    }
  }

  const x = getToolNumberInputAny(toolCall, ['x', 'nativeScreenX', 'clientX']);
  const y = getToolNumberInputAny(toolCall, ['y', 'nativeScreenY', 'clientY']);
  if (typeof x !== 'number' || typeof y !== 'number') {
    return null;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
  };
}

function shouldUseToolCallPointForNativeScreenReplay(toolCall: AgentToolCallCommand, action: string) {
  const explicitCoordinateSpace = getToolStringInput(toolCall, ['coordinateSpace']).toLowerCase();
  if (explicitCoordinateSpace) {
    return explicitCoordinateSpace === 'native-screen';
  }

  return shouldDefaultDesktopInputToNativeScreen(action) && hasDesktopInputPoint(toolCall, action);
}

function getDesktopInputResultNumber(result: Record<string, unknown>, key: string) {
  const value = result[key];
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.trim())
      : NaN;

  return Number.isFinite(numberValue) ? Math.round(numberValue) : null;
}

function resolveDesktopInputResultReplayPoint(
  result: Record<string, unknown> | null | undefined,
  action: string,
) {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const x = action === 'drag'
    ? getDesktopInputResultNumber(result, 'toX')
    : getDesktopInputResultNumber(result, 'x');
  const y = action === 'drag'
    ? getDesktopInputResultNumber(result, 'toY')
    : getDesktopInputResultNumber(result, 'y');
  if (x === null || y === null) {
    return null;
  }

  return { x, y };
}

function shouldCaptureDesktopInputReplay(action: string) {
  return action === 'click'
    || action === 'double_click'
    || action === 'right_click'
    || action === 'drag';
}

function shouldDefaultDesktopInputToNativeScreen(action: string) {
  return action === 'move_mouse'
    || action === 'click'
    || action === 'double_click'
    || action === 'right_click'
    || action === 'drag';
}

function hasDesktopInputPoint(toolCall: AgentToolCallCommand, action: string) {
  if (action === 'drag') {
    return typeof getToolNumberInputAny(toolCall, ['fromX', 'x', 'fromNativeScreenX', 'nativeScreenX']) === 'number'
      && typeof getToolNumberInputAny(toolCall, ['fromY', 'y', 'fromNativeScreenY', 'nativeScreenY']) === 'number'
      && typeof getToolNumberInputAny(toolCall, ['toX', 'targetX', 'endX', 'toNativeScreenX']) === 'number'
      && typeof getToolNumberInputAny(toolCall, ['toY', 'targetY', 'endY', 'toNativeScreenY']) === 'number';
  }

  return typeof getToolNumberInputAny(toolCall, ['x', 'nativeScreenX']) === 'number'
    && typeof getToolNumberInputAny(toolCall, ['y', 'nativeScreenY']) === 'number';
}

function createDesktopInputRequest(toolCall: AgentToolCallCommand, action: string) {
  const explicitCoordinateSpace = getToolStringInput(toolCall, ['coordinateSpace']);
  const shouldDefaultToNativeScreen = !explicitCoordinateSpace
    && shouldDefaultDesktopInputToNativeScreen(action)
    && hasDesktopInputPoint(toolCall, action);

  return {
    ...toolCall.input,
    action,
    ...(shouldDefaultToNativeScreen ? { coordinateSpace: 'native-screen' } : {}),
  };
}

function findDesktopInputReplayScreenSource(
  sources: DesktopPetCaptureSourceLike[],
  point: { x: number; y: number },
) {
  const screenSources = sources.filter((source) => source.type === 'screen' && Boolean(source.thumbnail));
  return screenSources.find((source) => {
    const bounds = source.bounds;
    return Boolean(
      bounds
      && point.x >= bounds.x
      && point.x <= bounds.x + bounds.width
      && point.y >= bounds.y
      && point.y <= bounds.y + bounds.height,
    );
  }) ?? screenSources[0] ?? null;
}

async function captureDesktopInputReplayFrame(point: { x: number; y: number }) {
  const sources = await desktopPetShellRuntime.listCaptureSources({
    captureSourceTypes: ['screen'],
    forceRefresh: true,
    includeCaptureThumbnails: true,
  }) as DesktopPetCaptureSourceLike[];
  const screenSources = Array.isArray(sources) ? sources : [];
  const source = findDesktopInputReplayScreenSource(screenSources, point);
  if (!source?.thumbnail) {
    return null;
  }

  const quality = await analyzeAgentCaptureDataUrl(source.thumbnail);
  const coordinateAudit = createAgentCoordinateAuditEvidence({
    displaySources: screenSources,
    point,
    source,
  });
  const redDotDataUrl = await createAgentCaptureRedDotPreview({
    imageDataUrl: source.thumbnail,
    point,
    source,
  });

  return {
    coordinateAudit,
    displaySources: screenSources,
    imageDataUrl: source.thumbnail,
    quality,
    redDotDataUrl,
    source,
  };
}

async function waitForDesktopInputReplayAfterCapture() {
  await new Promise((resolve) => {
    globalThis.setTimeout(resolve, 220);
  });
}

async function captureDesktopInputReplayBefore(point: { x: number; y: number } | null) {
  if (!point) {
    return null;
  }

  try {
    return await captureDesktopInputReplayFrame(point);
  } catch {
    return null;
  }
}

async function captureDesktopInputReplayAfter(options: {
  beforeImageDataUrl?: string | null;
  point: { x: number; y: number } | null;
}) {
  if (!options.point) {
    return null;
  }

  try {
    await waitForDesktopInputReplayAfterCapture();
    const frame = await captureDesktopInputReplayFrame(options.point);
    if (!frame) {
      return null;
    }

    const delta = options.beforeImageDataUrl
      ? await compareAgentCaptureDataUrls(options.beforeImageDataUrl, frame.imageDataUrl).catch(() => null)
      : null;

    return {
      ...frame,
      delta,
    };
  } catch {
    return null;
  }
}

function createDesktopInputReplayEvidence(options: {
  after: Awaited<ReturnType<typeof captureDesktopInputReplayAfter>>;
  before: Awaited<ReturnType<typeof captureDesktopInputReplayBefore>>;
  point: { x: number; y: number } | null;
}) {
  const beforeRegionSignature = options.after?.delta
    ? options.after.delta.uiChanged
      ? 'before-change'
      : 'unchanged'
    : null;
  const afterRegionSignature = options.after?.delta
    ? options.after.delta.uiChanged
      ? 'after-change'
      : 'unchanged'
    : null;
  const replaySource = options.after?.source ?? options.before?.source ?? null;
  const replayDisplaySources = options.after?.displaySources?.length
    ? options.after.displaySources
    : options.before?.displaySources ?? [];
  const coordinateClosure = options.point && replaySource
    ? evaluateAgentCoordinateReplayClosureHarness({
        afterRegion: {
          signature: afterRegionSignature,
          trusted: options.after?.quality.trusted ?? null,
        },
        beforeRegion: {
          signature: beforeRegionSignature,
          trusted: options.before?.quality.trusted ?? null,
        },
        clickPoint: options.point,
        displaySources: replayDisplaySources,
        source: replaySource,
      })
    : null;
  const preview: AgentInputReplayPreview | null = options.point
    ? {
        afterCaptureStatus: options.after?.quality.status ?? null,
        afterRedDotDataUrl: options.after?.redDotDataUrl ?? null,
        beforeCaptureStatus: options.before?.quality.status ?? null,
        beforeRedDotDataUrl: options.before?.redDotDataUrl ?? null,
        clickPoint: options.point,
        coordinateAudit: options.after?.coordinateAudit ?? options.before?.coordinateAudit ?? null,
        coordinateClosure,
        coordinateClosureStatus: coordinateClosure?.status ?? null,
        screenSource: options.after?.source.name ?? options.before?.source.name ?? null,
        uiChanged: options.after?.delta?.uiChanged ?? null,
        visualDeltaRatio: options.after?.delta?.changedRatio ?? null,
      }
    : null;
  const coordinateAudit = preview?.coordinateAudit ?? null;
  const coordinateAuditLine = formatAgentCoordinateAuditLine(coordinateAudit, 'Input replay coordinate audit');
  const lines = [
    options.point ? `Input replay point: x=${options.point.x} y=${options.point.y}` : '',
    coordinateAuditLine,
    options.before?.quality ? formatAgentCaptureQualityLine(options.before.quality, 'Input replay before capture') : '',
    options.after?.quality ? formatAgentCaptureQualityLine(options.after.quality, 'Input replay after capture') : '',
    options.after?.delta
      ? `Input replay visual delta: changed=${options.after.delta.uiChanged} changedRatio=${options.after.delta.changedRatio} meanDiff=${options.after.delta.meanDiff}`
      : '',
    coordinateClosure
      ? `Input replay coordinate closure: status=${coordinateClosure.status} targetRegionChanged=${coordinateClosure.targetRegionChanged} redDotRatio=${coordinateClosure.redDotRatio ? `${coordinateClosure.redDotRatio.x},${coordinateClosure.redDotRatio.y}` : 'unknown'}`
      : '',
    preview?.beforeRedDotDataUrl ? 'Input replay before red-dot preview captured.' : '',
    preview?.afterRedDotDataUrl ? 'Input replay after red-dot preview captured.' : '',
  ].filter(Boolean);
  const untrustedCaptures = [
    options.before?.quality,
    options.after?.quality,
  ].filter((quality): quality is AgentCaptureQualityAnalysis => Boolean(quality && !quality.trusted));
  const coordinateAuditMissingEvidence = coordinateAudit && coordinateAudit.status !== 'coordinate_ok'
    ? [`Input replay coordinate audit failed: ${coordinateAudit.status} (${coordinateAudit.reason})`]
    : [];
  const coordinateClosureMissingEvidence = coordinateClosure && coordinateClosure.status !== 'coordinate_closure_ok'
    ? [`Input replay coordinate closure failed: ${coordinateClosure.status}`]
    : [];

  return {
    lines,
    missingEvidence: [
      ...untrustedCaptures.map((quality) => `Input replay capture untrusted: ${quality.status} (${quality.reason})`),
      ...coordinateAuditMissingEvidence,
      ...coordinateClosureMissingEvidence,
    ],
    preview,
  };
}

function normalizeWindowUiAction(value: string) {
  const normalizedValue = value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
  switch (normalizedValue) {
    case 'click':
    case 'invoke':
    case 'invoke_pattern':
      return 'invoke';
    case 'select':
    case 'select_item':
      return 'select';
    case 'toggle':
    case 'check':
    case 'uncheck':
      return 'toggle';
    case 'expand':
    case 'expand_control':
      return 'expand';
    case 'collapse':
    case 'collapse_control':
      return 'collapse';
    case 'focus':
    case 'set_focus':
    case 'focus_control':
    case 'focus_window_ui':
    case 'keyboard_focus':
      return 'focus';
    case 'scroll':
    case 'scroll_into_view':
    case 'scroll_item':
    case 'scroll_item_into_view':
      return 'scroll_into_view';
    case 'set_text':
    case 'set_value':
    case 'value':
      return 'set_value';
    case 'auto':
      return 'auto';
    default:
      return '';
  }
}

function resolveWindowUiAction(toolCall: AgentToolCallCommand, normalizedDesktopAction: string) {
  const explicitUiAction = normalizeWindowUiAction(getToolStringInput(toolCall, [
    'uiAction',
    'uiaAction',
    'controlAction',
    'pattern',
  ]));
  if (explicitUiAction) {
    return explicitUiAction;
  }

  const rawDesktopAction = getToolStringInput(toolCall, ['action', 'desktopAction', 'operation'])
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/gu, '_');
  if (rawDesktopAction.includes('select')) {
    return 'select';
  }
  if (rawDesktopAction.includes('toggle')) {
    return 'toggle';
  }
  if (rawDesktopAction.includes('expand')) {
    return 'expand';
  }
  if (rawDesktopAction.includes('collapse')) {
    return 'collapse';
  }
  if (rawDesktopAction.includes('focus')) {
    return 'focus';
  }
  if (rawDesktopAction.includes('scroll')) {
    return 'scroll_into_view';
  }
  if (rawDesktopAction.includes('value') || rawDesktopAction.includes('text')) {
    return 'set_value';
  }
  if (rawDesktopAction.includes('invoke') || rawDesktopAction.includes('click')) {
    return 'invoke';
  }

  return normalizedDesktopAction === 'invoke_window_ui' ? 'invoke' : 'auto';
}

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

interface WindowUiActionResultLike {
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

function createWindowUiMissingValueResult(options: {
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

function createWindowUiInteractionStructuredEvidence(
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

async function executeWindowUiInteraction(
  toolCall: AgentToolCallCommand,
  normalizedDesktopAction: string,
): Promise<AgentChatCommandResult> {
  const targetText = getToolStringInput(toolCall, ['targetText', 'text', 'label', 'name', 'target']);
  const automationId = getToolStringInput(toolCall, ['automationId', 'id']);
  const controlType = getToolStringInput(toolCall, ['controlType', 'type']);
  const query = getToolStringInput(toolCall, ['query', 'windowTitle', 'title', 'processName', 'target']);
  const uiAction = resolveWindowUiAction(toolCall, normalizedDesktopAction);
  const value = getToolStringInput(toolCall, ['value', 'textValue', 'inputValue']);
  const x = getToolNumberInput(toolCall, 'x');
  const y = getToolNumberInput(toolCall, 'y');
  if (!targetText && !automationId && (!Number.isFinite(x) || !Number.isFinite(y))) {
    return {
      errorText: 'Missing invoke_window_ui target.',
      observations: [`Desktop action: ${normalizedDesktopAction}`, 'Missing targetText, automationId, or x/y point.'],
      ok: false,
      responseText: 'invoke_window_ui needs UI Automation target evidence such as targetText, automationId, or a native-screen point. controlType is only supporting evidence.',
    };
  }
  if (uiAction === 'set_value' && !value) {
    return createWindowUiMissingValueResult({
      automationId,
      controlType,
      normalizedDesktopAction,
      query,
      targetText,
      uiAction,
    });
  }

  const result = await desktopPetShellRuntime.invokeWindowUi({
    automationId,
    controlType,
    fallbackX: getToolNumberInput(toolCall, 'fallbackX'),
    fallbackY: getToolNumberInput(toolCall, 'fallbackY'),
    hwnd: getToolNumberInput(toolCall, 'hwnd') ?? getToolNumberInput(toolCall, 'windowHandle'),
    limit: getToolNumberInput(toolCall, 'limit'),
    maxDepth: getToolNumberInput(toolCall, 'maxDepth'),
    name: getToolStringInput(toolCall, ['name']),
    query,
    target: getToolStringInput(toolCall, ['target']),
    targetDescription: getToolStringInput(toolCall, ['targetDescription', 'description', 'element']),
    targetText,
    title: getToolStringInput(toolCall, ['title', 'windowTitle']),
    uiAction,
    value,
    x,
    y,
  }) as WindowUiActionResultLike;
  const control = result?.control ?? null;
  const windowLabel = result?.window?.title || result?.window?.processName || query || 'target window';
  const controlLabel = control?.name || control?.automationId || targetText || automationId || 'target control';
  const candidateCount = Array.isArray(result?.candidates) ? result.candidates.length : 0;
  const structuredEvidence = createWindowUiInteractionStructuredEvidence(result ?? {}, {
    automationId,
    controlType,
    normalizedDesktopAction,
    targetText,
    uiAction,
  });
  const recoveryLine = structuredEvidence?.postActionRecovery?.nextTool
    ? `Recovery: ${structuredEvidence.postActionRecovery.strategy ?? 'none'} -> ${structuredEvidence.postActionRecovery.nextTool}`
    : '';
  const observations = [
    `Desktop action: ${normalizedDesktopAction}`,
    `Window: ${windowLabel}`,
    typeof result?.window?.hwnd === 'number' ? `Window hwnd: ${result.window.hwnd}` : '',
    `Control: ${controlLabel}`,
    control?.automationId ? `AutomationId: ${control.automationId}` : '',
    control?.controlType ? `Control type: ${control.controlType}` : '',
    control?.selectionItem ? `Selection item: true` : '',
    control?.selectionItem ? `Selected after action: ${control.selected === true}` : '',
    Number.isFinite(Number(control?.matchScore)) ? `Match score: ${Math.round(Number(control?.matchScore))}` : '',
    `Requested UI action: ${result?.uiAction || uiAction || 'auto'}`,
    result?.resolvedAction ? `Resolved UI action: ${result.resolvedAction}` : '',
    result?.method ? `Method: ${result.method}` : '',
    `Candidate count: ${candidateCount}`,
    recoveryLine,
    result?.error ? `Error: ${result.error}` : '',
  ].filter(Boolean);
  const stateSummary = structuredEvidence
    ? {
        missingEvidence: result?.ok
          ? structuredEvidence.selectionVerificationStatus === 'visible-only'
            ? ['UI Automation action was applied, but the target control was not confirmed as selected afterward.']
            : []
          : [
              result?.error || 'UI Automation interaction failed.',
            ],
        observedState: observations,
        recommendedRecovery: structuredEvidence.postActionRecovery
          ? [
              [
                `postActionRecoveryStrategy=${structuredEvidence.postActionRecovery.strategy}`,
                structuredEvidence.postActionRecovery.nextTool ? `nextTool=${structuredEvidence.postActionRecovery.nextTool}` : '',
                structuredEvidence.postActionRecovery.nextArgs ? `nextArgs=${JSON.stringify(structuredEvidence.postActionRecovery.nextArgs)}` : '',
                structuredEvidence.postActionRecovery.reason ? `reason=${structuredEvidence.postActionRecovery.reason}` : '',
              ].filter(Boolean).join(' | '),
            ]
          : [],
        structuredEvidence,
        verificationEvidence: [
          result?.ok
            ? structuredEvidence.selectionVerificationStatus === 'selected'
              ? 'UI Automation reported the control action as applied and selection state is selected.'
              : 'UI Automation reported the control action as applied.'
            : 'UI Automation returned matched control evidence and recovery details.',
        ],
      }
    : undefined;

  return {
    errorText: result?.ok ? null : result?.error || 'Window UI invoke failed.',
    observations,
    ok: Boolean(result?.ok),
    receipt: {
      evidenceLines: observations,
      status: result?.ok && structuredEvidence?.selectionVerificationStatus !== 'visible-only' ? 'success' : result?.ok ? 'unverified' : 'failed',
      summaryLines: [
        `Call: execute_desktop_action ${normalizedDesktopAction}`,
        `Window: ${windowLabel}`,
        `Control: ${controlLabel}`,
        `UI action: ${result?.resolvedAction || result?.uiAction || uiAction || 'auto'}`,
      ],
      title: 'Agent window UI invoke',
      toolName: 'execute_desktop_action',
      verification: result?.ok
        ? structuredEvidence?.selectionVerificationStatus === 'visible-only'
          ? 'UI Automation control action returned success, but selected state was not confirmed.'
          : 'UI Automation control action returned success.'
        : result?.error ?? null,
      stateSummary,
    },
    responseText: result?.ok
      ? `Applied UI Automation action "${result?.resolvedAction || result?.uiAction || uiAction || 'auto'}" to "${controlLabel}" in ${windowLabel}.`
      : `Window UI interaction failed: ${result?.error || 'unknown error'}.`,
    stateSummary,
    verification: result?.ok
      ? structuredEvidence?.selectionVerificationStatus === 'visible-only'
        ? `UI Automation applied ${result?.resolvedAction || result?.uiAction || uiAction || 'auto'} to ${controlLabel} in ${windowLabel}, but selected state was not confirmed.`
        : `UI Automation applied ${result?.resolvedAction || result?.uiAction || uiAction || 'auto'} to ${controlLabel} in ${windowLabel}.`
      : result?.error || null,
  };
}

export async function executeDesktopAction(
  context: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const rawAction = getToolStringInput(toolCall, ['action', 'desktopAction', 'operation']);
  const action = normalizeExecuteDesktopAction(rawAction);
  const target = getDesktopActionTargetInput(toolCall);

  if (!action) {
    return {
      errorText: 'Unsupported execute_desktop_action action.',
      observations: [
        rawAction ? `Unsupported desktop action: ${rawAction}` : 'Missing desktop action.',
      ],
      ok: false,
      responseText: 'execute_desktop_action needs a supported primitive action such as list_running_apps, focus_window, control_window, move_window_to_display, close_window, open_resource, launch_local_app, interact_window_ui, invoke_window_ui, or search_web. For multi-step desktop operations, use execute_desktop_sequence.',
    };
  }

  switch (action) {
    case 'list_running_apps':
      return annotateDesktopActionResult(
        action,
        await executeListRunningApps(
          getToolStringInput(toolCall, ['query', 'target', 'name', 'processName', 'title']),
          getToolBooleanInput(toolCall, 'includeWindows'),
        ),
      );

    case 'get_default_app_for_uri':
      return annotateDesktopActionResult(
        action,
        await executeGetDefaultAppForUri(
          getToolStringInput(toolCall, ['uriScheme', 'scheme', 'protocol']) || 'https',
        ),
      );

    case 'get_active_window_info':
      return annotateDesktopActionResult(action, await executeGetActiveWindowInfo());

    case 'focus_window':
      if (!target && !getToolNumberInput(toolCall, 'pid') && !getToolNumberInput(toolCall, 'hwnd') && !getToolNumberInput(toolCall, 'windowHandle')) {
        return {
          errorText: 'Missing focus_window target.',
          observations: [`Desktop action: ${action}`],
          ok: false,
          responseText: 'focus_window needs a process name, app name, window title, PID, or hwnd target.',
        };
      }

      return annotateDesktopActionResult(action, await executeFocusWindow(toolCall));

    case 'control_window':
      return annotateDesktopActionResult(action, await executeControlWindow(toolCall));

    case 'open_or_focus_then_control_window':
      return annotateDesktopActionResult(action, await executeOpenOrFocusThenControlWindow(context, toolCall));

    case 'open_or_focus_then_move_window_to_display':
      return annotateDesktopActionResult(action, await executeOpenOrFocusThenMoveWindowToDisplay(context, toolCall));

    case 'move_window_to_display':
      return annotateDesktopActionResult(action, await executeMoveWindowToDisplay(toolCall));

    case 'close_window':
      return annotateDesktopActionResult(action, await executeCloseWindow(toolCall));

    case 'open_resource': {
      if (!target) {
        return {
          errorText: 'Missing open_resource target.',
          observations: [`Desktop action: ${action}`],
          ok: false,
          responseText: 'open_resource needs a URL, file, folder, or app target.',
        };
      }

      const rawNormalizedAction = rawAction.trim().toLowerCase().replace(/[-\s]+/gu, '_');
      return annotateDesktopActionResult(
        action,
        await executeOpenResource(
          target,
          getToolStringInput(toolCall, ['resourceType']) || (rawNormalizedAction === 'open_url' ? 'url' : undefined),
          getToolBooleanInput(toolCall, 'forceNew'),
        ),
      );
    }

    case 'launch_local_app':
      if (!target) {
        return {
          errorText: 'Missing launch_local_app target.',
          observations: [`Desktop action: ${action}`],
          ok: false,
          responseText: 'launch_local_app needs an app name, executable path, or remembered alias target.',
        };
      }

      return annotateDesktopActionResult(
        action,
        await executeAppLaunch(target, getToolBooleanInput(toolCall, 'forceNew')),
      );

    case 'interact_window_ui':
    case 'invoke_window_ui':
      return annotateDesktopActionResult(action, await executeWindowUiInteraction(toolCall, action));

    case 'search_web':
      if (!target) {
        return {
          errorText: 'Missing search_web query.',
          observations: [`Desktop action: ${action}`],
          ok: false,
          responseText: 'search_web needs a search query.',
        };
      }

      return annotateDesktopActionResult(
        action,
        await executeBrowserSearch(context, target, getToolBooleanInput(toolCall, 'forceNewPage')),
      );

    default:
      return {
        errorText: 'Unsupported execute_desktop_action action.',
        observations: [`Unsupported desktop action: ${rawAction}`],
        ok: false,
        responseText: `execute_desktop_action does not support action "${rawAction}".`,
      };
  }
}

export async function executeDesktopInput(toolCall: AgentToolCallCommand): Promise<AgentChatCommandResult> {
  const rawAction = getToolStringInput(toolCall, ['action', 'inputAction', 'operation']);
  const action = normalizeExecuteDesktopInputAction(rawAction) || rawAction;
  const inputRequest = createDesktopInputRequest(toolCall, action);
  const replayPointBefore = shouldCaptureDesktopInputReplay(action) && shouldUseToolCallPointForNativeScreenReplay(toolCall, action)
    ? resolveDesktopInputReplayPoint(toolCall, action)
    : null;
  const replayBefore = await captureDesktopInputReplayBefore(replayPointBefore);
  const result = await desktopPetShellRuntime.executeDesktopInput(inputRequest) as {
    action?: string | null;
    button?: string | null;
    cursorSet?: boolean | null;
    cursorVerified?: boolean | null;
    error?: string | null;
    foregroundAfter?: {
      elevated?: boolean | null;
      hwnd?: number | null;
      pid?: number | null;
      processName?: string | null;
      title?: string | null;
    } | null;
    foregroundBefore?: {
      elevated?: boolean | null;
      hwnd?: number | null;
      pid?: number | null;
      processName?: string | null;
      title?: string | null;
    } | null;
    clickCount?: number | null;
    cursorAfter?: { ok?: boolean | null; x?: number | null; y?: number | null } | null;
    cursorBefore?: { ok?: boolean | null; x?: number | null; y?: number | null } | null;
    fromX?: number | null;
    fromY?: number | null;
    hotkey?: string | null;
      inputDiagnostics?: {
        backendName?: string | null;
        downUpStrategy?: string | null;
        fallbackStrategy?: string | null;
        failureClassification?: string | null;
        forceMouseEventFallback?: boolean | null;
        foregroundStable?: boolean | null;
        inputPlan?: string[] | null;
        permissionStatus?: string | null;
        expectedTargetHwnd?: number | null;
        pointRootWindowHwnd?: number | null;
        pointWindowHwnd?: number | null;
        keyboardFallback?: string | null;
      keyboardFallbackUsed?: boolean | null;
      moveElapsedMs?: number | null;
      stageResults?: Array<{
        downLastError?: number | null;
        downSent?: number | null;
        elapsedMs?: number | null;
        index?: number | null;
        key?: string | null;
        ok?: boolean | null;
        reason?: string | null;
        stage?: string | null;
        upLastError?: number | null;
        upSent?: number | null;
        x?: number | null;
        y?: number | null;
      }> | null;
      totalElapsedMs?: number | null;
    } | null;
    holdMs?: number | null;
    intervalMs?: number | null;
    keys?: string | null;
    ok?: boolean;
    preClickDelayMs?: number | null;
    processElevated?: boolean | null;
    sendInput?: boolean | null;
    sendInputAllOk?: boolean | null;
    sendInputAttempts?: Array<{
      cursorAfterDown?: { ok?: boolean | null; x?: number | null; y?: number | null } | null;
      cursorAfterUp?: { ok?: boolean | null; x?: number | null; y?: number | null } | null;
      cursorBeforeDown?: { ok?: boolean | null; x?: number | null; y?: number | null } | null;
      cursorBeforeUp?: { ok?: boolean | null; x?: number | null; y?: number | null } | null;
      downElapsedMs?: number | null;
      downLastError?: number | null;
      downOk?: boolean | null;
      downSent?: number | null;
      fallbackMouseEventUsed?: boolean | null;
      foregroundAfterDown?: {
        elevated?: boolean | null;
        hwnd?: number | null;
        pid?: number | null;
        processName?: string | null;
        title?: string | null;
      } | null;
      foregroundAfterUp?: {
        elevated?: boolean | null;
        hwnd?: number | null;
        pid?: number | null;
        processName?: string | null;
        title?: string | null;
      } | null;
      foregroundBeforeDown?: {
        elevated?: boolean | null;
        hwnd?: number | null;
        pid?: number | null;
        processName?: string | null;
        title?: string | null;
      } | null;
      foregroundBeforeUp?: {
        elevated?: boolean | null;
        hwnd?: number | null;
        pid?: number | null;
        processName?: string | null;
        title?: string | null;
      } | null;
      index?: number | null;
      ok?: boolean | null;
      upElapsedMs?: number | null;
      upLastError?: number | null;
      upOk?: boolean | null;
      upSent?: number | null;
    }> | null;
    textLength?: number | null;
    toX?: number | null;
    toY?: number | null;
    x?: number | null;
    y?: number | null;
  };
  const replayPoint = replayPointBefore ?? resolveDesktopInputResultReplayPoint(result, action);
  const replayAfter = shouldCaptureDesktopInputReplay(action)
    ? await captureDesktopInputReplayAfter({
        beforeImageDataUrl: replayBefore?.imageDataUrl,
        point: replayPoint,
      })
    : null;
  const replayEvidence = createDesktopInputReplayEvidence({
    after: replayAfter,
    before: replayBefore,
    point: replayPoint,
  });
  const replayMissingEvidence = [
    ...replayEvidence.missingEvidence,
    replayPoint && shouldCaptureDesktopInputReplay(action) && !replayBefore
      ? 'Input replay before screenshot was unavailable.'
      : '',
    replayPoint && shouldCaptureDesktopInputReplay(action) && !replayAfter
      ? 'Input replay after screenshot was unavailable.'
      : '',
    replayAfter?.delta?.uiChanged === false
      ? 'Input replay did not detect a visible UI change after the pointer action.'
      : '',
    result?.error === 'target_window_not_foreground'
      || result?.inputDiagnostics?.failureClassification === 'target_window_not_foreground'
      ? 'Desktop input was blocked before injection because the expected target window was not foreground.'
      : '',
    result?.error === 'target_requires_elevation'
      || result?.inputDiagnostics?.permissionStatus === 'target_requires_elevation'
      ? 'Desktop input was blocked before injection because the target application requires matching elevation. Run the Agent with administrator permission or use a permitted UI Automation path.'
      : '',
    result?.inputDiagnostics?.failureClassification === 'target_hit_test_mismatch'
      ? `Desktop input was blocked before injection because the target point resolves to window ${result.inputDiagnostics.pointRootWindowHwnd ?? 'unknown'}, not expected target window ${result.inputDiagnostics.expectedTargetHwnd ?? 'unknown'}.`
      : '',
    replayAfter?.delta?.uiChanged === false
      && result?.inputDiagnostics?.failureClassification
      ? `Input backend classification: ${result.inputDiagnostics.failureClassification}.`
      : '',
    replayAfter?.delta?.uiChanged === false
      && result?.processElevated === false
      && (result.foregroundBefore?.elevated === true || result.foregroundAfter?.elevated === true)
      ? 'Input may be blocked by Windows UIPI/integrity boundary: foreground target is elevated while the Agent process is not elevated.'
      : '',
    replayAfter?.delta?.uiChanged === false
      && result?.sendInputAllOk === true
      && result?.cursorVerified === true
      && result?.foregroundBefore?.hwnd
      && result?.foregroundAfter?.hwnd
      && result.foregroundBefore.hwnd === result.foregroundAfter.hwnd
      ? 'Input backend injected mouse down/up successfully at the target point and foreground remained stable, but the UI did not visibly change; the target app may ignore synthetic mouse input.'
      : '',
  ].filter(Boolean);
  const receiptStatus = result?.ok
    ? replayMissingEvidence.length ? 'unverified' : 'success'
    : 'failed';
  const structuredEvidence: AgentStructuredToolEvidence | null = replayEvidence.preview
    ? {
        captureReason: replayMissingEvidence.join(' | ') || null,
        captureStatus: replayEvidence.preview.afterCaptureStatus ?? replayEvidence.preview.beforeCaptureStatus ?? null,
        captureTrusted: replayMissingEvidence.every((line) => !line.includes('untrusted')),
        confidence: receiptStatus === 'success' ? 'medium' : 'low',
        coordinateAudit: replayEvidence.preview.coordinateAudit ?? null,
        coordinateAuditStatus: replayEvidence.preview.coordinateAudit?.status ?? null,
        inputReplayPreview: replayEvidence.preview,
        status: receiptStatus,
      }
    : null;
  const actionEvidence = createDesktopInputActionEvidence({
    action: result?.action || action,
    ok: Boolean(result?.ok),
    point: replayPoint,
    preview: replayEvidence.preview,
    replayExpected: shouldCaptureDesktopInputReplay(action),
    replayLines: replayEvidence.lines,
    replayMissingEvidence,
  });
  const sendInputAttemptLines = Array.isArray(result?.sendInputAttempts)
    ? result.sendInputAttempts.slice(0, 4).map((attempt) => [
        `Input attempt ${attempt.index ?? '?'}`,
        `downSent=${attempt.downSent ?? 'unknown'}`,
        `downOk=${attempt.downOk ?? 'unknown'}`,
        `downLastError=${attempt.downLastError ?? 'unknown'}`,
        `upSent=${attempt.upSent ?? 'unknown'}`,
        `upOk=${attempt.upOk ?? 'unknown'}`,
        `upLastError=${attempt.upLastError ?? 'unknown'}`,
        `fallbackMouseEvent=${attempt.fallbackMouseEventUsed ?? 'unknown'}`,
        `fgBeforeDown=${attempt.foregroundBeforeDown?.processName || 'unknown'}:${attempt.foregroundBeforeDown?.hwnd ?? 'unknown'}`,
        `fgAfterUp=${attempt.foregroundAfterUp?.processName || 'unknown'}:${attempt.foregroundAfterUp?.hwnd ?? 'unknown'}`,
        `cursorBeforeDown=${attempt.cursorBeforeDown?.x ?? 'unknown'},${attempt.cursorBeforeDown?.y ?? 'unknown'}`,
        `cursorAfterUp=${attempt.cursorAfterUp?.x ?? 'unknown'},${attempt.cursorAfterUp?.y ?? 'unknown'}`,
      ].join(' | '))
    : [];
  const inputDiagnosticLines = [
    result?.inputDiagnostics?.backendName ? `Input backend: ${result.inputDiagnostics.backendName}` : '',
    Array.isArray(result?.inputDiagnostics?.inputPlan) ? `Input backend plan: ${result.inputDiagnostics.inputPlan.join(' -> ')}` : '',
    result?.inputDiagnostics?.failureClassification ? `Input backend classification: ${result.inputDiagnostics.failureClassification}` : '',
    typeof result?.inputDiagnostics?.foregroundStable === 'boolean' ? `Input foreground stable: ${result.inputDiagnostics.foregroundStable}` : '',
    typeof result?.inputDiagnostics?.keyboardFallbackUsed === 'boolean' ? `Keyboard fallback used: ${result.inputDiagnostics.keyboardFallbackUsed}${result.inputDiagnostics.keyboardFallback ? ` (${result.inputDiagnostics.keyboardFallback})` : ''}` : '',
    result?.cursorBefore ? `Cursor before: ok=${result.cursorBefore.ok ?? 'unknown'} x=${result.cursorBefore.x ?? 'unknown'} y=${result.cursorBefore.y ?? 'unknown'}` : '',
    result?.cursorAfter ? `Cursor after: ok=${result.cursorAfter.ok ?? 'unknown'} x=${result.cursorAfter.x ?? 'unknown'} y=${result.cursorAfter.y ?? 'unknown'}` : '',
    typeof result?.sendInputAllOk === 'boolean' ? `SendInput all attempts ok: ${result.sendInputAllOk}` : '',
    typeof result?.inputDiagnostics?.pointWindowHwnd === 'number' ? `Point window hwnd: ${result.inputDiagnostics.pointWindowHwnd}` : '',
    typeof result?.inputDiagnostics?.pointRootWindowHwnd === 'number' ? `Point root window hwnd: ${result.inputDiagnostics.pointRootWindowHwnd}` : '',
    typeof result?.inputDiagnostics?.expectedTargetHwnd === 'number' ? `Expected target hwnd: ${result.inputDiagnostics.expectedTargetHwnd}` : '',
    result?.inputDiagnostics ? `Input diagnostic timing: move=${result.inputDiagnostics.moveElapsedMs ?? 'unknown'}ms total=${result.inputDiagnostics.totalElapsedMs ?? 'unknown'}ms strategy=${result.inputDiagnostics.downUpStrategy || 'unknown'} fallback=${result.inputDiagnostics.fallbackStrategy || 'unknown'} forceMouseEventFallback=${result.inputDiagnostics.forceMouseEventFallback ?? 'unknown'}` : '',
    ...(Array.isArray(result?.inputDiagnostics?.stageResults)
      ? result.inputDiagnostics.stageResults.slice(0, 8).map((stage, index) => [
          `Input backend stage ${index + 1}`,
          `stage=${stage.stage || 'unknown'}`,
          `ok=${stage.ok ?? 'unknown'}`,
          typeof stage.index === 'number' ? `attempt=${stage.index}` : '',
          typeof stage.elapsedMs === 'number' ? `elapsedMs=${stage.elapsedMs}` : '',
          typeof stage.downSent === 'number' ? `downSent=${stage.downSent}` : '',
          typeof stage.upSent === 'number' ? `upSent=${stage.upSent}` : '',
          typeof stage.downLastError === 'number' ? `downLastError=${stage.downLastError}` : '',
          typeof stage.upLastError === 'number' ? `upLastError=${stage.upLastError}` : '',
          stage.key ? `key=${stage.key}` : '',
          stage.reason ? `reason=${stage.reason}` : '',
          typeof stage.x === 'number' && typeof stage.y === 'number' ? `point=${stage.x},${stage.y}` : '',
        ].filter(Boolean).join(' | '))
      : []),
    ...sendInputAttemptLines,
  ].filter(Boolean);
  const observations = [
    `Desktop input action: ${result?.action || action}`,
    typeof result?.x === 'number' && typeof result?.y === 'number' ? `Point: (${result.x}, ${result.y})` : '',
    result?.button ? `Button: ${result.button}` : '',
    typeof result?.clickCount === 'number' ? `Click count: ${result.clickCount}` : '',
    typeof result?.preClickDelayMs === 'number' ? `Pre-click delay: ${result.preClickDelayMs}ms` : '',
    typeof result?.holdMs === 'number' ? `Click hold: ${result.holdMs}ms` : '',
    typeof result?.intervalMs === 'number' ? `Click interval: ${result.intervalMs}ms` : '',
    typeof result?.processElevated === 'boolean' ? `Input process elevated: ${result.processElevated}` : '',
    result?.foregroundBefore ? `Foreground before: ${result.foregroundBefore.processName || 'unknown'} pid=${result.foregroundBefore.pid ?? 'unknown'} hwnd=${result.foregroundBefore.hwnd ?? 'unknown'} elevated=${result.foregroundBefore.elevated ?? 'unknown'} title=${result.foregroundBefore.title || ''}` : '',
    result?.foregroundAfter ? `Foreground after: ${result.foregroundAfter.processName || 'unknown'} pid=${result.foregroundAfter.pid ?? 'unknown'} hwnd=${result.foregroundAfter.hwnd ?? 'unknown'} elevated=${result.foregroundAfter.elevated ?? 'unknown'} title=${result.foregroundAfter.title || ''}` : '',
    typeof result?.cursorSet === 'boolean' ? `Cursor set: ${result.cursorSet}` : '',
    typeof result?.cursorVerified === 'boolean' ? `Cursor verified: ${result.cursorVerified}` : '',
    typeof result?.sendInput === 'boolean' ? `SendInput used: ${result.sendInput}` : '',
    ...inputDiagnosticLines,
    result?.hotkey ? `Hotkey: ${result.hotkey}` : '',
    result?.keys ? `Keys: ${result.keys}` : '',
    typeof result?.textLength === 'number' ? `Typed text length: ${result.textLength}` : '',
    ...replayEvidence.lines,
    result?.error ? `Error: ${result.error}` : '',
  ].filter(Boolean);
  const stateSummary = structuredEvidence || replayMissingEvidence.length || replayEvidence.lines.length || actionEvidence
    ? {
        actionEvidence,
        missingEvidence: replayMissingEvidence,
        observedState: replayEvidence.lines,
        recommendedRecovery: replayMissingEvidence.length
          ? [
              'Use the before/after red-dot replay to decide whether the coordinate was wrong, the capture was black, or the UI did not react.',
              replayMissingEvidence.some((line) => line.includes('UIPI') || line.includes('integrity boundary'))
                ? 'If the target app is elevated, rerun the Agent with matching elevation or use UI Automation invoke/focus fallback instead of retrying the same coordinate click.'
                : '',
              result?.error === 'target_requires_elevation'
                || result?.inputDiagnostics?.permissionStatus === 'target_requires_elevation'
                ? 'The target application is running with higher elevation than the Agent. Request matching elevation before retrying desktop input.'
                : '',
              'If the action was meant to change app state, verify with locate_screen_elements or inspect_window_ui before claiming success.',
            ].filter(Boolean)
          : [],
        structuredEvidence,
        verificationEvidence: [
          ...inputDiagnosticLines,
          ...replayEvidence.lines.filter((line) => line.includes('visual delta') || line.includes('red-dot')),
        ],
      }
    : undefined;

  return {
    errorText: result?.ok ? null : result?.error || 'Desktop input failed.',
    observations,
    ok: Boolean(result?.ok),
    receipt: {
      evidenceLines: observations,
      status: receiptStatus,
      summaryLines: [
        'Call: execute_desktop_input',
        `Action: ${result?.action || action || 'unknown'}`,
        replayPoint ? `Replay point: ${replayPoint.x},${replayPoint.y}` : '',
        typeof result?.clickCount === 'number' ? `Click count: ${result.clickCount}` : '',
        typeof result?.holdMs === 'number' ? `Click hold: ${result.holdMs}ms` : '',
        typeof result?.processElevated === 'boolean' ? `Input process elevated: ${result.processElevated}` : '',
        result?.foregroundBefore ? `Foreground before: ${result.foregroundBefore.processName || 'unknown'} elevated=${result.foregroundBefore.elevated ?? 'unknown'}` : '',
        result?.foregroundAfter ? `Foreground after: ${result.foregroundAfter.processName || 'unknown'} elevated=${result.foregroundAfter.elevated ?? 'unknown'}` : '',
        typeof result?.cursorVerified === 'boolean' ? `Cursor verified: ${result.cursorVerified}` : '',
        typeof result?.sendInput === 'boolean' ? `SendInput used: ${result.sendInput}` : '',
        typeof result?.sendInputAllOk === 'boolean' ? `SendInput all ok: ${result.sendInputAllOk}` : '',
        typeof result?.inputDiagnostics?.forceMouseEventFallback === 'boolean' ? `Forced mouse_event fallback: ${result.inputDiagnostics.forceMouseEventFallback}` : '',
        result?.inputDiagnostics ? `Input total: ${result.inputDiagnostics.totalElapsedMs ?? 'unknown'}ms` : '',
        replayAfter?.delta ? `UI changed: ${replayAfter.delta.uiChanged}` : '',
      ].filter(Boolean),
      title: '执行回执',
      toolName: 'execute_desktop_input',
      verification: result?.ok
        ? replayMissingEvidence.length
          ? 'Desktop input primitive returned success, but red-dot replay did not fully verify a visible UI change.'
          : 'Desktop input primitive returned success from the Windows input bridge with before/after red-dot replay evidence.'
        : result?.error ?? null,
      stateSummary,
    },
    responseText: result?.ok
      ? `Desktop input executed: ${result.action || action}.`
      : `Desktop input failed: ${result?.error || 'unknown error'}.`,
    stateSummary,
    verification: result?.ok
      ? replayMissingEvidence.length
        ? 'Desktop input request completed, but before/after replay is unverified.'
        : 'Desktop input request completed with red-dot replay evidence.'
      : result?.error || null,
  };
}
