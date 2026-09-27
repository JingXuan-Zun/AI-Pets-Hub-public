import {
  type AgentProductionSessionModelCaller,
  type AgentProductionSessionModelRequest,
} from '../agentProductionSessionContract';
import {
  type AgentRuntimeDecisionAction,
  type AgentRuntimeStep,
  type AgentRuntimeTimingEntry,
  type AgentRuntimeTimingEntryStatus,
  type AgentRuntimeTraceEventDraft,
  type AgentRuntimeUnderstanding,
} from './agentRuntimeContract';
import {
  createAgentDecisionAcceptedTraceSummary,
  createAgentDecisionRejectedTraceSummary,
  createAgentModelOutputFailedTraceSummary,
  createAgentModelOutputTraceSummary,
} from './agentDecisionTraceSummary';

export interface AgentModelParallelToolCall {
  args?: Record<string, unknown>;
  reason?: string | null;
  tool: string;
}

export interface AgentModelDecision {
  action: AgentRuntimeDecisionAction;
  args?: Record<string, unknown>;
  message?: string;
  reason?: string;
  tool?: string | null;
  tools?: AgentModelParallelToolCall[];
  understanding?: AgentRuntimeUnderstanding;
}

export interface AgentModelDecisionTimingPort {
  beginEntry: (
    kind: 'model',
    label: string,
    stepIndex: number,
    detail?: string | null,
  ) => AgentRuntimeTimingEntry;
  finishEntry: (
    entry: AgentRuntimeTimingEntry,
    status: AgentRuntimeTimingEntryStatus,
    detail?: string | null,
  ) => AgentRuntimeTimingEntry;
}

export type AgentModelDecisionTurnOutcome<Decision extends AgentModelDecision = AgentModelDecision> =
  | {
      decision: Decision;
      modelResponse: string;
      step: AgentRuntimeStep;
      timing: AgentRuntimeTimingEntry;
      traceEvents: AgentRuntimeTraceEventDraft[];
      type: 'accepted';
    }
  | {
      modelResponse: string;
      timing: AgentRuntimeTimingEntry;
      traceEvents: AgentRuntimeTraceEventDraft[];
      type: 'invalid-output';
    }
  | {
      errorText: string;
      step: AgentRuntimeStep;
      timing: AgentRuntimeTimingEntry;
      traceEvents: AgentRuntimeTraceEventDraft[];
      type: 'model-failed';
    }
  | {
      modelResponse: string;
      timing: AgentRuntimeTimingEntry;
      traceEvents: AgentRuntimeTraceEventDraft[];
      type: 'cancelled-after-output';
    };

export interface RunAgentModelDecisionTurnOptions<Decision extends AgentModelDecision> {
  isCancellationRequested: () => boolean;
  modelCaller: AgentProductionSessionModelCaller;
  modelRequest: AgentProductionSessionModelRequest;
  parseDecision: (modelResponse: string) => Decision | null;
  repairRuns: number;
  stepIndex: number;
  timingTracker: AgentModelDecisionTimingPort;
}

function getAgentModelDecisionToolText(decision: AgentModelDecision) {
  return decision.action === 'tool_calls'
    ? decision.tools?.map((toolCall) => toolCall.tool).join(', ') ?? null
    : decision.tool ?? null;
}

function createAgentModelDecisionStep(options: {
  decision: AgentModelDecision;
  modelResponse: string;
  stepIndex: number;
  timing: AgentRuntimeTimingEntry;
}): AgentRuntimeStep {
  return {
    action: options.decision.action,
    args: options.decision.args,
    index: options.stepIndex,
    modelResponse: options.modelResponse,
    reason: options.decision.reason ?? null,
    summary: options.decision.message ?? options.decision.reason ?? `Agent selected ${options.decision.action}.`,
    timing: options.timing,
    tool: getAgentModelDecisionToolText(options.decision),
    understanding: options.decision.understanding ?? null,
  };
}

export async function runAgentModelDecisionTurn<Decision extends AgentModelDecision>(
  options: RunAgentModelDecisionTurnOptions<Decision>,
): Promise<AgentModelDecisionTurnOutcome<Decision>> {
  const modelTiming = options.timingTracker.beginEntry('model', 'decision', options.stepIndex);
  let modelResponse = '';

  try {
    modelResponse = await options.modelCaller(options.modelRequest);
  } catch (error) {
    const errorText = error instanceof Error ? error.message : String(error);
    const timing = options.timingTracker.finishEntry(modelTiming, 'failed', errorText);
    return {
      errorText,
      step: {
        action: 'final_answer',
        errorText,
        index: options.stepIndex,
        summary: `Agent model call failed: ${errorText}`,
        timing,
      },
      timing,
      traceEvents: [{
        details: { errorText },
        status: 'failed',
        stepIndex: options.stepIndex,
        summary: createAgentModelOutputFailedTraceSummary(),
        type: 'model_output',
      }],
      type: 'model-failed',
    };
  }

  const timing = options.timingTracker.finishEntry(
    modelTiming,
    options.isCancellationRequested() ? 'cancelled' : 'success',
  );
  const modelOutputTraceEvent: AgentRuntimeTraceEventDraft = {
    details: {
      durationMs: timing.durationMs,
      outputPreview: modelResponse,
    },
    status: timing.status,
    stepIndex: options.stepIndex,
    summary: createAgentModelOutputTraceSummary(),
    type: 'model_output',
  };

  if (options.isCancellationRequested()) {
    return {
      modelResponse,
      timing,
      traceEvents: [modelOutputTraceEvent],
      type: 'cancelled-after-output',
    };
  }

  const decision = options.parseDecision(modelResponse);
  if (!decision) {
    return {
      modelResponse,
      timing,
      traceEvents: [
        modelOutputTraceEvent,
        {
          details: {
            outputPreview: modelResponse,
            repairRuns: options.repairRuns,
          },
          status: 'invalid-json',
          stepIndex: options.stepIndex,
          summary: createAgentDecisionRejectedTraceSummary(),
          type: 'decision_rejected',
        },
      ],
      type: 'invalid-output',
    };
  }

  return {
    decision,
    modelResponse,
    step: createAgentModelDecisionStep({
      decision,
      modelResponse,
      stepIndex: options.stepIndex,
      timing,
    }),
    timing,
    traceEvents: [
      modelOutputTraceEvent,
      {
        action: decision.action,
        details: {
          reason: decision.reason,
          toolCount: decision.tools?.length,
        },
        status: 'parsed',
        stepIndex: options.stepIndex,
        summary: createAgentDecisionAcceptedTraceSummary(decision.action),
        tool: getAgentModelDecisionToolText(decision),
        type: 'decision_parsed',
      },
    ],
    type: 'accepted',
  };
}
