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

interface ElevationResultLike {
  error?: string | null;
  inputDiagnostics?: { permissionStatus?: string | null } | null;
}

export function isElevationRequiredResult(result: unknown) {
  const value = (result ?? null) as ElevationResultLike | null;
  return value?.error === 'target_requires_elevation'
    || value?.inputDiagnostics?.permissionStatus === 'target_requires_elevation';
}

/** Asks the user (an approval card) before the elevated input helper may start. */
type ElevatedInputApprover = () => Promise<boolean>;
let elevatedInputApprover: ElevatedInputApprover | null = null;
let elevationDeclined = false;

/**
 * The running conversation registers its approval card here. Windows blocks a normal process
 * from sending input to a window that runs as administrator (WeGame and some game launchers),
 * so such input only proceeds after the user agrees in chat and then in the UAC prompt.
 */
export function setElevatedInputApprover(approver: ElevatedInputApprover | null) {
  elevatedInputApprover = approver;
  elevationDeclined = false;
}

async function startElevatedInputWithApproval() {
  const elevatedInput = typeof window === 'undefined' ? null : window.desktopPetShell?.elevatedInput ?? null;
  if (!elevatedInput || !elevatedInputApprover || elevationDeclined) return false;
  if (!await elevatedInputApprover()) {
    elevationDeclined = true;
    return false;
  }
  const started = await elevatedInput.start();
  if (!started.ok) elevationDeclined = true;
  return started.ok;
}

async function executeWithElevation(inputRequest: Record<string, unknown>) {
  const result = await desktopPetShellRuntime.executeDesktopInput(inputRequest);
  if (!isElevationRequiredResult(result) || !await startElevatedInputWithApproval()) return result;
  return desktopPetShellRuntime.executeDesktopInput(inputRequest);
}

/**
 * Sends desktop input; if the guard refused it only because the expected target window was
 * not in front (e.g. the chat window had focus), brings that window forward and retries once.
 * Live WeGame runs looped on target_window_not_foreground when the model clicked without a
 * separate focus step.
 */
export async function executeDesktopInputWithFocusRetry(inputRequest: Record<string, unknown>) {
  const first = await executeWithElevation(inputRequest);
  const target = resolveDesktopInputFocusRetryTarget(first);
  if (!target) return first;
  try {
    await desktopPetShellRuntime.focusWindow(target);
  } catch {
    return first;
  }
  await new Promise((resolve) => { globalThis.setTimeout(resolve, FOCUS_SETTLE_MS); });
  return executeWithElevation(inputRequest);
}
