const MIN_TIMEOUT_MS = 90_000;
const MAX_TIMEOUT_MS = 120_000;
const NODE_STEP = 20;
const STEP_TIMEOUT_MS = 15_000;

export type NeuralPersonaRelationshipTimeoutReason =
  | 'relationship-candidate-local-timeout'
  | 'relationship-candidate-provider-timeout';

export function resolveNeuralPersonaRelationshipTimeoutMs(
  nodeCount: number,
  configuredTimeoutMs: number,
) {
  const adjustment = Math.floor(Math.max(0, nodeCount) / NODE_STEP) * STEP_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(
    MIN_TIMEOUT_MS, configuredTimeoutMs, MIN_TIMEOUT_MS + adjustment,
  ));
}

export function classifyNeuralPersonaRelationshipTimeout(
  error: unknown,
): NeuralPersonaRelationshipTimeoutReason | null {
  const message = (error instanceof Error ? error.message : String(error)).toLocaleLowerCase();
  if (/\((408|504|524)\)|gateway\s*(?:time-?out|timeout)|upstream\s*(?:time-?out|timeout)/iu
    .test(message)) return 'relationship-candidate-provider-timeout';
  if (message.includes('cognition request timed out')) {
    return 'relationship-candidate-local-timeout';
  }
  return null;
}

export async function executeNeuralPersonaRelationshipRequestWithRetry<T>(options: {
  execute: (attempt: number) => Promise<T>;
  onRetry?: (reason: NeuralPersonaRelationshipTimeoutReason) => void;
}) {
  try {
    return await options.execute(1);
  } catch (error) {
    const reason = classifyNeuralPersonaRelationshipTimeout(error);
    if (!reason) throw error;
    options.onRetry?.(reason);
    return options.execute(2);
  }
}

export function neuralPersonaRelationshipFailureMessage(reason: string) {
  if (reason === 'relationship-candidate-empty') {
    return '模型没有生成任何有效语义关系，未允许提交纯树状图；请重新分析。';
  }
  if (reason === 'relationship-candidate-local-timeout') {
    return '本地等待模型响应超时，系统已自动重试一次。';
  }
  if (reason === 'relationship-candidate-provider-timeout') {
    return '模型服务商或上游网关响应超时，系统已自动重试一次。';
  }
  if (reason === 'relationship-candidate-model-cancelled') return '关系分析已取消。';
  return reason;
}
