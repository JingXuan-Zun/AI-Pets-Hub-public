import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const { session: sessionSource } = readProjectSources({
  session: 'src/agent/agentProductionSessionImplementation.ts',
});

function extractBetween(startNeedle: string, endNeedle: string) {
  const start = sessionSource.indexOf(startNeedle);
  assert.ok(start >= 0, `${startNeedle} should exist`);
  const end = sessionSource.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(end > start, `${endNeedle} should exist after ${startNeedle}`);
  return sessionSource.slice(start, end);
}

const maxStepsAnswer = sessionSource.match(
  /function createAgentSessionV2MaxStepsAnswer\([\s\S]*?\n\}/u,
)?.[0] ?? '';
const finalResultFunction = extractBetween(
  'function createAgentSessionV2FinalResult',
  'function createAgentSessionV2ContinuationSnapshot',
);
const runLoopFailureArea = sessionSource.slice(
  sessionSource.indexOf('export async function runAgentSessionV2'),
);

assert.ok(maxStepsAnswer, 'Max steps answer helper should exist.');
assert.ok(maxStepsAnswer.includes('Agent processed ${maxSteps} steps and stopped to avoid looping.'));
assert.doesNotMatch(maxStepsAnswer, /Agent V2/u);

assert.ok(finalResultFunction, 'Final result helper should exist.');
assert.ok(finalResultFunction.includes('No usable reply was generated, so I stopped.'));
assert.doesNotMatch(finalResultFunction, /Agent V2/u);

assert.match(runLoopFailureArea, /Model call failed:/u);
assert.match(runLoopFailureArea, /The model did not return a usable next step/u);
assert.match(runLoopFailureArea, /No local tool executor is available/u);
assert.match(runLoopFailureArea, /tool execution failed/u);
assert.doesNotMatch(runLoopFailureArea, /Agent V2/u);

console.log('agent session v2 human-facing failure smoke ok');
