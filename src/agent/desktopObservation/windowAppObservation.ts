import {
  type RunningAppWindowLike,
  type ObservedLocalAppLike,
  type ActiveWindowInfoResultLike,
  formatRunningAppLine,
  formatObservedAppLine,
  createObserveWindowsAndAppsStructuredEvidence,
  countObservedRunningProcesses,
} from './windowAppEvidence';
export {
  type RunningAppWindowLike,
  type RunningAppsResultLike,
  type ActiveWindowInfoResultLike,
  formatRunningAppLine,
  createStructuredWindowEvidence,
  createObserveWindowsAndAppsStructuredEvidence,
  countObservedRunningProcesses,
} from './windowAppEvidence';

import {
  desktopPetShellRuntime,
} from '../../desktopShellRuntime';
import {
  type AgentChatCommandResult,
  type AgentStructuredToolEvidence,
  type AgentToolCallCommand,
} from '../agentChatCommand';
import {
  getToolBooleanInput,
  getToolNumberInput,
  getToolStringInput,
} from '../desktopTools/desktopToolInput';

interface ObserveWindowsAndAppsResultLike {
  activeWindow?: ActiveWindowInfoResultLike | null;
  displays?: unknown[] | null;
  error?: string | null;
  installedApps?: ObservedLocalAppLike[] | null;
  installedCount?: number | null;
  ok?: boolean;
  query?: string | null;
  runningApps?: RunningAppWindowLike[] | null;
  runningCount?: number | null;
  windowEnumeration?: {
    enumeratedCount?: number | null;
    filteredOut?: Array<{
      hwnd?: number | null;
      pid?: number | null;
      reasons?: string[] | null;
      title?: string | null;
    }> | null;
  } | null;
  observationFallback?: boolean;
  taskbarPinnedApps?: ObservedLocalAppLike[] | null;
  taskbarPinnedCount?: number | null;
  taskbarPinnedRoot?: string | null;
}

let lastGoodObserveWindowsAndAppsSnapshot: ObserveWindowsAndAppsResultLike | null = null;

let windowObservationGeneration = 0;

export function attachWindowObservationFreshness(
  evidence: AgentStructuredToolEvidence | null,
  capturedAt = Date.now(),
  freshness: 'live' | 'stale-fallback' = 'live',
) {
  if (!evidence) {
    return null;
  }

  windowObservationGeneration += 1;
  return {
    ...evidence,
    observationCapturedAt: capturedAt,
    observationGeneration: windowObservationGeneration,
    observationFreshness: freshness,
  };
}

function getObservedListCount(list: unknown[] | null | undefined, explicitCount: number | null | undefined) {
  return typeof explicitCount === 'number' ? explicitCount : Array.isArray(list) ? list.length : 0;
}

function hasObservedWindowOrAppEvidence(result: ObserveWindowsAndAppsResultLike | null | undefined) {
  if (!result) {
    return false;
  }

  return getObservedListCount(result.installedApps, result.installedCount) > 0
    || getObservedListCount(result.taskbarPinnedApps, result.taskbarPinnedCount) > 0
    || getObservedListCount(result.runningApps, result.runningCount) > 0;
}

function isImplausibleEmptyObserveWindowsAndAppsResult(result: ObserveWindowsAndAppsResultLike | null | undefined) {
  if (!result?.ok) {
    return false;
  }

  return !hasObservedWindowOrAppEvidence(result)
    && Boolean(result.activeWindow?.processName || result.activeWindow?.title || result.activeWindow?.hwnd);
}

function createObserveWindowsAndAppsColdStartFallbackNote(
  emptyResult: ObserveWindowsAndAppsResultLike,
  snapshot: ObserveWindowsAndAppsResultLike,
) {
  const emptyQuery = emptyResult.query?.trim() ?? '';
  const snapshotQuery = snapshot.query?.trim() ?? '';
  const queryNote = emptyQuery && snapshotQuery && emptyQuery !== snapshotQuery
    ? ` currentQuery="${emptyQuery}" snapshotQuery="${snapshotQuery}"`
    : emptyQuery
      ? ` query="${emptyQuery}"`
      : '';

  return [
    'Observation fallback: using last good window/app snapshot because current snapshot returned empty cold-start data.',
    `Fallback snapshot counts: installed=${getObservedListCount(snapshot.installedApps, snapshot.installedCount)}, taskbarPinned=${getObservedListCount(snapshot.taskbarPinnedApps, snapshot.taskbarPinnedCount)}, running=${getObservedListCount(snapshot.runningApps, snapshot.runningCount)}.${queryNote}`,
  ];
}

export function resolveObserveWindowsAndAppsColdStartSnapshotForTest(options: {
  current: ObserveWindowsAndAppsResultLike;
  previous: ObserveWindowsAndAppsResultLike | null;
}) {
  if (
    isImplausibleEmptyObserveWindowsAndAppsResult(options.current)
    && hasObservedWindowOrAppEvidence(options.previous)
  ) {
    return {
      fallbackNotes: createObserveWindowsAndAppsColdStartFallbackNote(options.current, options.previous),
      result: {
        ...options.previous,
        activeWindow: options.current.activeWindow ?? options.previous?.activeWindow ?? null,
        displays: options.current.displays ?? options.previous?.displays ?? null,
        ok: options.current.ok,
        observationFallback: true,
        query: options.current.query ?? options.previous?.query ?? null,
      },
      usedFallback: true,
    };
  }

  return {
    fallbackNotes: [] as string[],
    result: options.current,
    usedFallback: false,
  };
}

export function resolveObserveWindowsAndAppsScopes(toolCall: AgentToolCallCommand) {
  const requestedScopes = {
    includeActiveWindow: getToolBooleanInput(toolCall, 'includeActiveWindow'),
    includeDisplays: getToolBooleanInput(toolCall, 'includeDisplays'),
    includeInstalledApps: getToolBooleanInput(toolCall, 'includeInstalledApps'),
    includeRunningApps: getToolBooleanInput(toolCall, 'includeRunningApps'),
    includeTaskbarPinned: getToolBooleanInput(toolCall, 'includeTaskbarPinned'),
  };
  const hasExplicitScope = Object.values(requestedScopes).some((value) => value !== undefined);

  return {
    includeActiveWindow: hasExplicitScope ? requestedScopes.includeActiveWindow ?? false : true,
    includeDisplays: hasExplicitScope ? requestedScopes.includeDisplays ?? false : true,
    includeInstalledApps: requestedScopes.includeInstalledApps ?? false,
    includeRunningApps: hasExplicitScope ? requestedScopes.includeRunningApps ?? false : true,
    includeTaskbarPinned: hasExplicitScope ? requestedScopes.includeTaskbarPinned ?? false : true,
  };
}

export async function executeObserveWindowsAndApps(toolCall: AgentToolCallCommand): Promise<AgentChatCommandResult> {
  const scopes = resolveObserveWindowsAndAppsScopes(toolCall);
  const rawResult = await desktopPetShellRuntime.observeWindowsAndApps({
    forceRefresh: getToolBooleanInput(toolCall, 'forceRefresh'),
    ...scopes,
    limit: getToolNumberInput(toolCall, 'limit') ?? undefined,
    query: getToolStringInput(toolCall, ['query', 'target', 'name', 'title', 'processName']),
  }) as ObserveWindowsAndAppsResultLike;
  const coldStartFallback = resolveObserveWindowsAndAppsColdStartSnapshotForTest({
    current: rawResult,
    previous: lastGoodObserveWindowsAndAppsSnapshot,
  });
  const result = coldStartFallback.result;
  if (result?.ok && hasObservedWindowOrAppEvidence(result) && !result.observationFallback) {
    lastGoodObserveWindowsAndAppsSnapshot = result;
  }
  const installedApps = Array.isArray(result?.installedApps) ? result.installedApps : [];
  const taskbarPinnedApps = Array.isArray(result?.taskbarPinnedApps) ? result.taskbarPinnedApps : [];
  const runningApps = Array.isArray(result?.runningApps) ? result.runningApps : [];
  const displays = Array.isArray(result?.displays) ? result.displays : [];
  const active = result?.activeWindow ?? null;
  const runningWindowCount = result?.runningCount ?? runningApps.length;
  const runningProcessCount = countObservedRunningProcesses(runningApps);
  const filteredWindows = result?.windowEnumeration?.filteredOut ?? [];
  const enumeratedWindowCount = result?.windowEnumeration?.enumeratedCount;
  const observations = [
    `Windows/apps query: ${result?.query || ''}`,
    `Installed app entries: ${result?.installedCount ?? installedApps.length}`,
    `Taskbar pinned entries: ${result?.taskbarPinnedCount ?? taskbarPinnedApps.length}`,
    `Running windows: ${runningWindowCount}`,
    `Distinct running processes: ${runningProcessCount}`,
    typeof enumeratedWindowCount === 'number' ? `Window enumeration candidates: ${enumeratedWindowCount}` : '',
    filteredWindows.length ? `Filtered windows: ${filteredWindows.slice(0, 8).map((window) => `${window.title || 'untitled'} pid=${window.pid ?? 'unknown'} hwnd=${window.hwnd ?? 'unknown'} reasons=${(window.reasons ?? []).join(',') || 'unknown'}`).join(' | ')}` : '',
    `Display observations: ${displays.length}`,
    active?.processName ? `Active process: ${active.processName}` : '',
    active?.title ? `Active title: ${active.title}` : '',
    active?.executablePath ? `Active executable: ${active.executablePath}` : '',
    active?.displayLabel ? `Active display: ${active.displayLabel}` : '',
    ...coldStartFallback.fallbackNotes,
    ...taskbarPinnedApps.slice(0, 8).map((app, index) => `Taskbar pinned ${formatObservedAppLine(app, index)}`),
    ...runningApps.slice(0, 12).map((app, index) => `Running ${formatRunningAppLine(app, index)}`),
    ...installedApps.slice(0, 8).map((app, index) => `Installed ${formatObservedAppLine(app, index)}`),
    result?.error ? `Error: ${result.error}` : '',
  ].filter(Boolean);
  const structuredEvidence = attachWindowObservationFreshness(createObserveWindowsAndAppsStructuredEvidence({
    active,
    installedApps,
    query: result?.query,
    runningApps,
    taskbarPinnedApps,
  }), Date.now(), result?.observationFallback ? 'stale-fallback' : 'live');
  const observeSucceeded = Boolean(result?.ok);
  const queryHasNoMatches = Boolean(
    observeSucceeded
    && result?.query?.trim()
    && !runningApps.length
    && !installedApps.length
    && !taskbarPinnedApps.length
  );
  const verificationText = observeSucceeded
    ? 'Window/app observation returned current installed entries, taskbar pins, windows, active window, and displays when requested.'
    : result?.error || null;

  return {
    errorText: observeSucceeded ? null : result?.error || 'Window/app observation failed.',
    observations,
    ok: observeSucceeded,
    receipt: {
      evidenceLines: observations.slice(0, 40),
      stateSummary: {
        missingEvidence: [
          queryHasNoMatches ? `No observed app/window matched query "${result?.query}".` : '',
          !observeSucceeded ? result?.error || 'Window/app observation failed.' : '',
        ].filter(Boolean),
        observedState: observations.slice(0, 40),
        recommendedRecovery: observeSucceeded ? [] : ['tool:observe_windows_and_apps'],
        structuredEvidence,
        verificationEvidence: verificationText ? [verificationText] : [],
      },
      status: observeSucceeded ? 'success' : 'failed',
      summaryLines: [
        'Call: observe_windows_and_apps',
        `Installed: ${result?.installedCount ?? installedApps.length}`,
        `Taskbar pinned: ${result?.taskbarPinnedCount ?? taskbarPinnedApps.length}`,
        `Running windows: ${runningWindowCount}`,
        `Distinct processes: ${runningProcessCount}`,
        coldStartFallback.usedFallback ? 'Fallback: last-good window/app snapshot' : '',
        active?.processName ? `Active: ${active.processName}` : '',
      ].filter(Boolean),
      title: '执行回执',
      toolName: 'observe_windows_and_apps',
      verification: observeSucceeded
        ? 'Observed current app/window/taskbar/display state through Electron main process services.'
        : result?.error ?? null,
    },
    responseText: observeSucceeded
      ? [
          `Observed apps/windows: installed=${result.installedCount ?? installedApps.length}, taskbarPinned=${result.taskbarPinnedCount ?? taskbarPinnedApps.length}, running=${runningWindowCount}.`,
          `Running windows=${runningWindowCount}; distinct processes=${runningProcessCount}.`,
          typeof enumeratedWindowCount === 'number' ? `Window enumeration candidates=${enumeratedWindowCount}; filtered=${filteredWindows.length}.` : '',
          active?.processName ? `Active window: ${active.processName}${active.title ? ` - ${active.title}` : ''}${active.displayLabel ? ` @ ${active.displayLabel}` : ''}` : '',
          runningApps.length ? `Running windows:\n${runningApps.slice(0, 12).map(formatRunningAppLine).join('\n')}` : '',
        ].filter(Boolean).join('\n')
      : `Window/app observation failed: ${result?.error || 'unknown error'}.`,
    stateSummary: {
      missingEvidence: [
        queryHasNoMatches ? `No observed app/window matched query "${result?.query}".` : '',
        !observeSucceeded ? result?.error || 'Window/app observation failed.' : '',
      ].filter(Boolean),
      observedState: observations.slice(0, 40),
      recommendedRecovery: observeSucceeded ? [] : ['tool:observe_windows_and_apps'],
      structuredEvidence,
      verificationEvidence: verificationText ? [verificationText] : [],
    },
    verification: verificationText,
  };
}
