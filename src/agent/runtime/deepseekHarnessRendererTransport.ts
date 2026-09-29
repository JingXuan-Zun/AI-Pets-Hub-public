import type { AgentRuntimeAdapterContext, AgentRuntimeProgressHandler, AgentRuntimeResult } from './agentRuntimeContract';
import type {
  DeepSeekHarnessRuntimeRequest,
  DeepSeekHarnessRuntimeResponse,
} from './deepseekHarnessAdapterContract';

function createResult(request: DeepSeekHarnessRuntimeRequest, finalAnswer: string): AgentRuntimeResult {
  const continuation = request.continuation ?? {
    historyLines: [], sourceText: request.sourceText, steps: [], traceEvents: [], toolResults: [], userGoal: request.userGoal,
  };
  return {
    continuation: { ...continuation, sourceText: request.sourceText, userGoal: request.userGoal },
    finalAnswer,
    sourceText: request.sourceText,
    status: 'completed',
    steps: [],
    traceEvents: [],
    toolResults: [],
  };
}

export async function runDeepSeekHarnessRendererTransport(
  request: DeepSeekHarnessRuntimeRequest,
  context: { adapterContext: AgentRuntimeAdapterContext; onProgress: AgentRuntimeProgressHandler },
): Promise<DeepSeekHarnessRuntimeResponse> {
  const runner = window.desktopPetShell?.runDeepSeekHarness;
  if (!runner) throw new Error('DeepSeek Harness bridge is unavailable.');
  context.onProgress({
    continuation: request.continuation ?? createResult(request, '').continuation,
    message: 'DeepSeek Harness 正在执行任务。',
    stepIndex: 0,
    type: 'model-thinking',
  });
  const cancelDeepSeekHarness = window.desktopPetShell?.cancelDeepSeekHarness;
  let cancelled = false;
  const cancelRequest = () => {
    cancelled = true;
    void cancelDeepSeekHarness?.({ requestId: request.sessionId, sessionId: request.sessionId });
  };
  context.adapterContext.cancellationSignal?.addEventListener('abort', cancelRequest, { once: true });
  const response = await runner({
    apiKey: request.apiKey,
    baseUrl: request.baseUrl,
    capabilityBridgeReady: request.capabilityBridgeReady,
    dshHome: request.dshHome,
    model: request.model,
    pythonPath: request.pythonPath,
    requestId: request.sessionId,
    sessionId: request.sessionId,
    userGoal: request.userGoal,
    workspace: request.workspace,
  });
  context.adapterContext.cancellationSignal?.removeEventListener('abort', cancelRequest);
  if (cancelled) throw new Error('DeepSeek Harness task cancelled.');
  if (!response.ok || !response.finalResponse?.trim()) {
    throw new Error(response.error || 'DeepSeek Harness did not return a response.');
  }
  return {
    protocolVersion: request.protocolVersion,
    result: createResult(request, response.finalResponse.trim()),
  };
}
