import { type AgentChatCommand } from '../agentChatCommand';
import { type AgentRuntimeResult, type AgentRuntimeToolResultEntry } from '../runtime/agentRuntimeContract';
import { AGENT_RECOVERY_CONTROLLER_DEFAULT_MAX_TRANSITIONS, createAgentRecoveryLoopState, transitionAgentRecoveryLoop, type AgentRecoveryProposalDecision, type AgentRecoveryTriggerDecision } from '../runtime/agentRecoveryController';
import { runAgentRecoveryExecution } from '../runtime/agentRecoveryExecutionRuntime';
import { runAgentVerificationContinuation } from '../runtime/agentRuntimeContinuationDispatcher';
import { type AgentPostActionTerminalEvaluation } from '../runtime/agentPostActionTerminalEvaluator';
import { type evaluateAgentActionRuntime } from '../agentActionRuntime';
import { createAgentAutoRecoveryLoopContinuedHistoryLine, createAgentAutoRecoveryLoopStoppedHistoryLine } from '../runtime/agentExecutionProgressSignals';
import { createAgentVisualRefinementCommand } from '../capabilities/agentVisualRefinementCapabilityAdapter';
import { isAgentTargetResolutionAvailable } from '../runtime/agentTargetResolutionRuntime';
import { getLatestAgentToolResult } from '../runtime/agentPlanningSignalEvidence';
import { formatAgentToolResultForModel } from '../runtime/agentToolResultSummary';
import { AGENT_PRODUCTION_EXECUTION_CANCELLED_ANSWER as AGENT_SESSION_V2_CANCELLED_ANSWER, isAgentProductionExecutionCancellationRequested as isAgentSessionV2CancellationRequested, resolveAgentProductionExecutionToolTimingStatus as resolveAgentSessionV2ToolTimingStatus } from './executionTiming';
import { type createAgentProductionFailedActionRecoveryObservation } from './failedActionRecoveryObservation';
import { type createAgentProductionVisualObservationExecution } from './visualObservationExecution';
import { isAgentReadyVisualActionEvidence } from './readyVisualActionEvidence';

type VisualDependencies = Parameters<typeof createAgentProductionVisualObservationExecution>[0];
interface AgentProductionAutoRecoveryDependencies extends Omit<Parameters<typeof createAgentProductionFailedActionRecoveryObservation>[0], 'proposeRecovery'> {
  proposeRecovery: (kind: 'automatic-observation', entry: AgentRuntimeToolResultEntry | null) => AgentRecoveryProposalDecision;
  resolveRecoveryPostActionState: (options: {entry: AgentRuntimeToolResultEntry | null; sourceText: string; userGoal: string}) => string;
  createPostActionTerminalResult: (entry: AgentRuntimeToolResultEntry | null, stepIndex: number, sourceLabel: string) => AgentRuntimeResult | null;
  createPostActionTerminalResultFromEvaluation: (entry: AgentRuntimeToolResultEntry, evaluation: AgentPostActionTerminalEvaluation, stepIndex: number, sourceLabel: string) => AgentRuntimeResult;
  getActionRuntimeDependencies: VisualDependencies['getActionRuntimeDependencies'];
  actionCoverageDependencies: VisualDependencies['actionCoverageDependencies'];
  getToolInputAction: VisualDependencies['getToolInputAction'];
  recordActionRuntimeDecision: (options: {decision: ReturnType<typeof evaluateAgentActionRuntime>; latestEntry: AgentRuntimeToolResultEntry | null; source: 'auto-recovery'}) => void;
  recordRecoveryTriggerDecision: (options: {actionDecision: ReturnType<typeof evaluateAgentActionRuntime>; latestEntry: AgentRuntimeToolResultEntry | null; triggerDecision: AgentRecoveryTriggerDecision}) => void;
  executeVisualRefinementObservation: ReturnType<typeof createAgentProductionVisualObservationExecution>['executeVisualRefinementObservation'];
  executeInAppTargetLocateObservation: ReturnType<typeof createAgentProductionVisualObservationExecution>['executeInAppTargetLocateObservation'];
}

export function createAgentProductionAutoRecoveryExecution(dependencies: AgentProductionAutoRecoveryDependencies) {
  const {sourceText, userGoal, historyLines, steps, toolResults, getTaskState, getActionRuntimeDependencies, proposeRecovery, authorizeRecovery, toolExecutor, cancellationSignal, readOnlyToolCache, timingTracker, commitToolResult, onProgress, createProgressSnapshot, appendTraceEvent, createBudgetExceededResult, createFinalResult, createPostActionTerminalResult, createPostActionTerminalResultFromEvaluation, recordActionRuntimeDecision, recordRecoveryTriggerDecision, executeVisualRefinementObservation, executeInAppTargetLocateObservation,
    executeCommandWithCache: executeAgentSessionV2ToolCommandWithCache,
    getTimingDetail: getAgentSessionV2TimingToolDetail,
    getToolInputAction: getAgentSessionV2ToolInputAction,
    compactText: compactAgentSessionText, emitProgress: emitAgentSessionV2Progress,
    resolveVisualActionApproval: resolveAgentSessionV2VisualActionApproval,
    preparePendingApprovalResult: prepareAgentSessionV2PendingApprovalResult,
    resolveRecoveryPostActionState: resolveAgentRecoveryPostActionState,
    actionCoverageDependencies: agentSessionV2ActionCoverageDependencies,
  } = dependencies;

  const executeAutoRecoveryObservation = async (
    latestEntry: AgentRuntimeToolResultEntry | null,
    triggerStepIndex: number,
    sourceLabel: string,
    proposedCommand?: AgentChatCommand | null,
  ): Promise<{ executed: boolean; finalResult: AgentRuntimeResult | null }> => {
    const terminalBeforeRecovery = createPostActionTerminalResult(
      latestEntry,
      triggerStepIndex,
      'pre-auto-recovery',
    );
    if (terminalBeforeRecovery) {
      return { executed: false, finalResult: terminalBeforeRecovery };
    }
    if (!proposedCommand && isAgentReadyVisualActionEvidence(latestEntry)) {
      historyLines.push(`Step ${triggerStepIndex} skipped automatic recovery observation: the latest visual evidence is action-ready; request the click instead of re-reading.`);
      return { executed: false, finalResult: null };
    }

    const recoveryProposal = proposedCommand
      ? {
          command: proposedCommand,
          reason: 'Using the Recovery Controller proposal already selected by the active loop.',
          status: 'proposed' as const,
        }
      : proposeRecovery('automatic-observation', latestEntry);
    const recoveryStepIndex = steps.length + 1;
    const postActionState = resolveAgentRecoveryPostActionState({
      entry: latestEntry,
      sourceText,
      userGoal,
    });
    const recoveryExecution = await runAgentRecoveryExecution({
      appendTraceEvent,
      authorizeRecovery,
      executeCommand: toolExecutor
        ? (command) => executeAgentSessionV2ToolCommandWithCache(
            command,
            toolExecutor,
            readOnlyToolCache,
            cancellationSignal,
          )
        : null,
      getTimingDetail: getAgentSessionV2TimingToolDetail,
      isCancellationRequested: () => isAgentSessionV2CancellationRequested(cancellationSignal),
      kind: 'automatic-observation',
      onAuthorization: (decision) => {
        historyLines.push([
          `Step ${triggerStepIndex} Task Runtime recovery authorization:`,
          'kind=automatic-observation',
          `allowed=${decision.allowed}`,
          `attempt=${decision.attempt}/${decision.limit}`,
          `reason=${decision.reason}`,
        ].join('\n'));
      },
      onCollected: ({ entry, progressEvent, step }) => {
        commitToolResult(entry);
        historyLines.push([
          `Step ${recoveryStepIndex} automatic recovery observation result:`,
          formatAgentToolResultForModel(entry.command, entry.result),
        ].join('\n'));
        steps.push(step);
        emitAgentSessionV2Progress(onProgress, progressEvent, createProgressSnapshot());
      },
      onStarted: ({ progressEvent, step }) => {
        historyLines.push([
          `Step ${triggerStepIndex} automatic recovery observation:`,
          `postActionState=${postActionState}`,
          `tool=${step.tool ?? step.action}`,
          `args=${compactAgentSessionText(JSON.stringify(step.args ?? {}), 520)}`,
        ].join('\n'));
        steps.push(step);
        emitAgentSessionV2Progress(onProgress, progressEvent, createProgressSnapshot());
      },
      postActionState,
      proposal: recoveryProposal,
      reason: sourceLabel,
      requestedLimit: AGENT_RECOVERY_CONTROLLER_DEFAULT_MAX_TRANSITIONS,
      resolveTimingStatus: (result) => resolveAgentSessionV2ToolTimingStatus(result, cancellationSignal),
      sourceText,
      stepIndex: recoveryStepIndex,
      taskState: getTaskState(),
      timingTracker,
      traceSource: 'auto-recovery',
      userGoal,
    });
    if (recoveryExecution.kind === 'not-executed') {
      if (recoveryExecution.stage === 'proposal' && recoveryProposal.status === 'rejected') {
        historyLines.push(`Step ${triggerStepIndex} automatic recovery rejected: ${recoveryProposal.reason}`);
      }
      if (recoveryExecution.stage === 'permission') {
        historyLines.push([
          `Step ${triggerStepIndex} skipped automatic recovery observation:`,
          `permission=${recoveryExecution.reason}`,
        ].join('\n'));
      }
      return { executed: false, finalResult: null };
    }
    if (recoveryExecution.kind === 'authorization-denied') {
      return {
        executed: false,
        finalResult: createFinalResult({
          finalAnswer: `Automatic recovery stopped after ${recoveryExecution.authorization.limit} authorized attempt(s). Fresh user input is required before more recovery work.`,
          status: 'needs-user',
        }),
      };
    }
    if (recoveryExecution.kind === 'budget-exceeded') {
      return { executed: false, finalResult: createBudgetExceededResult() };
    }
    if (recoveryExecution.kind === 'cancelled') {
      return {
        executed: true,
        finalResult: createFinalResult({
          finalAnswer: AGENT_SESSION_V2_CANCELLED_ANSWER,
          status: 'cancelled',
        }),
      };
    }

    const terminalAfterRecovery = createPostActionTerminalResult(
      getLatestAgentToolResult(toolResults),
      recoveryStepIndex,
      'auto-recovery-result',
    );
    if (terminalAfterRecovery) {
      return { executed: true, finalResult: terminalAfterRecovery };
    }

    const latestRecoveryEntry = getLatestAgentToolResult(toolResults);
    if (!latestRecoveryEntry) {
      return { executed: true, finalResult: null };
    }
    const recoveryContinuationDispatch = await runAgentVerificationContinuation<AgentRuntimeResult>({
      actionRuntimeDependencies: getActionRuntimeDependencies(),
      adapters: {
        approval: ({ stepIndex, transition }) => {
          const approvalResult = prepareAgentSessionV2PendingApprovalResult(
            transition.approval,
            stepIndex,
            'visual-action approval after auto recovery',
            null,
          );
          return {
            executed: approvalResult.handled,
            finalResult: approvalResult.result,
          };
        },
        planning: () => ({ executed: false, finalResult: null }),
        recovery: ({ latestEntry, stepIndex }) => executeAutoRecoveryLoop(
          latestEntry,
          stepIndex,
          'post-approval-verification',
        ),
        refine: ({ latestEntry, stepIndex }) => executeVisualRefinementObservation(
          latestEntry,
          stepIndex,
        ),
        targetResolution: ({ latestEntry, stepIndex }) => (
          executeInAppTargetLocateObservation(latestEntry, stepIndex)
        ),
        terminal: ({ latestEntry, stepIndex, transition }) => {
          const terminalEvaluation = transition.actionDecision.terminalEvaluation;
          if (transition.kind === 'terminal' && terminalEvaluation) {
            return {
              executed: true,
              finalResult: createPostActionTerminalResultFromEvaluation(
                latestEntry,
                terminalEvaluation,
                stepIndex,
                'auto-recovery-result',
              ),
            };
          }
          return {
            executed: true,
            finalResult: createFinalResult({
          finalAnswer: '自动恢复已停止：最新证据表明需要用户处理，例如登录、验证码或其他确认。',
              status: 'needs-user',
            }),
          };
        },
        verification: () => ({ executed: false, finalResult: null }),
      },
      latestEntry: latestRecoveryEntry,
      onTransition: (transition) => {
        recordActionRuntimeDecision({
          decision: transition.actionDecision,
          latestEntry: latestRecoveryEntry,
          source: 'auto-recovery',
        });
        if (transition.recoveryDecision) {
          recordRecoveryTriggerDecision({
            actionDecision: transition.actionDecision,
            latestEntry: latestRecoveryEntry,
            triggerDecision: transition.recoveryDecision,
          });
        }
      },
      refinementAvailable: Boolean(createAgentVisualRefinementCommand({
        latestEntry: latestRecoveryEntry,
        sourceText,
        toolResults,
        userGoal,
      })),
      resolveVisualApproval: (request) => resolveAgentSessionV2VisualActionApproval(request),
      sourceText,
      stepIndex: steps.length,
      targetResolutionAvailable: isAgentTargetResolutionAvailable({
        actionCoverageDependencies: agentSessionV2ActionCoverageDependencies,
        latestEntry: latestRecoveryEntry,
        sourceText,
        taskState: getTaskState(),
        toolResults,
        userGoal,
      }),
      toolResults,
      userGoal,
    });
    if (recoveryContinuationDispatch.loopDecision.action === 'return-final') {
      return {
        executed: true,
        finalResult: recoveryContinuationDispatch.loopDecision.finalResult,
      };
    }

    return { executed: true, finalResult: null };
  };
  const executeAutoRecoveryLoop = async (
    latestEntry: AgentRuntimeToolResultEntry | null,
    triggerStepIndex: number,
    sourceLabel: string,
  ): Promise<{ executed: boolean; finalResult: AgentRuntimeResult | null }> => {
    let loopState = createAgentRecoveryLoopState({
      evidenceCount: toolResults.length,
    });
    while (true) {
      const currentEntry = getLatestAgentToolResult(toolResults) ?? latestEntry;
      const terminalResult = createPostActionTerminalResult(
        currentEntry,
        triggerStepIndex,
        `${sourceLabel}:loop-${loopState.transitionIndex}`,
      );
      const iterationDecision = transitionAgentRecoveryLoop(loopState, {
        cancellationRequested: isAgentSessionV2CancellationRequested(cancellationSignal),
        terminalAvailable: Boolean(terminalResult),
        type: 'iteration-check',
      });
      if (iterationDecision.action === 'stop-cancelled') {
        return {
          executed: loopState.executed,
          finalResult: createFinalResult({
            finalAnswer: AGENT_SESSION_V2_CANCELLED_ANSWER,
            status: 'cancelled',
          }),
        };
      }
      if (iterationDecision.action === 'stop-terminal' && terminalResult) {
        return { executed: loopState.executed, finalResult: terminalResult };
      }
      if (iterationDecision.action === 'stop-limit-reached') {
        historyLines.push(createAgentAutoRecoveryLoopStoppedHistoryLine({
          reason: `loop-limit-reached-${loopState.maxTransitions}`,
          sourceLabel,
          triggerStepIndex,
        }));
        return { executed: loopState.executed, finalResult: null };
      }

      const recoveryProposal = proposeRecovery('automatic-observation', currentEntry);
      const proposalDecision = transitionAgentRecoveryLoop(loopState, {
        proposalStatus: recoveryProposal.status,
        type: 'proposal-resolved',
      });
      const recoveryCommand = recoveryProposal.command;
      if (proposalDecision.action !== 'execute-proposal' || !recoveryCommand) {
        if (loopState.executed) {
          historyLines.push(createAgentAutoRecoveryLoopStoppedHistoryLine({
            postActionState: resolveAgentRecoveryPostActionState({
              entry: currentEntry,
              sourceText,
              userGoal,
            }),
            reason: proposalDecision.action === 'stop-proposal-rejected'
              ? 'recovery-controller-rejected-proposal'
              : 'no-safe-read-only-recovery-command',
            sourceLabel,
            triggerStepIndex,
          }));
        }
        return { executed: loopState.executed, finalResult: null };
      }

      historyLines.push(createAgentAutoRecoveryLoopContinuedHistoryLine({
        loopIndex: loopState.transitionIndex,
        maxLoops: loopState.maxTransitions,
        nextAction: getAgentSessionV2ToolInputAction(recoveryCommand) || 'unknown',
        nextTool: recoveryCommand.toolCall?.name ?? recoveryCommand.kind,
        postActionState: resolveAgentRecoveryPostActionState({
          entry: currentEntry,
          sourceText,
          userGoal,
        }),
        sourceLabel,
        triggerStepIndex,
      }));

      const recovery = await executeAutoRecoveryObservation(
        currentEntry,
        steps.length,
        sourceLabel,
        recoveryCommand,
      );
      if (recovery.finalResult) {
        return { executed: true, finalResult: recovery.finalResult };
      }
      const executionDecision = transitionAgentRecoveryLoop(loopState, {
        evidenceCount: toolResults.length,
        executed: recovery.executed,
        type: 'execution-finished',
      });
      loopState = executionDecision.state;
      if (executionDecision.action === 'stop-execution-skipped') {
        return { executed: loopState.executed, finalResult: null };
      }
      if (executionDecision.action === 'stop-no-new-evidence') {
        historyLines.push(createAgentAutoRecoveryLoopStoppedHistoryLine({
          reason: 'recovery-did-not-produce-new-evidence',
          sourceLabel,
          triggerStepIndex,
        }));
        return { executed: loopState.executed, finalResult: null };
      }
      if (executionDecision.action === 'stop-limit-reached') {
        historyLines.push(createAgentAutoRecoveryLoopStoppedHistoryLine({
          postActionState: resolveAgentRecoveryPostActionState({
            entry: getLatestAgentToolResult(toolResults),
            sourceText,
            userGoal,
          }),
          reason: `loop-limit-reached-${loopState.maxTransitions}`,
          sourceLabel,
          triggerStepIndex,
        }));
        return { executed: loopState.executed, finalResult: null };
      }
    }
  };

  return { executeAutoRecoveryObservation, executeAutoRecoveryLoop };
}
