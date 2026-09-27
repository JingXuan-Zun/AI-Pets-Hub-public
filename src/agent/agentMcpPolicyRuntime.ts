import { type AgentMcpToolCallResult } from './agentMcpTypes';
import { type AgentMcpPolicyDecision } from './agentMcpPolicy';

function createPolicyDeniedResult(decision: AgentMcpPolicyDecision): AgentMcpToolCallResult {
  return {
    content: [{ text: decision.reason, type: 'text' }],
    isError: true,
    structuredContent: {
      policy: {
        mode: decision.mode,
        reason: decision.reason,
        source: decision.source,
      },
    },
  };
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number | null,
  label: string,
  onTimeout?: () => void,
) {
  if (!timeoutMs) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      onTimeout?.();
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    promise.then(resolve, reject).finally(() => globalThis.clearTimeout(timeoutId));
  });
}

function createRetryAttemptRecord(attempt: number, error: unknown) {
  return {
    attempt,
    error: error instanceof Error ? error.message : String(error),
  };
}

function mergeRetryEvidence(
  result: AgentMcpToolCallResult,
  attempts: Array<{ attempt: number; error: string }>,
) {
  if (!attempts.length) {
    return result;
  }

  return {
    ...result,
    structuredContent: {
      ...(result.structuredContent ?? {}),
      policyRetry: {
        failedAttempts: attempts,
        retryCount: attempts.length,
      },
    },
  };
}

export async function executeMcpCallWithPolicy(
  decision: AgentMcpPolicyDecision,
  call: () => Promise<AgentMcpToolCallResult>,
  options: { onTimeout?: () => void } = {},
): Promise<AgentMcpToolCallResult> {
  if (!decision.allowed) {
    return createPolicyDeniedResult(decision);
  }

  let lastError: unknown = null;
  const failedAttempts: Array<{ attempt: number; error: string }> = [];
  const attempts = Math.max(1, decision.retryCount + 1);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await withTimeout(call(), decision.timeoutMs, 'MCP tool call', options.onTimeout);
      return mergeRetryEvidence(result, failedAttempts);
    } catch (error) {
      lastError = error;
      failedAttempts.push(createRetryAttemptRecord(attempt, error));
    }
  }

  return {
    content: [{ text: lastError instanceof Error ? lastError.message : String(lastError), type: 'text' }],
    isError: true,
    structuredContent: {
      policy: {
        failedAttempts,
        finalAttempt: attempts,
        mode: decision.mode,
        retryCount: decision.retryCount,
        source: decision.source,
        timeoutMs: decision.timeoutMs,
      },
    },
  };
}
