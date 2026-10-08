import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { type AgentChatCommandResult, type AgentToolCallCommand } from '../agentChatCommand';
import { type AgentRuntimeExecutorContext } from '../agentRuntimeExecutor';
import { formatCaptureSourceLine, normalizeCaptureSourceTypesInput } from './captureSourceFormatting';
import { runCancellableAgentRuntimeTask } from './visualTaskCancellation';
import { getToolBooleanInput, getToolStringInput } from './visualToolInput';

export async function executeListCaptureSources(
  runtime: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const captureSourceTypes = normalizeCaptureSourceTypesInput(
    getToolStringInput(toolCall, ['captureSourceTypes', 'sourceType', 'type']) || 'all',
  );
  const includeCaptureThumbnails = getToolBooleanInput(toolCall, 'includeCaptureThumbnails') === true;
  const captureResult = await runCancellableAgentRuntimeTask(runtime, toolCall, () => desktopPetShellRuntime.listCaptureSources({
    captureSourceTypes,
    forceRefresh: getToolBooleanInput(toolCall, 'forceRefresh') === true,
    includeCaptureThumbnails,
  }) as Promise<DesktopPetCaptureSourceLike[]>);
  if (captureResult.cancelled === true) {
    return captureResult.result;
  }

  const result = captureResult.value;
  const sources = Array.isArray(result) ? result : [];
  const visibleSources = sources.slice(0, 20);
  const sourceLines = visibleSources.map(formatCaptureSourceLine);
  const screenCount = sources.filter((source) => source.type === 'screen').length;
  const windowCount = sources.filter((source) => source.type === 'window').length;
  const observations = [
    `Capture source types: ${captureSourceTypes.join(', ')}`,
    `Capture source count: ${sources.length}`,
    `Screen sources: ${screenCount}`,
    `Window sources: ${windowCount}`,
    `Thumbnails requested: ${includeCaptureThumbnails}`,
    ...sourceLines,
  ];

  return {
    observations,
    ok: true,
    receipt: {
      evidenceLines: observations.slice(0, 30),
      status: 'success',
      summaryLines: [
        '调用：list_capture_sources',
        `捕获源：${sources.length} 个`,
        `屏幕：${screenCount}，窗口：${windowCount}`,
      ],
      title: '执行回执',
      toolName: 'list_capture_sources',
      verification: `已读取 ${sources.length} 个屏幕/窗口捕获源。`,
    },
    responseText: sourceLines.length
      ? [
        `当前可用捕获源 ${sources.length} 个（屏幕 ${screenCount}，窗口 ${windowCount}）：`,
        ...sourceLines,
      ].join('\n')
      : '当前没有读取到可用的屏幕/窗口捕获源。',
    verification: `捕获源来自 Electron desktopCapturer/Windows 窗口枚举。`,
  };
}
