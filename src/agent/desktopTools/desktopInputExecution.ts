import { executeDesktopInputWithFocusRetry } from './desktopInputFocusRetry';
import {
  desktopPetShellRuntime,
} from '../../desktopShellRuntime';
import {
  type AgentChatCommandResult,
  type AgentStructuredToolEvidence,
  type AgentToolCallCommand,
} from '../agentChatCommand';
import {
  getToolStringInput,
  normalizeExecuteDesktopInputAction,
  createDesktopInputRequest,
} from './desktopToolInput';
import {
  createDesktopInputActionEvidence,
} from './desktopActionEvidence';
import {
  shouldCaptureDesktopInputReplay,
  shouldUseToolCallPointForNativeScreenReplay,
  resolveDesktopInputReplayPoint,
  captureDesktopInputReplayBefore,
  resolveDesktopInputResultReplayPoint,
  captureDesktopInputReplayAfter,
  createDesktopInputReplayEvidence,
} from './desktopInputReplay';

export async function executeDesktopInput(toolCall: AgentToolCallCommand): Promise<AgentChatCommandResult> {
  const rawAction = getToolStringInput(toolCall, ['action', 'inputAction', 'operation']);
  const action = normalizeExecuteDesktopInputAction(rawAction) || rawAction;
  const inputRequest = createDesktopInputRequest(toolCall, action);
  const replayPointBefore = shouldCaptureDesktopInputReplay(action) && shouldUseToolCallPointForNativeScreenReplay(toolCall, action)
    ? resolveDesktopInputReplayPoint(toolCall, action)
    : null;
  const replayBefore = await captureDesktopInputReplayBefore(replayPointBefore);
  const result = await executeDesktopInputWithFocusRetry(inputRequest) as {
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
