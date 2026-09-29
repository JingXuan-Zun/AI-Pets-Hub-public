import assert from 'node:assert/strict';
import {
  createAgentRuntimeProductionAdapter,
  runAgentRuntime,
} from '../src/agent/index.ts';

interface FakeResult {
  finalAnswer?: string;
  source: 'stable';
  status: string;
}

const stable = async (): Promise<FakeResult> => ({
  source: 'stable',
  status: 'completed',
});
const stableRun = await runAgentRuntime({
  adapter: createAgentRuntimeProductionAdapter({
    run: stable,
  }),
});
assert.equal(stableRun.implementation, 'stable');
assert.equal(stableRun.result?.source, 'stable');

console.log('agent runtime entry smoke ok');
