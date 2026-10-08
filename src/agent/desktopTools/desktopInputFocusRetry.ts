import { desktopPetShellRuntime } from '../../desktopShellRuntime';

const FOCUS_SETTLE_MS = 250;

interface ExpectedForegroundLike {
  hwnd?: number | null;
  pid?: number | null;
  processName?: string | null;
  title?: string | null;
}

interface ForegroundGuardResultLike {
  error?: string | null;
  expectedForeground?: ExpectedForegroundLike | null;
  inputDiagnostics?: { failureClassification?: string | null } | null;
}

/** The window the input guard expected in front, when the input was refused only for that reason. */
export function resolveDesktopInputFocusRetryTarget(result: unknown) {
  const guard = (result ?? null) as ForegroundGuardResultLike | null;
  const notForeground = guard?.error === 'target_window_not_foreground'
    || guard?.inputDiagnostics?.failureClassification === 'target_window_not_foreground';
  const expected = guard?.expectedForeground;
  const hwnd = Number(expected?.hwnd);
  const query = expected?.title?.trim() || expected?.processName?.trim() || '';
  if (!notForeground || (!(hwnd > 0) && !query)) return null;
  return {
    hwnd: hwnd > 0 ? Math.round(hwnd) : undefined,
    pid: Number(expected?.pid) > 0 ? Math.round(Number(expected?.pid)) : undefined,
    query: query || undefined,
  };
}

/**
 * Sends desktop input; if the guard refused it only because the expected target window was
 * not in front (e.g. the chat window had focus), brings that window forward and retries once.
 * Live WeGame runs looped on target_window_not_foreground when the model clicked without a
 * separate focus step.
 */
export async function executeDesktopInputWithFocusRetry(inputRequest: Record<string, unknown>) {
  const first = await desktopPetShellRuntime.executeDesktopInput(inputRequest);
  const target = resolveDesktopInputFocusRetryTarget(first);
  if (!target) return first;
  try {
    await desktopPetShellRuntime.focusWindow(target);
  } catch {
    return first;
  }
  await new Promise((resolve) => { globalThis.setTimeout(resolve, FOCUS_SETTLE_MS); });
  return desktopPetShellRuntime.executeDesktopInput(inputRequest);
}
