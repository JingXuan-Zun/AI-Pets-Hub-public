import { desktopPetShellRuntime } from '../desktopShellRuntime';
import {
  type AgentChatCommandResult,
  type AgentChatExecutionReceipt,
  type AgentStructuredToolEvidence,
  type AgentStructuredToolWindowEvidence,
} from './agentChatCommand';

interface OpenResourceResultLike {
  action?: string | null;
  app?: { name?: string | null; path?: string | null; sourceRoot?: string | null; type?: string | null } | null;
  error?: string | null;
  forceNew?: boolean | null;
  matchCount?: number | null;
  matches?: Array<{ name?: string | null; path?: string | null; type?: string | null }> | null;
  ok?: boolean;
  query?: string | null;
  resourceType?: string | null;
  status?: string | null;
  target?: string | null;
  url?: string | null;
  verification?: {
    ok?: boolean | null;
    reason?: string | null;
    window?: AgentRuntimeWindowEvidenceLike | null;
  } | null;
  focusedWindow?: AgentRuntimeWindowEvidenceLike | null;
}

export interface AgentRuntimeWindowEvidenceLike {
  bounds?: { coordinateSpace?: string | null; height?: number | null; width?: number | null; x?: number | null; y?: number | null } | null;
  displayId?: string | null;
  displayLabel?: string | null;
  hwnd?: number | null;
  pid?: number | null;
  processName?: string | null;
  title?: string | null;
}

function formatAgentRuntimeWindowBounds(bounds: AgentRuntimeWindowEvidenceLike['bounds']) {
  if (!bounds) {
    return '';
  }

  return `${bounds.x ?? '?'}${','}${bounds.y ?? '?'} ${bounds.width ?? '?'}x${bounds.height ?? '?'}`;
}

export function createAgentRuntimeWindowEvidenceLines(
  windowInfo: AgentRuntimeWindowEvidenceLike | null | undefined,
  prefix = 'Window',
) {
  if (!windowInfo || typeof windowInfo !== 'object') {
    return [];
  }

  return [
    windowInfo.processName ? `${prefix} process: ${windowInfo.processName}` : '',
    windowInfo.title ? `${prefix} title: ${windowInfo.title}` : '',
    typeof windowInfo.pid === 'number' ? `${prefix} pid: ${windowInfo.pid}` : '',
    typeof windowInfo.hwnd === 'number' ? `${prefix} hwnd: ${windowInfo.hwnd}` : '',
    windowInfo.displayLabel ? `${prefix} display: ${windowInfo.displayLabel}` : '',
    windowInfo.displayId ? `${prefix} displayId: ${windowInfo.displayId}` : '',
    windowInfo.bounds ? `${prefix} bounds: ${formatAgentRuntimeWindowBounds(windowInfo.bounds)}` : '',
  ].filter(Boolean);
}

function getAgentRuntimeLaunchVerificationWindow(result: {
  focusedWindow?: AgentRuntimeWindowEvidenceLike | null;
  verification?: { window?: AgentRuntimeWindowEvidenceLike | null } | null;
} | null | undefined) {
  return result?.verification?.window ?? result?.focusedWindow ?? null;
}

export function createAgentStructuredWindowEvidence(
  windowInfo: AgentRuntimeWindowEvidenceLike | null | undefined,
): AgentStructuredToolWindowEvidence | null {
  if (!windowInfo || typeof windowInfo !== 'object') {
    return null;
  }

  return {
    bounds: windowInfo.bounds
      ? {
          coordinateSpace: typeof windowInfo.bounds.coordinateSpace === 'string'
            ? windowInfo.bounds.coordinateSpace
            : null,
          height: typeof windowInfo.bounds.height === 'number' ? windowInfo.bounds.height : null,
          width: typeof windowInfo.bounds.width === 'number' ? windowInfo.bounds.width : null,
          x: typeof windowInfo.bounds.x === 'number' ? windowInfo.bounds.x : null,
          y: typeof windowInfo.bounds.y === 'number' ? windowInfo.bounds.y : null,
        }
      : null,
    displayId: windowInfo.displayId ?? null,
    displayLabel: windowInfo.displayLabel ?? null,
    hwnd: typeof windowInfo.hwnd === 'number' ? windowInfo.hwnd : null,
    pid: typeof windowInfo.pid === 'number' ? windowInfo.pid : null,
    processName: windowInfo.processName ?? null,
    title: windowInfo.title ?? null,
  };
}

export function createAgentStructuredWindowEvidenceFromParts(options: {
  bounds?: { coordinateSpace?: string | null; height?: number | null; width?: number | null; x?: number | null; y?: number | null } | null;
  displayId?: string | null;
  displayLabel?: string | null;
  hwnd?: number | null;
  pid?: number | null;
  processName?: string | null;
  title?: string | null;
}): AgentStructuredToolWindowEvidence | null {
  if (
    !options.bounds
    && !options.displayId
    && !options.displayLabel
    && typeof options.hwnd !== 'number'
    && typeof options.pid !== 'number'
    && !options.processName
    && !options.title
  ) {
    return null;
  }

  return createAgentStructuredWindowEvidence(options);
}

function createAgentRuntimeLaunchEvidenceLines(result: {
  action?: string | null;
  app?: { name?: string | null; path?: string | null; sourceRoot?: string | null; type?: string | null } | null;
  forceNew?: boolean | null;
  matchCount?: number | null;
  matches?: Array<{ name?: string | null; path?: string | null; type?: string | null }> | null;
  query?: string | null;
  status?: string | null;
  verification?: { ok?: boolean | null; reason?: string | null; window?: AgentRuntimeWindowEvidenceLike | null } | null;
} | null | undefined) {
  return [
    `Launch status: ${result?.status ?? result?.action ?? 'unknown'}`,
    result?.query ? `Launch query: ${result.query}` : '',
    result?.app?.name ? `Matched app: ${result.app.name}` : '',
    result?.app?.path ? `Matched app path: ${result.app.path}` : '',
    result?.app?.type ? `Matched app type: ${result.app.type}` : '',
    result?.app?.sourceRoot ? `Matched app source: ${result.app.sourceRoot}` : '',
    `Match count: ${result?.matchCount ?? result?.matches?.length ?? 0}`,
    result?.forceNew ? 'User requested a new app instance.' : 'Agent preferred existing focused window.',
    typeof result?.verification?.ok === 'boolean' ? `Launch verification ok: ${result.verification.ok}` : '',
    result?.verification?.reason ? `Launch verification reason: ${result.verification.reason}` : '',
    ...createAgentRuntimeWindowEvidenceLines(getAgentRuntimeLaunchVerificationWindow(result), 'Focused window'),
  ].filter(Boolean);
}

export async function executeOpenResource(
  target: string,
  resourceType?: string,
  forceNew?: boolean,
): Promise<AgentChatCommandResult> {
  const result = await desktopPetShellRuntime.openResource({
    forceNew,
    resourceType: resourceType === 'url'
      || resourceType === 'file'
      || resourceType === 'folder'
      || resourceType === 'app'
      || resourceType === 'auto'
      ? resourceType
      : 'auto',
    target,
  }) as OpenResourceResultLike;
  const openedTarget = result?.url || result?.target || target;
  const displayType = result?.resourceType || resourceType || 'auto';
  const observations = [
    `Open resource target: ${target}`,
    `Resource type: ${displayType}`,
    result?.url ? `URL: ${result.url}` : '',
    result?.status ? `Status: ${result.status}` : '',
    result?.action ? `Action: ${result.action}` : '',
    result?.app?.name ? `App: ${result.app.name}` : '',
    result?.app?.path ? `App path: ${result.app.path}` : '',
    typeof result?.verification?.ok === 'boolean' ? `Launch verification ok: ${result.verification.ok}` : '',
    result?.verification?.reason ? `Launch verification reason: ${result.verification.reason}` : '',
    ...createAgentRuntimeWindowEvidenceLines(getAgentRuntimeLaunchVerificationWindow(result), 'Focused window'),
  ].filter(Boolean);
  const requestAccepted = Boolean(result?.ok) || result?.status === 'launched-unverified';
  const openResourceStatus: AgentChatExecutionReceipt['status'] = result?.status === 'launched-unverified'
    || result?.verification?.ok === false
    || displayType === 'url'
    ? 'unverified'
    : 'success';
  const structuredEvidence: AgentStructuredToolEvidence = {
    confidence: openResourceStatus === 'success' ? 'high' : 'medium',
    finalUrl: result?.url ?? null,
    finalWindow: createAgentStructuredWindowEvidence(getAgentRuntimeLaunchVerificationWindow(result)),
    status: openResourceStatus,
    targetMatched: openedTarget,
  };

  if (requestAccepted) {
    return {
      followUp: openResourceStatus === 'unverified'
        ? 'The open request was accepted, but the final app/window/page state still needs observation before claiming completion.'
        : null,
      receipt: {
        evidenceLines: observations,
        status: openResourceStatus,
        summaryLines: [
          'Call: open_resource',
          `Target: ${openedTarget}`,
          `Resource type: ${displayType}`,
          result?.status ? `Status: ${result.status}` : '',
          openResourceStatus === 'unverified'
            ? 'Result: open request accepted, final visible state unverified'
            : 'Result: open request accepted',
        ].filter(Boolean),
        title: 'Execution receipt',
        toolName: 'open_resource',
        verification: openResourceStatus === 'unverified'
          ? `Open request accepted, but final visible state was not verified: ${openedTarget}`
          : `Open request accepted: ${openedTarget}`,
        stateSummary: {
          structuredEvidence,
        },
      },
      observations,
      ok: true,
      stateSummary: {
        structuredEvidence,
      },
      responseText: `已打开：${openedTarget}。`,
      verification: `系统打开请求已接受：${openedTarget}`,
    };
  }

  return {
    errorText: result?.error || '打开资源失败。',
    observations,
    ok: false,
    responseText: `没有成功打开 ${target}：${result?.error || '未知原因'}。`,
    verification: result?.error || null,
  };
}

export async function executeAppLaunch(
  appName: string,
  forceNew?: boolean,
  forceRefresh?: boolean,
): Promise<AgentChatCommandResult> {
  const result = await desktopPetShellRuntime.launchLocalApp({
    forceNew,
    forceRefresh,
    query: appName,
  });
  const appDisplayName = result?.app?.name ?? appName;
  const launchEvidenceLines = createAgentRuntimeLaunchEvidenceLines(result);
  const focusedWindow = result?.verification?.window ?? result?.focusedWindow ?? null;
  const launchStructuredEvidence: AgentStructuredToolEvidence = {
    confidence: result?.ok ? 'high' : result?.status === 'launched-unverified' ? 'low' : 'low',
    finalWindow: createAgentStructuredWindowEvidence(focusedWindow),
    status: result?.ok ? 'success' : result?.status ?? 'failed',
    targetMatched: appDisplayName,
  };
  const windowText = focusedWindow?.processName
    ? `窗口进程：${focusedWindow.processName}${focusedWindow.title ? `，标题：${focusedWindow.title}` : ''}`
    : '';
  const verification = result?.verification
    ? result.verification.ok
      ? `${result.action === 'focused' ? '已检测并唤出已有窗口' : '启动后已检测到应用窗口'}。${windowText}`.trim()
      : `${result.action === 'launched' ? '启动请求已发出，但未检测到可聚焦窗口' : '未检测到匹配窗口'}：${result.verification.reason ?? '未知原因'}。`
    : null;

  if (result?.ok) {
    return {
      observations: launchEvidenceLines,
      ok: true,
      receipt: {
        evidenceLines: launchEvidenceLines,
        status: 'success',
        summaryLines: [
          'Call: launch_local_app',
          `Target: ${appDisplayName}`,
          `Status: ${result.status ?? result.action ?? 'unknown'}`,
          'Result: app window verified',
        ],
        title: 'Execution receipt',
        toolName: 'launch_local_app',
        verification: verification ?? `Launch verified: ${appDisplayName}`,
        stateSummary: {
          structuredEvidence: launchStructuredEvidence,
        },
      },
      stateSummary: {
        structuredEvidence: launchStructuredEvidence,
      },
      responseText: result.action === 'focused'
        ? `已唤出「${appDisplayName}」的现有窗口。`
        : `已打开「${appDisplayName}」，并检测到窗口。`,
      verification,
    };
  }

  if (result?.status === 'launched-unverified') {
    return {
      receipt: {
        evidenceLines: launchEvidenceLines,
        status: 'unverified',
        summaryLines: [
          'Call: launch_local_app',
          `Target: ${appDisplayName}`,
          `Status: ${result.status}`,
          'Result: launch request sent, window verification uncertain',
        ],
        title: 'Execution receipt',
        toolName: 'launch_local_app',
        verification: verification ?? `Launch request sent, but no focusable window was verified: ${appDisplayName}`,
        stateSummary: {
          structuredEvidence: launchStructuredEvidence,
        },
      },
      followUp: '如果应用实际没有出现在桌面上，可以让我重新查找窗口，或提供更准确的应用名称/路径让我记住。',
      observations: launchEvidenceLines,
      ok: true,
      responseText: `已向 Windows 发起打开「${appDisplayName}」的请求，但暂时没有检测到可唤出的窗口。它可能在托盘、后台启动，或启动较慢。`,
      verification,
    };
  }

  if (Array.isArray(result?.matches) && result.matches.length > 0) {
    return {
      errorText: result?.error ?? '应用启动失败',
      followUp: result.matches.length > 1
        ? `我找到了多个候选：${result.matches.slice(0, 4).map((match) => match.name).join('、')}。可以说更完整的名称，或提供应用路径让我记住。`
        : '可以换一个更完整的应用名，或者提供 exe/lnk 路径让我记住。',
      observations: [
        `Launch status: ${result?.status ?? 'launch-failed'}`,
        `Match count: ${result.matches.length}`,
      ],
      ok: false,
      responseText: `找到「${result.matches[0]?.name ?? appName}」，但打开失败：${result?.error ?? '未知错误'}。`,
      verification,
    };
  }

  return {
    errorText: `没有找到「${appName}」对应的应用快捷方式。`,
    followUp: '可以试试更完整的应用名，或者输入完整的 exe/lnk 路径让我记住。',
    observations: [
      `Launch status: ${result?.status ?? 'not-found'}`,
      `Match count: ${result?.matchCount ?? 0}`,
    ],
    ok: false,
    responseText: `没有找到「${appName}」对应的应用快捷方式。可以试试更完整的应用名，或者输入完整的 exe/lnk 路径。`,
    verification,
  };
}
