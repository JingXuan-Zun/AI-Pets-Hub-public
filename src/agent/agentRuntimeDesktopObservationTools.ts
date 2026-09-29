import { desktopPetShellRuntime } from '../desktopShellRuntime';
import {
  type AgentChatCommandResult,
  type AgentStructuredToolCandidateEvidence,
  type AgentStructuredToolEvidence,
  type AgentToolCallCommand,
} from './agentChatCommand';

interface DefaultAppForUriResultLike {
  appName?: string | null;
  command?: string | null;
  error?: string | null;
  executablePath?: string | null;
  ok?: boolean;
  progId?: string | null;
  uriScheme?: string | null;
}

interface RunningAppWindowLike {
  bounds?: { height?: number; width?: number; x?: number; y?: number } | null;
  displayId?: string | null;
  displayIds?: string[] | null;
  displayLabel?: string | null;
  executablePath?: string | null;
  hwnd?: number | null;
  pid?: number | null;
  processName?: string | null;
  title?: string | null;
  titles?: string[] | null;
  windowCount?: number | null;
}

interface RunningAppsResultLike {
  apps?: RunningAppWindowLike[] | null;
  count?: number | null;
  error?: string | null;
  ok?: boolean;
  query?: string | null;
}

interface ObservedLocalAppLike {
  name?: string | null;
  path?: string | null;
  shortcutTargetPath?: string | null;
  taskbarPinned?: boolean | null;
  type?: string | null;
  userDefined?: boolean | null;
}

interface ActiveWindowInfoResultLike {
  bounds?: { height?: number; width?: number; x?: number; y?: number } | null;
  displayId?: string | null;
  displayLabel?: string | null;
  error?: string | null;
  executablePath?: string | null;
  hwnd?: number | null;
  ok?: boolean;
  pid?: number | null;
  processName?: string | null;
  title?: string | null;
  visible?: boolean | null;
}

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

function attachWindowObservationFreshness(
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

interface WindowUiControlLike {
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

interface WindowUiInspectionResultLike {
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

interface DesktopPetCursorPointLike {
  coordinateSpace?: 'dip' | 'native-screen' | string;
  updatedAt?: number | null;
  x?: number | null;
  y?: number | null;
}

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

function formatRunningAppLine(app: RunningAppWindowLike, index: number) {
  const processText = app.processName || 'unknown';
  const pidText = typeof app.pid === 'number' ? ` pid=${app.pid}` : '';
  const hwndText = typeof app.hwnd === 'number' ? ` hwnd=${app.hwnd}` : '';
  const titleText = app.title
    ? ` title="${app.title}"`
    : Array.isArray(app.titles) && app.titles.length
      ? ` titles="${app.titles.slice(0, 3).join(' | ')}"`
      : '';
  const windowCountText = typeof app.windowCount === 'number' ? ` windows=${app.windowCount}` : '';
  const displayText = app.displayLabel
    ? ` display="${app.displayLabel}"`
    : Array.isArray((app as { displayIds?: string[] }).displayIds) && (app as { displayIds?: string[] }).displayIds?.length
      ? ` displays="${(app as { displayIds?: string[] }).displayIds?.slice(0, 3).join(' | ')}"`
      : '';

  return `${index + 1}. ${processText}${pidText}${hwndText}${windowCountText}${displayText}${titleText}`;
}

function formatObservedAppLine(app: ObservedLocalAppLike, index: number) {
  const tags = [
    app.type ? `type=${app.type}` : '',
    app.taskbarPinned ? 'taskbarPinned=true' : '',
    app.userDefined ? 'userDefined=true' : '',
    app.shortcutTargetPath ? `target="${app.shortcutTargetPath}"` : '',
  ].filter(Boolean).join(' ');

  return `${index + 1}. ${app.name || 'unknown'}${tags ? ` ${tags}` : ''}${app.path ? ` path="${app.path}"` : ''}`;
}

function createStructuredWindowEvidence(
  window: ActiveWindowInfoResultLike | RunningAppWindowLike | null | undefined,
): NonNullable<AgentStructuredToolEvidence['finalWindow']> | null {
  if (!window) {
    return null;
  }

  const bounds = window.bounds && typeof window.bounds === 'object'
    ? {
        height: typeof window.bounds.height === 'number' ? window.bounds.height : null,
        width: typeof window.bounds.width === 'number' ? window.bounds.width : null,
        x: typeof window.bounds.x === 'number' ? window.bounds.x : null,
        y: typeof window.bounds.y === 'number' ? window.bounds.y : null,
      }
    : null;
  const evidence = {
    bounds,
    displayId: window.displayId ?? null,
    displayLabel: window.displayLabel ?? null,
    hwnd: typeof window.hwnd === 'number' ? window.hwnd : null,
    pid: typeof window.pid === 'number' ? window.pid : null,
    processName: window.processName ?? null,
    title: window.title ?? (Array.isArray((window as RunningAppWindowLike).titles)
      ? (window as RunningAppWindowLike).titles?.[0] ?? null
      : null),
  };
  return Object.values(evidence).some(Boolean) ? evidence : null;
}

function getObserveWindowCandidateConfidence(app: RunningAppWindowLike, query: string | null | undefined) {
  if (!query?.trim()) {
    return 'medium' as const;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const text = [
    app.processName,
    app.title,
    ...(Array.isArray(app.titles) ? app.titles : []),
  ].filter(Boolean).join(' ').toLowerCase();

  return text.includes(normalizedQuery) ? 'high' as const : 'medium' as const;
}

function doesObservedWindowMatchQuery(
  window: RunningAppWindowLike | ActiveWindowInfoResultLike,
  query: string | null | undefined,
) {
  const normalizedQuery = query?.trim().toLowerCase() ?? '';
  if (!normalizedQuery) {
    return false;
  }

  return [
    window.processName,
    window.title,
    window.executablePath,
    ...(Array.isArray((window as RunningAppWindowLike).titles)
      ? (window as RunningAppWindowLike).titles
      : []),
  ]
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}

function getObservedLocalAppCandidateConfidence(app: ObservedLocalAppLike, query: string | null | undefined) {
  if (!query?.trim()) {
    return 'medium' as const;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const text = [
    app.name,
    app.path,
    app.shortcutTargetPath,
  ].filter(Boolean).join(' ').toLowerCase();

  return text.includes(normalizedQuery) ? 'high' as const : 'medium' as const;
}

function createObservedLocalAppCandidate(options: {
  app: ObservedLocalAppLike;
  index: number;
  query?: string | null;
  sourceKind: 'installed-app' | 'taskbar-pinned';
}): AgentStructuredToolCandidateEvidence | null {
  const label = options.app.name?.trim()
    || options.app.path?.trim()
    || options.app.shortcutTargetPath?.trim()
    || '';
  if (!label) {
    return null;
  }

  return {
    actions: ['launch_local_app'],
    confidence: getObservedLocalAppCandidateConfidence(options.app, options.query),
    description: formatObservedAppLine(options.app, options.index),
    label,
    relation: options.sourceKind,
    source: 'observe_windows_and_apps',
  };
}

export function createObserveWindowsAndAppsStructuredEvidence(options: {
  active: ActiveWindowInfoResultLike | null;
  installedApps?: ObservedLocalAppLike[] | null;
  query?: string | null;
  runningApps: RunningAppWindowLike[];
  taskbarPinnedApps?: ObservedLocalAppLike[] | null;
}): AgentStructuredToolEvidence | null {
  const query = options.query?.trim() ?? '';
  const matchingRunningApps = query
    ? options.runningApps.filter((app) => doesObservedWindowMatchQuery(app, query))
    : [];
  const matchedTargetWindow = matchingRunningApps.find((app) => (
    Number(app.hwnd) > 0 || Boolean(app.title?.trim())
  )) ?? matchingRunningApps[0] ?? null;
  const finalWindow = createStructuredWindowEvidence(
    query ? matchedTargetWindow : options.active,
  );
  const processPresent = query ? matchingRunningApps.length > 0 : null;
  const windowPresent = query
    ? matchingRunningApps.some((app) => Number(app.hwnd) > 0 || Boolean(app.title?.trim()))
    : null;
  const foreground = query && options.active
    ? doesObservedWindowMatchQuery(options.active, query)
    : null;
  const desktopTargetPresence: AgentStructuredToolEvidence['desktopTargetPresence'] = !query
    ? 'unknown'
    : !processPresent
      ? 'absent'
      : 'present_unreadable';
  const runningCandidates = options.runningApps
    .slice(0, 12)
    .map((app, index): AgentStructuredToolCandidateEvidence | null => {
      const window = createStructuredWindowEvidence(app);
      if (!window) {
        return null;
      }

      return {
        bounds: window.bounds
          ? {
              coordinateSpace: 'native-screen',
              height: window.bounds.height,
              source: 'observe_windows_and_apps',
              width: window.bounds.width,
              x: window.bounds.x,
              y: window.bounds.y,
            }
          : null,
        confidence: getObserveWindowCandidateConfidence(app, options.query),
        description: formatRunningAppLine(app, index),
        label: [app.processName, app.title].filter(Boolean).join(' - ') || app.processName || app.title || 'running window',
        source: 'observe_windows_and_apps',
        window,
      };
    })
    .filter((candidate): candidate is AgentStructuredToolCandidateEvidence => Boolean(candidate));
  const taskbarPinnedCandidates = (options.taskbarPinnedApps ?? [])
    .slice(0, 6)
    .map((app, index) => createObservedLocalAppCandidate({
      app,
      index,
      query: options.query,
      sourceKind: 'taskbar-pinned',
    }))
    .filter((candidate): candidate is AgentStructuredToolCandidateEvidence => Boolean(candidate));
  const installedCandidates = (options.installedApps ?? [])
    .slice(0, 6)
    .map((app, index) => createObservedLocalAppCandidate({
      app,
      index,
      query: options.query,
      sourceKind: 'installed-app',
    }))
    .filter((candidate): candidate is AgentStructuredToolCandidateEvidence => Boolean(candidate));
  const targetCandidates = [
    ...runningCandidates,
    ...taskbarPinnedCandidates,
    ...installedCandidates,
  ];
  const bestTargetCandidate = targetCandidates.find((candidate) => candidate.confidence === 'high')
    ?? targetCandidates.find((candidate) => candidate.confidence === 'medium')
    ?? targetCandidates[0]
    ?? null;
  const evidence: AgentStructuredToolEvidence = {
    appExecutionProfile: 'unknown',
    captureAvailable: null,
    desktopTargetPresence,
    finalWindow,
    foreground,
    interactionReady: null,
    processPresent,
    status: 'success',
    targetCandidates: targetCandidates.length ? targetCandidates : null,
    targetMatched: bestTargetCandidate?.label ?? finalWindow?.title ?? finalWindow?.processName ?? null,
    uiAutomationAvailable: null,
    visualReadable: null,
    windowPresent,
  };

  return evidence.finalWindow || evidence.targetCandidates?.length || evidence.targetMatched
    ? evidence
    : null;
}

export function countObservedRunningProcesses(runningApps: RunningAppWindowLike[]) {
  const processKeys = new Set<string>();
  runningApps.forEach((app) => {
    const pid = Number(app.pid);
    const processName = app.processName?.trim().toLowerCase() ?? '';
    const executablePath = app.executablePath?.trim().toLowerCase() ?? '';
    const key = Number.isFinite(pid) && pid > 0
      ? `pid:${Math.round(pid)}`
      : processName
        ? `name:${processName}`
        : executablePath
          ? `path:${executablePath}`
          : '';
    if (key) {
      processKeys.add(key);
    }
  });
  return processKeys.size;
}

function getWindowUiControlLabel(control: WindowUiControlLike) {
  return [
    control.name?.trim(),
    control.automationId?.trim() ? `id=${control.automationId.trim()}` : '',
    control.controlType?.trim() ? `type=${control.controlType.trim()}` : '',
  ].filter(Boolean).join(' ');
}

function isWindowUiControlActionable(control: WindowUiControlLike) {
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

function getWindowUiControlBounds(control: WindowUiControlLike): AgentStructuredToolCandidateEvidence['bounds'] {
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

function getWindowUiControlCenter(control: WindowUiControlLike): AgentStructuredToolCandidateEvidence['center'] {
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

function getWindowUiControlConfidence(control: WindowUiControlLike): AgentStructuredToolCandidateEvidence['confidence'] {
  const score = Number(control.matchScore);
  if (Number.isFinite(score) && score >= 78) {
    return 'high';
  }

  if (Number.isFinite(score) && score >= 45) {
    return 'medium';
  }

  return 'low';
}

function createWindowUiCandidate(
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

function createWindowUiSelectionEvidence(options: {
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

function createWindowUiLauncherVerification(options: {
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

function resolveWindowUiBestEnabledAlternateAction(options: {
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

function createWindowUiInspectionTextBlob(
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

function inferWindowUiInspectionPostActionState(options: {
  bestMatchedAction: WindowUiControlLike | null;
  controls: WindowUiControlLike[];
  matchedControls: WindowUiControlLike[];
  result: WindowUiInspectionResultLike;
}) {
  const { bestMatchedAction, controls, matchedControls, result } = options;
  const text = createWindowUiInspectionTextBlob(result, controls, matchedControls);
  const hasDisabledMatchedTarget = matchedControls.some((control) => (
    control.enabled === false
    || control.offscreen === true
  ));

  if (bestMatchedAction) {
    return null;
  }

  if (/(?:login|sign\s*in|password|account|qr\s*code|captcha|verification|verify|\u767b\u5f55|\u767b\u9646|\u8d26\u53f7|\u8d26\u6237|\u5bc6\u7801|\u626b\u7801|\u9a8c\u8bc1)/iu.test(text)) {
    return 'login_required';
  }

  if (/(?:error|failed|failure|exception|crash|\u9519\u8bef|\u5931\u8d25|\u5f02\u5e38|\u5d29\u6e83|\u62a5\u9519)/iu.test(text)) {
    return 'error';
  }

  if (/(?:permission|denied|modal|confirmation|confirm|allow|blocked|gate|\u6743\u9650|\u62d2\u7edd|\u5f39\u7a97|\u786e\u8ba4|\u5141\u8bb8|\u963b\u6b62|\u62e6\u622a)/iu.test(text)) {
    return 'blocked';
  }

  if (/(?:updating|update|download|install|patch|verifying|extracting|preparing|queued|queue|\u66f4\u65b0|\u4e0b\u8f7d|\u5b89\u88c5|\u4fee\u8865|\u8865\u4e01|\u6821\u9a8c|\u9a8c\u8bc1\u4e2d|\u89e3\u538b|\u51c6\u5907|\u6392\u961f)/iu.test(text)) {
    return 'updating';
  }

  if (/(?:loading|launching|starting|initializing|connecting|please\s*wait|progress|spinner|waiting|\u52a0\u8f7d|\u542f\u52a8\u4e2d|\u6b63\u5728\u542f\u52a8|\u521d\u59cb\u5316|\u8fde\u63a5|\u7b49\u5f85|\u8fdb\u5ea6)/iu.test(text)) {
    return 'loading';
  }

  if (hasDisabledMatchedTarget) {
    return 'blocked';
  }

  return null;
}

function createWindowUiInspectionPostActionRecovery(options: {
  postActionState: string | null;
  result: WindowUiInspectionResultLike;
}) {
  const { postActionState, result } = options;
  if (!postActionState) {
    return null;
  }

  const query = result.query?.trim()
    || result.window?.title?.trim()
    || result.window?.processName?.trim()
    || '';
  const targetText = result.targetText?.trim() || '';
  const withQuery = (args: Record<string, unknown>) => (
    query ? { ...args, query } : args
  );

  switch (postActionState) {
    case 'loading':
      return {
        nextArgs: withQuery({
          action: 'wait_and_observe',
          forceRefresh: true,
          includeVisual: true,
          waitMs: 2500,
        }),
        nextTool: 'execute_desktop_observation' as const,
        reason: 'UI Automation found the target unavailable while the window looks like it is loading or starting. Wait briefly and observe again before retrying.',
        strategy: 'wait-and-observe' as const,
      };

    case 'updating':
      return {
        nextArgs: withQuery({
          action: 'wait_and_observe',
          forceRefresh: true,
          includeVisual: true,
          waitMs: 5000,
        }),
        nextTool: 'execute_desktop_observation' as const,
        reason: 'UI Automation found update/download/install/progress evidence. Wait and observe progress instead of clicking disabled controls.',
        strategy: 'wait-and-observe' as const,
      };

    case 'error':
      return {
        nextArgs: withQuery({
          action: 'describe_elements',
          forceRefresh: true,
          question: targetText
            ? `Read visible error text and safe retry/recovery controls related to ${targetText}. Do not click anything.`
            : 'Read visible error text and safe retry/recovery controls. Do not click anything.',
          targetDescription: 'visible error text and recovery controls',
          ...(targetText ? { targetText } : {}),
        }),
        nextTool: 'locate_screen_elements' as const,
        reason: 'UI Automation text suggests an error. Read the visible error before retrying or reporting a blocker.',
        strategy: 'read-error' as const,
      };

    case 'blocked':
      return {
        nextArgs: withQuery({
          action: 'describe_elements',
          forceRefresh: true,
          question: targetText
            ? `Read why ${targetText} is unavailable: blocker, modal, permission prompt, disabled-state reason, and safe alternate controls. Do not click anything.`
            : 'Read visible blocker, modal, permission prompt, disabled-state reason, and safe alternate controls. Do not click anything.',
          targetDescription: 'visible blocker, permission prompt, modal, disabled-state reason, and alternate controls',
          ...(targetText ? { targetText } : {}),
        }),
        nextTool: 'locate_screen_elements' as const,
        reason: 'UI Automation found the requested control disabled/offscreen or blocked by a gate. Read the blocker/reason before retrying.',
        strategy: 'read-blocker' as const,
      };

    case 'login_required':
      return {
        nextArgs: withQuery({
          action: 'describe_elements',
          forceRefresh: true,
          question: [
            targetText
              ? `Read the login/account page related to ${targetText}.`
              : 'Read the visible login/account page.',
            'Find safe login continuation controls such as 登录, 快速登录, 安全登录, Sign in, Log in, Continue, Confirm, or OK when credentials appear already filled or remembered.',
            'Also report any captcha, QR-code scan, SMS code, two-factor verification, empty required input, or admin/UAC gate. Do not click anything.',
          ].join(' '),
          targetDescription: 'login continuation controls and non-automatable verification gates',
          targetText: '登录 快速登录 安全登录 Sign in Log in Continue Confirm OK',
        }),
        nextTool: 'locate_screen_elements' as const,
        reason: 'UI Automation text suggests a login/account page. Read safe login continuation controls first; only ask the user for captcha, QR scan, 2FA, empty credentials, or admin confirmation.',
        strategy: 're-locate-target' as const,
      };

    default:
      return null;
  }
}

function createFailedWindowUiInspectionStructuredEvidence(
  result: WindowUiInspectionResultLike,
): AgentStructuredToolEvidence {
  const query = result.query?.trim()
    || result.window?.title?.trim()
    || result.window?.processName?.trim()
    || '';
  const targetText = result.targetText?.trim() || '';
  const targetDescription = result.targetDescription?.trim() || '';
  const nextArgs: Record<string, unknown> = {
    action: 'describe_elements',
    forceRefresh: true,
    question: [
      'UI Automation failed or returned no usable controls. Use vision/OCR to read the current window, visible target text, primary action buttons, disabled/loading/error text, and reliable coordinates. Do not click anything.',
      targetText ? `Requested target: ${targetText}.` : '',
      targetDescription ? `Target description: ${targetDescription}.` : '',
    ].filter(Boolean).join(' '),
    targetDescription: targetDescription || 'visible target text, primary action buttons, status text, and safe coordinates',
  };
  if (query) {
    nextArgs.query = query;
    nextArgs.sourceQuery = query;
  }
  if (targetText) {
    nextArgs.targetText = targetText;
  }

  const finalWindow = createStructuredWindowEvidence(result.window);
  const processPresent = Boolean(finalWindow?.pid || finalWindow?.processName);
  const windowPresent = Boolean(finalWindow?.hwnd || finalWindow?.title);
  return {
    appExecutionProfile: 'unknown',
    captureAvailable: null,
    confidence: 'low',
    coordinateConfidence: 'low',
    desktopTargetPresence: processPresent || windowPresent ? 'present_unreadable' : 'unknown',
    finalWindow,
    foreground: null,
    interactionReady: false,
    postActionRecovery: {
      nextArgs,
      nextTool: 'locate_screen_elements',
      reason: result.error
        ? `UI Automation failed before controls could be inspected: ${result.error}`
        : 'UI Automation did not return usable controls. Fall back to visual/OCR screen element location.',
      strategy: 're-locate-target',
    },
    postActionState: 'unknown',
    relation: 'UI Automation did not provide usable control evidence; visual/OCR observation is needed before deciding the next action.',
    processPresent,
    status: 'failed',
    targetMatched: targetText || null,
    uiAutomationAvailable: false,
    visualReadable: null,
    visualActionReadiness: 'low-confidence',
    windowPresent,
  };
}

function formatWindowUiControlLine(control: WindowUiControlLike, index: number) {
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

function createWindowUiStructuredEvidence(
  result: WindowUiInspectionResultLike,
): AgentStructuredToolEvidence | null {
  const controls = Array.isArray(result.controls) ? result.controls : [];
  const matchedControls = Array.isArray(result.matchedControls) ? result.matchedControls : [];
  const actionableControls = controls
    .filter((control) => isWindowUiControlActionable(control) && getWindowUiControlCenter(control))
    .sort((first, second) => (
      Number(second.matchScore ?? 0) - Number(first.matchScore ?? 0)
      || Number(first.depth ?? 0) - Number(second.depth ?? 0)
      || Number(first.index ?? 0) - Number(second.index ?? 0)
    ));
  const targetText = result.targetText?.trim() ?? '';
  const directBestMatchedAction = actionableControls.find((control) => Number(control.matchScore ?? 0) >= 78) ?? null;
  const alternateBestMatchedAction = directBestMatchedAction
    ? null
    : resolveWindowUiBestEnabledAlternateAction({
        actionableControls,
        matchedControls,
        requireTargetAssociation: true,
        targetText,
      });
  const bestMatchedAction = directBestMatchedAction ?? alternateBestMatchedAction;
  const bestMatchedActionIsAlternate = Boolean(alternateBestMatchedAction);
  const bestMatchedActionIsNearbyAction = Boolean(
    alternateBestMatchedAction
      && !matchedControls.some((control) => control.enabled === false || control.offscreen === true),
  );
  const targetCandidates = matchedControls
    .filter((control) => getWindowUiControlCenter(control) || getWindowUiControlBounds(control))
    .slice(0, 8)
    .map((control) => createWindowUiCandidate(control, result.window));
  const rankedActionControls = [
    ...(bestMatchedAction ? [bestMatchedAction] : []),
    ...actionableControls.filter((control) => control !== bestMatchedAction),
  ];
  const actionCandidates = rankedActionControls
    .slice(0, 8)
    .map((control) => createWindowUiCandidate(control, result.window));
  const bestBounds = bestMatchedAction ? getWindowUiControlBounds(bestMatchedAction) : null;
  const bestCenter = bestMatchedAction ? getWindowUiControlCenter(bestMatchedAction) : null;
  const selectionEvidence = createWindowUiSelectionEvidence({
    matchedControls,
    result,
    targetCandidates,
  });

  if (!controls.length && !matchedControls.length) {
    return null;
  }

  const readiness: AgentStructuredToolEvidence['visualActionReadiness'] = bestMatchedAction && bestCenter
    ? 'ready'
    : targetText && targetCandidates.length > 1
      ? 'needs-target-selection'
      : targetText && targetCandidates.length === 1
        ? 'needs-primary-action'
        : targetText
          ? 'low-confidence'
          : 'not-actionable';
  const postActionState = inferWindowUiInspectionPostActionState({
    bestMatchedAction,
    controls,
    matchedControls,
    result,
  });
  const postActionRecovery = createWindowUiInspectionPostActionRecovery({
    postActionState,
    result,
  });
  const primaryAction = bestMatchedAction ? getWindowUiControlLabel(bestMatchedAction) : null;
  const relation = bestMatchedActionIsAlternate
    ? bestMatchedActionIsNearbyAction
      ? 'UI Automation matched the requested target as a non-action control and selected a nearby enabled primary action control.'
      : 'UI Automation found the requested target unavailable, but selected a nearby enabled alternate action control with relevant action text.'
    : bestMatchedAction
    ? 'The target text matched an actionable UI Automation control.'
    : postActionState === 'loading' || postActionState === 'updating'
      ? 'UI Automation indicates the target is not actionable yet because the app is in a transitional state.'
      : postActionState === 'blocked'
        ? 'UI Automation indicates the requested control is unavailable or blocked; visible reason should be read before retrying.'
        : targetCandidates.length || actionCandidates.length
          ? 'UI Automation returned candidate controls; use visual/OCR focus crop when target/action relation is unclear.'
          : null;
  const targetMatched = bestMatchedAction
    ? (targetText || getWindowUiControlLabel(bestMatchedAction))
    : targetCandidates[0]?.label ?? null;
  const targetInteractionVerification = createWindowUiLauncherVerification({
    actionCandidates,
    currentSelection: selectionEvidence.currentSelection,
    primaryAction,
    readiness,
    relation,
    selectionVerificationStatus: selectionEvidence.selectionVerificationStatus,
    targetCandidates,
    targetMatched,
  });
  const finalWindow = createStructuredWindowEvidence(result.window);
  const processPresent = Boolean(finalWindow?.pid || finalWindow?.processName);
  const windowPresent = Boolean(finalWindow?.hwnd || finalWindow?.title);
  const interactionReady = readiness === 'ready';

  return {
    actionCandidates: actionCandidates.length ? actionCandidates : null,
    appExecutionProfile: 'unknown',
    captureAvailable: null,
    confidence: bestMatchedAction ? getWindowUiControlConfidence(bestMatchedAction) : targetCandidates.length ? 'medium' : 'low',
    coordinateConfidence: bestCenter ? 'high' : targetCandidates.length || actionCandidates.length ? 'medium' : 'low',
    currentSelection: selectionEvidence.currentSelection,
    elementBounds: bestBounds,
    elementCenter: bestCenter,
    elementDescription: bestMatchedAction ? getWindowUiControlLabel(bestMatchedAction) : null,
    desktopTargetPresence: interactionReady ? 'present_interactable' : 'present_unreadable',
    finalWindow,
    foreground: null,
    interactionReady,
    launcherVerification: targetInteractionVerification,
    primaryAction,
    postActionRecovery,
    postActionState,
    processPresent,
    relation,
    selectionEvidence: selectionEvidence.selectionEvidence.length ? selectionEvidence.selectionEvidence : null,
    selectionVerificationStatus: selectionEvidence.selectionVerificationStatus,
    status: result.ok ? 'success' : 'failed',
    targetCandidates: targetCandidates.length ? targetCandidates : null,
    targetMatched,
    targetInteractionVerification,
    uiAutomationAvailable: true,
    visibleTextCandidates: controls
      .map((control) => control.name?.trim())
      .filter((name): name is string => Boolean(name))
      .slice(0, 20),
    visualReadable: null,
    visualActionReadiness: readiness,
    windowPresent,
  };
}

export async function executeGetDefaultAppForUri(uriScheme?: string): Promise<AgentChatCommandResult> {
  const result = await desktopPetShellRuntime.getDefaultAppForUri({
    uriScheme: uriScheme || 'https',
  }) as DefaultAppForUriResultLike;
  const scheme = result?.uriScheme || uriScheme || 'https';
  const appName = result?.appName || result?.progId || '未知默认应用';
  const observations = [
    `URI scheme: ${scheme}`,
    result?.progId ? `ProgId: ${result.progId}` : '',
    result?.appName ? `Default app: ${result.appName}` : '',
    result?.executablePath ? `Executable: ${result.executablePath}` : '',
    result?.command ? `Open command: ${result.command}` : '',
  ].filter(Boolean);

  if (result?.ok) {
    return {
      observations,
      ok: true,
      responseText: `${scheme} 的系统默认应用是 ${appName}。`,
      verification: `读取到系统 URI 关联：${scheme} -> ${appName}`,
    };
  }

  return {
    errorText: result?.error || '没有读取到系统默认应用。',
    observations,
    ok: false,
    responseText: `没有读取到 ${scheme} 的系统默认应用：${result?.error || '未知原因'}。`,
    verification: result?.error || null,
  };
}

export async function executeGetActiveWindowInfo(): Promise<AgentChatCommandResult> {
  const result = await desktopPetShellRuntime.getActiveWindowInfo() as ActiveWindowInfoResultLike;
  const observations = [
    result?.processName ? `Active process: ${result.processName}` : '',
    result?.title ? `Active title: ${result.title}` : '',
    typeof result?.pid === 'number' ? `Active pid: ${result.pid}` : '',
    typeof result?.hwnd === 'number' ? `Active hwnd: ${result.hwnd}` : '',
    result?.executablePath ? `Executable: ${result.executablePath}` : '',
    typeof result?.visible === 'boolean' ? `Visible: ${result.visible}` : '',
    result?.error ? `Error: ${result.error}` : '',
  ].filter(Boolean);
  const windowLabel = result?.title || result?.processName || '当前活动窗口';

  if (result?.ok) {
    return {
      observations,
      ok: true,
      receipt: {
        evidenceLines: observations,
        status: 'success',
        summaryLines: [
          '调用：get_active_window_info',
          `窗口：${windowLabel}`,
          result.processName ? `进程：${result.processName}` : '',
        ].filter(Boolean),
        title: '执行回执',
        toolName: 'get_active_window_info',
        verification: `已读取当前前台窗口：${windowLabel}`,
      },
      responseText: [
        `当前活动窗口：${windowLabel}`,
        result.processName ? `进程：${result.processName}` : '',
        typeof result.pid === 'number' ? `PID：${result.pid}` : '',
        result.executablePath ? `路径：${result.executablePath}` : '',
      ].filter(Boolean).join('\n'),
      verification: `当前前台窗口来自 Windows 原生窗口查询：${windowLabel}`,
    };
  }

  return {
    errorText: result?.error || '没有读取到当前活动窗口。',
    observations,
    ok: false,
    responseText: `没有成功读取当前活动窗口：${result?.error || '未知原因'}。`,
    verification: result?.error || null,
  };
}

export async function executeGetCursorPosition(): Promise<AgentChatCommandResult> {
  const point = await desktopPetShellRuntime.getCursorScreenPoint() as DesktopPetCursorPointLike | null;
  if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) {
    return {
      errorText: '没有读取到当前鼠标光标位置。',
      observations: ['Cursor point unavailable.'],
      ok: false,
      responseText: '没有成功读取当前鼠标光标位置。',
      verification: null,
    };
  }

  const x = Math.round(Number(point.x));
  const y = Math.round(Number(point.y));
  const coordinateSpace = 'dip';
  const observations = [
    `Cursor coordinate space: ${coordinateSpace}`,
    `Cursor DIP x: ${x}`,
    `Cursor DIP y: ${y}`,
    typeof point.updatedAt === 'number' ? `Updated at: ${point.updatedAt}` : '',
  ].filter(Boolean);

  return {
    observations,
    ok: true,
    receipt: {
      evidenceLines: observations,
      status: 'success',
      summaryLines: [
        '调用：get_cursor_position',
        `坐标：(${x}, ${y})`,
      ],
      title: '执行回执',
      toolName: 'get_cursor_position',
      verification: `已读取当前鼠标光标屏幕坐标：(${x}, ${y})`,
    },
    responseText: `当前鼠标光标位置：屏幕坐标 (${x}, ${y})。`,
    verification: `鼠标位置来自 Electron screen.getCursorScreenPoint()。`,
  };
}

export async function executeListRunningApps(
  query?: string,
  includeWindows?: boolean,
): Promise<AgentChatCommandResult> {
  const result = await desktopPetShellRuntime.listRunningApps({
    includeWindows,
    query,
  }) as RunningAppsResultLike;
  const apps = Array.isArray(result?.apps) ? result.apps : [];
  const visibleApps = apps.slice(0, 12);
  const observations = [
    `Running app query: ${result?.query || query || ''}`,
    `Running app count: ${result?.count ?? apps.length}`,
    ...visibleApps.map(formatRunningAppLine),
  ];
  const structuredEvidence = attachWindowObservationFreshness(createObserveWindowsAndAppsStructuredEvidence({
    active: null,
    query: result?.query ?? query,
    runningApps: apps,
  }));

  if (result?.ok) {
    return {
      observations,
      ok: true,
      receipt: {
        evidenceLines: observations,
        stateSummary: {
          observedState: observations,
          structuredEvidence,
          verificationEvidence: [`Observed ${result.count ?? apps.length} running app/window candidate(s).`],
        },
        status: 'success',
        summaryLines: [
          'Call: list_running_apps',
          `Running windows: ${result.count ?? apps.length}`,
        ],
        title: 'Running app observation',
        toolName: 'list_running_apps',
        verification: `读取到 ${result.count ?? apps.length} 个运行窗口/应用。`,
      },
      responseText: visibleApps.length
        ? `当前找到 ${result.count ?? apps.length} 个运行窗口/应用：\n${visibleApps.map(formatRunningAppLine).join('\n')}`
        : '当前没有找到匹配的运行窗口/应用。',
      stateSummary: {
        observedState: observations,
        structuredEvidence,
        verificationEvidence: [`Observed ${result.count ?? apps.length} running app/window candidate(s).`],
      },
      verification: `读取到 ${result.count ?? apps.length} 个运行窗口/应用。`,
    };
  }

  return {
    errorText: result?.error || '没有读取到运行窗口/应用列表。',
    observations,
    ok: false,
    responseText: `没有读取到运行窗口/应用列表：${result?.error || '未知原因'}。`,
    stateSummary: {
      observedState: observations,
      structuredEvidence,
      verificationEvidence: result?.error ? [result.error] : [],
    },
    verification: result?.error || null,
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

export async function executeInspectWindowUi(toolCall: AgentToolCallCommand): Promise<AgentChatCommandResult> {
  const result = await desktopPetShellRuntime.inspectWindowUi({
    hwnd: getToolNumberInput(toolCall, 'hwnd') ?? undefined,
    limit: getToolNumberInput(toolCall, 'limit') ?? undefined,
    maxDepth: getToolNumberInput(toolCall, 'maxDepth') ?? undefined,
    query: getToolStringInput(toolCall, ['query', 'target', 'name', 'title', 'processName']),
    targetDescription: getToolStringInput(toolCall, ['targetDescription', 'description', 'element']),
    targetText: getToolStringInput(toolCall, ['targetText', 'text', 'label', 'targetElement']),
  }) as WindowUiInspectionResultLike;
  const controls = Array.isArray(result?.controls) ? result.controls : [];
  const matchedControls = Array.isArray(result?.matchedControls) ? result.matchedControls : [];
  const actionableControls = controls.filter((control) => isWindowUiControlActionable(control));
  const structuredEvidence = createWindowUiStructuredEvidence(result);
  const windowLabel = result?.window?.title || result?.window?.processName || result?.query || 'target window';
  const matchedLines = matchedControls.slice(0, 8).map(formatWindowUiControlLine);
  const actionableLines = actionableControls.slice(0, 8).map(formatWindowUiControlLine);
  const sampleLines = controls.slice(0, 12).map(formatWindowUiControlLine);
  const observations = [
    `Window UI query: ${result?.query || ''}`,
    `Target text: ${result?.targetText || ''}`,
    result?.window?.processName ? `Window process: ${result.window.processName}` : '',
    result?.window?.title ? `Window title: ${result.window.title}` : '',
    typeof result?.window?.hwnd === 'number' ? `Window hwnd: ${result.window.hwnd}` : '',
    `UI Automation controls: ${result?.controlCount ?? controls.length}`,
    matchedLines.length ? `Matched controls:\n${matchedLines.join('\n')}` : '',
    actionableLines.length ? `Actionable controls:\n${actionableLines.join('\n')}` : '',
    sampleLines.length ? `Control sample:\n${sampleLines.join('\n')}` : '',
    result?.error ? `Error: ${result.error}` : '',
  ].filter(Boolean);

  if (result?.ok) {
    const postActionRecoveryLine = structuredEvidence?.postActionRecovery
      ? [
          `postActionRecoveryStrategy=${structuredEvidence.postActionRecovery.strategy}`,
          structuredEvidence.postActionRecovery.nextTool ? `nextTool=${structuredEvidence.postActionRecovery.nextTool}` : '',
          structuredEvidence.postActionRecovery.nextArgs ? `nextArgs=${JSON.stringify(structuredEvidence.postActionRecovery.nextArgs)}` : '',
          structuredEvidence.postActionRecovery.reason ? `reason=${structuredEvidence.postActionRecovery.reason}` : '',
        ].filter(Boolean).join(' | ')
      : '';
    const launcherVerificationBlocked = Boolean(
      structuredEvidence?.launcherVerification?.status
        && structuredEvidence.launcherVerification.status !== 'ready',
    );
    const missingEvidence = structuredEvidence?.visualActionReadiness === 'ready' && !launcherVerificationBlocked
      ? []
      : [
          structuredEvidence?.launcherVerification?.status && structuredEvidence.launcherVerification.status !== 'ready'
            ? `Launcher verification failed: ${structuredEvidence.launcherVerification.reason ?? structuredEvidence.launcherVerification.status}.`
            : '',
          structuredEvidence?.postActionState
            ? `UI Automation post-action state is ${structuredEvidence.postActionState}.`
            : '',
          matchedControls.length
            ? 'Target/action relation is not fully proven by UI Automation alone.'
            : 'No exact UI Automation match for the requested target text.',
        ].filter(Boolean);
    const recommendedRecovery = structuredEvidence?.visualActionReadiness === 'ready' && !launcherVerificationBlocked
      ? []
      : postActionRecoveryLine
        ? [
            structuredEvidence?.launcherVerification?.status && structuredEvidence.launcherVerification.status !== 'ready'
              ? `Recover launcher state: ${structuredEvidence.launcherVerification.reason ?? structuredEvidence.launcherVerification.status}.`
              : '',
            postActionRecoveryLine,
          ].filter(Boolean)
        : [
            'Use locate_screen_elements with focus crop around a UI Automation candidate, or ask one short clarification if multiple candidates remain ambiguous.',
          ];

    return {
      observations,
      ok: true,
      receipt: {
        evidenceLines: observations.slice(0, 40),
        status: missingEvidence.length ? 'unverified' : 'success',
        summaryLines: [
          'Call: execute_desktop_observation inspect_window_ui',
          `Window: ${windowLabel}`,
          `Controls: ${result.controlCount ?? controls.length}`,
          `Matched: ${matchedControls.length}`,
        ],
        title: 'Agent window UI inspection',
        toolName: 'execute_desktop_observation',
        verification: `Read ${result.controlCount ?? controls.length} UI Automation controls from ${windowLabel}.`,
      },
      responseText: [
        `Inspected UI controls in ${windowLabel}.`,
        `controls=${result.controlCount ?? controls.length}, matched=${matchedControls.length}, actionable=${actionableControls.length}`,
        matchedLines.length ? `Matched controls:\n${matchedLines.join('\n')}` : '',
      ].filter(Boolean).join('\n'),
      stateSummary: {
        missingEvidence,
        observedState: observations,
        recommendedRecovery,
        structuredEvidence,
        verificationEvidence: [
          `UI Automation returned ${result.controlCount ?? controls.length} controls for ${windowLabel}.`,
          matchedControls.length ? `Matched ${matchedControls.length} controls against target text.` : '',
        ].filter(Boolean),
      },
      verification: `Window UI inspection returned current control names, types, actions, and screen bounds for ${windowLabel}.`,
    };
  }

  const failedStructuredEvidence = structuredEvidence ?? createFailedWindowUiInspectionStructuredEvidence(result ?? {});
  const recovery = failedStructuredEvidence.postActionRecovery;
  const recoveryLine = recovery
    ? [
        `postActionRecoveryStrategy=${recovery.strategy}`,
        recovery.nextTool ? `nextTool=${recovery.nextTool}` : '',
        recovery.nextArgs ? `nextArgs=${JSON.stringify(recovery.nextArgs)}` : '',
        recovery.reason ? `reason=${recovery.reason}` : '',
      ].filter(Boolean).join(' | ')
    : 'Use visual snapshot or locate_screen_elements as a fallback when UI Automation is unavailable.';

  return {
    errorText: result?.error || 'Window UI inspection failed.',
    observations,
    ok: false,
    responseText: `Window UI inspection failed: ${result?.error || 'unknown error'}.`,
    stateSummary: {
      missingEvidence: [
        'Window UI Automation controls were not available.',
        'Need visual/OCR evidence for visible target text, primary action, status text, and coordinates.',
      ],
      observedState: observations,
      recommendedRecovery: [
        recoveryLine,
      ],
      structuredEvidence: failedStructuredEvidence,
      verificationEvidence: [],
    },
    verification: result?.error || null,
  };
}
