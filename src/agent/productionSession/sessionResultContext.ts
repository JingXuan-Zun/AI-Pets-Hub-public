import { type AgentRuntimePendingApproval as AgentSessionV2PendingApproval, type AgentRuntimeStatus as AgentSessionV2Status, type AgentRuntimeDiagnosticEnvelope, type AgentTaskRuntimeStateRecord } from '../runtime/agentRuntimeContract';
import { createAgentTaskRuntimeV4SessionV2Shadow } from '../agentTaskRuntimeV4SessionV2ShadowAdapter';
import { type AgentSessionV3PilotShadowInputCollector } from '../agentSessionV3PilotShadowInputCollector';
import type { runAgentSessionV3PilotShadowEventList } from '../agentSessionV3PilotShadowMode';
import { type collectAgentRuntimeLifecycleFacts } from '../runtime/agentProductionLifecycleFacts';
import { type createAgentProductionSessionPresentation, type AgentProductionPresentationDebugInfo as AgentSessionV2DebugInfo } from './sessionPresentation';
import { type createAgentProductionExecutionTimingTracker } from './executionTiming';

type Presentation = ReturnType<typeof createAgentProductionSessionPresentation>;
type ResultOptions = Parameters<Presentation['createAgentProductionPresentationFinalResult']>[0];
type ShadowRunner = typeof runAgentSessionV3PilotShadowEventList;
interface SessionResultContextDependencies extends Pick<ResultOptions, 'sourceText' | 'userGoal' | 'historyLines' | 'steps' | 'toolResults' | 'traceEvents'> {
  diagnostics: AgentRuntimeDiagnosticEnvelope[];
  getTaskState: () => AgentTaskRuntimeStateRecord | null;
  timingTracker: ReturnType<typeof createAgentProductionExecutionTimingTracker>;
  getProductionLifecycleFacts: () => ReturnType<typeof collectAgentRuntimeLifecycleFacts>;
  v3PilotShadowInputCollector: AgentSessionV3PilotShadowInputCollector | null;
  runAgentSessionV3PilotShadowEventList: ShadowRunner | null;
  v3PilotShadow?: Partial<Pick<Parameters<ShadowRunner>[0], 'debugSummary' | 'maxTransitions'>> | null;
  createPresentationFinalResult: Presentation['createAgentProductionPresentationFinalResult'];
  createPresentationBudgetExceededResult: Presentation['createAgentProductionPresentationBudgetExceededResult'];
  createBudgetExceededAnswer: Presentation['createAgentProductionPresentationBudgetExceededAnswer'];
}

export function createAgentProductionSessionResultContext(dependencies: SessionResultContextDependencies) {
  const {sourceText, userGoal, historyLines, steps, toolResults, traceEvents, diagnostics, getTaskState, timingTracker, getProductionLifecycleFacts, v3PilotShadowInputCollector, runAgentSessionV3PilotShadowEventList, v3PilotShadow,
    createPresentationFinalResult: createAgentSessionV2FinalResult,
    createPresentationBudgetExceededResult: createAgentSessionV2BudgetExceededResult,
    createBudgetExceededAnswer: createAgentSessionV2BudgetExceededAnswer,
  } = dependencies;
  const createProgressSnapshot = () => ({
    diagnostics,
    historyLines,
    sourceText,
    steps,
    taskState: getTaskState(),
    timing: timingTracker.snapshot(),
    traceEvents,
    toolResults,
    userGoal,
  });
  const createAgentSessionV2DebugInfo = (options: {
    pendingApproval?: AgentSessionV2PendingApproval | null;
    status: AgentSessionV2Status;
  }): AgentSessionV2DebugInfo | null => {
    const v4TaskShadow = createAgentTaskRuntimeV4SessionV2Shadow({
      productionLifecycleFacts: getProductionLifecycleFacts(),
      pendingApproval: options.pendingApproval ?? null,
      previousRuntimeShadowEvents: [
        ...diagnostics
          .filter((diagnostic) => (
            diagnostic.category === 'runtime-shadow'
            || diagnostic.category === 'approval-continuation'
          ))
          .map((diagnostic) => ({
            details: diagnostic.payload.details ?? undefined,
            status: diagnostic.payload.status ?? undefined,
            summary: diagnostic.payload.summary,
            tool: diagnostic.payload.tool ?? undefined,
          })),
        ...traceEvents
          .filter((event) => event.type === 'runtime_shadow')
          .map((event) => ({
            details: event.details,
            status: event.status,
            summary: event.summary,
            tool: event.tool,
          })),
      ],
      sourceText,
      status: options.status,
      taskId: `session-v2:${sourceText.slice(0, 80)}`,
      toolResults,
      userGoal,
    });

    return {
      v4TaskShadow,
      ...(v3PilotShadowInputCollector && runAgentSessionV3PilotShadowEventList
        ? {
            v3PilotShadow: runAgentSessionV3PilotShadowEventList({
              debugSummary: v3PilotShadow?.debugSummary ?? null,
              enabled: true,
              events: v3PilotShadowInputCollector.getEvents(),
              maxTransitions: v3PilotShadow?.maxTransitions ?? null,
            }),
          }
        : {}),
    };
  };
  const createFinalResult = (
    resultOptions: Pick<
      Parameters<typeof createAgentSessionV2FinalResult>[0],
      'finalAnswer' | 'status'
    > & Partial<Parameters<typeof createAgentSessionV2FinalResult>[0]>,
  ) => {
    const debug = resultOptions.debug ?? createAgentSessionV2DebugInfo({
      pendingApproval: resultOptions.pendingApproval ?? null,
      status: resultOptions.status,
    });
    return createAgentSessionV2FinalResult({
      ...resultOptions,
      debug,
      diagnostics,
      historyLines,
      sourceText,
      steps,
      taskState: getTaskState(),
      timing: timingTracker.snapshot(),
      traceEvents,
      toolResults,
      userGoal,
    });
  };
  const createBudgetExceededResult = (finalAnswer?: string) => {
    const timing = timingTracker.snapshot();
    return createAgentSessionV2BudgetExceededResult({
      debug: createAgentSessionV2DebugInfo({
        pendingApproval: null,
        status: 'budget-exceeded',
      }),
      diagnostics,
      finalAnswer: finalAnswer ?? createAgentSessionV2BudgetExceededAnswer(timing),
      historyLines,
      sourceText,
      steps,
      taskState: getTaskState(),
      timing,
      traceEvents,
      toolResults,
      userGoal,
    });
  };
  return { createProgressSnapshot, createFinalResult, createBudgetExceededResult };
}
