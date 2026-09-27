import type {
  AgentRuntimeAdapter,
  AgentRuntimeAdapterContext,
  AgentRuntimeResult,
} from './agentRuntimeContract';
import { createAgentRuntimeProductionAdapter } from './agentRuntimeProductionAdapter';
import {
  createUnavailableAgentRuntimeAdapter,
  type AgentRuntimeProviderId,
} from './agentRuntimeProviderRegistry';
import {
  createDeepSeekHarnessRuntimeRequest,
  validateDeepSeekHarnessRuntimeResponse,
  type DeepSeekHarnessRuntimeTransport,
} from './deepseekHarnessAdapterContract';

type RuntimeRunner<Result> = (context: AgentRuntimeAdapterContext) => Promise<Result>;

export function createNativeAgentRuntimeAdapter<Result>(run: RuntimeRunner<Result>) {
  return createAgentRuntimeProductionAdapter({ id: 'native-runtime-adapter', run });
}

export function createAgentRuntimeAdapter<Result>(
  providerId: AgentRuntimeProviderId,
  nativeRun: RuntimeRunner<Result>,
): AgentRuntimeAdapter<Result> {
  if (providerId === 'native') {
    return createNativeAgentRuntimeAdapter(nativeRun);
  }

  return createUnavailableAgentRuntimeAdapter<Result>(providerId);
}

export function createDeepSeekHarnessRuntimeAdapter(options: {
  continuation?: AgentRuntimeResult['continuation'] | null;
  apiKey?: string;
  baseUrl?: string;
  capabilityBridgeReady?: boolean;
  dshHome?: string;
  model?: string;
  pythonPath?: string;
  sessionId?: string;
  sourceText: string;
  transport: DeepSeekHarnessRuntimeTransport;
  userGoal: string;
  workspace?: string;
}): AgentRuntimeAdapter<AgentRuntimeResult> {
  return {
    id: 'deepseek-harness-adapter',
    async run(context) {
      if (!context) {
        throw new Error('DeepSeek Harness adapter requires Runtime context.');
      }

      const response = await options.transport(
        createDeepSeekHarnessRuntimeRequest({
          continuation: options.continuation,
          apiKey: options.apiKey,
          baseUrl: options.baseUrl,
          capabilityBridgeReady: options.capabilityBridgeReady,
          dshHome: options.dshHome,
          model: options.model,
          pythonPath: options.pythonPath,
          sessionId: options.sessionId,
          sourceText: options.sourceText,
          userGoal: options.userGoal,
          workspace: options.workspace,
        }),
        {
          adapterContext: context,
          onProgress: context.onProgress,
        },
      );
      if (!validateDeepSeekHarnessRuntimeResponse(response)) {
        throw new Error('DeepSeek Harness returned an invalid Runtime response.');
      }

      return {
        implementation: 'candidate',
        reason: 'DeepSeek Harness Runtime Adapter completed the task.',
        result: response.result,
      };
    },
  };
}
