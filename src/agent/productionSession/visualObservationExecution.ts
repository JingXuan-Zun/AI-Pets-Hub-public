import { type AgentChatCommand } from '../agentChatCommand';
import { type AgentRuntimeContinuation, type AgentRuntimeResult, type AgentRuntimePendingApproval, type AgentRuntimeProgressHandler, type AgentRuntimeStep, type AgentRuntimeToolExecutor, type AgentRuntimeToolResultEntry, type AgentTaskRuntimeStateRecord } from '../runtime/agentRuntimeContract';
import { createAgentVisualRefinementCommand } from '../capabilities/agentVisualRefinementCapabilityAdapter';
import { runAgentVisualRefinementExecution } from '../runtime/agentVisualRefinementExecutionRuntime';
import { runAgentTargetResolutionExecution } from '../runtime/agentTargetResolutionExecutionRuntime';
import { isAgentTargetResolutionAvailable } from '../runtime/agentTargetResolutionRuntime';
import { hasAgentActionableWindowTargetEvidence } from '../runtime/agentTargetResolutionContext';
import { evaluateAgentActionRuntime } from '../agentActionRuntime';
import { getLatestAgentToolResult } from '../runtime/agentPlanningSignalEvidence';
import { formatAgentToolResultForModel } from '../runtime/agentToolResultSummary';
import { AGENT_PRODUCTION_EXECUTION_CANCELLED_ANSWER as AGENT_SESSION_V2_CANCELLED_ANSWER, isAgentProductionExecutionCancellationRequested as isAgentSessionV2CancellationRequested, resolveAgentProductionExecutionToolTimingStatus as resolveAgentSessionV2ToolTimingStatus } from './executionTiming';
import { type createAgentProductionSessionPresentation } from './sessionPresentation';
import { type createAgentProductionVisualApproval } from './visualApproval';
import { type createAgentProductionApprovalResult } from './approvalResult';
import { type createAgentProductionObservationReuse, type AgentProductionReadOnlyToolCache } from './observationReuse';

interface AgentProductionVisualObservationDependencies {
  sourceText: string; userGoal: string; historyLines: string[]; steps: AgentRuntimeStep[]; toolResults: AgentRuntimeToolResultEntry[];
  getTaskState: () => AgentTaskRuntimeStateRecord | null;
  getActionRuntimeDependencies: () => Parameters<typeof evaluateAgentActionRuntime>[0]['dependencies'];
  recordActionRuntimeDecision: (options: {decision: ReturnType<typeof evaluateAgentActionRuntime>; latestEntry: AgentRuntimeToolResultEntry | null; source: 'in-app-target-locate'}) => void;
  actionCoverageDependencies: Parameters<typeof isAgentTargetResolutionAvailable>[0]['actionCoverageDependencies'];
  toolExecutor?: AgentRuntimeToolExecutor | null; cancellationSignal?: AbortSignal | null; readOnlyToolCache: AgentProductionReadOnlyToolCache;
  timingTracker: Parameters<typeof runAgentVisualRefinementExecution>[0]['timingTracker'];
  executeCommandWithCache: ReturnType<typeof createAgentProductionObservationReuse>['executeAgentProductionToolCommandWithCache'];
  getTimingDetail: (command: AgentChatCommand) => string;
  getToolInputAction: (command: AgentChatCommand) => string;
  isVisualToolCommand: (command: AgentChatCommand) => boolean;
  compactText: (value: unknown, maxLength?: number) => string;
  commitToolResult: (entry: AgentRuntimeToolResultEntry) => unknown;
  onProgress?: AgentRuntimeProgressHandler;
  createProgressSnapshot: () => AgentRuntimeContinuation;
  emitProgress: ReturnType<typeof createAgentProductionSessionPresentation>['emitAgentProductionPresentationProgress'];
  appendTraceEvent: Parameters<typeof runAgentVisualRefinementExecution>[0]['appendTraceEvent'];
  createBudgetExceededResult: () => AgentRuntimeResult;
  createFinalResult: (options: {finalAnswer: string; status: 'cancelled'}) => AgentRuntimeResult;
  resolveVisualActionApproval: ReturnType<typeof createAgentProductionVisualApproval>['resolveAgentProductionVisualActionApproval'];
  preparePendingApprovalResult: ReturnType<typeof createAgentProductionApprovalResult>['prepareAgentProductionPendingApprovalResult'];
}

export function createAgentProductionVisualObservationExecution(dependencies: AgentProductionVisualObservationDependencies) {
  const {sourceText, userGoal, historyLines, steps, toolResults, getTaskState, getActionRuntimeDependencies, recordActionRuntimeDecision, toolExecutor, cancellationSignal, readOnlyToolCache, timingTracker, commitToolResult, onProgress, createProgressSnapshot, appendTraceEvent, createBudgetExceededResult, createFinalResult,
    actionCoverageDependencies: agentSessionV2ActionCoverageDependencies,
    executeCommandWithCache: executeAgentSessionV2ToolCommandWithCache,
    getTimingDetail: getAgentSessionV2TimingToolDetail,
    getToolInputAction: getAgentSessionV2ToolInputAction,
    isVisualToolCommand: isAgentSessionV2VisualToolCommand,
    compactText: compactAgentSessionText, emitProgress: emitAgentSessionV2Progress,
    resolveVisualActionApproval: resolveAgentSessionV2VisualActionApproval,
    preparePendingApprovalResult: prepareAgentSessionV2PendingApprovalResult,
  } = dependencies;

  const executeVisualRefinementObservation = async (
    latestEntry: AgentRuntimeToolResultEntry | null,
    triggerStepIndex: number,
  ): Promise<{ executed: boolean; finalResult: AgentRuntimeResult | null }> => {
    const refinementCommand = createAgentVisualRefinementCommand({
      latestEntry,
      sourceText,
      toolResults,
      userGoal,
    });
    const refinementStepIndex = steps.length + 1;
    const refinementExecution = await runAgentVisualRefinementExecution({
      appendTraceEvent,
      command: refinementCommand,
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
      onCollected: ({ entry, progressEvent, step }) => {
        commitToolResult(entry);
        historyLines.push([
          `Step ${refinementStepIndex} visual refinement result:`,
          formatAgentToolResultForModel(entry.command, entry.result),
        ].join('\n'));
        steps.push(step);
        emitAgentSessionV2Progress(onProgress, progressEvent, createProgressSnapshot());
      },
      onStarted: ({ progressEvent, step }) => {
        historyLines.push([
          `Step ${triggerStepIndex} visual refinement:`,
          `tool=${step.tool ?? step.action}`,
          `args=${compactAgentSessionText(JSON.stringify(step.args ?? {}), 520)}`,
        ].join('\n'));
        steps.push(step);
        emitAgentSessionV2Progress(onProgress, progressEvent, createProgressSnapshot());
      },
      resolveTimingStatus: (result) => resolveAgentSessionV2ToolTimingStatus(result, cancellationSignal),
      stepIndex: refinementStepIndex,
      timingTracker,
    });
    if (refinementExecution.kind === 'not-executed') {
      if (refinementExecution.stage === 'permission') {
        historyLines.push([
          `Step ${triggerStepIndex} skipped visual refinement:`,
          `permission=${refinementExecution.reason}`,
        ].join('\n'));
      }
      return { executed: false, finalResult: null };
    }
    if (refinementExecution.kind === 'budget-exceeded') {
      return { executed: false, finalResult: createBudgetExceededResult() };
    }
    if (refinementExecution.kind === 'cancelled') {
      return {
        executed: true,
        finalResult: createFinalResult({
          finalAnswer: AGENT_SESSION_V2_CANCELLED_ANSWER,
          status: 'cancelled',
        }),
      };
    }
    const refinementEntry = refinementExecution.collected.entry;
    const visualActionApproval = resolveAgentSessionV2VisualActionApproval({
      command: refinementEntry.command,
      result: refinementEntry.result,
      sourceText,
      toolResults,
      userGoal,
    });
    const visualApprovalResult = prepareAgentSessionV2PendingApprovalResult(
      visualActionApproval,
      refinementStepIndex,
      'visual-action approval after visual refinement',
      null,
    );
    if (visualApprovalResult.result) {
      return { executed: true, finalResult: visualApprovalResult.result };
    }
    if (visualApprovalResult.handled) {
      return { executed: true, finalResult: null };
    }

    // A UIA inspection may lead to the first coordinate-bearing visual
    // sample. Collect one more bounded sample before giving control back to
    // planning so coordinate consensus can form without a premature click.
    if (createAgentVisualRefinementCommand({
      latestEntry: refinementEntry,
      sourceText,
      toolResults,
      userGoal,
    })) {
      return executeVisualRefinementObservation(refinementEntry, steps.length);
    }

    return { executed: true, finalResult: null };
  };
  const executeInAppTargetLocateObservation = async (
    latestEntry: AgentRuntimeToolResultEntry | null,
    triggerStepIndex: number,
  ): Promise<{ executed: boolean; finalResult: AgentRuntimeResult | null }> => {
    if (!toolExecutor) {
      return { executed: false, finalResult: null };
    }

    const latestToolName = latestEntry?.command.toolCall?.name ?? '';
    const latestAction = latestEntry
      ? getAgentSessionV2ToolInputAction(latestEntry.command)
      : '';
    const latestIsVisualObservation = latestToolName === 'locate_screen_elements'
      || Boolean(latestEntry && isAgentSessionV2VisualToolCommand(latestEntry.command))
      || latestToolName === 'execute_desktop_observation'
        && ['inspect_window_ui', 'summarize_visual_snapshot'].includes(latestAction);
    if (latestIsVisualObservation && !hasAgentActionableWindowTargetEvidence(latestEntry)) {
      historyLines.push([
        `Step ${triggerStepIndex} skipped duplicate in-app target locate:`,
        'The latest result is already a visual observation; continue with bounded visual review or planning instead of repeating the same locate request.',
      ].join('\n'));
      return { executed: false, finalResult: null };
    }

    // Visual fallback and the deterministic in-app gate can converge on the
    // same latest locate result. Let the shared gate own the result once it is
    // actionable, instead of dispatching a second identical observation.
    if (hasAgentActionableWindowTargetEvidence(latestEntry)) {
      return { executed: false, finalResult: null };
    }

    // Tasks that never select target resolution (for example read-only
    // observation) must not leave an ActionRuntime decision or a skipped-locate
    // line behind, or every planning turn starts from a polluted history.
    if (!isAgentTargetResolutionAvailable({
      actionCoverageDependencies: agentSessionV2ActionCoverageDependencies,
      latestEntry,
      sourceText,
      taskState: getTaskState(),
      toolResults,
      userGoal,
    })) {
      return { executed: false, finalResult: null };
    }

    const inAppLocateRuntimeDecision = evaluateAgentActionRuntime({
      dependencies: getActionRuntimeDependencies(),
      latestEntry,
      sourceText,
      toolResults,
      userGoal,
    });
    recordActionRuntimeDecision({
      decision: inAppLocateRuntimeDecision,
      latestEntry,
      source: 'in-app-target-locate',
    });
    if (inAppLocateRuntimeDecision.status === 'waiting') {
      historyLines.push([
        `Step ${triggerStepIndex} deferred in-app target locate:`,
        `postActionState=${inAppLocateRuntimeDecision.postActionState}`,
        `runtimeReason=${inAppLocateRuntimeDecision.reason}`,
        'The outer app/window is not ready yet; wait/recovery should run before locating the internal target.',
      ].join('\n'));
      return { executed: false, finalResult: null };
    }

    const locateStepIndex = steps.length + 1;
    const targetResolutionExecution = await runAgentTargetResolutionExecution({
      actionCoverageDependencies: agentSessionV2ActionCoverageDependencies,
      appendTraceEvent,
      executeCommand: (command) => executeAgentSessionV2ToolCommandWithCache(
        command,
        toolExecutor,
        readOnlyToolCache,
        cancellationSignal,
      ),
      getTimingDetail: getAgentSessionV2TimingToolDetail,
      isCancellationRequested: () => isAgentSessionV2CancellationRequested(cancellationSignal),
      latestEntry,
      onCollected: ({ entry, progressEvent, step }) => {
        commitToolResult(entry);
        historyLines.push([
          `Step ${locateStepIndex} in-app target locate result:`,
          formatAgentToolResultForModel(entry.command, entry.result),
        ].join('\n'));
        steps.push(step);
        emitAgentSessionV2Progress(
          onProgress,
          progressEvent,
          createProgressSnapshot(),
        );
      },
      onStarted: ({ progressEvent, step }) => {
        historyLines.push([
          `Step ${triggerStepIndex} in-app target locate:`,
          `tool=${step.tool ?? step.action}`,
          `args=${compactAgentSessionText(JSON.stringify(step.args ?? {}), 520)}`,
        ].join('\n'));
        steps.push(step);
        emitAgentSessionV2Progress(
          onProgress,
          progressEvent,
          createProgressSnapshot(),
        );
      },
      resolveTimingStatus: (result) => resolveAgentSessionV2ToolTimingStatus(result, cancellationSignal),
      sourceText,
      stepIndex: locateStepIndex,
      taskState: getTaskState(),
      timingTracker,
      toolResults,
      userGoal,
    });
    if (targetResolutionExecution.kind === 'not-executed') {
      historyLines.push([
        `Step ${triggerStepIndex} skipped in-app target locate:`,
        `stage=${targetResolutionExecution.stage}`,
        `reason=${targetResolutionExecution.reason}`,
      ].join('\n'));
      return { executed: false, finalResult: null };
    }
    if (targetResolutionExecution.kind === 'budget-exceeded') {
      return {
        executed: false,
        finalResult: createBudgetExceededResult(),
      };
    }
    if (targetResolutionExecution.kind === 'cancelled') {
      return {
        executed: true,
        finalResult: createFinalResult({
          finalAnswer: AGENT_SESSION_V2_CANCELLED_ANSWER,
          status: 'cancelled',
        }),
      };
    }

    const locateEntry = targetResolutionExecution.collected.entry;
    const locateCommand = locateEntry.command;
    const locateResult = locateEntry.result;

    const visualActionApproval = resolveAgentSessionV2VisualActionApproval({
      command: locateCommand,
      result: locateResult,
      sourceText,
      toolResults,
      userGoal,
    });
    const visualApprovalResult = prepareAgentSessionV2PendingApprovalResult(
      visualActionApproval,
      locateStepIndex,
      'visual-action approval after in-app target locate',
      null,
    );
    if (visualApprovalResult.result) {
      return { executed: true, finalResult: visualApprovalResult.result };
    }
    if (visualApprovalResult.handled) {
      return { executed: true, finalResult: null };
    }

    const visualRefinement = await executeVisualRefinementObservation(
      getLatestAgentToolResult(toolResults),
      steps.length,
    );
    if (visualRefinement.finalResult) {
      return visualRefinement;
    }

    return { executed: true, finalResult: null };
  };

  return { executeVisualRefinementObservation, executeInAppTargetLocateObservation };
}
