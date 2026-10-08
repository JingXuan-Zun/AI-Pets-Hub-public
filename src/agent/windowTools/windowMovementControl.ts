import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { type AgentChatCommandResult, type AgentChatExecutionReceipt, type AgentStructuredToolEvidence, type AgentToolCallCommand } from '../agentChatCommand';
import { getToolStringInput, getToolBooleanInput, getToolNumberInput } from '../desktopTools/desktopToolInput';
import { createAgentStructuredWindowEvidenceFromParts } from '../agentRuntimeDesktopLaunchTools';
import { doesAgentDisplayRoleMatchPrimaryFlag, resolveAgentExplicitDisplayRoleFromText } from '../runtime/agentDisplayTargetIntent';

function getToolStringArrayInput(toolCall: AgentToolCallCommand, keys: string[]) {
  const input = toolCall.input ?? {};
  const result: string[] = [];
  const seen = new Set<string>();
  const add = (value: unknown) => {
    const text = typeof value === 'string' ? value.trim() : '';
    const key = text.toLowerCase();
    if (!text || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(text);
  };

  for (const key of keys) {
    const value = input[key];
    if (Array.isArray(value)) {
      value.forEach(add);
    } else {
      add(value);
    }
  }

  return result.slice(0, 8);
}

interface MoveWindowToDisplayResultLike {
  error?: string | null;
  fromBounds?: { coordinateSpace?: string | null; height?: number; width?: number; x?: number; y?: number } | null;
  fromDisplayId?: string | null;
  fromDisplayLabel?: string | null;
  hwnd?: number | null;
  matchCount?: number | null;
  matchReason?: string | null;
  maximizedRestored?: boolean | null;
  moved?: boolean;
  ok?: boolean;
  pid?: number | null;
  processName?: string | null;
  query?: string | null;
  queryCandidates?: string[] | null;
  reason?: string | null;
  retryMoveAttempted?: boolean | null;
  targetDisplayId?: string | null;
  targetDisplayLabel?: string | null;
  targetDisplay?: {
    primary?: boolean | null;
  } | null;
  title?: string | null;
  toBounds?: { coordinateSpace?: string | null; height?: number; width?: number; x?: number; y?: number } | null;
  verified?: boolean | null;
  wasMaximized?: boolean | null;
}

interface ControlWindowResultLike {
  afterState?: string | null;
  beforeState?: string | null;
  boundsChanged?: boolean | null;
  controlled?: boolean | null;
  error?: string | null;
  fromBounds?: { coordinateSpace?: string | null; height?: number; width?: number; x?: number; y?: number } | null;
  fromDisplayId?: string | null;
  fromDisplayLabel?: string | null;
  hwnd?: number | null;
  matchCount?: number | null;
  matchReason?: string | null;
  ok?: boolean;
  pid?: number | null;
  processName?: string | null;
  query?: string | null;
  reason?: string | null;
  requestedSnap?: string | null;
  requestedState?: string | null;
  stateChanged?: boolean | null;
  targetBounds?: { coordinateSpace?: string | null; height?: number; width?: number; x?: number; y?: number } | null;
  targetDisplayId?: string | null;
  targetDisplayLabel?: string | null;
  title?: string | null;
  toBounds?: { coordinateSpace?: string | null; height?: number; width?: number; x?: number; y?: number } | null;
  toDisplayId?: string | null;
  toDisplayLabel?: string | null;
}

export async function executeMoveWindowToDisplay(toolCall: AgentToolCallCommand): Promise<AgentChatCommandResult> {
  const query = getToolStringInput(toolCall, ['query', 'target', 'title', 'processName', 'name']);
  const queryCandidates = getToolStringArrayInput(toolCall, ['queryCandidates', 'targetCandidates', 'windowCandidates']);
  const pid = getToolNumberInput(toolCall, 'pid');
  const hwnd = getToolNumberInput(toolCall, 'hwnd') ?? getToolNumberInput(toolCall, 'windowHandle');
  const targetDisplay = getToolStringInput(toolCall, [
    'targetDisplay',
    'display',
    'displayTarget',
    'screen',
    'screenTarget',
  ]);
  const displayId = getToolStringInput(toolCall, ['displayId', 'targetDisplayId', 'screenId']);
  const position = getToolStringInput(toolCall, ['position', 'placement']);
  const preserveSize = getToolBooleanInput(toolCall, 'preserveSize');
  const fallbackToActiveWindow = getToolBooleanInput(toolCall, 'fallbackToActiveWindow');

  if (!query && queryCandidates.length === 0 && !pid && !hwnd) {
    return {
      errorText: 'Missing move_window_to_display target.',
      ok: false,
      responseText: 'move_window_to_display needs a window title, process name, PID, or window handle.',
    };
  }

  if (!targetDisplay && !displayId) {
    return {
      errorText: 'Missing move_window_to_display target display.',
      ok: false,
      responseText: 'move_window_to_display needs a target display such as primary, secondary, a display label, or displayId.',
    };
  }

  const result = await desktopPetShellRuntime.moveWindowToDisplay({
    displayId,
    hwnd,
    fallbackToActiveWindow,
    pid,
    position,
    preserveSize,
    query,
    queryCandidates,
    targetDisplay,
  }) as MoveWindowToDisplayResultLike;
  const targetText = result?.title || result?.processName || query || (
    typeof pid === 'number' ? `pid=${pid}` : typeof hwnd === 'number' ? `hwnd=${hwnd}` : 'unknown'
  );
  const requestedDisplayText = displayId || targetDisplay || 'unknown';
  const requestedDisplayRole = resolveAgentExplicitDisplayRoleFromText(targetDisplay);
  const requestedDisplayRoleMatched = doesAgentDisplayRoleMatchPrimaryFlag(
    requestedDisplayRole,
    result?.targetDisplay?.primary,
  );
  const moveVerificationUncertain = result?.verified === false || !requestedDisplayRoleMatched;
  const observations = [
    query ? `Move window query: ${query}` : '',
    queryCandidates.length ? `Move window query candidates: ${queryCandidates.join(' | ')}` : '',
    typeof pid === 'number' ? `Requested pid: ${pid}` : '',
    typeof hwnd === 'number' ? `Requested hwnd: ${hwnd}` : '',
    `Requested display: ${requestedDisplayText}`,
    result?.processName ? `Matched process: ${result.processName}` : '',
    result?.title ? `Matched title: ${result.title}` : '',
    typeof result?.pid === 'number' ? `Matched pid: ${result.pid}` : '',
    typeof result?.hwnd === 'number' ? `Matched hwnd: ${result.hwnd}` : '',
    typeof result?.matchCount === 'number' ? `Match count: ${result.matchCount}` : '',
    result?.matchReason ? `Match reason: ${result.matchReason}` : '',
    result?.fromDisplayLabel ? `From display: ${result.fromDisplayLabel}` : '',
    result?.targetDisplayLabel ? `Target display: ${result.targetDisplayLabel}` : '',
    typeof result?.targetDisplay?.primary === 'boolean' ? `Target display primary: ${result.targetDisplay.primary}` : '',
    requestedDisplayRole ? `Requested display role: ${requestedDisplayRole}` : '',
    requestedDisplayRole ? `Requested display role matched: ${requestedDisplayRoleMatched}` : '',
    result?.fromBounds ? `From bounds: ${result.fromBounds.x},${result.fromBounds.y},${result.fromBounds.width}x${result.fromBounds.height}` : '',
    result?.toBounds ? `To bounds: ${result.toBounds.x},${result.toBounds.y},${result.toBounds.width}x${result.toBounds.height}` : '',
    typeof result?.verified === 'boolean' ? `Verified after move: ${result.verified}` : '',
    result?.wasMaximized ? `Window was maximized before move: true` : '',
    result?.wasMaximized ? `Maximized state restored: ${result.maximizedRestored === true}` : '',
    result?.retryMoveAttempted ? 'Retry move attempted: true' : '',
    result?.reason ? `Reason: ${result.reason}` : '',
    result?.error ? `Error: ${result.error}` : '',
  ].filter(Boolean);
  const moveReceiptStatus: AgentChatExecutionReceipt['status'] = result?.ok
    ? moveVerificationUncertain ? 'unverified' : 'success'
    : 'failed';
  const moveStructuredEvidence: AgentStructuredToolEvidence = {
    confidence: moveReceiptStatus === 'success' ? 'high' : moveReceiptStatus === 'unverified' ? 'low' : 'low',
    finalDisplay: {
      id: result?.targetDisplayId ?? displayId ?? null,
      label: result?.targetDisplayLabel ?? targetDisplay ?? null,
      primary: result?.targetDisplay?.primary ?? null,
    },
    finalWindow: createAgentStructuredWindowEvidenceFromParts({
      bounds: result?.toBounds
        ? {
            ...result.toBounds,
            coordinateSpace: result.toBounds.coordinateSpace ?? 'dip',
          }
        : null,
      displayId: result?.targetDisplayId ?? displayId ?? null,
      displayLabel: result?.targetDisplayLabel ?? targetDisplay ?? null,
      hwnd: result?.hwnd ?? (typeof hwnd === 'number' ? hwnd : null),
      pid: result?.pid ?? (typeof pid === 'number' ? pid : null),
      processName: result?.processName ?? null,
      title: result?.title ?? null,
    }),
    postActionState: result?.verified === true && requestedDisplayRoleMatched ? 'completed' : null,
    status: moveReceiptStatus,
    targetMatched: targetText,
  };

  if (result?.ok) {
    return {
      observations,
      ok: true,
      receipt: {
        evidenceLines: observations,
        status: moveReceiptStatus,
        summaryLines: [
          'Call: move_window_to_display',
          `Target: ${targetText}`,
          `Display: ${result.targetDisplayLabel || requestedDisplayText}`,
          moveVerificationUncertain ? 'Result: move requested, verification uncertain' : 'Result: window moved',
        ],
        title: 'Execution receipt',
        toolName: 'move_window_to_display',
        verification: moveVerificationUncertain
          ? !requestedDisplayRoleMatched
            ? `Move request was sent, but the resulting display did not match the requested ${requestedDisplayRole} role for ${targetText}.`
            : `Move request was sent, but post-move verification was uncertain for ${targetText}.`
          : `Window moved to ${result.targetDisplayLabel || requestedDisplayText}: ${targetText}`,
        stateSummary: {
          structuredEvidence: moveStructuredEvidence,
        },
      },
      stateSummary: {
        structuredEvidence: moveStructuredEvidence,
      },
      responseText: moveVerificationUncertain
        ? !requestedDisplayRoleMatched
          ? `Move request sent for ${targetText}, but the resulting display did not match the requested ${requestedDisplayRole} role.`
          : `Move request sent for ${targetText}, but verification was uncertain.`
        : `Moved ${targetText} to ${result.targetDisplayLabel || requestedDisplayText}.`,
      verification: moveVerificationUncertain
        ? !requestedDisplayRoleMatched
          ? `Move target role mismatch: expected ${requestedDisplayRole}, received primary=${String(result?.targetDisplay?.primary)}.`
          : `Move requested but not fully verified: ${targetText}`
        : `Window moved: ${targetText} -> ${result.targetDisplayLabel || requestedDisplayText}`,
    };
  }

  return {
    errorText: result?.error || result?.reason || 'No matching window was moved.',
    observations,
    ok: false,
    responseText: `No matching window was moved: ${targetText}. ${result?.error || result?.reason || ''}`.trim(),
    verification: result?.error || result?.reason || null,
  };
}

function inferWindowControlStateFromAction(rawAction: string) {
  const action = rawAction.trim().toLowerCase().replace(/[-\s]+/gu, '_');
  if (action === 'maximize_window') {
    return 'maximized';
  }

  if (action === 'minimize_window') {
    return 'minimized';
  }

  if (action === 'restore_window') {
    return 'normal';
  }

  return '';
}

function formatWindowBounds(bounds: { height?: number; width?: number; x?: number; y?: number } | null | undefined) {
  if (!bounds) {
    return '';
  }

  return `${bounds.x ?? '?'}${','}${bounds.y ?? '?'} ${bounds.width ?? '?'}x${bounds.height ?? '?'}`;
}

export async function executeControlWindow(toolCall: AgentToolCallCommand): Promise<AgentChatCommandResult> {
  const query = getToolStringInput(toolCall, ['query', 'target', 'title', 'processName', 'name']);
  const pid = getToolNumberInput(toolCall, 'pid');
  const hwnd = getToolNumberInput(toolCall, 'hwnd') ?? getToolNumberInput(toolCall, 'windowHandle');
  const rawAction = getToolStringInput(toolCall, ['action', 'desktopAction', 'operation']);
  const windowState = getToolStringInput(toolCall, ['windowState', 'state', 'mode'])
    || inferWindowControlStateFromAction(rawAction);
  const snap = getToolStringInput(toolCall, ['snap', 'snapPosition', 'placement']);
  const targetDisplay = getToolStringInput(toolCall, [
    'targetDisplay',
    'display',
    'displayTarget',
    'screen',
    'screenTarget',
  ]);
  const displayId = getToolStringInput(toolCall, ['displayId', 'targetDisplayId', 'screenId']);
  const coordinateSpace = getToolStringInput(toolCall, ['coordinateSpace']);
  const fallbackToActiveWindow = getToolBooleanInput(toolCall, 'fallbackToActiveWindow');
  const x = getToolNumberInput(toolCall, 'x') ?? getToolNumberInput(toolCall, 'left');
  const y = getToolNumberInput(toolCall, 'y') ?? getToolNumberInput(toolCall, 'top');
  const width = getToolNumberInput(toolCall, 'width') ?? getToolNumberInput(toolCall, 'w');
  const height = getToolNumberInput(toolCall, 'height') ?? getToolNumberInput(toolCall, 'h');
  const hasBoundsInput = [x, y, width, height].some((value) => typeof value === 'number');
  const hasOperation = Boolean(windowState || snap || targetDisplay || displayId || hasBoundsInput);

  if (!hasOperation) {
    return {
      errorText: 'Missing control_window operation.',
      ok: false,
      responseText: 'control_window needs a windowState, snap, display target, or x/y/width/height bounds.',
    };
  }

  if (!query && !pid && !hwnd && fallbackToActiveWindow === false) {
    return {
      errorText: 'Missing control_window target.',
      ok: false,
      responseText: 'control_window needs a target window, PID, hwnd, or fallbackToActiveWindow=true for the active window.',
    };
  }

  const result = await desktopPetShellRuntime.controlWindow({
    coordinateSpace,
    displayId,
    fallbackToActiveWindow,
    height,
    hwnd,
    pid,
    query,
    snap,
    state: windowState,
    targetDisplay,
    width,
    x,
    y,
  }) as ControlWindowResultLike;
  const targetText = result?.title || result?.processName || query || (
    typeof pid === 'number' ? `pid=${pid}` : typeof hwnd === 'number' ? `hwnd=${hwnd}` : 'active window'
  );
  const observations = [
    query ? `Control window query: ${query}` : 'Control window target: active window fallback',
    windowState ? `Requested state: ${windowState}` : '',
    snap ? `Requested snap: ${snap}` : '',
    targetDisplay || displayId ? `Requested display: ${displayId || targetDisplay}` : '',
    coordinateSpace ? `Coordinate space: ${coordinateSpace}` : '',
    typeof x === 'number' ? `Requested x: ${x}` : '',
    typeof y === 'number' ? `Requested y: ${y}` : '',
    typeof width === 'number' ? `Requested width: ${width}` : '',
    typeof height === 'number' ? `Requested height: ${height}` : '',
    result?.processName ? `Matched process: ${result.processName}` : '',
    result?.title ? `Matched title: ${result.title}` : '',
    typeof result?.pid === 'number' ? `Matched pid: ${result.pid}` : '',
    typeof result?.hwnd === 'number' ? `Matched hwnd: ${result.hwnd}` : '',
    typeof result?.matchCount === 'number' ? `Match count: ${result.matchCount}` : '',
    result?.matchReason ? `Match reason: ${result.matchReason}` : '',
    result?.beforeState ? `Before state: ${result.beforeState}` : '',
    result?.afterState ? `After state: ${result.afterState}` : '',
    typeof result?.stateChanged === 'boolean' ? `State changed: ${result.stateChanged}` : '',
    typeof result?.boundsChanged === 'boolean' ? `Bounds changed: ${result.boundsChanged}` : '',
    result?.fromDisplayLabel ? `From display: ${result.fromDisplayLabel}` : '',
    result?.toDisplayLabel ? `To display: ${result.toDisplayLabel}` : '',
    result?.targetDisplayLabel ? `Target display: ${result.targetDisplayLabel}` : '',
    result?.fromBounds ? `From bounds: ${formatWindowBounds(result.fromBounds)}` : '',
    result?.targetBounds ? `Target bounds: ${formatWindowBounds(result.targetBounds)}` : '',
    result?.toBounds ? `To bounds: ${formatWindowBounds(result.toBounds)}` : '',
    result?.reason ? `Reason: ${result.reason}` : '',
    result?.error ? `Error: ${result.error}` : '',
  ].filter(Boolean);
  const controlReceiptStatus: AgentChatExecutionReceipt['status'] = result?.ok
    ? result.controlled === false ? 'unverified' : 'success'
    : 'failed';
  const controlFinalBounds = result?.toBounds ?? result?.targetBounds ?? null;
  const controlStructuredEvidence: AgentStructuredToolEvidence = {
    confidence: controlReceiptStatus === 'success' ? 'high' : 'low',
    finalDisplay: result?.toDisplayId || result?.toDisplayLabel || result?.targetDisplayId || result?.targetDisplayLabel || displayId || targetDisplay
      ? {
          id: result?.toDisplayId ?? result?.targetDisplayId ?? displayId ?? null,
          label: result?.toDisplayLabel ?? result?.targetDisplayLabel ?? targetDisplay ?? null,
        }
      : null,
    finalWindow: createAgentStructuredWindowEvidenceFromParts({
      bounds: controlFinalBounds
        ? {
            ...controlFinalBounds,
            coordinateSpace: controlFinalBounds.coordinateSpace ?? 'dip',
          }
        : null,
      displayId: result?.toDisplayId ?? result?.targetDisplayId ?? displayId ?? null,
      displayLabel: result?.toDisplayLabel ?? result?.targetDisplayLabel ?? targetDisplay ?? null,
      hwnd: result?.hwnd ?? (typeof hwnd === 'number' ? hwnd : null),
      pid: result?.pid ?? (typeof pid === 'number' ? pid : null),
      processName: result?.processName ?? null,
      title: result?.title ?? null,
    }),
    status: controlReceiptStatus,
    targetMatched: targetText,
  };

  if (result?.ok) {
    return {
      observations,
      ok: true,
      receipt: {
        evidenceLines: observations,
        status: controlReceiptStatus,
        summaryLines: [
          'Call: control_window',
          `Target: ${targetText}`,
          windowState ? `State: ${result.afterState || windowState}` : '',
          snap ? `Snap: ${snap}` : '',
          result?.toBounds ? `Bounds: ${formatWindowBounds(result.toBounds)}` : '',
        ].filter(Boolean),
        title: 'Execution receipt',
        toolName: 'control_window',
        verification: result.controlled === false
          ? `Window control returned ok but did not report a state or bounds change: ${targetText}.`
          : `Window control completed for ${targetText}.`,
        stateSummary: {
          structuredEvidence: controlStructuredEvidence,
        },
      },
      stateSummary: {
        structuredEvidence: controlStructuredEvidence,
      },
      responseText: `Window control completed for ${targetText}.`,
      verification: result.controlled === false
        ? `Window control ok but unverified: ${targetText}`
        : `Window control completed: ${targetText}`,
    };
  }

  return {
    errorText: result?.error || result?.reason || 'No matching window was controlled.',
    observations,
    ok: false,
    responseText: `Window control failed for ${targetText}. ${result?.error || result?.reason || ''}`.trim(),
    verification: result?.error || result?.reason || null,
  };
}
