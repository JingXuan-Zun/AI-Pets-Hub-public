import {
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../agentChatCommand';
import {
  type AgentRuntimeContinuation,
  type AgentRuntimeToolResultEntry,
} from './agentRuntimeContract';
import { buildAgentPermissionRoute } from '../agentPermissionRouter';
import { type AgentExecutionPlan } from '../agentOrchestrator';
import { appendAgentRuntimeToolEvidence } from './agentRuntimeTaskEvidence';
import {
  createAgentWindowIdentityObservationCommand,
  resolveAgentWindowTargetBeforeDispatch,
} from './agentWindowTargetResolutionRuntime';

const WINDOW_TARGET_ACTIONS = new Set([
  'close_window',
  'control_window',
  'focus_window',
  'move_window_to_display',
]);

const WINDOW_UI_ACTIONS = new Set([
  'interact_window_ui',
  'invoke_window_ui',
  'select_window_ui',
  'toggle_window_ui',
  'expand_window_ui',
  'collapse_window_ui',
  'set_window_ui_value',
]);

const WINDOW_CREATION_ACTIONS = new Set([
  'launch_local_app',
  'open_resource',
  'search_web',
]);

interface ApprovedDispatchResolutionOptions {
  command: AgentChatCommand;
  continuation: AgentRuntimeContinuation;
  executeObservation: (command: AgentChatCommand) => Promise<AgentChatCommandResult>;
}

export interface ApprovedDispatchResolutionResult {
  blockedResult?: AgentChatCommandResult | null;
  command: AgentChatCommand;
  continuation: AgentRuntimeContinuation;
  plan?: AgentExecutionPlan | null;
}

function resolveCommandPlan(command: AgentChatCommand, fallback: AgentExecutionPlan | null = null) {
  return buildAgentPermissionRoute(command).plan ?? fallback;
}

function normalizeAction(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[-\s]+/gu, '_')
    : '';
}

function getSequenceSteps(command: AgentChatCommand) {
  if (command.toolCall?.name !== 'execute_desktop_sequence') {
    return null;
  }

  const stepsJson = command.toolCall.input.stepsJson;
  if (typeof stepsJson !== 'string') {
    return null;
  }

  try {
    const steps = JSON.parse(stepsJson) as unknown;
    return Array.isArray(steps) ? steps : null;
  } catch {
    return null;
  }
}

function getStepToolAndArgs(step: unknown) {
  if (!step || typeof step !== 'object' || Array.isArray(step)) {
    return null;
  }
  const record = step as Record<string, unknown>;
  const rawArgs = record.args ?? record.input;
  return {
    args: rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
      ? rawArgs as Record<string, unknown>
      : {},
    record,
    tool: typeof record.tool === 'string' ? record.tool : '',
  };
}

function isWindowTargetAction(args: Record<string, unknown>, tool: string) {
  return tool === 'execute_desktop_action'
    && WINDOW_TARGET_ACTIONS.has(normalizeAction(args.action));
}

function getInputWindowIdentityArgs(args: Record<string, unknown>) {
  const hwnd = getPositiveInteger(args.expectedForegroundHwnd ?? args.hwnd ?? args.windowHandle);
  const pid = getPositiveInteger(args.expectedForegroundPid ?? args.pid);
  const query = [
    args.sourceQuery,
    args.sourceWindowTitle,
    args.windowQuery,
    args.expectedForegroundTitle,
    args.expectedForegroundProcessName,
    args.windowTitle,
    args.title,
    args.processName,
  ].find((value) => typeof value === 'string' && value.trim()) ?? '';
  if (!hwnd && !pid && !query) {
    return null;
  }
  return {
    action: 'focus_window',
    ...(hwnd ? { hwnd } : {}),
    ...(pid ? { pid } : {}),
    ...(query ? { query } : {}),
  };
}

function getWindowIdentityArgsForAction(args: Record<string, unknown>, tool: string) {
  if (isWindowTargetAction(args, tool)) {
    return args;
  }
  const action = normalizeAction(args.action);
  if (tool !== 'execute_desktop_action' || !WINDOW_UI_ACTIONS.has(action)) {
    return null;
  }
  const hwnd = getPositiveInteger(args.hwnd ?? args.windowHandle);
  const pid = getPositiveInteger(args.pid);
  const query = [
    args.query,
    args.sourceQuery,
    args.sourceWindowTitle,
    args.windowQuery,
    args.windowTitle,
    args.title,
    args.processName,
  ]
    .find((value) => typeof value === 'string' && value.trim()) ?? '';
  if (!hwnd && !pid && !query) {
    return null;
  }
  return {
    action: 'focus_window',
    ...(hwnd ? { hwnd } : {}),
    ...(pid ? { pid } : {}),
    ...(query ? { query } : {}),
  };
}

function getResolutionArgs(args: Record<string, unknown>) {
  const query = [
    args.query,
    args.target,
    args.title,
    args.windowTitle,
    args.processName,
    args.sourceQuery,
    args.sourceWindowTitle,
    args.windowQuery,
    args.expectedForegroundTitle,
    args.expectedForegroundProcessName,
  ].find((value) => typeof value === 'string' && value.trim());
  if (!query) {
    return args;
  }

  const {
    hwnd: _hwnd,
    pid: _pid,
    windowHandle: _windowHandle,
    expectedForegroundHwnd: _expectedForegroundHwnd,
    expectedForegroundPid: _expectedForegroundPid,
    ...semanticArgs
  } = args;
  return {
    ...semanticArgs,
    action: 'focus_window',
  };
}

function isWindowUiAction(args: Record<string, unknown>, tool: string) {
  return tool === 'execute_desktop_action'
    && WINDOW_UI_ACTIONS.has(normalizeAction(args.action));
}

function applyResolvedIdentity(
  originalArgs: Record<string, unknown>,
  resolvedArgs: Record<string, unknown>,
) {
  const { windowHandle: _windowHandle, ...argsWithoutLegacyHandle } = originalArgs;
  return {
    ...argsWithoutLegacyHandle,
    ...(getPositiveInteger(resolvedArgs.hwnd) ? { hwnd: getPositiveInteger(resolvedArgs.hwnd) } : {}),
    ...(getPositiveInteger(resolvedArgs.pid) ? { pid: getPositiveInteger(resolvedArgs.pid) } : {}),
  };
}

function hasWindowCreationBefore(steps: unknown[], index: number) {
  return steps.slice(0, index).some((step) => {
    const parsed = getStepToolAndArgs(step);
    return Boolean(parsed) && WINDOW_CREATION_ACTIONS.has(normalizeAction(parsed.args.action));
  });
}

function getLatestWindowCreationTarget(steps: unknown[], index: number) {
  for (let stepIndex = index - 1; stepIndex >= 0; stepIndex -= 1) {
    const parsed = getStepToolAndArgs(steps[stepIndex]);
    if (!parsed || !isWindowCreationAction(parsed.args, parsed.tool)) {
      continue;
    }
    return [
      parsed.args.target,
      parsed.args.query,
      parsed.args.appName,
      parsed.args.name,
      parsed.args.url,
    ].find((value) => typeof value === 'string' && value.trim()) ?? '';
  }
  return '';
}

function stripWindowIdentity(args: Record<string, unknown>) {
  const {
    hwnd: _hwnd,
    pid: _pid,
    windowHandle: _windowHandle,
    expectedForegroundHwnd: _expectedForegroundHwnd,
    expectedForegroundPid: _expectedForegroundPid,
    ...semanticArgs
  } = args;
  return semanticArgs;
}

function getWindowQueryArgs(args: Record<string, unknown>) {
  return [
    args.query,
    args.target,
    args.title,
    args.windowTitle,
    args.processName,
    args.name,
  ].some((value) => typeof value === 'string' && value.trim());
}

function isWindowCreationAction(args: Record<string, unknown>, tool: string) {
  return tool === 'execute_desktop_action'
    && WINDOW_CREATION_ACTIONS.has(normalizeAction(args.action));
}

function getPositiveInteger(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue) : null;
}

function updateDependentInputIdentities(
  steps: unknown[],
  resolvedArgs: Record<string, unknown>,
  resolvedIndex: number,
  previousArgs: Record<string, unknown>,
) {
  const resolvedHwnd = getPositiveInteger(resolvedArgs.hwnd);
  const resolvedPid = getPositiveInteger(resolvedArgs.pid);
  const previousHwnd = getPositiveInteger(previousArgs.hwnd);
  const previousPid = getPositiveInteger(previousArgs.pid);
  if (!resolvedHwnd && !resolvedPid) {
    return steps;
  }

  return steps.map((step, index) => {
    if (index <= resolvedIndex) {
      return step;
    }
    const parsed = getStepToolAndArgs(step);
    if (!parsed) {
      return step;
    }
    if (isWindowTargetAction(parsed.args, parsed.tool) || WINDOW_UI_ACTIONS.has(normalizeAction(parsed.args.action)) || (
      parsed.tool === 'execute_desktop_action'
      && WINDOW_CREATION_ACTIONS.has(normalizeAction(parsed.args.action))
    )) {
      return step;
    }
    if (parsed.tool !== 'execute_desktop_input') {
      return step;
    }

    const currentHwnd = getPositiveInteger(parsed.args.expectedForegroundHwnd);
    const currentPid = getPositiveInteger(parsed.args.expectedForegroundPid);
    if (!currentHwnd && !currentPid) {
      return step;
    }
    const hwndMatchesPrevious = !currentHwnd || !previousHwnd || currentHwnd === previousHwnd;
    const pidMatchesPrevious = !currentPid || !previousPid || currentPid === previousPid;
    if (!hwndMatchesPrevious || !pidMatchesPrevious) {
      return step;
    }

    return {
      ...parsed.record,
      args: {
        ...parsed.args,
        ...(resolvedHwnd ? { expectedForegroundHwnd: resolvedHwnd } : {}),
        ...(resolvedPid ? { expectedForegroundPid: resolvedPid } : {}),
      },
    };
  });
}

function createBlockedResult(reason: string, command: AgentChatCommand): AgentChatCommandResult {
  const toolName = command.toolCall?.name ?? command.kind;
  return {
    errorText: `Approved action was not dispatched: ${reason}`,
    observations: [
      'Dispatch-time window identity re-resolution blocked the approved action.',
      reason,
    ],
    ok: false,
    receipt: {
      evidenceLines: [
        'approvedDispatchReResolution=blocked',
        reason,
      ],
      status: 'blocked',
      summaryLines: [
        'Approved action was stopped before side-effect dispatch.',
        `Tool: ${toolName}`,
      ],
      title: 'Dispatch-time target resolution blocked',
      toolName,
      verification: 'The approved command was not sent because its live window identity could not be re-resolved safely.',
    },
    responseText: `The approved action was stopped before execution because the live window identity could not be resolved safely. ${reason}`,
    verification: 'Dispatch-time target re-resolution blocked the stale approved action.',
  };
}

async function resolveWindowAction(options: {
  args: Record<string, unknown>;
  command: AgentChatCommand;
  continuation: AgentRuntimeContinuation;
  executeObservation: (command: AgentChatCommand) => Promise<AgentChatCommandResult>;
}) {
  const toolName = 'execute_desktop_action';
  const forcedObservation = createAgentWindowIdentityObservationCommand(
    normalizeAction(options.args.action),
    options.continuation.sourceText,
    options.continuation.userGoal,
  );
  let observationResult: AgentChatCommandResult;
  try {
    observationResult = await options.executeObservation(forcedObservation);
  } catch (error) {
    return {
      blockedResult: createBlockedResult(
        `The dispatch-time observation failed: ${error instanceof Error ? error.message : String(error)}`,
        options.command,
      ),
      toolResults: options.continuation.toolResults,
    };
  }
  const observationEntry = {
    command: forcedObservation,
    result: observationResult,
  };
  let toolResults = [...options.continuation.toolResults, observationEntry];
  let resolution = resolveAgentWindowTargetBeforeDispatch({
    args: getResolutionArgs(options.args),
    sourceText: options.continuation.sourceText,
    toolName,
    toolResults,
    userGoal: options.continuation.userGoal,
  });

  if (resolution.kind !== 'ready') {
    return {
      blockedResult: createBlockedResult(resolution.reason, options.command),
      toolResults,
    };
  }

  return {
    // The resolver uses focus_window as its lookup operation. Keep the
    // approved action intact and only carry the live identity forward.
    args: applyResolvedIdentity(options.args, resolution.args),
    toolResults,
  };
}

function updateContinuationWithToolResults(
  continuation: AgentRuntimeContinuation,
  toolResults: AgentRuntimeToolResultEntry[],
) {
  const previousToolResultCount = continuation.toolResults.length;
  const previousTaskState = continuation.taskState ?? continuation.taskTransaction?.taskState ?? null;
  const taskState = previousTaskState
    ? appendAgentRuntimeToolEvidence({
        entries: toolResults.slice(previousToolResultCount),
        state: previousTaskState,
      })
      : null;
  const taskTransaction = continuation.taskTransaction && taskState
    ? { ...continuation.taskTransaction, taskState }
    : continuation.taskTransaction;
  return {
    ...continuation,
    ...(taskState ? { taskState } : {}),
    ...(taskTransaction ? { taskTransaction } : {}),
    toolResults,
  };
}

export async function resolveAgentApprovedDispatch(
  options: ApprovedDispatchResolutionOptions,
): Promise<ApprovedDispatchResolutionResult> {
  const toolCall = options.command.toolCall;
  if (!toolCall) {
    return {
      command: options.command,
      continuation: options.continuation,
      plan: resolveCommandPlan(options.command),
    };
  }

  const directAction = normalizeAction(toolCall.input.action);
  if (
    toolCall.name === 'execute_desktop_action'
    && (WINDOW_TARGET_ACTIONS.has(directAction) || WINDOW_UI_ACTIONS.has(directAction))
  ) {
    const resolved = await resolveWindowAction({
      args: toolCall.input,
      command: options.command,
      continuation: options.continuation,
      executeObservation: options.executeObservation,
    });
    return {
      blockedResult: resolved.blockedResult ?? null,
      command: resolved.args
        ? {
            ...options.command,
            toolCall: {
              ...toolCall,
              input: WINDOW_UI_ACTIONS.has(directAction)
                ? applyResolvedIdentity(toolCall.input, resolved.args)
                : resolved.args,
            },
          }
        : options.command,
      continuation: updateContinuationWithToolResults(options.continuation, resolved.toolResults),
      plan: resolveCommandPlan(
        resolved.args
          ? { ...options.command, toolCall: { ...toolCall, input: resolved.args } }
          : options.command,
      ),
    };
  }

  const steps = getSequenceSteps(options.command);
  if (!steps) {
    if (toolCall.name === 'execute_desktop_input') {
      const identityArgs = getInputWindowIdentityArgs(toolCall.input);
      if (identityArgs) {
        const resolved = await resolveWindowAction({
          args: identityArgs,
          command: options.command,
          continuation: options.continuation,
          executeObservation: options.executeObservation,
        });
        if (resolved.blockedResult) {
          return {
            blockedResult: resolved.blockedResult,
            command: options.command,
            continuation: updateContinuationWithToolResults(options.continuation, resolved.toolResults),
            plan: resolveCommandPlan(options.command),
          };
        }
        const resolvedHwnd = getPositiveInteger(resolved.args?.hwnd);
        const resolvedPid = getPositiveInteger(resolved.args?.pid);
        const command = resolvedHwnd || resolvedPid
          ? {
              ...options.command,
              toolCall: {
                ...toolCall,
                input: {
                  ...toolCall.input,
                  ...(resolvedHwnd ? { expectedForegroundHwnd: resolvedHwnd } : {}),
                  ...(resolvedPid ? { expectedForegroundPid: resolvedPid } : {}),
                },
              },
            }
          : options.command;
        return {
          command,
          continuation: updateContinuationWithToolResults(options.continuation, resolved.toolResults),
          plan: resolveCommandPlan(command),
        };
      }
    }
    return {
      command: options.command,
      continuation: options.continuation,
      plan: resolveCommandPlan(options.command),
    };
  }

  let nextSteps = steps;
  let nextToolResults = [...options.continuation.toolResults];
  let blockedResult: AgentChatCommandResult | null = null;
  for (let index = 0; index < steps.length; index += 1) {
    const parsed = getStepToolAndArgs(nextSteps[index]);
    if (!parsed) {
      continue;
    }

    const followsWindowCreation = hasWindowCreationBefore(steps, index);
    const creationTarget = followsWindowCreation
      ? getLatestWindowCreationTarget(steps, index)
      : '';
    const resolutionInput = followsWindowCreation && creationTarget
      ? {
          ...parsed.args,
          ...(getWindowIdentityArgsForAction(parsed.args, parsed.tool)
            ? { query: parsed.args.query ?? creationTarget }
            : parsed.tool === 'execute_desktop_input'
              ? {
                  sourceQuery: parsed.args.sourceQuery ?? creationTarget,
                  sourceWindowTitle: parsed.args.sourceWindowTitle ?? creationTarget,
                }
              : {}),
        }
      : parsed.args;

    if (followsWindowCreation && creationTarget) {
      const dependentArgs = parsed.tool === 'execute_desktop_input'
        ? {
            ...stripWindowIdentity(parsed.args),
            sourceQuery: parsed.args.sourceQuery ?? creationTarget,
            sourceWindowTitle: parsed.args.sourceWindowTitle ?? creationTarget,
          }
        : {
            ...stripWindowIdentity(parsed.args),
            ...(!getWindowQueryArgs(parsed.args) ? { query: creationTarget } : {}),
          };
      nextSteps = nextSteps.map((step, stepIndex) => stepIndex === index
        ? { ...parsed.record, args: dependentArgs }
        : step);
      continue;
    }

    const identityArgs = getWindowIdentityArgsForAction(resolutionInput, parsed.tool)
      ?? (parsed.tool === 'execute_desktop_input'
        ? getInputWindowIdentityArgs(resolutionInput)
        : null);
    if (!identityArgs) {
      continue;
    }

    const resolved = await resolveWindowAction({
      args: getResolutionArgs(identityArgs),
      command: options.command,
      continuation: { ...options.continuation, toolResults: nextToolResults },
      executeObservation: options.executeObservation,
    });
    nextToolResults = resolved.toolResults;
    if (resolved.blockedResult) {
      blockedResult = resolved.blockedResult;
      break;
    }
    nextSteps = nextSteps.map((step, stepIndex) => {
      if (stepIndex !== index) {
        return step;
      }
      return {
        ...parsed.record,
        args: parsed.tool === 'execute_desktop_input'
          ? {
              ...parsed.args,
              ...(typeof resolutionInput.sourceQuery === 'string' && resolutionInput.sourceQuery.trim()
                ? { sourceQuery: resolutionInput.sourceQuery }
                : {}),
              ...(typeof resolutionInput.sourceWindowTitle === 'string' && resolutionInput.sourceWindowTitle.trim()
                ? { sourceWindowTitle: resolutionInput.sourceWindowTitle }
                : {}),
              ...(getPositiveInteger(resolved.args.hwnd)
                ? { expectedForegroundHwnd: getPositiveInteger(resolved.args.hwnd) } : {}),
              ...(getPositiveInteger(resolved.args.pid)
                ? { expectedForegroundPid: getPositiveInteger(resolved.args.pid) } : {}),
            }
          : isWindowUiAction(parsed.args, parsed.tool)
            ? applyResolvedIdentity(parsed.args, resolved.args)
            : applyResolvedIdentity(parsed.args, resolved.args),
      };
    });
    nextSteps = updateDependentInputIdentities(nextSteps, resolved.args, index, resolutionInput);
  }

  const nextCommand = blockedResult || nextSteps === steps
    ? options.command
    : {
        ...options.command,
        toolCall: {
          ...toolCall,
          input: {
            ...toolCall.input,
            stepsJson: JSON.stringify(nextSteps),
          },
        },
      };
  return {
    blockedResult,
    command: nextCommand,
    continuation: updateContinuationWithToolResults(options.continuation, nextToolResults),
    plan: resolveCommandPlan(nextCommand),
  };
}
