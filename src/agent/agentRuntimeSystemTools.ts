import {
  desktopPetShellRuntime,
} from '../desktopShellRuntime';
import {
  type AgentChatCommandResult,
} from './agentChatCommand';
import {
  formatDisplayResolutionSummary,
  getDisplayLogicalPosition,
  getDisplayPhysicalPosition,
} from './displayMetrics';

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

export {
  executeInspectLocalProject,
  executeRunLocalProjectAction,
  executeRunControlledCommand,
} from './systemTools/localProjectTools';
