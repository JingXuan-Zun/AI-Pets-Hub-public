import type {
  AgentRuntimeAdapterContext,
  AgentRuntimeContinuation,
  AgentRuntimeProgressHandler,
  AgentRuntimeResult,
} from './agentRuntimeContract';

export const DEEPSEEK_HARNESS_ADAPTER_PROTOCOL_VERSION = 1;

export interface DeepSeekHarnessRuntimeRequest {
  apiKey: string;
  baseUrl: string;
  capabilityBridgeReady: boolean;
  continuation: AgentRuntimeContinuation | null;
  dshHome: string;
  model: string;
  protocolVersion: number;
  pythonPath: string;
  sourceText: string;
  sessionId: string;
  userGoal: string;
  workspace: string;
}

export interface DeepSeekHarnessRuntimeResponse {
  result: AgentRuntimeResult;
  protocolVersion: number;
}

export type DeepSeekHarnessRuntimeTransport = (
  request: DeepSeekHarnessRuntimeRequest,
  context: {
    adapterContext: AgentRuntimeAdapterContext;
    onProgress: AgentRuntimeProgressHandler;
  },
) => Promise<DeepSeekHarnessRuntimeResponse>;

export function createDeepSeekHarnessRuntimeRequest(options: {
  continuation?: AgentRuntimeContinuation | null;
  apiKey?: string;
  baseUrl?: string;
  capabilityBridgeReady?: boolean;
  dshHome?: string;
  model?: string;
  pythonPath?: string;
  sessionId?: string;
  sourceText: string;
  userGoal: string;
  workspace?: string;
}): DeepSeekHarnessRuntimeRequest {
  return {
    continuation: options.continuation ?? null,
    apiKey: options.apiKey ?? '',
    baseUrl: options.baseUrl ?? '',
    capabilityBridgeReady: options.capabilityBridgeReady === true,
    dshHome: options.dshHome ?? '',
    model: options.model ?? 'deepseek-v4-flash',
    protocolVersion: DEEPSEEK_HARNESS_ADAPTER_PROTOCOL_VERSION,
    pythonPath: options.pythonPath ?? '',
    sessionId: options.sessionId ?? `ai-pets-${Date.now()}`,
    sourceText: options.sourceText,
    userGoal: options.userGoal,
    workspace: options.workspace ?? '',
  };
}

export function validateDeepSeekHarnessRuntimeResponse(
  response: DeepSeekHarnessRuntimeResponse,
) {
  return response.protocolVersion === DEEPSEEK_HARNESS_ADAPTER_PROTOCOL_VERSION
    && Boolean(response.result?.continuation)
    && typeof response.result?.status === 'string';
}
