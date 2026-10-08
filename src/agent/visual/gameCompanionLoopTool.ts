import { type AgentChatCommandResult, type AgentToolCallCommand } from '../agentChatCommand';
import { type AgentRuntimeExecutorContext } from '../agentRuntimeExecutor';
import { normalizeVisualSnapshotSourceTypeInput } from './captureSourceMatching';
import { createAgentRuntimeCancelledResult, runCancellableAgentRuntimeTask } from './visualTaskCancellation';
import { getToolNumberInput, getToolStringInput } from './visualToolInput';

export async function executeManageGameCompanionLoop(
  runtime: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const controller = runtime.gameCompanionLoopControllerRef?.current ?? null;
  if (!controller) {
    return {
      errorText: '游戏陪伴循环控制器还没有准备好。',
      ok: false,
      responseText: '游戏陪伴循环还没有准备好，请稍后再试。',
      verification: 'Game companion loop controller is unavailable.',
    };
  }

  const action = getToolStringInput(toolCall, ['action', 'mode', 'operation']) || 'status';
  if (action === 'stop') {
    const stopResult = await runCancellableAgentRuntimeTask(runtime, toolCall, async () => controller.stop());
    return stopResult.cancelled === true ? stopResult.result : stopResult.value;
  }

  if (action === 'status') {
    const statusResult = await runCancellableAgentRuntimeTask(runtime, toolCall, async () => controller.status());
    return statusResult.cancelled === true ? statusResult.result : statusResult.value;
  }

  if (action !== 'start') {
    return {
      errorText: `Unsupported game companion loop action: ${action}`,
      ok: false,
      responseText: '游戏陪伴循环只支持 start、stop、status。',
    };
  }

  const stopCompanionLoopOnAbort = () => {
    void controller.stop();
  };
  let removeAbortListener: (() => void) | null = null;
  if (runtime.signal) {
    if (runtime.signal.aborted) {
      return createAgentRuntimeCancelledResult(toolCall);
    }

    runtime.signal.addEventListener('abort', stopCompanionLoopOnAbort, { once: true });
    removeAbortListener = () => runtime.signal?.removeEventListener('abort', stopCompanionLoopOnAbort);
  }

  try {
    const startResult = await runCancellableAgentRuntimeTask(runtime, toolCall, async () => controller.start({
      focus: getToolStringInput(toolCall, ['focus', 'analysisFocus', 'topic']),
      gameHint: getToolStringInput(toolCall, ['gameHint', 'gameName', 'game']),
      intervalMs: getToolNumberInput(toolCall, 'intervalMs') ?? getToolNumberInput(toolCall, 'sampleEveryMs'),
      maxSamples: getToolNumberInput(toolCall, 'maxSamples'),
      minCommentIntervalMs: getToolNumberInput(toolCall, 'minCommentIntervalMs') ?? getToolNumberInput(toolCall, 'commentCooldownMs'),
      query: getToolStringInput(toolCall, ['query', 'target', 'sourceName', 'name', 'windowTitle', 'title']),
      sourceId: getToolStringInput(toolCall, ['sourceId', 'id']),
      sourceType: normalizeVisualSnapshotSourceTypeInput(
        getToolStringInput(toolCall, ['sourceType', 'captureSourceTypes', 'type']) || 'window',
      ),
    }));
    return startResult.cancelled === true ? startResult.result : startResult.value;
  } finally {
    removeAbortListener?.();
  }
}
