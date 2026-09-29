import { type AgentRuntimeToolResultEntry } from './agentRuntimeContract';
import {
  transitionAgentApprovedActionOutcome,
  type AgentApprovedActionOutcomeOptions,
  type AgentApprovedActionOutcomeTransition,
} from './agentApprovedActionOutcomeRuntime';
import {
  transitionAgentToolOutcome,
  type AgentToolOutcomeOptions,
  type AgentToolOutcomeTransition,
} from './agentToolOutcomeRuntime';
import {
  transitionAgentVerificationOutcome,
  type AgentVerificationOutcomeOptions,
  type AgentVerificationOutcomeTransition,
} from './agentVerificationOutcomeRuntime';
import {
  decideAgentTaskRuntimeLoopContinuation,
  type AgentTaskRuntimeLoopContinuationDecision,
} from './agentTaskRuntime';

export type AgentRuntimeContinuationTransition =
  | AgentApprovedActionOutcomeTransition
  | AgentToolOutcomeTransition
  | AgentVerificationOutcomeTransition;

export interface AgentRuntimeContinuationAdapterResult<Result> {
  executed: boolean;
  finalResult: Result | null;
}

export interface AgentRuntimeContinuationAdapterRequest {
  latestEntry: AgentRuntimeToolResultEntry;
  stepIndex: number;
  transition: AgentRuntimeContinuationTransition;
}

export type AgentRuntimeContinuationAdapter<Result> = (
  request: AgentRuntimeContinuationAdapterRequest,
) => AgentRuntimeContinuationAdapterResult<Result>
  | Promise<AgentRuntimeContinuationAdapterResult<Result>>;

export interface AgentRuntimeContinuationAdapters<Result> {
  approval: AgentRuntimeContinuationAdapter<Result>;
  planning: AgentRuntimeContinuationAdapter<Result>;
  recovery: AgentRuntimeContinuationAdapter<Result>;
  refine: AgentRuntimeContinuationAdapter<Result>;
  targetResolution: AgentRuntimeContinuationAdapter<Result>;
  terminal: AgentRuntimeContinuationAdapter<Result>;
  verification: AgentRuntimeContinuationAdapter<Result>;
}

export type AgentRuntimeContinuationAdapterKind = keyof AgentRuntimeContinuationAdapters<unknown>;

export interface AgentRuntimeContinuationDispatchResult<Result>
  extends AgentRuntimeContinuationAdapterResult<Result> {
  adapterKind: AgentRuntimeContinuationAdapterKind;
}

function selectAgentRuntimeContinuationAdapterKind(
  transition: AgentRuntimeContinuationTransition,
): AgentRuntimeContinuationAdapterKind {
  switch (transition.kind) {
    case 'terminal':
    case 'stop-needs-user':
      return 'terminal';
    case 'approval':
      return 'approval';
    case 'planning':
      return 'planning';
    case 'target-resolution':
      return 'targetResolution';
    case 'recovery':
      return 'recovery';
    case 'refine':
      return 'refine';
    case 'verification':
      return 'verification';
  }
}

export async function dispatchAgentRuntimeContinuation<Result>(options: {
  adapters: AgentRuntimeContinuationAdapters<Result>;
  latestEntry: AgentRuntimeToolResultEntry;
  stepIndex: number;
  transition: AgentRuntimeContinuationTransition;
}): Promise<AgentRuntimeContinuationDispatchResult<Result>> {
  const adapterKind = selectAgentRuntimeContinuationAdapterKind(options.transition);
  const adapterResult = await options.adapters[adapterKind]({
    latestEntry: options.latestEntry,
    stepIndex: options.stepIndex,
    transition: options.transition,
  });

  return {
    ...adapterResult,
    adapterKind,
  };
}

export async function runAgentApprovedActionContinuation<Result>(
  options: AgentApprovedActionOutcomeOptions & {
    adapters: AgentRuntimeContinuationAdapters<Result>;
    onTransition?: (transition: AgentApprovedActionOutcomeTransition) => void;
    stepIndex: number;
  },
): Promise<AgentRuntimeContinuationDispatchResult<Result> & {
  loopDecision: AgentTaskRuntimeLoopContinuationDecision<Result>;
  transition: AgentApprovedActionOutcomeTransition;
}> {
  const transition = transitionAgentApprovedActionOutcome(options);
  options.onTransition?.(transition);
  const dispatch = await dispatchAgentRuntimeContinuation({
    adapters: options.adapters,
    latestEntry: options.latestEntry,
    stepIndex: options.stepIndex,
    transition,
  });
  const loopDecision = decideAgentTaskRuntimeLoopContinuation({ dispatch });
  return {
    ...dispatch,
    loopDecision,
    transition,
  };
}

export async function runAgentVerificationContinuation<Result>(
  options: AgentVerificationOutcomeOptions & {
    adapters: AgentRuntimeContinuationAdapters<Result>;
    onTransition?: (transition: AgentVerificationOutcomeTransition) => void;
    stepIndex: number;
  },
): Promise<AgentRuntimeContinuationDispatchResult<Result> & {
  loopDecision: AgentTaskRuntimeLoopContinuationDecision<Result>;
  transition: AgentVerificationOutcomeTransition;
}> {
  const transition = transitionAgentVerificationOutcome(options);
  options.onTransition?.(transition);
  const dispatch = await dispatchAgentRuntimeContinuation({
    adapters: options.adapters,
    latestEntry: options.latestEntry,
    stepIndex: options.stepIndex,
    transition,
  });
  const loopDecision = decideAgentTaskRuntimeLoopContinuation({ dispatch });
  return {
    ...dispatch,
    loopDecision,
    transition,
  };
}

export async function runAgentToolOutcomeContinuation<Result>(
  options: AgentToolOutcomeOptions & {
    adapters: AgentRuntimeContinuationAdapters<Result>;
    onTransition?: (transition: AgentToolOutcomeTransition) => void;
    stepIndex: number;
  },
): Promise<AgentRuntimeContinuationDispatchResult<Result> & {
  loopDecision: AgentTaskRuntimeLoopContinuationDecision<Result>;
  transition: AgentToolOutcomeTransition;
}> {
  const transition = transitionAgentToolOutcome(options);
  options.onTransition?.(transition);
  const dispatch = await dispatchAgentRuntimeContinuation({
    adapters: options.adapters,
    latestEntry: options.latestEntry,
    stepIndex: options.stepIndex,
    transition,
  });
  const loopDecision = decideAgentTaskRuntimeLoopContinuation({ dispatch });
  return {
    ...dispatch,
    loopDecision,
    transition,
  };
}
