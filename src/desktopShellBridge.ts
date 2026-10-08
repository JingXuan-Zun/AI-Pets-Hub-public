import type {
  DesktopPetSettingsAction,
  DesktopPetSharedState,
} from './desktopShellSharedState';
import type { RuntimeWorldPresentationIntent } from './runtime-world/runtimeWorldPresentationTypes';

const noop = () => {};
let lastSettingsOpenState: boolean | null = null;
let lastPointerPassthroughState: boolean | null = null;
let lastInteractiveRegionsSignature = '';
const HIGH_FREQUENCY_UNITY_BRIDGE_COMMAND_TYPES = new Set(['setLayout', 'setSemanticState']);
const lastUnityBridgeCommandSignatures = new Map<string, string>();

const UNITY_BRIDGE_COMMAND_SIGNATURE_KEYS: Array<keyof DesktopPetUnityBridgeCommandLike> = [
  'type',
  'petId',
  'runtimeKind',
  'modelUrl',
  'motionKey',
  'expressionKey',
  'viseme',
  'scale',
  'screenHeight',
  'screenWidth',
  'presentationMode',
  'visible',
  'viewportHeight',
  'viewportWidth',
  'viewportX',
  'viewportY',
  'dragActive',
  'dragDeltaX',
  'dragDeltaY',
  'hoverRegion',
  'lookAtX',
  'lookAtY',
];

function summarizeValue(value: unknown, depth = 0): string {
  if (value == null) {
    return String(value);
  }

  if (typeof value === 'string') {
    return value.length > 120 ? `${value.slice(0, 117)}...` : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (depth >= 1) {
      return `[${value.length} items]`;
    }

    return `[${value.slice(0, 4).map((item) => summarizeValue(item, depth + 1)).join(', ')}${value.length > 4 ? ', ...' : ''}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (depth >= 1) {
      return `{${entries.slice(0, 4).map(([key]) => key).join(', ')}${entries.length > 4 ? ', ...' : ''}}`;
    }

    return `{${entries.slice(0, 4).map(([key, item]) => `${key}: ${summarizeValue(item, depth + 1)}`).join(', ')}${entries.length > 4 ? ', ...' : ''}}`;
  }

  return typeof value;
}

function pushRuntimeLog(scope: string, message: string, details?: unknown) {
  if (!window.desktopPetShell?.desktopMode) {
    return;
  }

  window.desktopPetShell?.pushRuntimeLog?.(scope, message, details);
}

function shouldLogSettingsAction(action: DesktopPetSettingsAction | null | undefined) {
  return action?.type !== 'set-chat-input';
}

function normalizeInteractiveRegions(regions: DesktopPetInteractiveRegionLike[] | null | undefined) {
  return (Array.isArray(regions) ? regions : [])
    .map((region) => ({
      height: Math.max(1, Math.round(Number(region?.height ?? 0))),
      width: Math.max(1, Math.round(Number(region?.width ?? 0))),
      x: Math.max(0, Math.round(Number(region?.x ?? 0))),
      y: Math.max(0, Math.round(Number(region?.y ?? 0))),
    }))
    .filter((region) => (
      Number.isFinite(region.x)
      && Number.isFinite(region.y)
      && Number.isFinite(region.width)
      && Number.isFinite(region.height)
      && region.width > 0
      && region.height > 0
    ));
}

function createInteractiveRegionsSignature(regions: DesktopPetInteractiveRegionLike[]) {
  return regions
    .map((region) => `${region.x},${region.y},${region.width},${region.height}`)
    .join('|');
}

function normalizeInteractiveRegionSyncOptions(
  options: DesktopPetInteractiveRegionSyncOptionsLike | null | undefined,
) {
  const source = typeof options?.source === 'string' ? options.source.trim() : '';
  const force = Boolean(options?.force);

  return source || force
    ? { force, source }
    : undefined;
}

function createUnityBridgeCommandSignature(command: DesktopPetUnityBridgeCommandLike) {
  return UNITY_BRIDGE_COMMAND_SIGNATURE_KEYS
    .map((key) => `${key}:${String(command[key] ?? '')}`)
    .join('|');
}

function createUnityBridgeCommandSignatureKey(command: DesktopPetUnityBridgeCommandLike) {
  return `${command.petId?.trim() || 'main'}:${command.type}`;
}

function clearUnityBridgeCommandSignaturesForPet(petId?: string | null) {
  const normalizedPetId = petId?.trim() || 'main';
  Array.from(lastUnityBridgeCommandSignatures.keys())
    .filter((key) => key.startsWith(`${normalizedPetId}:`))
    .forEach((key) => {
      lastUnityBridgeCommandSignatures.delete(key);
    });
}

function isHighFrequencyUnityBridgeCommand(command: DesktopPetUnityBridgeCommandLike | null) {
  return Boolean(command && HIGH_FREQUENCY_UNITY_BRIDGE_COMMAND_TYPES.has(command.type));
}

function shouldSkipDuplicateUnityBridgeCommand(command: DesktopPetUnityBridgeCommandLike) {
  if (command.type === 'loadAvatar') {
    clearUnityBridgeCommandSignaturesForPet(command.petId);
    return false;
  }

  if (!isHighFrequencyUnityBridgeCommand(command)) {
    return false;
  }

  const signatureKey = createUnityBridgeCommandSignatureKey(command);
  const signature = createUnityBridgeCommandSignature(command);
  if (lastUnityBridgeCommandSignatures.get(signatureKey) === signature) {
    return true;
  }

  lastUnityBridgeCommandSignatures.set(signatureKey, signature);
  return false;
}

function summarizeVoiceSettings(settings: unknown) {
  if (!settings || typeof settings !== 'object') {
    return undefined;
  }

  const next = settings as Record<string, unknown>;
  return {
    ttsProvider: next.ttsProvider ?? null,
    sttProvider: next.sttProvider ?? null,
    apiTtsProtocol: next.apiTtsProtocol ?? null,
    apiSttProtocol: next.apiSttProtocol ?? null,
    browserTtsApiUrl: typeof next.browserTtsApiUrl === 'string' && next.browserTtsApiUrl
      ? 'configured'
      : 'default',
    localTtsVoiceToneStability: Number.isFinite(Number(next.localTtsVoiceToneStability))
      ? Math.min(100, Math.max(0, Math.round(Number(next.localTtsVoiceToneStability))))
      : (next.localTtsLockVoiceTone ? 100 : 0),
    localTtsRandomSeed: typeof next.localTtsRandomSeed === 'string' && next.localTtsRandomSeed.trim()
      ? next.localTtsRandomSeed.trim()
      : 'auto',
    localVoiceRuntimePath: typeof next.localVoiceRuntimePath === 'string' && next.localVoiceRuntimePath
      ? 'configured'
      : 'auto',
  };
}

export const desktopPetShellBridge = {
  isDesktopMode: () => Boolean(window.desktopPetShell?.desktopMode),
  dispatch: (action: DesktopPetSettingsAction) => {
    if (shouldLogSettingsAction(action)) {
      pushRuntimeLog('IPC', '发送 settings-action', { type: action?.type ?? 'unknown' });
    }
    window.desktopPetShell?.sendSettingsAction?.(action);
  },
  syncSharedState: (state: DesktopPetSharedState) => {
    window.desktopPetShell?.syncSharedState?.(state);
  },
  publishRuntimeWorldPresentationIntent: (intent: RuntimeWorldPresentationIntent) => {
    window.desktopPetShell?.publishRuntimeWorldPresentationIntent?.(intent);
  },
  onRuntimeWorldPresentationIntent: (
    callback: (intent: RuntimeWorldPresentationIntent | null) => void,
  ) => window.desktopPetShell?.onRuntimeWorldPresentationIntent?.((intent) => {
    callback(intent as RuntimeWorldPresentationIntent | null);
  }) ?? noop,
  openSettingsWindow: () => {
    pushRuntimeLog('IPC', '请求打开设置窗口');
    window.desktopPetShell?.openSettingsWindow?.();
  },
  closeSettingsWindow: () => {
    pushRuntimeLog('IPC', '请求关闭设置窗口');
    window.desktopPetShell?.closeSettingsWindow?.();
  },
  isSettingsWindowOpen: () => {
    pushRuntimeLog('IPC', '查询设置窗口状态');
    return window.desktopPetShell?.isSettingsWindowOpen?.() ?? Promise.resolve(false);
  },
  onSettingsWindowState: (callback: (isOpen: boolean) => void) =>
    window.desktopPetShell?.onSettingsWindowState?.((isOpen) => {
      pushRuntimeLog('事件', '收到设置窗口状态', { isOpen });
      callback(isOpen);
    }) ?? noop,
  openChatWindow: () => {
    pushRuntimeLog('IPC', '请求打开聊天窗口');
    window.desktopPetShell?.openChatWindow?.();
  },
  closeChatWindow: () => {
    pushRuntimeLog('IPC', '请求关闭聊天窗口');
    window.desktopPetShell?.closeChatWindow?.();
  },
  setAgentDesktopExecutionActive: async (active: boolean) => {
    pushRuntimeLog('IPC', '设置 Agent 桌面执行窗口状态', { active });
    await window.desktopPetShell?.setAgentDesktopExecutionActive?.(active);
  },
  setCurrentWindowBounds: (bounds: { x: number; y: number; width: number; height: number }) => {
    window.desktopPetShell?.setCurrentWindowBounds?.(bounds);
  },
  minimizeCurrentWindow: () => {
    window.desktopPetShell?.minimizeCurrentWindow?.();
  },
  toggleMaximizeCurrentWindow: () => (
    window.desktopPetShell?.toggleMaximizeCurrentWindow?.() ?? Promise.resolve(false)
  ),
  captureSourceImage: (request: { height?: number; maxSide?: number; sourceId: string; width?: number }) => (
    window.desktopPetShell?.captureSourceImage?.(request) ?? Promise.resolve({ ok: false, reason: 'unavailable' })
  ),
  captureRegionText: (request: DesktopPetScreenRegionTextRequestLike) => (
    window.desktopPetShell?.captureRegionText?.(request)
      ?? Promise.resolve<DesktopPetScreenRegionTextResultLike>({ lines: [], ok: false, reason: 'unavailable' })
  ),
  recognizeScreenText: (request: { imageDataUrl: string }) => (
    window.desktopPetShell?.recognizeScreenText?.(request)
      ?? Promise.resolve<DesktopPetScreenTextRecognitionResultLike>({ lines: [], ok: false, reason: 'unavailable' })
  ),
  isCurrentWindowMaximized: () => (
    window.desktopPetShell?.isCurrentWindowMaximized?.() ?? Promise.resolve(false)
  ),
  restoreMaximizedWindowForDrag: (request: DesktopPetWindowDragRestoreRequest) => (
    window.desktopPetShell?.restoreMaximizedWindowForDrag?.(request) ?? Promise.resolve(null)
  ),
  isChatWindowOpen: () => {
    pushRuntimeLog('IPC', '查询聊天窗口状态');
    return window.desktopPetShell?.isChatWindowOpen?.() ?? Promise.resolve(false);
  },
  onChatWindowState: (callback: (isOpen: boolean) => void) =>
    window.desktopPetShell?.onChatWindowState?.((isOpen) => {
      pushRuntimeLog('事件', '收到聊天窗口状态', { isOpen });
      callback(isOpen);
    }) ?? noop,
  onAction: (callback: (action: DesktopPetSettingsAction | null) => void) =>
    window.desktopPetShell?.onSettingsAction?.((action) => {
      const nextAction = action as DesktopPetSettingsAction | null;
      if (shouldLogSettingsAction(nextAction)) {
        pushRuntimeLog('事件', '收到 settings-action', { type: nextAction?.type ?? 'unknown' });
      }
      callback(nextAction);
    }) ?? noop,
  setSettingsOpen: (isOpen: boolean) => {
    const nextIsOpen = Boolean(isOpen);
    if (lastSettingsOpenState === nextIsOpen) {
      return;
    }

    lastSettingsOpenState = nextIsOpen;
    pushRuntimeLog('IPC', '同步设置面板开关', { isOpen });
    window.desktopPetShell?.setSettingsOpen?.(nextIsOpen);
  },
  setPointerPassthrough: (ignore: boolean) => {
    const nextIgnore = Boolean(ignore);
    if (lastPointerPassthroughState === nextIgnore) {
      return;
    }

    lastPointerPassthroughState = nextIgnore;
    window.desktopPetShell?.setPointerPassthrough?.(nextIgnore);
  },
  setInteractiveRegions: (
    regions: DesktopPetInteractiveRegionLike[] | null | undefined,
    options?: DesktopPetInteractiveRegionSyncOptionsLike | null,
  ) => {
    const normalizedRegions = normalizeInteractiveRegions(regions);
    const normalizedOptions = normalizeInteractiveRegionSyncOptions(options);
    const nextRegionSignature = createInteractiveRegionsSignature(normalizedRegions);
    const nextSignature = [
      normalizedOptions?.source ?? '',
      normalizedOptions?.force ? 'force' : 'normal',
      nextRegionSignature,
    ].join(':');
    if (
      lastInteractiveRegionsSignature === nextSignature
      && !normalizedOptions?.force
    ) {
      return;
    }

    lastInteractiveRegionsSignature = nextSignature;
    window.desktopPetShell?.setInteractiveRegions?.(normalizedRegions, normalizedOptions);
  },
  setPetDragNativeShapeActive: (active: boolean) => {
    window.desktopPetShell?.setPetDragNativeShapeActive?.(Boolean(active));
  },
  onRefreshNativeInteractiveRegions: (callback: (payload: unknown) => void) =>
    window.desktopPetShell?.onRefreshNativeInteractiveRegions?.(callback) ?? noop,
  markMainWindowReadyToShow: () => {
    window.desktopPetShell?.markMainWindowReadyToShow?.();
  },
  updateActivityRegion: (config: { displayId?: string; areaScale?: number }) => {
    pushRuntimeLog('IPC', '更新活动区域', config);
    window.desktopPetShell?.updateActivityRegion?.(config);
  },
  getDisplayEnvironment: (options?: DesktopPetDisplayEnvironmentRequestLike) => {
    pushRuntimeLog('IPC', '获取显示环境', options);
    return window.desktopPetShell?.getDisplayEnvironment?.(options) ?? Promise.resolve(null);
  },
  onDisplayEnvironmentChange: (callback: (environment: DesktopPetDisplayEnvironmentLike | null) => void) =>
    window.desktopPetShell?.onDisplayEnvironmentChange?.((environment) => {
      pushRuntimeLog('事件', '收到显示环境变化', environment ? summarizeValue(environment) : 'null');
      callback(environment);
    }) ?? noop,
  getUnityBridgeStatus: () => {
    pushRuntimeLog('IPC', '查询 Unity bridge 状态');
    return window.desktopPetShell?.getUnityBridgeStatus?.() ?? Promise.resolve(null);
  },
  sendUnityBridgeCommand: (command?: DesktopPetUnityBridgeCommandLike | null) => {
    const nextCommand = command ?? null;
    if (nextCommand && shouldSkipDuplicateUnityBridgeCommand(nextCommand)) {
      return Promise.resolve({
        connected: false,
        ok: true,
        queued: false,
        runtimeProcess: null,
      });
    }

    if (nextCommand) {
      if (!isHighFrequencyUnityBridgeCommand(nextCommand)) {
        pushRuntimeLog('IPC', '发送 Unity bridge 命令', {
          petId: nextCommand.petId ?? 'main',
          type: nextCommand.type,
        });
      }
    }
    return window.desktopPetShell?.sendUnityBridgeCommand?.(nextCommand) ?? Promise.resolve({
      connected: false,
      ok: false,
      queued: false,
      runtimeProcess: null,
    });
  },
  onUnityBridgeStatus: (callback: (status: DesktopPetUnityBridgeStatusLike | null) => void) =>
    window.desktopPetShell?.onUnityBridgeStatus?.((status) => {
      pushRuntimeLog('事件', '收到 Unity bridge 状态', status ? summarizeValue(status) : 'null');
      callback(status);
    }) ?? noop,
  onUnityBridgeEvent: (callback: (event: DesktopPetUnityBridgeEventLike | null) => void) =>
    window.desktopPetShell?.onUnityBridgeEvent?.((event) => {
      pushRuntimeLog('事件', '收到 Unity bridge 事件', event ? summarizeValue(event) : 'null');
      callback(event);
    }) ?? noop,
  listDisplays: () => {
    pushRuntimeLog('IPC', '列出显示器');
    return window.desktopPetShell?.listDisplays?.() ?? Promise.resolve([]);
  },
  getSystemInfo: () => {
    pushRuntimeLog('IPC', '读取系统信息');
    return window.desktopPetShell?.getSystemInfo?.() ?? Promise.resolve(null);
  },
  probeDeepSeekHarness: (request?: { pythonPath?: string }) => (
    window.desktopPetShell?.probeDeepSeekHarness?.(request) ?? Promise.resolve({
      available: false, error: '当前不是桌面版。', pythonVersion: null, sdkVersion: null,
    })
  ),
  checkDeepSeekHarnessUpdate: (request?: { pythonPath?: string }) => (
    window.desktopPetShell?.checkDeepSeekHarnessUpdate?.(request) ?? Promise.resolve({
      checked: false, error: '当前不是桌面版。', latestVersion: null,
    })
  ),
  prepareDeepSeekHarnessProfile: (request?: { dshHome?: string }) => (
    window.desktopPetShell?.prepareDeepSeekHarnessProfile?.(request) ?? Promise.resolve({
      error: '当前不是桌面版。', ok: false,
    })
  ),
  validateDeepSeekHarnessSetup: (request?: { dshHome?: string; model?: string; pythonPath?: string; workspace?: string }) => (
    window.desktopPetShell?.validateDeepSeekHarnessSetup?.(request) ?? Promise.resolve({ error: '当前不是桌面版。', ok: false })
  ),
  runDeepSeekHarness: (request?: Parameters<NonNullable<Window['desktopPetShell']>['runDeepSeekHarness']>[0]) => (
    window.desktopPetShell?.runDeepSeekHarness?.(request) ?? Promise.resolve({ error: '当前不是桌面版。', ok: false })
  ),
  cancelDeepSeekHarness: (request?: { requestId?: string; sessionId?: string }) => (
    window.desktopPetShell?.cancelDeepSeekHarness?.(request) ?? Promise.resolve({ cancelled: false, error: '当前不是桌面版。', ok: false })
  ),
  listCaptureSources: (request?: DesktopPetCaptureSourceListRequestLike) => {
    pushRuntimeLog('IPC', '列出捕获源', {
      forceRefresh: Boolean(request?.forceRefresh),
      includeCaptureThumbnails: Boolean(request?.includeCaptureThumbnails),
      types: Array.isArray(request?.captureSourceTypes) ? request.captureSourceTypes.join(',') : 'all',
    });
    return window.desktopPetShell?.listCaptureSources?.(request) ?? Promise.resolve([]);
  },
  listDesktopIcons: (options?: {
    coordinateSpace?: 'dip' | 'native-screen';
    forceRefresh?: boolean;
    includeFileSystemFallback?: boolean;
    includeReadOnlyPositionFallback?: boolean;
  }) => {
    pushRuntimeLog('IPC', '列出桌面图标');
    return window.desktopPetShell?.listDesktopIcons?.(options) ?? Promise.resolve([]);
  },
  moveDesktopIcon: (request: {
    coordinateSpace?: 'dip' | 'native-screen';
    iconId?: string;
    iconName?: string;
    x: number;
    y: number;
  }) => {
    pushRuntimeLog('IPC', '移动桌面图标', {
      iconId: request?.iconId ?? null,
      iconName: request?.iconName ?? null,
    });
    return window.desktopPetShell?.moveDesktopIcon?.(request) ?? Promise.resolve({
      error: '当前不是桌面版，无法移动桌面图标。',
      ok: false,
    });
  },
  launchLocalApp: (request: { forceNew?: boolean; forceRefresh?: boolean; name?: string; openMode?: 'new' | 'reuse'; query?: string }) => {
    pushRuntimeLog('IPC', '打开本机应用', {
      forceNew: Boolean(request?.forceNew || request?.openMode === 'new'),
      query: request?.query ?? request?.name ?? '',
    });
    return window.desktopPetShell?.launchLocalApp?.(request) ?? Promise.resolve({
      action: 'failed',
      app: null,
      error: '当前不是桌面版，无法打开本机应用。',
      focusedWindow: null,
      forceNew: Boolean(request?.forceNew || request?.openMode === 'new'),
      matchCount: 0,
      matches: [],
      ok: false,
      query: request?.query ?? request?.name ?? '',
      status: 'not-found',
      verification: null,
    });
  },
  getDefaultAppForUri: (request?: { protocol?: string; scheme?: string; uriScheme?: string }) => {
    pushRuntimeLog('IPC', '读取默认 URI 应用', {
      uriScheme: request?.uriScheme ?? request?.scheme ?? request?.protocol ?? 'https',
    });
    return window.desktopPetShell?.getDefaultAppForUri?.(request) ?? Promise.resolve({
      error: '当前不是桌面版，无法读取默认应用。',
      ok: false,
      uriScheme: request?.uriScheme ?? request?.scheme ?? request?.protocol ?? 'https',
    });
  },
  listRunningApps: (request?: { includeWindows?: boolean; query?: string }) => {
    pushRuntimeLog('IPC', '列出运行应用', {
      query: request?.query ?? '',
    });
    return window.desktopPetShell?.listRunningApps?.(request) ?? Promise.resolve({
      apps: [],
      count: 0,
      error: '当前不是桌面版，无法列出运行应用。',
      ok: false,
      query: request?.query ?? '',
    });
  },
  observeWindowsAndApps: (request?: {
    forceRefresh?: boolean;
    includeActiveWindow?: boolean;
    includeDisplays?: boolean;
    includeInstalledApps?: boolean;
    includeRunningApps?: boolean;
    includeTaskbarPinned?: boolean;
    limit?: number;
    query?: string;
  }) => {
    pushRuntimeLog('IPC', '观察窗口和应用', {
      query: request?.query ?? '',
    });
    return window.desktopPetShell?.observeWindowsAndApps?.(request) ?? Promise.resolve({
      activeWindow: null,
      displays: [],
      error: '当前不是桌面版，无法观察窗口和应用。',
      installedApps: [],
      installedCount: 0,
      ok: false,
      query: request?.query ?? '',
      runningApps: [],
      runningCount: 0,
      taskbarPinnedApps: [],
      taskbarPinnedCount: 0,
    });
  },
  inspectWindowUi: (request?: {
    hwnd?: number;
    limit?: number;
    maxDepth?: number;
    query?: string;
    targetDescription?: string;
    targetText?: string;
  }) => {
    pushRuntimeLog('IPC', '读取窗口 UI 控件', {
      query: request?.query ?? '',
      targetText: request?.targetText ?? '',
    });
    return window.desktopPetShell?.inspectWindowUi?.(request) ?? Promise.resolve({
      controls: [],
      error: '当前不是桌面版，无法读取窗口 UI 控件。',
      matchedControls: [],
      ok: false,
      query: request?.query ?? '',
      targetText: request?.targetText ?? '',
      window: null,
    });
  },
  invokeWindowUi: (request?: {
    automationId?: string;
    controlType?: string;
    fallbackX?: number;
    fallbackY?: number;
    hwnd?: number;
    limit?: number;
    maxDepth?: number;
    name?: string;
    query?: string;
    target?: string;
    targetDescription?: string;
    targetText?: string;
    title?: string;
    uiAction?: string;
    value?: string;
    x?: number;
    y?: number;
  }) => {
    pushRuntimeLog('IPC', '触发窗口 UI 控件', {
      automationId: request?.automationId ?? '',
      query: request?.query ?? request?.target ?? request?.title ?? '',
      targetText: request?.targetText ?? request?.name ?? '',
      uiAction: request?.uiAction ?? 'invoke',
    });
    return window.desktopPetShell?.invokeWindowUi?.(request) ?? Promise.resolve({
      candidates: [],
      control: null,
      error: '当前不是桌面版，无法触发窗口 UI 控件。',
      invoked: false,
      ok: false,
      query: request?.query ?? request?.target ?? request?.title ?? '',
      targetText: request?.targetText ?? request?.name ?? '',
      window: null,
    });
  },
  getActiveWindowInfo: () => {
    pushRuntimeLog('IPC', '读取当前活动窗口');
    return window.desktopPetShell?.getActiveWindowInfo?.() ?? Promise.resolve({
      error: '当前不是桌面版，无法读取当前活动窗口。',
      ok: false,
    });
  },
  focusWindow: (request: { hwnd?: number; name?: string; pid?: number; processName?: string; query?: string; target?: string; title?: string; windowHandle?: number }) => {
    pushRuntimeLog('IPC', '唤出已有窗口', {
      query: request?.query ?? request?.target ?? request?.title ?? request?.processName ?? request?.name ?? '',
    });
    return window.desktopPetShell?.focusWindow?.(request) ?? Promise.resolve({
      error: '当前不是桌面版，无法唤出已有窗口。',
      ok: false,
      query: request?.query ?? request?.target ?? request?.title ?? request?.processName ?? request?.name ?? '',
    });
  },
  moveWindowToDisplay: (request: {
    display?: string;
    displayId?: string;
    displayTarget?: string;
    fallbackToActiveWindow?: boolean;
    hwnd?: number;
    name?: string;
    pid?: number;
    position?: string;
    preserveSize?: boolean;
    processName?: string;
    query?: string;
    queryCandidates?: string[];
    screen?: string;
    screenTarget?: string;
    target?: string;
    targetDisplay?: string;
    targetDisplayId?: string;
    title?: string;
    windowHandle?: number;
  }) => {
    pushRuntimeLog('IPC', '移动已有窗口到屏幕', {
      query: request?.query ?? request?.target ?? request?.title ?? request?.processName ?? request?.name ?? '',
      targetDisplay: request?.targetDisplay ?? request?.displayTarget ?? request?.display ?? request?.screen ?? request?.screenTarget ?? request?.displayId ?? request?.targetDisplayId ?? '',
    });
    return window.desktopPetShell?.moveWindowToDisplay?.(request) ?? Promise.resolve({
      error: '当前不是桌面版，无法移动已有窗口。',
      moved: false,
      ok: false,
      query: request?.query ?? request?.target ?? request?.title ?? request?.processName ?? request?.name ?? '',
    });
  },
  controlWindow: (request: {
    coordinateSpace?: 'native-screen' | 'display' | string;
    display?: string;
    displayId?: string;
    displayTarget?: string;
    fallbackToActiveWindow?: boolean;
    height?: number;
    hwnd?: number;
    name?: string;
    pid?: number;
    placement?: string;
    processName?: string;
    query?: string;
    screen?: string;
    screenTarget?: string;
    snap?: string;
    snapPosition?: string;
    state?: string;
    target?: string;
    targetDisplay?: string;
    targetDisplayId?: string;
    title?: string;
    windowHandle?: number;
    windowState?: string;
    width?: number;
    x?: number;
    y?: number;
  }) => {
    pushRuntimeLog('IPC', '控制已有窗口状态/位置', {
      query: request?.query ?? request?.target ?? request?.title ?? request?.processName ?? request?.name ?? '',
      snap: request?.snap ?? request?.snapPosition ?? request?.placement ?? '',
      state: request?.windowState ?? request?.state ?? '',
    });
    return window.desktopPetShell?.controlWindow?.(request) ?? Promise.resolve({
      controlled: false,
      error: '当前不是桌面版，无法控制已有窗口。',
      ok: false,
      query: request?.query ?? request?.target ?? request?.title ?? request?.processName ?? request?.name ?? '',
    });
  },
  closeWindow: (request: { hwnd?: number; name?: string; pid?: number; processName?: string; query?: string; target?: string; title?: string; windowHandle?: number }) => {
    pushRuntimeLog('IPC', '关闭已有窗口', {
      query: request?.query ?? request?.target ?? request?.title ?? request?.processName ?? request?.name ?? '',
      pid: Number.isFinite(Number(request?.pid)) ? Number(request?.pid) : null,
    });
    return window.desktopPetShell?.closeWindow?.(request) ?? Promise.resolve({
      closed: false,
      error: '当前不是桌面版，无法关闭已有窗口。',
      ok: false,
      query: request?.query ?? request?.target ?? request?.title ?? request?.processName ?? request?.name ?? '',
    });
  },
  openResource: (request: { forceNew?: boolean; path?: string; query?: string; resourceType?: 'auto' | 'url' | 'file' | 'folder' | 'app'; site?: string; target?: string; targetUrl?: string; url?: string; website?: string }) => {
    pushRuntimeLog('IPC', '打开系统资源', {
      resourceType: request?.resourceType ?? 'auto',
      targetConfigured: Boolean(request?.target || request?.query || request?.url || request?.path || request?.website || request?.site || request?.targetUrl),
    });
    return window.desktopPetShell?.openResource?.(request) ?? Promise.resolve({
      error: '当前不是桌面版，无法打开系统资源。',
      ok: false,
      resourceType: request?.resourceType ?? 'auto',
      target: request?.target ?? request?.query ?? request?.url ?? request?.path ?? request?.website ?? request?.site ?? request?.targetUrl ?? '',
    });
  },
  executeDesktopInput: (request?: {
    action?: string;
    button?: string;
    fromX?: number;
    fromY?: number;
    hotkey?: string;
    keys?: string;
    sequence?: string;
    steps?: number;
    targetX?: number;
    targetY?: number;
    text?: string;
    toX?: number;
    toY?: number;
    value?: string;
    x?: number;
    y?: number;
  }) => {
    pushRuntimeLog('IPC', '执行桌面输入原语', {
      action: request?.action ?? '',
    });
    return window.desktopPetShell?.executeDesktopInput?.(request) ?? Promise.resolve({
      action: request?.action ?? '',
      error: '当前不是桌面版，无法执行桌面输入。',
      ok: false,
    });
  },
  runControlledCommand: (request?: {
    command?: string;
    cwd?: string;
    query?: string;
    requestId?: string;
    script?: string;
    shell?: 'powershell' | 'cmd';
    timeoutMs?: number;
  }) => {
    pushRuntimeLog('IPC', '执行受控命令', {
      commandConfigured: Boolean(request?.command || request?.script || request?.query),
      shell: request?.shell ?? 'powershell',
    });
    return window.desktopPetShell?.runControlledCommand?.(request) ?? Promise.resolve({
      blocked: false,
      error: '当前不是桌面版，无法执行受控命令。',
      ok: false,
    });
  },
  cancelControlledCommand: (request?: { requestId?: string }) => {
    pushRuntimeLog('IPC', '取消受控命令', {
      requestIdConfigured: Boolean(request?.requestId),
    });
    return window.desktopPetShell?.cancelControlledCommand?.(request) ?? Promise.resolve({
      cancelled: false,
      error: '当前不是桌面版，无法取消受控命令。',
      ok: false,
    });
  },
  listMcpTools: (request?: { serverId?: string | null }) => {
    pushRuntimeLog('IPC', '列出 MCP 工具', {
      serverId: request?.serverId ?? 'all',
    });
    return window.desktopPetShell?.listMcpTools?.(request) ?? Promise.resolve({
      ok: true,
      serverHealth: [],
      servers: [],
      tools: [],
    });
  },
  inspectMcpServer: (request?: { serverId?: string | null }) => {
    pushRuntimeLog('IPC', '诊断 MCP server', {
      serverId: request?.serverId ?? '',
    });
    return window.desktopPetShell?.inspectMcpServer?.(request) ?? Promise.resolve({
      command: '',
      commandPathExists: null,
      cwd: '',
      cwdExists: false,
      durationMs: 0,
      error: '当前不是桌面版，无法诊断 MCP server。',
      ok: false,
      serverId: request?.serverId ?? '',
      stderrSnippet: '',
      timeoutMs: 0,
      toolCount: 0,
      tools: [],
    });
  },
  preflightMcpServerEnvironment: (request?: {
    server?: {
      args?: string[];
      command?: string;
      cwd?: string;
      env?: Record<string, unknown>;
      id?: string;
    };
  }) => {
    pushRuntimeLog('IPC', 'preflight MCP server environment', {
      commandConfigured: Boolean(request?.server?.command),
      serverId: request?.server?.id ?? '',
    });
    return window.desktopPetShell?.preflightMcpServerEnvironment?.(request) ?? Promise.resolve({
      checks: [{
        detail: 'MCP environment checks require the desktop app.',
        id: 'desktop-runtime',
        label: 'Desktop runtime',
        status: 'blocked' as const,
      }],
      commandKind: 'executable' as const,
      ok: false,
      resolvedCommand: null,
      status: 'blocked' as const,
    });
  },
  callMcpTool: (request?: { arguments?: Record<string, unknown>; name?: string; requestId?: string; serverId?: string }) => {
    pushRuntimeLog('IPC', '调用 MCP 工具', {
      name: request?.name ?? '',
      requestIdConfigured: Boolean(request?.requestId),
      serverId: request?.serverId ?? '',
    });
    return window.desktopPetShell?.callMcpTool?.(request) ?? Promise.resolve({
      content: [{ text: '当前不是桌面版，无法调用外部 MCP 工具。', type: 'text' }],
      isError: true,
      structuredContent: null,
    });
  },
  cancelMcpToolCall: (request?: { requestId?: string }) => {
    pushRuntimeLog('IPC', '取消 MCP 工具调用', {
      requestIdConfigured: Boolean(request?.requestId),
    });
    return window.desktopPetShell?.cancelMcpToolCall?.(request) ?? Promise.resolve({
      cancelled: false,
      error: '当前不是桌面版，无法取消 MCP 工具调用。',
      ok: false,
      requestId: request?.requestId ?? '',
    });
  },
  getMcpSessionStatus: () => {
    pushRuntimeLog('IPC', '读取 MCP session 状态');
    return window.desktopPetShell?.getMcpSessionStatus?.() ?? Promise.resolve({
      ok: true,
      sessions: [],
    });
  },
  resetMcpSession: (request?: { serverId?: string | null }) => {
    pushRuntimeLog('IPC', '重置 MCP session', {
      serverId: request?.serverId ?? 'all',
    });
    return window.desktopPetShell?.resetMcpSession?.(request) ?? Promise.resolve({
      closedCount: 0,
      error: '当前不是桌面版，无法重置 MCP session。',
      ok: false,
      serverId: request?.serverId ?? '',
    });
  },
  listMcpHistory: (request?: { limit?: number; serverId?: string | null }) => {
    pushRuntimeLog('IPC', '读取 MCP 历史', {
      limit: request?.limit ?? null,
      serverId: request?.serverId ?? 'all',
    });
    return window.desktopPetShell?.listMcpHistory?.(request) ?? Promise.resolve({
      entries: [],
      limit: request?.limit ?? 0,
      ok: true,
      totalCount: 0,
    });
  },
  clearMcpHistory: (request?: { serverId?: string | null }) => {
    pushRuntimeLog('IPC', '清理 MCP 历史', {
      serverId: request?.serverId ?? 'all',
    });
    return window.desktopPetShell?.clearMcpHistory?.(request) ?? Promise.resolve({
      ok: false,
      removedCount: 0,
      retentionLimit: 0,
      totalCount: 0,
    });
  },
  exportMcpHistory: (request?: { limit?: number; serverId?: string | null }) => {
    pushRuntimeLog('IPC', '导出 MCP 历史', {
      limit: request?.limit ?? null,
      serverId: request?.serverId ?? 'all',
    });
    return window.desktopPetShell?.exportMcpHistory?.(request) ?? Promise.resolve({
      entryCount: 0,
      fileName: 'mcp-history.json',
      mimeType: 'application/json',
      ok: false,
      text: '',
    });
  },
  setMcpHistoryRetention: (request?: { limit?: number }) => {
    pushRuntimeLog('IPC', '设置 MCP 历史保留条数', {
      limit: request?.limit ?? null,
    });
    return window.desktopPetShell?.setMcpHistoryRetention?.(request) ?? Promise.resolve({
      ok: false,
      removedCount: 0,
      retentionLimit: request?.limit ?? 0,
      totalCount: 0,
    });
  },
  loadMcpConfig: () => {
    pushRuntimeLog('IPC', '读取 MCP 配置');
    return window.desktopPetShell?.loadMcpConfig?.() ?? Promise.resolve({
      config: { servers: [] },
      error: '当前不是桌面版，无法读取 MCP 配置。',
      exists: false,
      ok: false,
      path: '',
      rawText: '{\n  "servers": []\n}\n',
    });
  },
  saveMcpConfig: (request?: { rawText?: string }) => {
    pushRuntimeLog('IPC', '保存 MCP 配置');
    return window.desktopPetShell?.saveMcpConfig?.(request) ?? Promise.resolve({
      config: { servers: [] },
      error: '当前不是桌面版，无法保存 MCP 配置。',
      exists: false,
      ok: false,
      path: '',
      rawText: request?.rawText ?? '',
    });
  },
  getMcpSoakReadiness: (request?: { rawText?: string; reportDir?: string; rounds?: number }) => {
    pushRuntimeLog('IPC', '生成 MCP soak 预检', {
      rounds: request?.rounds ?? null,
    });
    return window.desktopPetShell?.getMcpSoakReadiness?.(request) ?? Promise.resolve({
      configPath: '',
      configPresent: false,
      generatedAt: new Date().toISOString(),
      kind: 'mcp-real-server-soak-readiness',
      reportDir: '',
      runbook: { allServers: '', indexReports: '', perServer: [] },
      servers: [],
      status: 'blocked',
      totals: {
        blockedServers: 0,
        fakeFixtureServers: 0,
        readyServers: 0,
        servers: 0,
      },
      version: 1,
    });
  },
  rememberLocalApp: (request: { alias?: string; aliases?: string[]; appPath?: string; name?: string; path?: string }) => {
    pushRuntimeLog('IPC', '记住本机应用路径', {
      alias: request?.alias ?? request?.name ?? '',
      pathConfigured: Boolean(request?.path || request?.appPath),
    });
    return window.desktopPetShell?.rememberLocalApp?.(request) ?? Promise.resolve({
      app: null,
      error: '当前不是桌面版，无法记住本机应用路径。',
      ok: false,
    });
  },
  getPathInfo: (request: { path?: string; query?: string; target?: string }) => {
    pushRuntimeLog('IPC', '读取路径信息', {
      pathConfigured: Boolean(request?.path || request?.query || request?.target),
    });
    return window.desktopPetShell?.getPathInfo?.(request) ?? Promise.resolve({
      error: '当前不是桌面版，无法读取路径信息。',
      ok: false,
      path: request?.path ?? request?.query ?? request?.target ?? '',
    });
  },
  listDirectory: (request: { folderPath?: string; includeHidden?: boolean; limit?: number; path?: string; query?: string }) => {
    pushRuntimeLog('IPC', '列出目录', {
      pathConfigured: Boolean(request?.path || request?.folderPath || request?.query),
    });
    return window.desktopPetShell?.listDirectory?.(request) ?? Promise.resolve({
      entries: [],
      error: '当前不是桌面版，无法列出目录。',
      ok: false,
      path: request?.path ?? request?.folderPath ?? request?.query ?? '',
    });
  },
  searchFiles: (request: { extension?: string; extensions?: string[] | string; folderPath?: string; includeHidden?: boolean; limit?: number; maxDepth?: number; nameQuery?: string; path?: string; pattern?: string; query?: string; rootPath?: string }) => {
    pushRuntimeLog('IPC', '搜索文件', {
      pathConfigured: Boolean(request?.path || request?.folderPath || request?.rootPath),
      queryConfigured: Boolean(request?.query || request?.nameQuery || request?.pattern),
    });
    return window.desktopPetShell?.searchFiles?.(request) ?? Promise.resolve({
      error: '当前不是桌面版，无法搜索文件。',
      matches: [],
      ok: false,
      path: request?.path ?? request?.folderPath ?? request?.rootPath ?? '',
    });
  },
  readTextFile: (request: { filePath?: string; maxBytes?: number; path?: string; query?: string }) => {
    pushRuntimeLog('IPC', '读取文本文件', {
      pathConfigured: Boolean(request?.path || request?.filePath || request?.query),
    });
    return window.desktopPetShell?.readTextFile?.(request) ?? Promise.resolve({
      error: '当前不是桌面版，无法读取文本文件。',
      ok: false,
      path: request?.path ?? request?.filePath ?? request?.query ?? '',
    });
  },
  readFileDataUrl: (request: { filePath?: string; maxBytes?: number; path?: string; query?: string }) => {
    pushRuntimeLog('IPC', '读取序列帧图片', {
      pathConfigured: Boolean(request?.path || request?.filePath || request?.query),
    });
    return window.desktopPetShell?.readFileDataUrl?.(request) ?? Promise.resolve({
      error: '当前不是桌面版，无法读取序列帧图片。',
      ok: false,
      path: request?.path ?? request?.filePath ?? request?.query ?? '',
    });
  },
  executeFileManagementAction: (request: {
    action?: string;
    destinationDirectory?: string;
    destinationPath?: string;
    dryRun?: boolean;
    fileAction?: string;
    folderName?: string;
    intendedAction?: string;
    mode?: 'execute' | 'preview';
    name?: string;
    newName?: string;
    operation?: string;
    path?: string;
    previewAction?: string;
    query?: string;
    sourcePath?: string;
    targetDirectory?: string;
    targetPath?: string;
  }) => {
    pushRuntimeLog('IPC', '执行文件管理动作', {
      action: request?.action ?? request?.fileAction ?? request?.operation ?? '',
      destinationConfigured: Boolean(request?.destinationPath || request?.targetPath || request?.destinationDirectory || request?.targetDirectory),
      dryRun: Boolean(request?.dryRun || request?.mode === 'preview'),
      sourceConfigured: Boolean(request?.sourcePath || request?.path || request?.query),
    });
    return window.desktopPetShell?.executeFileManagementAction?.(request) ?? Promise.resolve({
      error: '当前不是桌面版，无法执行文件管理动作。',
      ok: false,
      path: request?.path ?? request?.sourcePath ?? request?.query ?? '',
    });
  },
  inspectLocalProject: (request: { filePath?: string; folderPath?: string; path?: string; projectPath?: string; query?: string }) => {
    pushRuntimeLog('IPC', '分析本机项目目录', {
      pathConfigured: Boolean(request?.path || request?.folderPath || request?.projectPath || request?.filePath || request?.query),
    });
    return window.desktopPetShell?.inspectLocalProject?.(request) ?? Promise.resolve({
      error: '当前不是桌面版，无法分析本机项目目录。',
      ok: false,
    });
  },
  runLocalProjectAction: (request: { actionIndex?: number; command?: string; dryRun?: boolean; filePath?: string; folderPath?: string; label?: string; path?: string; projectPath?: string; query?: string }) => {
    pushRuntimeLog('IPC', '执行本机项目启动候选', {
      actionIndex: Number.isFinite(Number(request?.actionIndex)) ? Number(request?.actionIndex) : null,
      pathConfigured: Boolean(request?.path || request?.folderPath || request?.projectPath || request?.filePath || request?.query),
    });
    return window.desktopPetShell?.runLocalProjectAction?.(request) ?? Promise.resolve({
      error: '当前不是桌面版，无法执行本机项目启动候选。',
      ok: false,
    });
  },
  getCursorScreenPoint: () => (
    window.desktopPetShell?.getCursorScreenPoint?.() ?? Promise.resolve(null)
  ),
  listLocalVoiceAssets: (options?: { forceRefresh?: boolean }) => {
    pushRuntimeLog('IPC', options?.forceRefresh ? '强制刷新本地语音资源' : '列出本地语音资源');
    return window.desktopPetShell?.listLocalVoiceAssets?.(options) ?? Promise.resolve({
      rootPath: null,
      ttsModels: [],
      sttModels: [],
      references: [],
    });
  },
  getLocalVoiceHealth: (settings?: unknown) => {
    pushRuntimeLog('IPC', '检测本地语音环境', summarizeVoiceSettings(settings));
    return window.desktopPetShell?.getLocalVoiceHealth?.(settings) ?? Promise.resolve(null);
  },
  warmupLocalVoice: (settings?: unknown) => {
    pushRuntimeLog('IPC', '请求本地语音预热', summarizeVoiceSettings(settings));
    return window.desktopPetShell?.warmupLocalVoice?.(settings) ?? Promise.resolve(null);
  },
  installLocalVoiceDependencies: (settings?: unknown) => {
    pushRuntimeLog('IPC', '安装本地语音依赖', summarizeVoiceSettings(settings));
    return window.desktopPetShell?.installLocalVoiceDependencies?.(settings) ?? Promise.resolve(null);
  },
  getBrowserTtsHealth: (settings?: unknown) => {
    pushRuntimeLog('IPC', '检测 Edge-TTS 本地服务', summarizeVoiceSettings(settings));
    return window.desktopPetShell?.getBrowserTtsHealth?.(settings) ?? Promise.resolve(null);
  },
  startBrowserTtsService: (settings?: unknown) => {
    pushRuntimeLog('IPC', '启动 Edge-TTS 本地服务', summarizeVoiceSettings(settings));
    return window.desktopPetShell?.startBrowserTtsService?.(settings) ?? Promise.resolve(null);
  },
  installBrowserTtsDependencies: (settings?: unknown) => {
    pushRuntimeLog('IPC', '安装 Edge-TTS 依赖', summarizeVoiceSettings(settings));
    return window.desktopPetShell?.installBrowserTtsDependencies?.(settings) ?? Promise.resolve(null);
  },
  listBrowserTtsSpeakers: (settings?: unknown) => {
    pushRuntimeLog('IPC', '读取 Edge-TTS 音色列表', summarizeVoiceSettings(settings));
    return window.desktopPetShell?.listBrowserTtsSpeakers?.(settings) ?? Promise.resolve(null);
  },
  getGptSovitsHealth: (settings?: unknown) => {
    pushRuntimeLog('IPC', '检测 GPT-SoVITS 本地服务', summarizeVoiceSettings(settings));
    return window.desktopPetShell?.getGptSovitsHealth?.(settings) ?? Promise.resolve(null);
  },
  startGptSovitsService: (settings?: unknown) => {
    pushRuntimeLog('IPC', '启动 GPT-SoVITS 本地服务', summarizeVoiceSettings(settings));
    return window.desktopPetShell?.startGptSovitsService?.(settings) ?? Promise.resolve(null);
  },
  listGptSovitsModels: () => window.desktopPetShell?.listGptSovitsModels?.() ?? Promise.resolve(null),
  installGptSovitsRuntime: (settings?: unknown) => {
    pushRuntimeLog('IPC', '安装 GPT-SoVITS 运行环境', summarizeVoiceSettings(settings));
    return window.desktopPetShell?.installGptSovitsRuntime?.(settings) ?? Promise.resolve(null);
  },
  onGptSovitsInstallProgress: (callback: (progress: unknown) => void) => (
    window.desktopPetShell?.onGptSovitsInstallProgress?.(callback) ?? (() => undefined)
  ),
  getRuntimeLogs: () => window.desktopPetShell?.getRuntimeLogs?.() ?? Promise.resolve([]),
  detectBrowserSearch: (payload?: unknown) => {
    pushRuntimeLog('联网', '检测本机浏览器');
    return window.desktopPetShell?.detectBrowserSearch?.(payload) ?? Promise.resolve({
      ok: false,
      error: '当前不是桌面版，无法检测本机浏览器。',
    });
  },
  browserSearch: (payload?: unknown) => {
    pushRuntimeLog('联网', '调用本机浏览器查询');
    return window.desktopPetShell?.browserSearch?.(payload) ?? Promise.resolve({
      ok: false,
      error: '当前不是桌面版，无法调用本机浏览器。',
    });
  },
  controlBrowser: (payload?: unknown) => {
    pushRuntimeLog('联网', '控制受控浏览器');
    return window.desktopPetShell?.controlBrowser?.(payload) ?? Promise.resolve({
      ok: false,
      error: '当前不是桌面版，无法控制受控浏览器。',
    });
  },
  onRuntimeLog: (callback: (line: string) => void) =>
    window.desktopPetShell?.onRuntimeLog?.(callback) ?? noop,
  onLocalVoiceInstallProgress: (callback: (progress: unknown) => void) =>
    window.desktopPetShell?.onLocalVoiceInstallProgress?.((progress) => {
      callback(progress);
    }) ?? noop,
  onBrowserTtsInstallProgress: (callback: (progress: unknown) => void) =>
    window.desktopPetShell?.onBrowserTtsInstallProgress?.((progress) => {
      callback(progress);
    }) ?? noop,
  synthesizeLocalVoice: (payload?: unknown) => {
    const nextPayload = payload && typeof payload === 'object'
      ? payload as Record<string, unknown>
      : null;
    pushRuntimeLog('IPC', '执行本地语音合成', nextPayload ? {
      textLength: typeof nextPayload.text === 'string' ? nextPayload.text.length : 0,
      settings: summarizeVoiceSettings(nextPayload.settings),
    } : undefined);
    return window.desktopPetShell?.synthesizeLocalVoice?.(payload) ?? Promise.resolve({});
  },
  cancelLocalVoiceSynthesis: () => {
    pushRuntimeLog('IPC', '请求取消本地语音合成');
    return window.desktopPetShell?.cancelLocalVoiceSynthesis?.() ?? Promise.resolve(false);
  },
  transcribeLocalVoice: (payload?: unknown) => {
    const nextPayload = payload && typeof payload === 'object'
      ? payload as Record<string, unknown>
      : null;
    pushRuntimeLog('IPC', '执行本地语音识别', nextPayload ? {
      audioBase64Length: typeof nextPayload.audioBase64 === 'string' ? nextPayload.audioBase64.length : 0,
      settings: summarizeVoiceSettings(nextPayload.settings),
    } : undefined);
    return window.desktopPetShell?.transcribeLocalVoice?.(payload) ?? Promise.resolve({});
  },
  pickDesktopCaptureArea: () => {
    pushRuntimeLog('IPC', '请求框选桌面区域');
    return window.desktopPetShell?.pickDesktopCaptureArea?.() ?? Promise.resolve(null);
  },
  getAreaPickerContext: () => {
    pushRuntimeLog('IPC', '获取框选上下文');
    return window.desktopPetShell?.getAreaPickerContext?.() ?? Promise.resolve(null);
  },
  onAreaPickerContext: (callback: (context: DesktopPetAreaPickerContextLike | null) => void) =>
    window.desktopPetShell?.onAreaPickerContext?.((context) => {
      pushRuntimeLog('事件', '收到框选上下文', context ? summarizeValue(context) : 'null');
      callback(context);
    }) ?? noop,
  submitAreaPickerSelection: (selection: DesktopPetAreaSelectionLike | null) => {
    pushRuntimeLog('IPC', '提交框选结果', selection ? summarizeValue(selection) : 'null');
    window.desktopPetShell?.submitAreaPickerSelection?.(selection);
  },
  cancelAreaPickerSelection: () => {
    pushRuntimeLog('IPC', '取消框选');
    window.desktopPetShell?.cancelAreaPickerSelection?.();
  },
  getSharedState: () => window.desktopPetShell?.getSharedState?.() ?? Promise.resolve(null),
  onSharedState: (callback: (state: unknown) => void) =>
    window.desktopPetShell?.onSharedState?.(callback) ?? noop,
};
