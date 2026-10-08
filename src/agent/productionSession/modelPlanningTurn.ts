import { type AgentChatCommand } from '../agentChatCommand';
import { type AgentRuntimeResult } from '../runtime/agentRuntimeContract';
import { runAgentModelDecisionTurn, type AgentModelDecision, type AgentModelDecisionTurnOutcome } from '../runtime/agentModelDecisionRuntime';
import { type AgentProductionSessionModelCaller, type AgentProductionSessionModelRequest } from '../agentProductionSessionContract';
import { createAgentPlanningContext, createAgentModelInput, type CreateAgentPlanningContextOptions, type AgentPlanningContextAdapters } from '../runtime/agentPlanningContextRuntime';
import { type AgentRequestedActionKind } from '../runtime/agentActionCoverage';
import { createAgentGuardedWorkingMemoryText } from '../runtime/agentWorkingMemoryBias';
import { parseAgentDecisionContract } from '../runtime/agentDecisionContract';
import { createAgentInvalidModelOutputRepairText } from '../runtime/agentDecisionRepairSignal';
import { AGENT_PRODUCTION_EXECUTION_CANCELLED_ANSWER as AGENT_SESSION_V2_CANCELLED_ANSWER, isAgentProductionExecutionCancellationRequested as isAgentSessionV2CancellationRequested } from './executionTiming';
import { type createAgentProductionExecutionTimingTracker } from './executionTiming';
import { type createAgentProductionPostApprovalVerification } from './postApprovalVerification';
import { type createAgentProductionSingleToolExecution } from './singleToolExecution';

type VerificationDependencies = Parameters<typeof createAgentProductionPostApprovalVerification>[0];
type PlanningOptions = CreateAgentPlanningContextOptions<Set<AgentRequestedActionKind>>;
interface ModelPlanningTurnDependencies extends Pick<VerificationDependencies,
  'sourceText' | 'userGoal' | 'historyLines' | 'steps' | 'toolResults' | 'cancellationSignal'
  | 'appendTraceEvent' | 'createBudgetExceededResult' | 'onProgress' | 'createProgressSnapshot' | 'emitProgress' | 'compactText'
>, Pick<PlanningOptions, 'traceEvents' | 'workingMemory' | 'workingMemoryText'> {
  timingTracker: ReturnType<typeof createAgentProductionExecutionTimingTracker>;
  modelCaller: AgentProductionSessionModelCaller;
  settings: AgentProductionSessionModelRequest['settings'];
  systemInstruction: string;
  importedSkillCatalog: string;
  activeImportedSkillInstruction: string;
  personaBehaviorContract?: string;
  createPlanningContextAdapters: () => AgentPlanningContextAdapters<Set<AgentRequestedActionKind>>;
  createFinalResult: Parameters<typeof createAgentProductionSingleToolExecution>[0]['createFinalResult'];
  getInitialCommand: () => AgentChatCommand | null;
  clearInitialCommand: () => void;
  maxModelOutputRepairRuns: number;
  getModelOutputRepairRuns: () => number;
  incrementModelOutputRepairRuns: () => void;
}
type ModelPlanningTurnResult =
  | {kind: 'continue'}
  | {kind: 'final'; finalResult: AgentRuntimeResult}
  | {kind: 'accepted'; decision: AgentModelDecision; modelDecisionTurn: Extract<AgentModelDecisionTurnOutcome, {type: 'accepted'}>};

export function createAgentProductionModelPlanningTurn(dependencies: ModelPlanningTurnDependencies) {
  const {sourceText, userGoal, historyLines, steps, toolResults, traceEvents, workingMemory, workingMemoryText, timingTracker, cancellationSignal, appendTraceEvent, createBudgetExceededResult, onProgress, createProgressSnapshot, modelCaller, settings, importedSkillCatalog, activeImportedSkillInstruction, personaBehaviorContract, createFinalResult, getInitialCommand, clearInitialCommand, maxModelOutputRepairRuns, getModelOutputRepairRuns, incrementModelOutputRepairRuns,
    systemInstruction: AGENT_SESSION_V2_SYSTEM_INSTRUCTION,
    createPlanningContextAdapters: createAgentSessionV2PlanningContextAdapters,
    compactText: compactAgentSessionText, emitProgress: emitAgentSessionV2Progress,
  } = dependencies;
  const executeModelPlanningTurn = async (options: {runStepIndex: number; stepIndex: number; onStopped: (turn: AgentModelDecisionTurnOutcome) => void}): Promise<ModelPlanningTurnResult> => {
    const {runStepIndex, stepIndex, onStopped} = options;
    const planningContext = createAgentPlanningContext({
      adapters: createAgentSessionV2PlanningContextAdapters(),
      sourceText,
      steps,
      toolResults,
      traceEvents,
      userGoal,
      workingMemory,
      workingMemoryText,
    });
    const modelInput = createAgentModelInput({
      formatWorkingMemory: createAgentGuardedWorkingMemoryText,
      historyLines,
      planningContext,
      sourceText,
      userGoal,
    });
    const preModelBudgetStopReason = timingTracker.getBudgetStopReason();
    if (preModelBudgetStopReason) {
      timingTracker.markStopReason(preModelBudgetStopReason);
      return {kind: 'final', finalResult: createBudgetExceededResult()};
    }

    emitAgentSessionV2Progress(
      onProgress,
      {
        message: runStepIndex === 1
          ? 'Agent is understanding the request and choosing the first step.'
          : 'Agent is reading the latest result and choosing the next step.',
        stepIndex,
        type: 'model-thinking',
      },
      createProgressSnapshot(),
    );

    const modelDecisionTurn = await runAgentModelDecisionTurn<AgentModelDecision>({
      isCancellationRequested: () => isAgentSessionV2CancellationRequested(cancellationSignal),
      modelCaller,
      modelRequest: {
        settings,
        signal: cancellationSignal,
        systemInstruction: [
          AGENT_SESSION_V2_SYSTEM_INSTRUCTION,
          importedSkillCatalog,
          activeImportedSkillInstruction,
          personaBehaviorContract?.trim() ?? '',
        ].filter(Boolean).join('\n\n'),
        userInput: modelInput,
      },
      parseDecision: parseAgentDecisionContract,
      repairRuns: getModelOutputRepairRuns(),
      stepIndex,
      timingTracker,
    });
    for (const traceEvent of modelDecisionTurn.traceEvents) {
      appendTraceEvent(traceEvent);
    }

    if (modelDecisionTurn.type === 'model-failed') {
      steps.push(modelDecisionTurn.step);
      onStopped(modelDecisionTurn);

      return {kind: 'final', finalResult: createFinalResult({
        finalAnswer: `Model call failed: ${modelDecisionTurn.errorText}`,
        status: 'failed',
      })};
    }

    if (modelDecisionTurn.type === 'cancelled-after-output') {
      onStopped(modelDecisionTurn);
      return {kind: 'final', finalResult: createFinalResult({
        finalAnswer: AGENT_SESSION_V2_CANCELLED_ANSWER,
        status: 'cancelled',
      })};
    }

    if (modelDecisionTurn.type === 'invalid-output') {
      if (getModelOutputRepairRuns() < maxModelOutputRepairRuns) {
        incrementModelOutputRepairRuns();
        historyLines.push([
          `Step ${stepIndex} rejected invalid model output:`,
          createAgentInvalidModelOutputRepairText(modelDecisionTurn.modelResponse),
        ].join('\n'));
        return {kind: 'continue'};
      }

      steps.push({
        action: 'final_answer',
        errorText: 'Model did not return valid AgentSessionV2 JSON.',
        index: stepIndex,
        modelResponse: modelDecisionTurn.modelResponse,
        summary: 'AgentSessionV2 model response was not valid JSON.',
        timing: modelDecisionTurn.timing,
      });

      return {kind: 'final', finalResult: createFinalResult({
        finalAnswer: 'The model did not return a usable next step, so I stopped instead of treating normal chat as a command.',
        status: 'failed',
      })};
    }

    const modelDecision = modelDecisionTurn.decision;
    const routedInitialToolCall = getInitialCommand()?.toolCall;
    const decision = routedInitialToolCall
      ? {
          ...modelDecision,
          action: 'tool_call' as const,
          args: routedInitialToolCall.input,
          reason: 'The user explicitly selected a saved follow-up action; dispatch that exact action through the standard permission and approval lifecycle.',
          tool: routedInitialToolCall.name,
        }
      : modelDecision;
    if (routedInitialToolCall) {
      historyLines.push([
        'Explicit saved follow-up selected by the user:',
        `tool=${routedInitialToolCall.name}`,
        `args=${compactAgentSessionText(routedInitialToolCall.input, 360)}`,
      ].join('\n'));
      clearInitialCommand();
    }
    steps.push(modelDecisionTurn.step);
    emitAgentSessionV2Progress(
      onProgress,
      {
        message: decision.action === 'tool_calls'
          ? 'Agent selected a parallel read-only observation batch.'
          : decision.action === 'tool_call'
            ? `Agent selected tool: ${decision.tool ?? 'unknown'}.`
            : decision.action === 'ask_user'
              ? 'Agent needs one more detail from the user.'
              : 'Agent is preparing the final answer.',
        stepIndex,
        type: 'model-decision',
      },
      createProgressSnapshot(),
    );

    return {kind: 'accepted', decision, modelDecisionTurn};
  };
  return { executeModelPlanningTurn };
}
