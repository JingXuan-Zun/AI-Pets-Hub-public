import {
  desktopPetShellRuntime,
} from '../desktopShellRuntime';
import {
  type AgentChatCommandResult,
} from './agentChatCommand';
import {
  type ActiveWindowInfoResultLike,
  type RunningAppsResultLike,
  formatRunningAppLine,
  attachWindowObservationFreshness,
  createObserveWindowsAndAppsStructuredEvidence,
} from './desktopObservation/windowAppObservation';
export {
  resolveObserveWindowsAndAppsColdStartSnapshotForTest,
  createObserveWindowsAndAppsStructuredEvidence,
  countObservedRunningProcesses,
  resolveObserveWindowsAndAppsScopes,
  executeObserveWindowsAndApps,
} from './desktopObservation/windowAppObservation';
export {
  executeInspectWindowUi,
} from './desktopObservation/windowUiInspection';

interface DefaultAppForUriResultLike {
  appName?: string | null;
  command?: string | null;
  error?: string | null;
  executablePath?: string | null;
  ok?: boolean;
  progId?: string | null;
  uriScheme?: string | null;
}

interface DesktopPetCursorPointLike {
  coordinateSpace?: 'dip' | 'native-screen' | string;
  updatedAt?: number | null;
  x?: number | null;
  y?: number | null;
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
