import { type AgentChatCommandResult, type AgentStructuredToolWindowEvidence } from '../agentChatCommand';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { createAgentRuntimeResult } from './sequenceResultEvidence';

const CLICK_ACTIONS = new Set(['click', 'double_click', 'right_click']);
const BOUNDS_TOLERANCE_PX = 4;

/**
 * A coordinate click is planned against the window as it looked when it was located.
 * If, by the time the approved click runs, the focused target window no longer
 * contains that point (closed, moved, resized, or replaced by another window), the
 * click would land on whatever is there now, so it is blocked and must be re-located.
 */
export function findAgentRuntimeDesktopSequenceStaleClick(
  stepArgs: Record<string, unknown>,
  focusedWindow: AgentStructuredToolWindowEvidence | null,
) {
  const action = typeof stepArgs.action === 'string' ? stepArgs.action.trim().toLowerCase().replace(/[-\s]+/gu, '_') : '';
  const space = typeof stepArgs.coordinateSpace === 'string' ? stepArgs.coordinateSpace.trim().toLowerCase() : 'native-screen';
  const x = Number(stepArgs.x); const y = Number(stepArgs.y);
  const bounds = focusedWindow?.bounds;
  const left = Number(bounds?.x); const top = Number(bounds?.y);
  const width = Number(bounds?.width); const height = Number(bounds?.height);
  if (
    !CLICK_ACTIONS.has(action)
    || space !== 'native-screen'
    || ![x, y, left, top, width, height].every(Number.isFinite)
    || width <= 0
    || height <= 0
    || (bounds?.coordinateSpace && bounds.coordinateSpace.trim().toLowerCase() !== 'native-screen')
  ) {
    return null;
  }
  const inside = x >= left - BOUNDS_TOLERANCE_PX && x <= left + width + BOUNDS_TOLERANCE_PX
    && y >= top - BOUNDS_TOLERANCE_PX && y <= top + height + BOUNDS_TOLERANCE_PX;
  return inside ? null : {
    point: { x, y },
    windowBounds: { height, width, x: left, y: top },
    windowTitle: focusedWindow?.title || focusedWindow?.processName || 'target window',
  };
}

/**
 * When the click step carries the handle of the window it was located in, look that
 * window up now: gone (e.g. a login window replaced by the main window, both titled the
 * same) or moved away from the point means the click is stale.
 */
export async function findAgentRuntimeDesktopSequenceStaleClickByHwnd(stepArgs: Record<string, unknown>) {
  // Planned args only (not the focus-merged ones): a login-continuation retry carries the
  // login window as expectedForegroundHwnd; once login replaces that window, the retry is stale.
  const hwnd = Math.round(Number(stepArgs.expectedWindowHwnd ?? stepArgs.expectedForegroundHwnd));
  if (!(hwnd > 0)) return null;
  let sources: DesktopPetCaptureSourceLike[] = [];
  try {
    sources = await desktopPetShellRuntime.listCaptureSources({
      captureSourceTypes: ['window'], forceRefresh: true, includeCaptureThumbnails: false,
    }) as DesktopPetCaptureSourceLike[];
  } catch {
    return null;
  }
  if (!Array.isArray(sources) || !sources.length) return null;
  const window = sources.find((source) => source.id.split(':')[1] === String(hwnd));
  const x = Number(stepArgs.x); const y = Number(stepArgs.y);
  if (!window) {
    return { point: { x, y }, windowBounds: { height: 0, width: 0, x: 0, y: 0 }, windowTitle: `window ${hwnd} (closed or replaced)` };
  }
  return findAgentRuntimeDesktopSequenceStaleClick(stepArgs, {
    bounds: { coordinateSpace: 'native-screen', ...window.bounds }, hwnd, title: window.name,
  });
}

export function createAgentRuntimeDesktopSequenceStaleClickResult(
  stale: NonNullable<ReturnType<typeof findAgentRuntimeDesktopSequenceStaleClick>>,
): AgentChatCommandResult {
  const { point, windowBounds, windowTitle } = stale;
  const reason = `The approved click at (${point.x}, ${point.y}) is outside "${windowTitle}" as it is now `
    + `(${windowBounds.x},${windowBounds.y} ${windowBounds.width}x${windowBounds.height}); the window changed after the target was located.`;
  return createAgentRuntimeResult({
    errorText: reason,
    observations: [
      reason,
      'The click was blocked before dispatch so it does not land on a different window or page.',
      'Locate the target again in the current window before requesting a new click.',
    ],
    ok: false,
    receipt: {
      evidenceLines: [reason, 'preDispatchClickTarget=stale'],
      status: 'blocked',
      summaryLines: ['Call: execute_desktop_sequence', 'Click blocked: target window changed since it was located.'],
      title: 'Desktop click target changed',
      toolName: 'execute_desktop_sequence',
      verification: reason,
    },
    responseText: reason,
    verification: reason,
  });
}
