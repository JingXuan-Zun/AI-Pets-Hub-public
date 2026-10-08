import {
  type AgentStructuredToolCandidateEvidence,
  type AgentStructuredToolEvidence,
} from '../agentChatCommand';

export interface RunningAppWindowLike {
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

export interface RunningAppsResultLike {
  apps?: RunningAppWindowLike[] | null;
  count?: number | null;
  error?: string | null;
  ok?: boolean;
  query?: string | null;
}

export interface ObservedLocalAppLike {
  name?: string | null;
  path?: string | null;
  shortcutTargetPath?: string | null;
  taskbarPinned?: boolean | null;
  type?: string | null;
  userDefined?: boolean | null;
}

export interface ActiveWindowInfoResultLike {
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

export function formatRunningAppLine(app: RunningAppWindowLike, index: number) {
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

export function formatObservedAppLine(app: ObservedLocalAppLike, index: number) {
  const tags = [
    app.type ? `type=${app.type}` : '',
    app.taskbarPinned ? 'taskbarPinned=true' : '',
    app.userDefined ? 'userDefined=true' : '',
    app.shortcutTargetPath ? `target="${app.shortcutTargetPath}"` : '',
  ].filter(Boolean).join(' ');

  return `${index + 1}. ${app.name || 'unknown'}${tags ? ` ${tags}` : ''}${app.path ? ` path="${app.path}"` : ''}`;
}

export function createStructuredWindowEvidence(
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
