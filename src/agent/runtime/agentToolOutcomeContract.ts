export type AgentToolExecutionState = 'executed' | 'not_executed' | 'blocked';

export type AgentToolEffectState = 'changed' | 'no-op' | 'uncertain' | 'none';

export type AgentToolVerificationState =
  | 'satisfied'
  | 'partial'
  | 'unknown'
  | 'blocked';

export type AgentToolRetryPolicy = 'safe' | 'observe-first' | 'halt';

export type AgentToolOutcomeClass =
  | 'success'
  | 'failure'
  | 'unknown'
  | 'not_executed';

export interface AgentToolOutcomeContract {
  classification: AgentToolOutcomeClass;
  effect: AgentToolEffectState;
  execution: AgentToolExecutionState;
  retryPolicy: AgentToolRetryPolicy;
  uncertainEffects: boolean;
  verification: AgentToolVerificationState;
}

export interface CreateAgentToolOutcomeInput {
  effect?: AgentToolEffectState;
  execution: AgentToolExecutionState;
  nonIdempotentSideEffect?: boolean;
  verification?: AgentToolVerificationState;
}

function normalizeEffect(
  execution: AgentToolExecutionState,
  effect: AgentToolEffectState | undefined,
) {
  if (execution !== 'executed') return 'none' as const;
  return effect ?? 'uncertain';
}

function normalizeVerification(
  execution: AgentToolExecutionState,
  verification: AgentToolVerificationState | undefined,
) {
  if (execution === 'blocked') return 'blocked' as const;
  if (execution === 'not_executed') return 'unknown' as const;
  return verification ?? 'unknown';
}

export function createAgentToolOutcomeContract(
  input: CreateAgentToolOutcomeInput,
): AgentToolOutcomeContract {
  const effect = normalizeEffect(input.execution, input.effect);
  const verification = normalizeVerification(input.execution, input.verification);
  const uncertainEffects = input.execution === 'executed'
    && effect !== 'none'
    && (effect === 'uncertain' || verification === 'unknown' || verification === 'partial');
  const classification: AgentToolOutcomeClass = input.execution === 'not_executed'
    ? 'not_executed'
    : input.execution === 'blocked'
      ? 'failure'
      : verification === 'satisfied' && !uncertainEffects
        ? 'success'
        : verification === 'blocked' || effect === 'uncertain'
          ? 'failure'
          : 'unknown';
  const retryPolicy: AgentToolRetryPolicy = uncertainEffects && input.nonIdempotentSideEffect
    ? 'halt'
    : uncertainEffects
      ? 'observe-first'
      : classification === 'success' || effect === 'no-op' || effect === 'none'
        ? 'safe'
        : 'observe-first';

  return {
    classification,
    effect,
    execution: input.execution,
    retryPolicy,
    uncertainEffects,
    verification,
  };
}

export function assertAgentToolOutcomeContract(
  outcome: AgentToolOutcomeContract,
): void {
  if (outcome.execution !== 'executed' && outcome.effect !== 'none') {
    throw new Error('Non-executed tools must have effect=none.');
  }
  if (outcome.retryPolicy === 'halt' && !outcome.uncertainEffects) {
    throw new Error('halt retry policy requires uncertainEffects=true.');
  }
  if (outcome.classification === 'success' && outcome.verification !== 'satisfied') {
    throw new Error('success classification requires satisfied verification.');
  }
}
