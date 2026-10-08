import { desktopPetShellRuntime } from '../desktopShellRuntime';
import { type AgentChatCommandResult, type AgentToolCallCommand } from './agentChatCommand';
import { getToolStringInput, getToolNumberInput } from './desktopTools/desktopToolInput';

export { executeMoveWindowToDisplay, executeControlWindow } from './windowTools/windowMovementControl';

interface FocusWindowResultLike {
  error?: string | null;
  focusResolutionAttempts?: number | null;
  focusResolutionRetried?: boolean | null;
  foregroundHwnd?: number | null;
  foregroundMatchesTarget?: boolean | null;
  focusRequestAccepted?: boolean | null;
  focusAttempts?: number | null;
  hwnd?: number | null;
  ok?: boolean;
  pid?: number | null;
  processName?: string | null;
  query?: string | null;
  reason?: string | null;
  title?: string | null;
}

interface CloseWindowResultLike {
  closed?: boolean;
  error?: string | null;
  hwnd?: number | null;
  matchCount?: number | null;
  matchReason?: string | null;
  ok?: boolean;
  pid?: number | null;
  processName?: string | null;
  query?: string | null;
  reason?: string | null;
  stillProcessWindow?: boolean | null;
  stillWindow?: boolean | null;
  title?: string | null;
}

export async function executeFocusWindow(input: string | AgentToolCallCommand): Promise<AgentChatCommandResult> {
  const query = typeof input === 'string'
    ? input
    : getToolStringInput(input, ['query', 'target', 'title', 'processName', 'name']);
  const pid = typeof input === 'string' ? undefined : getToolNumberInput(input, 'pid');
  const hwnd = typeof input === 'string' ? undefined : getToolNumberInput(input, 'hwnd') ?? getToolNumberInput(input, 'windowHandle');
  const result = await desktopPetShellRuntime.focusWindow({ hwnd, pid, query }) as FocusWindowResultLike;
  const observations = [
    query ? `Focus window query: ${query}` : '',
    typeof pid === 'number' ? `Requested pid: ${pid}` : '',
    typeof hwnd === 'number' ? `Requested hwnd: ${hwnd}` : '',
    result?.processName ? `Focused process: ${result.processName}` : '',
    result?.title ? `Focused title: ${result.title}` : '',
    typeof result?.pid === 'number' ? `Focused pid: ${result.pid}` : '',
    typeof result?.hwnd === 'number' ? `Focused hwnd: ${result.hwnd}` : '',
    typeof result?.foregroundHwnd === 'number' ? `Foreground hwnd after focus: ${result.foregroundHwnd}` : '',
    typeof result?.foregroundMatchesTarget === 'boolean' ? `Foreground matches target: ${result.foregroundMatchesTarget}` : '',
    typeof result?.focusRequestAccepted === 'boolean' ? `Focus request accepted: ${result.focusRequestAccepted}` : '',
    typeof result?.focusAttempts === 'number' ? `Focus attempts: ${result.focusAttempts}` : '',
    typeof result?.focusResolutionAttempts === 'number' ? `Window resolution attempts: ${result.focusResolutionAttempts}` : '',
    typeof result?.focusResolutionRetried === 'boolean' ? `Window resolution retried: ${result.focusResolutionRetried}` : '',
    result?.reason ? `Reason: ${result.reason}` : '',
  ].filter(Boolean);

  const focusedHwnd = typeof result?.hwnd === 'number' && result.hwnd > 0
    ? Math.round(result.hwnd)
    : null;
  const foregroundVerified = result?.foregroundMatchesTarget === true;
  const structuredEvidence = {
    finalWindow: {
      hwnd: focusedHwnd,
      pid: typeof result?.pid === 'number' ? result.pid : pid ?? null,
      processName: result?.processName ?? null,
      title: result?.title ?? null,
    },
    focus: {
      focusedHwnd,
      requestedHwnd: typeof hwnd === 'number' && hwnd > 0 ? Math.round(hwnd) : null,
      requestedPid: typeof pid === 'number' && pid > 0 ? Math.round(pid) : null,
      foregroundHwnd: typeof result?.foregroundHwnd === 'number' ? Math.round(result.foregroundHwnd) : null,
      foregroundMatchesTarget: result?.foregroundMatchesTarget ?? null,
      verified: Boolean(result?.ok && focusedHwnd && foregroundVerified),
    },
  };

  if (result?.ok && focusedHwnd && foregroundVerified) {
    return {
      observations,
      ok: true,
      receipt: {
        evidenceLines: observations,
        stateSummary: {
          structuredEvidence,
          verificationEvidence: [
            focusedHwnd
              ? `focus_window returned focusedHwnd=${focusedHwnd}; foreground hwnd was verified.`
              : 'focus_window returned success without a concrete focused HWND.',
          ],
        },
        status: focusedHwnd ? 'success' : 'unverified',
        summaryLines: [
          'Call: focus_window',
          focusedHwnd ? `Focused HWND: ${focusedHwnd}` : 'Focused HWND: unavailable',
        ],
        title: 'Window focus',
        toolName: 'focus_window',
        verification: focusedHwnd
          ? `focus_window returned focusedHwnd=${focusedHwnd}; foreground hwnd was verified.`
          : 'focus_window returned success without a concrete focused HWND.',
      },
      stateSummary: { structuredEvidence },
      responseText: `已唤出匹配窗口：${result.title || result.processName || query}。`,
      verification: `窗口已切到前台并通过 HWND 复核：${result.processName || query}`,
    };
  }

  return {
    errorText: result?.error || result?.reason || '窗口未通过前台 HWND 复核。',
    observations,
    ok: false,
    responseText: `窗口未能切到前台：${query}。`,
    verification: result?.error || result?.reason || 'focus_window did not verify the target HWND as the real foreground window.',
  };
}

export async function executeCloseWindow(toolCall: AgentToolCallCommand): Promise<AgentChatCommandResult> {
  const query = getToolStringInput(toolCall, ['query', 'target', 'title', 'processName', 'name']);
  const pid = getToolNumberInput(toolCall, 'pid');
  const hwnd = getToolNumberInput(toolCall, 'hwnd') ?? getToolNumberInput(toolCall, 'windowHandle');
  if (!query && !pid && !hwnd) {
    return {
      errorText: 'Missing close_window target.',
      ok: false,
      responseText: '关闭窗口需要先知道目标窗口标题、进程名、PID 或窗口句柄。',
    };
  }

  const result = await desktopPetShellRuntime.closeWindow({
    hwnd,
    pid,
    query,
  }) as CloseWindowResultLike;
  const targetText = result?.title || result?.processName || query || (
    typeof pid === 'number' ? `pid=${pid}` : typeof hwnd === 'number' ? `hwnd=${hwnd}` : 'unknown'
  );
  const observations = [
    query ? `Close window query: ${query}` : '',
    typeof pid === 'number' ? `Requested pid: ${pid}` : '',
    typeof hwnd === 'number' ? `Requested hwnd: ${hwnd}` : '',
    result?.processName ? `Matched process: ${result.processName}` : '',
    result?.title ? `Matched title: ${result.title}` : '',
    typeof result?.pid === 'number' ? `Matched pid: ${result.pid}` : '',
    typeof result?.hwnd === 'number' ? `Matched hwnd: ${result.hwnd}` : '',
    typeof result?.matchCount === 'number' ? `Match count: ${result.matchCount}` : '',
    result?.matchReason ? `Match reason: ${result.matchReason}` : '',
    typeof result?.closed === 'boolean' ? `Closed after request: ${result.closed}` : '',
    typeof result?.stillWindow === 'boolean' ? `Window handle still exists: ${result.stillWindow}` : '',
    result?.reason ? `Reason: ${result.reason}` : '',
    result?.error ? `Error: ${result.error}` : '',
  ].filter(Boolean);

  if (result?.ok) {
    const closed = Boolean(result.closed);
    return {
      observations,
      ok: true,
      receipt: {
        evidenceLines: observations,
        status: closed ? 'success' : 'unverified',
        summaryLines: [
          '调用：close_window',
          `目标：${targetText}`,
          closed ? '结果：窗口已关闭' : '结果：关闭请求已发送，但窗口可能仍在等待确认',
        ],
        title: '执行回执',
        toolName: 'close_window',
        verification: closed
          ? `已向窗口发送 WM_CLOSE，并验证窗口句柄消失：${targetText}`
          : `已向窗口发送 WM_CLOSE，但窗口仍存在；目标应用可能在等待保存或关闭确认：${targetText}`,
      },
      responseText: closed
        ? `已关闭窗口：${targetText}`
        : `已向窗口发送关闭请求：${targetText}。如果它弹出了保存确认，需要用户再确认一下。`,
      verification: closed
        ? `Window closed after WM_CLOSE: ${targetText}`
        : `Close request sent, but window still exists: ${targetText}`,
    };
  }

  return {
    errorText: result?.error || result?.reason || 'No matching window was closed.',
    observations,
    ok: false,
    responseText: `没有关闭匹配窗口：${targetText}。${result?.error || result?.reason || ''}`.trim(),
    verification: result?.error || result?.reason || null,
  };
}

export async function waitForDesktopActionWindowSettle(ms = 900) {
  await new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}
