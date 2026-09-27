import { desktopPetShellRuntime } from '../desktopShellRuntime';
import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentChatFollowUpAction,
  type AgentToolCallCommand,
} from './agentChatCommand';
import { type AgentRuntimeExecutorContext } from './agentRuntimeExecutor';
import {
  formatDisplayResolutionSummary,
  getDisplayLogicalPosition,
  getDisplayPhysicalPosition,
} from './displayMetrics';

const AGENT_RUNTIME_CANCELLED_TEXT = '已终止当前 Agent 执行。';

function isAgentRuntimeCancellationRequested(runtime: AgentRuntimeExecutorContext) {
  return Boolean(runtime.signal?.aborted);
}

function createAgentRuntimeCancelledResult(target: AgentToolCallCommand | string): AgentChatCommandResult {
  const toolName = typeof target === 'string' ? target : target.name;
  return {
    errorText: AGENT_RUNTIME_CANCELLED_TEXT,
    ok: false,
    receipt: {
      evidenceLines: ['User cancelled the active Agent run before this tool could finish.'],
      status: 'blocked',
      summaryLines: [
        `tool: ${toolName}`,
        'result: cancelled by user',
      ],
      title: 'Agent run cancelled',
      toolName,
      verification: AGENT_RUNTIME_CANCELLED_TEXT,
    },
    responseText: AGENT_RUNTIME_CANCELLED_TEXT,
    verification: AGENT_RUNTIME_CANCELLED_TEXT,
  };
}

async function runCancellableAgentRuntimeTask<T>(
  runtime: AgentRuntimeExecutorContext,
  target: AgentToolCallCommand | string,
  task: Promise<T> | (() => Promise<T>),
): Promise<{ cancelled: true; result: AgentChatCommandResult } | { cancelled: false; value: T }> {
  if (isAgentRuntimeCancellationRequested(runtime)) {
    return {
      cancelled: true,
      result: createAgentRuntimeCancelledResult(target),
    };
  }

  let removeAbortListener: (() => void) | null = null;
  try {
    const taskPromise = typeof task === 'function' ? task() : task;
    const racedValue = await new Promise<T | symbol>((resolve, reject) => {
      const cancelledMarker = Symbol('agent-runtime-cancelled');
      const signal = runtime.signal;
      const handleAbort = () => resolve(cancelledMarker);

      if (signal) {
        if (signal.aborted) {
          resolve(cancelledMarker);
          return;
        }

        signal.addEventListener('abort', handleAbort, { once: true });
        removeAbortListener = () => signal.removeEventListener('abort', handleAbort);
      }

      taskPromise.then(resolve, reject);
    });

    removeAbortListener?.();
    removeAbortListener = null;

    if (typeof racedValue === 'symbol' || isAgentRuntimeCancellationRequested(runtime)) {
      return {
        cancelled: true,
        result: createAgentRuntimeCancelledResult(target),
      };
    }

    return {
      cancelled: false,
      value: racedValue,
    };
  } finally {
    removeAbortListener?.();
  }
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

function formatBytes(bytes: unknown) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) {
    return '未知';
  }

  const gib = value / 1024 / 1024 / 1024;
  return `${gib.toFixed(gib >= 10 ? 1 : 2)} GB`;
}

function formatNumber(value: unknown, fallback = 0) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function formatSystemInfoSource(source: unknown) {
  return source === 'windows-native' || source === 'windows-cim'
    ? 'Windows 原生系统信息'
    : source === 'node-os'
      ? 'Node 系统接口'
      : source === 'electron'
        ? 'Electron'
        : '';
}

function formatDisplayLine(display: DesktopPetDisplayLike, index: number) {
  const label = display.label || `屏幕 ${index + 1}`;
  const primaryText = display.isPrimary ? '主屏' : '副屏';
  const logicalPosition = getDisplayLogicalPosition(display);
  const physicalPosition = getDisplayPhysicalPosition(display);

  return `${index + 1}. ${label}（${primaryText}）：${formatDisplayResolutionSummary(display)}，物理位置 (${physicalPosition.x}, ${physicalPosition.y})，逻辑位置 (${logicalPosition.x}, ${logicalPosition.y})`;
}

function formatDisplayInfo(displays: DesktopPetDisplayLike[]) {
  if (!Array.isArray(displays) || displays.length === 0) {
    return '我没有读取到当前屏幕信息。';
  }

  return [
    `检测到 ${displays.length} 个屏幕：`,
    ...displays.map(formatDisplayLine),
  ].join('\n');
}

function createDisplayInfoReceipt(displays: DesktopPetDisplayLike[]): NonNullable<AgentChatCommandResult['receipt']> {
  if (!Array.isArray(displays) || displays.length === 0) {
    return {
      evidenceLines: ['desktopPetShellRuntime.listDisplays() 没有返回可用屏幕。'],
      status: 'unverified',
      summaryLines: [
        '调用：get_display_info',
        '结果：未读取到屏幕列表',
      ],
      title: '执行回执',
      toolName: 'get_display_info',
      verification: '没有拿到屏幕数据，不能确认当前主屏/副屏。',
    };
  }

  const evidenceLines = displays.map((display, index) => {
    const label = display.label || `屏幕 ${index + 1}`;
    const roleText = display.isPrimary ? '主屏' : '副屏';
    const physicalPosition = getDisplayPhysicalPosition(display);
    const logicalPosition = getDisplayLogicalPosition(display);

    return `${index + 1}. ${label}（${roleText}）：${formatDisplayResolutionSummary(display)}；物理位置 (${physicalPosition.x}, ${physicalPosition.y})；逻辑位置 (${logicalPosition.x}, ${logicalPosition.y})`;
  });
  const primaryDisplay = displays.find((display) => display.isPrimary) ?? displays[0];
  const primaryLabel = primaryDisplay?.label || '未知屏幕';

  return {
    evidenceLines,
    status: 'success',
    summaryLines: [
      '调用：get_display_info',
      `读取：${displays.length} 个屏幕`,
      `主屏：${primaryLabel}`,
    ],
    title: '执行回执',
    toolName: 'get_display_info',
    verification: `已通过桌面运行时读取 ${displays.length} 个屏幕；回复和回执使用同一份 listDisplays 数据。`,
  };
}

function formatGpuInfo(systemInfo: DesktopPetSystemInfoLike | null) {
  const devices = Array.isArray(systemInfo?.gpu?.devices)
    ? systemInfo?.gpu?.devices ?? []
    : [];
  const namedDevices = devices
    .map((device) => {
      const name = device.deviceString || [device.vendorId, device.deviceId].filter(Boolean).join(':');
      if (!name) {
        return '';
      }

      const adapterRamText = formatBytes(device.adapterRamBytes);
      return adapterRamText === '未知'
        ? name
        : `${name}（显存 ${adapterRamText}）`;
    })
    .filter(Boolean);

  if (namedDevices.length > 0) {
    return namedDevices.join('；');
  }

  if (systemInfo?.gpu?.error) {
    return `未能读取显卡摘要：${systemInfo.gpu.error}`;
  }

  return '未读取到显卡名称';
}

function formatSystemInfo(systemInfo: DesktopPetSystemInfoLike | null, displays?: DesktopPetDisplayLike[]) {
  if (!systemInfo) {
    return '我没有读取到当前电脑配置。请确认现在运行的是桌面版，而不是网页预览。';
  }

  const cpuModel = systemInfo.cpu?.model || '未知 CPU';
  const logicalCores = formatNumber(systemInfo.cpu?.logicalCores, 0);
  const physicalCores = formatNumber(systemInfo.cpu?.physicalCores, 0);
  const installedMemoryText = formatBytes(systemInfo.memory?.installedBytes);
  const visibleMemoryText = formatBytes(systemInfo.memory?.totalVisibleBytes || systemInfo.memory?.totalBytes);
  const freeMemoryText = formatBytes(systemInfo.memory?.freePhysicalBytes || systemInfo.memory?.freeBytes);
  const osText = [systemInfo.osCaption || systemInfo.osType, systemInfo.osVersion || systemInfo.osRelease]
    .filter(Boolean)
    .join(' ');
  const computerText = [
    systemInfo.computer?.manufacturer,
    systemInfo.computer?.model,
  ].filter(Boolean).join(' ');
  const runtimeText = [
    systemInfo.electronVersion ? `Electron ${systemInfo.electronVersion}` : '',
    systemInfo.chromeVersion ? `Chrome ${systemInfo.chromeVersion}` : '',
  ].filter(Boolean).join('，');
  const sourceText = [
    formatSystemInfoSource(systemInfo.dataSources?.native || systemInfo.cpu?.source),
  ].filter(Boolean).join('，');
  const cpuCoreText = [
    physicalCores ? `${physicalCores} 物理核心` : '',
    logicalCores ? `${logicalCores} 逻辑线程` : '',
  ].filter(Boolean).join('，');
  const memoryParts = [
    installedMemoryText !== '未知' ? `安装 ${installedMemoryText}` : '',
    visibleMemoryText !== '未知' ? `系统可见 ${visibleMemoryText}` : '',
    freeMemoryText !== '未知' ? `当前可用 ${freeMemoryText}` : '',
  ].filter(Boolean);
  const lines = [
    '我读取到的当前电脑基础信息：',
    sourceText ? `数据来源：${sourceText}` : '',
    computerText ? `设备：${computerText}` : '',
    `系统：${osText || systemInfo.platform}（${systemInfo.arch}）`,
    `CPU：${cpuModel}${cpuCoreText ? `，${cpuCoreText}` : ''}`,
    `内存：${memoryParts.length ? memoryParts.join('，') : '未知'}`,
    `显卡：${formatGpuInfo(systemInfo)}`,
    runtimeText ? `运行环境：${runtimeText}` : '',
    displays && displays.length ? '' : '',
    displays && displays.length ? formatDisplayInfo(displays) : '',
  ].filter((line) => line !== '');

  return lines.join('\n');
}

function createSystemInfoReceipt(
  systemInfo: DesktopPetSystemInfoLike | null,
  displays?: DesktopPetDisplayLike[],
): NonNullable<AgentChatCommandResult['receipt']> {
  if (!systemInfo) {
    return {
      evidenceLines: ['desktopPetShellRuntime.getSystemInfo() 没有返回系统信息。'],
      status: 'unverified',
      summaryLines: [
        '调用：get_system_info',
        '结果：未读取到电脑配置',
      ],
      title: '执行回执',
      toolName: 'get_system_info',
      verification: '没有拿到系统信息，不能确认当前电脑配置。',
    };
  }

  const cpuModel = systemInfo.cpu?.model || '未知 CPU';
  const logicalCores = formatNumber(systemInfo.cpu?.logicalCores, 0);
  const physicalCores = formatNumber(systemInfo.cpu?.physicalCores, 0);
  const installedMemoryText = formatBytes(systemInfo.memory?.installedBytes);
  const visibleMemoryText = formatBytes(systemInfo.memory?.totalVisibleBytes || systemInfo.memory?.totalBytes);
  const osText = [systemInfo.osCaption || systemInfo.osType, systemInfo.osVersion || systemInfo.osRelease]
    .filter(Boolean)
    .join(' ');
  const computerText = [
    systemInfo.computer?.manufacturer,
    systemInfo.computer?.model,
  ].filter(Boolean).join(' ');
  const sourceText = formatSystemInfoSource(systemInfo.dataSources?.native || systemInfo.cpu?.source)
    || String(systemInfo.dataSources?.native || systemInfo.cpu?.source || 'unknown');
  const displayCount = Array.isArray(displays) ? displays.length : 0;

  return {
    evidenceLines: [
      `数据来源：${sourceText}`,
      computerText ? `设备：${computerText}` : '',
      `系统：${osText || systemInfo.platform}；${systemInfo.arch}`,
      `CPU：${cpuModel}${physicalCores ? `；${physicalCores} 物理核心` : ''}${logicalCores ? `；${logicalCores} 逻辑线程` : ''}`,
      `内存：安装 ${installedMemoryText}；系统可见 ${visibleMemoryText}`,
      displayCount ? `屏幕：同时读取 ${displayCount} 个屏幕` : '',
    ].filter(Boolean),
    status: 'success',
    summaryLines: [
      '调用：get_system_info',
      `来源：${sourceText}`,
      `CPU：${cpuModel}`,
      `内存：${installedMemoryText}`,
    ],
    title: '执行回执',
    toolName: 'get_system_info',
    verification: '已通过桌面运行时读取系统信息；回复和回执使用同一份 getSystemInfo 数据。',
  };
}

export async function executeGetDisplayInfo(): Promise<AgentChatCommandResult> {
  const displays = await desktopPetShellRuntime.listDisplays();
  return {
    receipt: createDisplayInfoReceipt(displays),
    responseText: formatDisplayInfo(displays),
  };
}

export async function executeGetSystemInfo(includeDisplays = true): Promise<AgentChatCommandResult> {
  const [systemInfo, displays] = await Promise.all([
    desktopPetShellRuntime.getSystemInfo(),
    includeDisplays ? desktopPetShellRuntime.listDisplays() : Promise.resolve([]),
  ]);

  return {
    receipt: createSystemInfoReceipt(systemInfo, displays),
    responseText: formatSystemInfo(systemInfo, displays),
  };
}

function formatInlineList(values: unknown, limit = 8) {
  const items = Array.isArray(values)
    ? values.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  if (!items.length) {
    return '无';
  }

  const visibleItems = items.slice(0, limit);
  return `${visibleItems.join('、')}${items.length > visibleItems.length ? ` 等 ${items.length} 项` : ''}`;
}

function formatLocalProjectInspection(result: DesktopPetLocalProjectInspectionLike | null) {
  if (!result?.ok) {
    return `我没能分析这个本机目录：${result?.error ?? '未知错误'}。`;
  }

  const primaryType = result.primaryType?.label || '暂未识别';
  const typeReason = result.primaryType?.reason ? `（${result.primaryType.reason}）` : '';
  const actions = Array.isArray(result.suggestedActions) ? result.suggestedActions : [];
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  const readmeHints = Array.isArray(result.readmeHints) ? result.readmeHints : [];
  const directories = result.entrySummary?.directories ?? [];
  const files = result.entrySummary?.files ?? [];
  const actionLines = actions.length
    ? actions.slice(0, 8).map((action, index) => {
      const commandText = action.command ? `：${action.command}` : '';
      const cwdText = action.cwd ? `（目录：${action.cwd}）` : '';
      return `${index + 1}. ${action.label}${commandText}${cwdText}`;
    })
    : ['暂时没有推断出可直接尝试的启动方式。'];
  const readmeLines = readmeHints.length
    ? [
        '',
        'README/说明里提到的运行线索：',
        ...readmeHints.slice(0, 6).map((line) => `- ${line}`),
      ]
    : [];

  return [
    `我只读分析了：${result.rootPath || result.path || '未知路径'}`,
    `判断：${primaryType}${typeReason}`,
    `读取的关键文件：${formatInlineList(result.readFiles, 10)}`,
    `顶层目录：${formatInlineList(directories, 8)}`,
    `顶层文件：${formatInlineList(files, 10)}`,
    '',
    '可能的运行/打开方式：',
    ...actionLines,
    ...readmeLines,
    warnings.length ? '' : '',
    warnings.length ? `注意：${warnings.slice(0, 4).join('；')}` : '',
    '我还没有执行这些命令；如果你要我启动其中一个，需要你再确认。',
  ].filter((line) => line !== '').join('\n');
}

function formatLocalProjectRunResult(result: DesktopPetLocalProjectRunResultLike | null) {
  if (!result?.ok) {
    const action = result?.action;
    const actionText = action?.label || action?.command || '候选动作';
    const commandText = action?.command ? `\n动作：${action.command}` : '';
    const cwdText = action?.cwd ? `\n目录：${action.cwd}` : '';
    return `我没能启动这个项目候选动作：${result?.error ?? '未知错误'}。\n候选：${actionText}${commandText}${cwdText}`;
  }

  const action = result.action;
  const actionText = action?.label || action?.command || '候选动作';
  const selectedIndexText = typeof result.selectedActionIndex === 'number' && Number.isFinite(result.selectedActionIndex)
    ? `第 ${result.selectedActionIndex + 1} 个候选`
    : '候选动作';
  const commandText = action?.command ? `\n动作：${action.command}` : '';
  const cwdText = action?.cwd ? `\n目录：${action.cwd}` : '';
  const pidText = result.pid ? `\n进程：${result.pid}` : '';
  const execution = result.execution;
  const visibleWindowText = execution?.visibleWindow ? '\n窗口：已创建新的可见命令行窗口' : '';
  const targetText = execution?.target ? `\n目标：${execution.target}` : '';
  const observationText = execution?.observation ? `\n观察：${execution.observation}` : '';
  const verificationText = result.verification?.summary ? `\n验证：${result.verification.summary}` : '';

  return `已启动项目动作：${selectedIndexText}，${actionText}${commandText}${cwdText}${pidText}${visibleWindowText}${targetText}${observationText}${verificationText}`;
}

function createLocalProjectRunVerification(result: DesktopPetLocalProjectRunResultLike | null) {
  if (!result) {
    return null;
  }

  if (result.verification?.summary) {
    return result.verification.summary;
  }

  if (result.ok) {
    return '项目动作启动请求已返回成功，但没有额外验证信息。';
  }

  return result.error ? `项目动作启动失败：${result.error}` : null;
}

function createLocalProjectRunFollowUp(result: DesktopPetLocalProjectRunResultLike | null) {
  if (!result?.ok) {
    return '可以先重新分析项目，或选择另一个候选动作。';
  }

  if (result.verification?.confidence === 'started') {
    return '如果命令行窗口里出现报错，可以把报错贴给我，我再继续判断下一步。';
  }

  if (result.verification?.confidence === 'request-accepted') {
    return '如果目标窗口没有出现，可以告诉我现象，我再帮你换一种启动方式。';
  }

  return null;
}

function createLocalProjectRunObservations(result: DesktopPetLocalProjectRunResultLike | null) {
  return [
    result?.action?.kind ? `Project action kind: ${result.action.kind}` : '',
    result?.action?.command ? `Project action command: ${result.action.command}` : '',
    result?.execution?.cwd ? `Project action cwd: ${result.execution.cwd}` : '',
    result?.execution?.visibleWindow ? 'Visible terminal window was created.' : '',
    result?.verification?.confidence ? `Project run verification confidence: ${result.verification.confidence}` : '',
  ].filter(Boolean);
}

function createRunLocalProjectActionCommand(
  sourceText: string,
  inspection: DesktopPetLocalProjectInspectionLike,
  actionIndex: number,
): AgentChatCommand {
  return {
    capabilityId: 'local-project-inspector',
    instruction: `运行刚才分析出的第 ${actionIndex} 个候选动作`,
    kind: 'tool-call',
    sourceText,
    toolCall: {
      goal: `运行刚才分析出的第 ${actionIndex} 个候选动作`,
      input: {
        actionIndex,
        path: inspection.rootPath || inspection.path,
        question: sourceText,
      },
      name: 'run_local_project_action',
    },
  };
}

function createLocalProjectFollowUpActions(
  inspection: DesktopPetLocalProjectInspectionLike,
  limit = 4,
): AgentChatFollowUpAction[] {
  const suggestedActions = Array.isArray(inspection.suggestedActions)
    ? inspection.suggestedActions
    : [];

  return suggestedActions.slice(0, limit).map((action, index) => {
    const actionIndex = index + 1;
    const label = action.label?.trim()
      ? `运行${actionIndex}：${action.label.trim()}`
      : `运行第${actionIndex}个`;

    return {
      command: createRunLocalProjectActionCommand(
        `继续：运行第 ${actionIndex} 个候选动作`,
        inspection,
        actionIndex,
      ),
      kind: 'run-command' as const,
      label,
      requiresApproval: true,
    };
  });
}

export async function executeInspectLocalProject(
  runtime: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
  sourceText = '',
): Promise<AgentChatCommandResult> {
  const localPath = getToolStringInput(toolCall, ['path', 'projectPath', 'folderPath', 'filePath', 'query']);
  if (!localPath) {
    return {
      responseText: '要分析文件夹或程序怎么运行，需要先给我一个本机绝对路径。',
    };
  }

  const result = await desktopPetShellRuntime.inspectLocalProject({
    path: localPath,
    query: getToolStringInput(toolCall, ['question']) || sourceText,
  });
  if (result?.ok) {
    runtime.lastLocalProjectInspectionRef.current = result;
  }

  const followUpActions = result?.ok
    ? createLocalProjectFollowUpActions(result)
    : [];
  const inspectionResult = result?.ok ? result : null;

  return {
    followUp: result?.ok && followUpActions.length > 0
      ? '如果你要我继续，可以选择一个候选动作运行；也可以直接说运行第几个。'
      : undefined,
    followUpAction: followUpActions[0] ?? undefined,
    followUpActions: followUpActions.length > 0 ? followUpActions : undefined,
    observations: [
      inspectionResult?.primaryType?.id ? `Detected project type: ${inspectionResult.primaryType.id}` : '',
      inspectionResult?.readFiles?.length ? `Read key files: ${inspectionResult.readFiles.join(', ')}` : '',
      `Suggested actions: ${followUpActions.length}`,
    ].filter(Boolean),
    ok: Boolean(result?.ok),
    responseText: formatLocalProjectInspection(result),
    verification: inspectionResult
      ? `已完成只读项目分析：识别为 ${inspectionResult.primaryType?.label ?? '未知类型'}，读取关键文件 ${inspectionResult.readFiles?.length ?? 0} 个，生成候选动作 ${followUpActions.length} 个。`
      : result?.error ?? '项目分析失败',
  };
}

export async function executeRunLocalProjectAction(
  runtime: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const localPath = getToolStringInput(toolCall, ['path', 'projectPath', 'folderPath', 'filePath', 'query']);
  const actionIndex = getToolNumberInput(toolCall, 'actionIndex') ?? getToolNumberInput(toolCall, 'index');
  const fallbackInspection = runtime.lastLocalProjectInspectionRef.current;
  if (!localPath && !fallbackInspection?.ok) {
    return {
      responseText: '我还没有可复用的项目分析结果。你可以先说“帮我分析 D:\\项目 这个程序怎么运行”，再让我运行第几个候选动作。',
    };
  }

  const result = await desktopPetShellRuntime.runLocalProjectAction({
    actionIndex,
    command: getToolStringInput(toolCall, ['command']) || undefined,
    label: getToolStringInput(toolCall, ['label']) || undefined,
    path: localPath || fallbackInspection?.rootPath || fallbackInspection?.path,
  });
  if (result?.ok && result.inspection?.ok) {
    runtime.lastLocalProjectInspectionRef.current = result.inspection;
  }

  return {
    errorText: result?.ok ? null : result?.error ?? '项目候选动作启动失败',
    followUp: createLocalProjectRunFollowUp(result),
    observations: createLocalProjectRunObservations(result),
    ok: Boolean(result?.ok),
    responseText: formatLocalProjectRunResult(result),
    verification: createLocalProjectRunVerification(result),
  };
}

export async function executeRunControlledCommand(
  runtime: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const command = getToolStringInput(toolCall, ['command', 'script', 'query']);
  const rawShell = getToolStringInput(toolCall, ['shell']);
  const shell = rawShell === 'cmd' || rawShell === 'powershell' ? rawShell : undefined;
  const requestId = `agent-controlled-command-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const cancelControlledCommand = () => {
    void desktopPetShellRuntime.cancelControlledCommand({ requestId });
  };
  let removeAbortListener: (() => void) | null = null;
  if (runtime.signal) {
    if (runtime.signal.aborted) {
      return createAgentRuntimeCancelledResult(toolCall);
    }

    runtime.signal.addEventListener('abort', cancelControlledCommand, { once: true });
    removeAbortListener = () => runtime.signal?.removeEventListener('abort', cancelControlledCommand);
  }

  const controlledResult = await (async () => {
    try {
      return await runCancellableAgentRuntimeTask(runtime, toolCall, () => desktopPetShellRuntime.runControlledCommand({
        command,
        cwd: getToolStringInput(toolCall, ['cwd']) || undefined,
        requestId,
        shell,
        timeoutMs: getToolNumberInput(toolCall, 'timeoutMs') ?? undefined,
      }) as Promise<{
        blocked?: boolean;
        command?: string | null;
        cwd?: string | null;
        durationMs?: number | null;
        error?: string | null;
        exitCode?: number | null;
        ok?: boolean;
        shell?: string | null;
        stderr?: string | null;
        stdout?: string | null;
        timedOut?: boolean;
      }>);
    } finally {
      removeAbortListener?.();
    }
  })();
  if (controlledResult.cancelled === true) {
    return controlledResult.result;
  }

  const result = controlledResult.value;
  const observations = [
    `Controlled command: ${result?.command || command}`,
    result?.cwd ? `cwd: ${result.cwd}` : '',
    result?.shell ? `shell: ${result.shell}` : '',
    typeof result?.exitCode === 'number' ? `exitCode: ${result.exitCode}` : '',
    typeof result?.durationMs === 'number' ? `durationMs: ${result.durationMs}` : '',
    typeof result?.timedOut === 'boolean' ? `timedOut: ${result.timedOut}` : '',
    typeof result?.blocked === 'boolean' ? `blocked: ${result.blocked}` : '',
    result?.stdout ? `stdout:\n${result.stdout}` : '',
    result?.stderr ? `stderr:\n${result.stderr}` : '',
    result?.error ? `error: ${result.error}` : '',
  ].filter(Boolean);

  return {
    errorText: result?.ok ? null : result?.error || 'Controlled command failed.',
    observations,
    ok: Boolean(result?.ok),
    receipt: {
      evidenceLines: observations.slice(0, 12),
      status: result?.ok ? 'success' : result?.blocked ? 'blocked' : 'failed',
      summaryLines: [
        'Call: run_controlled_command',
        result?.command ? `Command: ${result.command}` : '',
        typeof result?.exitCode === 'number' ? `Exit code: ${result.exitCode}` : '',
        result?.blocked ? 'Blocked by safety policy' : '',
      ].filter(Boolean),
      title: '执行回执',
      toolName: 'run_controlled_command',
      verification: result?.ok
        ? 'Controlled command completed with exitCode 0.'
        : result?.error ?? null,
    },
    responseText: result?.ok
      ? [
          `Controlled command completed: ${result.command || command}`,
          result.stdout ? `stdout:\n${result.stdout}` : '',
          result.stderr ? `stderr:\n${result.stderr}` : '',
        ].filter(Boolean).join('\n')
      : `Controlled command failed${result?.blocked ? ' or was blocked' : ''}: ${result?.error || 'unknown error'}.`,
    verification: result?.ok
      ? `Command exitCode=${result.exitCode ?? 0}.`
      : result?.error || null,
  };
}
