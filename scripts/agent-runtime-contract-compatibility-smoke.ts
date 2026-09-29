import assert from 'node:assert/strict';
import {
  type AgentRuntimeContinuation,
  type AgentRuntimeResult,
  type AgentSessionV2ContinuationState,
  type AgentSessionV2Result,
} from '../src/agent/legacy/index.ts';

const continuation: AgentRuntimeContinuation = {
  historyLines: ['legacy-compatible history'],
  sourceText: '/agent compatibility smoke',
  steps: [],
  traceEvents: [],
  toolResults: [],
  userGoal: 'Verify the version-neutral runtime contract.',
};

const legacyContinuation: AgentSessionV2ContinuationState = continuation;
const restoredContinuation: AgentRuntimeContinuation = legacyContinuation;
assert.equal(restoredContinuation.sourceText, continuation.sourceText);

const runtimeResult: AgentRuntimeResult = {
  continuation,
  finalAnswer: 'compatible',
  sourceText: continuation.sourceText,
  status: 'completed',
  steps: [],
  traceEvents: [],
  toolResults: [],
};

const diagnosticRuntimeResult: AgentRuntimeResult = {
  ...runtimeResult,
  diagnostics: [{
    authority: 'diagnostic-only',
    category: 'runtime-shadow',
    payload: {
      details: { classification: 'shadow-only' },
      summary: 'Compatibility diagnostic',
    },
    source: 'compatibility-smoke',
    timestamp: 1,
  }],
};
assert.equal(diagnosticRuntimeResult.diagnostics?.[0]?.authority, 'diagnostic-only');

const legacyResult: AgentSessionV2Result = runtimeResult;
const restoredResult: AgentRuntimeResult = legacyResult;
assert.equal(restoredResult.status, 'completed');
assert.deepEqual(restoredResult.continuation, continuation);

console.log('agent runtime contract compatibility smoke ok');
