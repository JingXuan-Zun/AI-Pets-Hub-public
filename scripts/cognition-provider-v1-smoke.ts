import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COGNITION_REQUEST_VERSION,
  createCloudTextCognitionProvider,
  createCognitionRequestId,
  requireCognitionOutputText,
  runCognitionProvider,
  type CognitionRequest,
} from '../src/cognition/index.ts';

function createRequest(overrides: Partial<CognitionRequest> = {}): CognitionRequest {
  return {
    input: { text: 'decide next action' },
    requestId: 'cognition-smoke-request',
    task: 'agent-decision',
    version: COGNITION_REQUEST_VERSION,
    ...overrides,
  };
}

const provider = createCloudTextCognitionProvider({
  execute: async (request) => ({
    outputText: ` ${request.input.text}:done `,
    semanticEvents: [{ kind: 'agent.decision-produced' }],
  }),
  id: 'cloud-model.smoke',
  tasks: ['agent-decision'],
});
assert.equal(provider.descriptor.capabilities.maxContextTokens, null);
assert.notEqual(createCognitionRequestId('agent-decision', 1), createCognitionRequestId('agent-decision', 1));

const completed = await runCognitionProvider(provider, createRequest());
assert.equal(completed.status, 'completed');
assert.equal(requireCognitionOutputText(completed), 'decide next action:done');
assert.deepEqual(
  completed.status === 'completed' ? completed.semanticEvents : [],
  [{ kind: 'agent.decision-produced' }],
);

const unsupported = await runCognitionProvider(provider, createRequest({ task: 'world-assessment' }));
assert.equal(unsupported.status, 'failed');
assert.equal(unsupported.status === 'failed' ? unsupported.error.code : null, 'unsupported-task');

const cancelledController = new AbortController();
cancelledController.abort();
const cancelled = await runCognitionProvider(provider, createRequest({ signal: cancelledController.signal }));
assert.equal(cancelled.status, 'cancelled');

const slowProvider = createCloudTextCognitionProvider({
  execute: async () => new Promise<string>((resolve) => {
    setTimeout(() => resolve('late output'), 50);
  }),
  id: 'cloud-model.slow-smoke',
  tasks: ['agent-decision'],
});
const timedOut = await runCognitionProvider(slowProvider, createRequest({ timeoutMs: 5 }));
assert.equal(timedOut.status, 'timed-out');

const emptyProvider = createCloudTextCognitionProvider({
  execute: async () => '   ',
  id: 'cloud-model.empty-smoke',
  tasks: ['agent-decision'],
});
const invalid = await runCognitionProvider(emptyProvider, createRequest());
assert.equal(invalid.status, 'failed');
assert.equal(invalid.status === 'failed' ? invalid.error.code : null, 'invalid-response');

const cognitionContractSource = readFileSync(
  join(process.cwd(), 'src', 'cognition', 'cognitionProvider.ts'),
  'utf8',
);
assert.doesNotMatch(
  cognitionContractSource,
  /components|runtime-world|geminiService|PetConfig/u,
  'The public cognition contract must remain independent from UI, Runtime World, and model implementations.',
);

const sessionSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'agentProductionSessionImplementation.ts'),
  'utf8',
);
assert.match(
  sessionSource,
  /getAgentPlannerResponse\([\s\S]{0,180}request\.signal/u,
  'The Agent model caller must forward cancellation into the cognition boundary.',
);

const modelServiceSource = readFileSync(
  join(process.cwd(), 'src', 'services', 'geminiService.ts'),
  'utf8',
);
assert.match(modelServiceSource, /runCognitionProvider\(provider,/u);
assert.match(modelServiceSource, /signal: signal \?\? undefined/u);

console.log('cognition provider v1 smoke: passed');
