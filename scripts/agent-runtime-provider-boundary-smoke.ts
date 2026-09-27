import { strict as assert } from 'node:assert';
import {
  AGENT_RUNTIME_PROVIDER_CATALOG,
  createUnavailableAgentRuntimeAdapter,
  createAgentRuntimeAdapter,
  createDeepSeekHarnessRuntimeAdapter,
  createDeepSeekHarnessRuntimeRequest,
  DEEPSEEK_HARNESS_ADAPTER_PROTOCOL_VERSION,
  isAgentRuntimeProviderConfigured,
  resolveDefaultAgentRuntimeProvider,
  validateDeepSeekHarnessRuntimeResponse,
} from '../src/agent/index.ts';

assert.equal(resolveDefaultAgentRuntimeProvider(), 'native');
assert.equal(AGENT_RUNTIME_PROVIDER_CATALOG.find((provider) => provider.id === 'native')?.status, 'active');
assert.equal(AGENT_RUNTIME_PROVIDER_CATALOG.find((provider) => provider.id === 'deepseek-harness')?.status, 'not-configured');
assert.equal(isAgentRuntimeProviderConfigured('native'), true);
assert.equal(isAgentRuntimeProviderConfigured('deepseek-harness'), false);
const request = createDeepSeekHarnessRuntimeRequest({ sourceText: '整理文件', userGoal: '整理文件夹' });
assert.equal(request.protocolVersion, DEEPSEEK_HARNESS_ADAPTER_PROTOCOL_VERSION);
assert.equal(request.continuation, null);
const adapter = createUnavailableAgentRuntimeAdapter('deepseek-harness');
assert.equal(adapter.id, 'deepseek-harness-adapter');
const result = await adapter.run();
assert.equal(result.implementation, 'unavailable');
assert.equal(result.result, null);
const nativeAdapter = createAgentRuntimeAdapter('native', async () => ({ native: true }));
assert.equal(nativeAdapter.id, 'native-runtime-adapter');
const externalAdapter = createAgentRuntimeAdapter('deepseek-harness', async () => ({ native: false }));
assert.equal(externalAdapter.id, 'deepseek-harness-adapter');
const harnessAdapter = createDeepSeekHarnessRuntimeAdapter({
  sourceText: '整理文件',
  userGoal: '整理文件夹',
  transport: async (transportRequest) => ({
    protocolVersion: transportRequest.protocolVersion,
    result: {
      continuation: {
        historyLines: [],
        sourceText: transportRequest.sourceText,
        steps: [],
        traceEvents: [],
        toolResults: [],
        userGoal: transportRequest.userGoal,
      },
      finalAnswer: '完成',
      sourceText: transportRequest.sourceText,
      status: 'completed',
      steps: [],
      traceEvents: [],
      toolResults: [],
    },
  }),
});
const harnessResult = await harnessAdapter.run({
  authorizeModelIteration: () => ({}) as never,
  authorizeRecovery: () => ({}) as never,
  onProgress: () => undefined,
  taskTransaction: null,
});
assert.equal(harnessResult.implementation, 'candidate');
assert.equal(harnessResult.result?.finalAnswer, '完成');
assert.equal(validateDeepSeekHarnessRuntimeResponse({
  protocolVersion: DEEPSEEK_HARNESS_ADAPTER_PROTOCOL_VERSION,
  result: { continuation: null } as never,
}), false);

console.log('agent runtime provider boundary smoke passed');
