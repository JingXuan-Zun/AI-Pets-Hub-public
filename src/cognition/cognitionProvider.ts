export const COGNITION_REQUEST_VERSION = 'cognition-request.v1' as const;
export const COGNITION_RESULT_VERSION = 'cognition-result.v1' as const;

export type CognitionTaskKind =
  | 'agent-decision'
  | 'conversation-reply'
  | 'memory-retrieval'
  | 'proactive-response'
  | 'result-interpretation'
  | 'understanding'
  | 'world-assessment';

export type CognitionProviderKind = 'cloud-model' | 'local-model' | 'neural' | 'rule';

export type CognitionMessage = {
  content: string;
  role: 'assistant' | 'system' | 'user';
};

export type CognitionSemanticEvent = {
  confidence?: number;
  kind: string;
  payload?: Record<string, unknown>;
};

export type CognitionRequest = {
  context?: {
    messages?: CognitionMessage[];
    metadata?: Record<string, unknown>;
  };
  input: {
    systemInstruction?: string;
    text: string;
  };
  requestId: string;
  signal?: AbortSignal | null;
  task: CognitionTaskKind;
  timeoutMs?: number | null;
  version: typeof COGNITION_REQUEST_VERSION;
};

export type CognitionProviderDescriptor = {
  capabilities: {
    cancellation: boolean;
    maxContextTokens: number | null;
    streaming: boolean;
    tasks: CognitionTaskKind[];
  };
  id: string;
  kind: CognitionProviderKind;
  version: string;
};

export type CognitionProviderResponse = {
  degraded?: boolean;
  outputText: string;
  semanticEvents?: CognitionSemanticEvent[];
};

export type CognitionProvider = {
  descriptor: CognitionProviderDescriptor;
  invoke: (request: CognitionRequest) => Promise<CognitionProviderResponse>;
};

export type CognitionFailureCode =
  | 'cancelled'
  | 'failed'
  | 'invalid-response'
  | 'timed-out'
  | 'unsupported-task';

type CognitionResultBase = {
  completedAtMs: number;
  providerId: string;
  requestId: string;
  version: typeof COGNITION_RESULT_VERSION;
};

export type CognitionResult =
  | (CognitionResultBase & {
      outputText: string;
      semanticEvents: CognitionSemanticEvent[];
      status: 'completed' | 'degraded';
    })
  | (CognitionResultBase & {
      error: {
        code: CognitionFailureCode;
        message: string;
      };
      status: 'cancelled' | 'failed' | 'timed-out';
    });

function createResultBase(request: CognitionRequest, provider: CognitionProvider): CognitionResultBase {
  return {
    completedAtMs: Date.now(),
    providerId: provider.descriptor.id,
    requestId: request.requestId,
    version: COGNITION_RESULT_VERSION,
  };
}

function createFailureResult(options: {
  code: CognitionFailureCode;
  message: string;
  provider: CognitionProvider;
  request: CognitionRequest;
  status: 'cancelled' | 'failed' | 'timed-out';
}): CognitionResult {
  return {
    ...createResultBase(options.request, options.provider),
    error: {
      code: options.code,
      message: options.message,
    },
    status: options.status,
  };
}

function normalizeTimeoutMs(timeoutMs?: number | null) {
  if (timeoutMs == null) {
    return null;
  }

  return Number.isFinite(timeoutMs) && timeoutMs > 0
    ? Math.floor(timeoutMs)
    : null;
}

export async function runCognitionProvider(
  provider: CognitionProvider,
  request: CognitionRequest,
): Promise<CognitionResult> {
  if (!provider.descriptor.capabilities.tasks.includes(request.task)) {
    return createFailureResult({
      code: 'unsupported-task',
      message: `Cognition provider ${provider.descriptor.id} does not support ${request.task}.`,
      provider,
      request,
      status: 'failed',
    });
  }

  if (request.signal?.aborted) {
    return createFailureResult({
      code: 'cancelled',
      message: 'Cognition request was cancelled.',
      provider,
      request,
      status: 'cancelled',
    });
  }

  const controller = new AbortController();
  const timeoutMs = normalizeTimeoutMs(request.timeoutMs);
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let rejectAbort: (() => void) | null = null;
  const abortPromise = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(new Error('cognition-request-aborted'));
  });
  const abort = () => {
    controller.abort();
    rejectAbort?.();
  };
  const onExternalAbort = () => abort();
  request.signal?.addEventListener('abort', onExternalAbort, { once: true });

  if (timeoutMs !== null) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      abort();
    }, timeoutMs);
  }

  try {
    const response = await Promise.race([
      provider.invoke({ ...request, signal: controller.signal }),
      abortPromise,
    ]);
    const outputText = response.outputText?.trim();
    if (!outputText) {
      return createFailureResult({
        code: 'invalid-response',
        message: `Cognition provider ${provider.descriptor.id} returned no usable text.`,
        provider,
        request,
        status: 'failed',
      });
    }

    return {
      ...createResultBase(request, provider),
      outputText,
      semanticEvents: response.semanticEvents ?? [],
      status: response.degraded ? 'degraded' : 'completed',
    };
  } catch (error) {
    if (timedOut) {
      return createFailureResult({
        code: 'timed-out',
        message: `Cognition request timed out after ${timeoutMs}ms.`,
        provider,
        request,
        status: 'timed-out',
      });
    }

    if (request.signal?.aborted || controller.signal.aborted) {
      return createFailureResult({
        code: 'cancelled',
        message: 'Cognition request was cancelled.',
        provider,
        request,
        status: 'cancelled',
      });
    }

    return createFailureResult({
      code: 'failed',
      message: error instanceof Error ? error.message : String(error),
      provider,
      request,
      status: 'failed',
    });
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    request.signal?.removeEventListener('abort', onExternalAbort);
  }
}

let cognitionRequestSequence = 0;

export function createCognitionRequestId(task: CognitionTaskKind, nowMs = Date.now()) {
  cognitionRequestSequence += 1;
  return `${task}:${nowMs}:${cognitionRequestSequence}`;
}

export function requireCognitionOutputText(result: CognitionResult) {
  if (!('error' in result)) {
    return result.outputText;
  }

  throw new Error(result.error.message);
}
