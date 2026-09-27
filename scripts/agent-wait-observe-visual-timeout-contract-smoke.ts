import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/agent/agentRuntimeExecutor.ts', import.meta.url),
  'utf8',
);

assert.match(source, /AGENT_WAIT_OBSERVE_VISUAL_TIMEOUT_MS = 15_000/u);
assert.match(source, /executeSupplementalWaitVisualObservation[\s\S]*Promise\.race/u);
assert.match(source, /const ok = windowOk/u);
assert.match(source, /windowOk && visualOk \? 'success' : windowOk \? 'unverified' : 'failed'/u);
assert.match(source, /missing:supplemental-visual-observation/u);
assert.match(source, /errorText: windowOk \? null/u);

console.log('agent wait observe visual timeout contract smoke ok');
