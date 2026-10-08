import {
  WINDOW_TARGET_ACTIONS,
  WINDOW_UI_ACTIONS,
  normalizeAction,
  getSequenceSteps,
  getStepToolAndArgs,
  getInputWindowIdentityArgs,
  getWindowIdentityArgsForAction,
  getResolutionArgs,
  isWindowUiAction,
  applyResolvedIdentity,
  hasWindowCreationBefore,
  getLatestWindowCreationTarget,
  stripWindowIdentity,
  getWindowQueryArgs,
  getPositiveInteger,
  updateDependentInputIdentities,
} from './approvedDispatch/windowCommandIdentity';

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
