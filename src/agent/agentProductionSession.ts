import { runAgentProductionSessionImplementation } from './agentProductionSessionImplementation';
import { buildDeepSeekHarnessAgentGoal, getSelectedDeepSeekHarnessAgent } from './deepseekHarnessAgentLibrary';
import { resolveAgentProductionSessionInstruction } from './agentProductionSessionInstruction';
import { runAgentRuntime } from './runtime/agentRuntime';
import { createDeepSeekHarnessRuntimeAdapter, createNativeAgentRuntimeAdapter } from './runtime/agentRuntimeAdapterFactory';
import { runDeepSeekHarnessRendererTransport } from './runtime/deepseekHarnessRendererTransport';
import {
  createAgentRuntimeTaskTransactionState,
  transitionAgentRuntimeTaskTransaction,
  type AgentRuntimeTaskTransactionEvent,
} from './runtime/agentRuntimeTaskTransaction';
import {
  createAgentRuntimeWaitingApprovalSnapshot,
  runAgentApprovedActionLifecycle,
  runAgentTaskScopedApprovalContinuations,
  type AgentApprovalContinuationIterationContext,
} from './runtime/agentApprovalContinuationRuntime';
import { resolveAgentApprovedDispatch } from './runtime/agentApprovedDispatchResolution';
import {
  type AgentChatCommand,
  type AgentChatCommandResult,
} from './agentChatCommand';
import {
  type AgentRuntimeContinuation,
  type AgentRuntimePendingApproval,
  type AgentRuntimeProgressHandler,
  type AgentRuntimeResult,
  type AgentRuntimeToolExecutor,
} from './runtime/agentRuntimeContract';
import { type AgentExecutionPlan } from './agentOrchestrator';
import { buildAgentPermissionRoute } from './agentPermissionRouter';
import {
  type AgentProductionSessionResult,
  type RunAgentProductionSessionOptions,
} from './agentProductionSessionContract';

export * from './agentProductionSessionContract';
export { resolveAgentProductionSessionInstruction };

function isOfficeDevelopmentTask(sourceText: string, userGoal: string) {
  const text = `${sourceText} ${userGoal}`.toLocaleLowerCase();
  const officeSignals = /(?:项目|代码|源码|代码库|仓库|工程|文件|文档|日志|报错|bug|修复|修改|编辑|编写|重构|测试|构建|打包|依赖|插件|skill|mcp|git|readme|报告|表格|配置|脚本|project|code|source|document|debug|fix|build|test|dependency|plugin)/iu;
  const computerControlSignals = /(?:点击|输入|拖拽|移动窗口|整理桌面|打开应用|关闭窗口|聚焦窗口|屏幕上|鼠标|键盘|click|type|drag|move window|desktop icon|screen|mouse|keyboard|focus window)/iu;
  return officeSignals.test(text) && !computerControlSignals.test(text);
}

function isDeepSeekHarnessConfigured(settings: RunAgentProductionRuntimeOptions['settings']) {
  return Boolean(
    settings.deepseekHarnessApiKey?.trim()
      || settings.deepseekHarnessBaseUrl?.trim()
      || settings.deepseekHarnessPythonPath?.trim()
      || settings.deepseekHarnessHome?.trim()
      || settings.deepseekHarnessWorkspace?.trim(),
  );
}

export function runAgentProductionSession(
  options: RunAgentProductionSessionOptions,
): Promise<AgentProductionSessionResult> {
  return runAgentProductionSessionImplementation(options);
}

export interface RunAgentProductionRuntimeOptions extends RunAgentProductionSessionOptions {
  taskTransactionEvent?: AgentRuntimeTaskTransactionEvent | null;
}

export async function runAgentProductionRuntime(
  options: RunAgentProductionRuntimeOptions,
) {
  const {
    taskTransactionEvent = null,
    ...sessionOptions
  } = options;
  const nativeRun = (runtimeContext: import('./runtime/agentRuntimeContract').AgentRuntimeAdapterContext) => runAgentProductionSessionImplementation({
        ...sessionOptions,
        authorizeModelIteration: runtimeContext.authorizeModelIteration,
        authorizeRecovery: runtimeContext.authorizeRecovery,
        onProgress: runtimeContext.onProgress,
      });
  const harnessUserGoal = buildDeepSeekHarnessAgentGoal(
    sessionOptions.userGoal,
    getSelectedDeepSeekHarnessAgent(),
  );
  const shouldUseHarness = sessionOptions.settings.agentRuntimeProvider === 'deepseek-harness'
    || (isOfficeDevelopmentTask(sessionOptions.sourceText, sessionOptions.userGoal)
      && isDeepSeekHarnessConfigured(sessionOptions.settings));
  const adapter = shouldUseHarness
    ? createDeepSeekHarnessRuntimeAdapter({
        apiKey: sessionOptions.settings.deepseekHarnessApiKey,
        baseUrl: sessionOptions.settings.deepseekHarnessBaseUrl,
        capabilityBridgeReady: true,
        continuation: sessionOptions.continuation ?? null,
        dshHome: sessionOptions.settings.deepseekHarnessHome,
        model: sessionOptions.settings.deepseekHarnessModel,
        pythonPath: sessionOptions.settings.deepseekHarnessPythonPath,
        sourceText: sessionOptions.sourceText,
        transport: runDeepSeekHarnessRendererTransport,
        userGoal: harnessUserGoal,
        workspace: sessionOptions.settings.deepseekHarnessWorkspace,
      })
    : createNativeAgentRuntimeAdapter(nativeRun);
  return runAgentRuntime({
    adapter,
    onProgress: sessionOptions.onProgress,
    taskIdentity: {
      sourceText: sessionOptions.sourceText,
      userGoal: sessionOptions.userGoal,
    },
    taskTransaction: sessionOptions.continuation?.taskTransaction ?? null,
    taskTransactionEvent,
    cancellationSignal: sessionOptions.cancellationSignal,
  });
}

export interface CancelAgentProductionRuntimeOptions {
  continuation: AgentRuntimeContinuation;
}

export function cancelAgentProductionRuntime(
  options: CancelAgentProductionRuntimeOptions,
) {
  const { continuation } = options;
  const previous = continuation.taskTransaction
    ?? createAgentRuntimeTaskTransactionState({ taskState: continuation.taskState ?? null });
  const transition = transitionAgentRuntimeTaskTransaction({
    event: {
      sourceText: continuation.sourceText,
      type: 'cancel',
      userGoal: continuation.userGoal,
    },
    previous,
  });

  return {
    accepted: transition.accepted,
    continuation: transition.accepted
      ? {
          ...continuation,
          taskState: transition.state.taskState,
          taskTransaction: transition.state,
        }
      : continuation,
    reason: transition.reason,
  };
}

export interface RunAgentProductionApprovedActionOptions extends Omit<
  RunAgentProductionRuntimeOptions,
  'approvedToolResult' | 'continuation' | 'sourceText' | 'taskTransactionEvent' | 'userGoal'
> {
  approval: AgentRuntimePendingApproval;
  continuation: AgentRuntimeContinuation;
  executeApprovedCommand: (
    command: AgentChatCommand,
    executingResult: AgentRuntimeResult,
  ) => Promise<AgentChatCommandResult>;
}

export async function runAgentProductionApprovedAction(
  options: RunAgentProductionApprovedActionOptions,
) {
  const {
    approval,
    continuation,
    executeApprovedCommand,
    ...sessionOptions
  } = options;
  const approvedDispatch = await resolveAgentApprovedDispatch({
    command: approval.command,
    continuation,
    executeObservation: (command) => sessionOptions.toolExecutor
      ? Promise.resolve(sessionOptions.toolExecutor(command, {
          signal: sessionOptions.cancellationSignal,
        }))
      : Promise.resolve({
          errorText: 'No read-only observation executor is available for dispatch-time target resolution.',
          ok: false,
          responseText: 'No read-only observation executor is available for dispatch-time target resolution.',
        }),
  });
  const executionApproval: AgentRuntimePendingApproval = {
    ...approval,
    command: approvedDispatch.command,
    plan: approvedDispatch.plan ?? approval.plan,
    ...(approvedDispatch.continuation.taskState
      ? {
          runId: approvedDispatch.continuation.taskState.runId,
          surfaceGeneration: approvedDispatch.continuation.taskState.surface?.generation ?? null,
          surfaceId: approvedDispatch.continuation.taskState.surface?.surfaceId ?? null,
          taskId: approvedDispatch.continuation.taskState.taskId,
        }
      : {}),
  };
  if (approvedDispatch.blockedResult) {
    const routed = await runAgentProductionRuntime({
      ...sessionOptions,
      approvedToolResult: {
        command: approvedDispatch.command,
        result: approvedDispatch.blockedResult,
      },
      continuation: approvedDispatch.continuation,
      sourceText: continuation.sourceText,
      taskTransactionEvent: {
        approval: executionApproval,
        type: 'approve',
      },
      userGoal: continuation.userGoal,
    });
    return {
      ...routed,
      commandResult: approvedDispatch.blockedResult,
    };
  }
  const approvedAction = await runAgentApprovedActionLifecycle({
    command: executionApproval.command,
    execute: executeApprovedCommand,
    waitingResult: createAgentRuntimeWaitingApprovalSnapshot({
      command: executionApproval.command,
      continuation: approvedDispatch.continuation,
      plan: executionApproval.plan,
      reason: executionApproval.reason,
      routeSummary: executionApproval.routeSummary,
    }),
  });
  const routed = await runAgentProductionRuntime({
    ...sessionOptions,
    approvedToolResult: {
      command: executionApproval.command,
      result: approvedAction.commandResult,
    },
    continuation: approvedAction.runtimeResult.continuation,
    sourceText: continuation.sourceText,
    taskTransactionEvent: {
      approval: executionApproval,
      type: 'approve',
    },
    userGoal: continuation.userGoal,
  });
  return {
    ...routed,
    commandResult: approvedAction.commandResult,
  };
}

export interface RunAgentProductionApprovalContinuationsOptions {
  approvedCommand: AgentChatCommand;
  approvedPlan: AgentExecutionPlan;
  cancellationSignal?: AbortSignal | null;
  createSkippedResult: (command: AgentChatCommand) => AgentChatCommandResult;
  executeApprovedCommand: (command: AgentChatCommand) => Promise<AgentChatCommandResult>;
  initialPendingApproval?: AgentRuntimePendingApproval | null;
  initialResult: AgentRuntimeResult;
  isCancelled?: (() => boolean) | null;
  maxContinuations?: number | null;
  onIteration?: ((context: AgentApprovalContinuationIterationContext & { skipped: boolean }) => void) | null;
  onProgress?: AgentRuntimeProgressHandler | null;
  personaBehaviorContract?: string;
  settings: RunAgentProductionSessionOptions['settings'];
  toolExecutor?: AgentRuntimeToolExecutor;
}

export function runAgentProductionApprovalContinuations(
  options: RunAgentProductionApprovalContinuationsOptions,
) {
  return runAgentTaskScopedApprovalContinuations({
    approvedCommand: options.approvedCommand,
    approvedPlan: options.approvedPlan,
    createSkippedResult: options.createSkippedResult,
    execute: (command) => options.executeApprovedCommand(command),
    initialPendingApproval: options.initialPendingApproval,
    initialResult: options.initialResult,
    isCancelled: options.isCancelled,
    maxContinuations: options.maxContinuations,
    onIteration: options.onIteration,
    resolveApprovedDispatch: (command, continuation) => resolveAgentApprovedDispatch({
      command,
      continuation,
      executeObservation: (observationCommand) => options.toolExecutor
        ? Promise.resolve(options.toolExecutor(observationCommand, {
            signal: options.cancellationSignal,
          }))
        : Promise.resolve({
            errorText: 'No read-only observation executor is available for dispatch-time target resolution.',
            ok: false,
            responseText: 'No read-only observation executor is available for dispatch-time target resolution.',
          }),
    }),
    resume: async ({ command, previousResult, result }) => {
      const previousApproval = previousResult.pendingApproval;
      const resolvedApproval = previousApproval
        ? {
            ...previousApproval,
            command,
            plan: buildAgentPermissionRoute(command).plan ?? previousApproval.plan,
            ...(previousResult.continuation.taskState
              ? {
                  runId: previousResult.continuation.taskState.runId,
                  surfaceGeneration: previousResult.continuation.taskState.surface?.generation ?? null,
                  surfaceId: previousResult.continuation.taskState.surface?.surfaceId ?? null,
                  taskId: previousResult.continuation.taskState.taskId,
                }
              : {}),
          }
        : null;
      const routed = await runAgentProductionRuntime({
        approvedToolResult: { command, result },
        cancellationSignal: options.cancellationSignal,
        continuation: previousResult.continuation,
        onProgress: options.onProgress,
        personaBehaviorContract: options.personaBehaviorContract,
        ...(resolvedApproval ? {
          taskTransactionEvent: {
            approval: resolvedApproval,
            type: 'approve' as const,
          },
        } : {}),
        settings: options.settings,
        sourceText: previousResult.continuation.sourceText,
        toolExecutor: options.toolExecutor,
        userGoal: previousResult.continuation.userGoal,
      });
      if (!routed.result) {
        throw new Error(routed.reason);
      }
      return routed.result;
    },
  });
}
