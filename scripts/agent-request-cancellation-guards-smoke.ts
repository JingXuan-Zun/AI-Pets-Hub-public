import assert from 'node:assert/strict';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

const names = ['createInitialAgentRunCancellationGuard', 'isInitialAgentRequestStale', 'createApprovedAgentRunCancellationGuard', 'isApprovedAgentRequestCancelled'];
export function exerciseRequestCancellationGuards(baselineSource?: string) {
  const outputs: unknown[] = [];
  for (const phase of [0, 1, 2, 3]) for (const aborted of [false, true]) for (const stale of [false, true]) {
    for (const stopped of [false, true]) for (const messageId of [null, '', 'task']) outputs.push(exercise(phase, aborted, stale, stopped, messageId));
  }
  for (const phase of [0, 1, 2, 3]) {
    for (const failure of [...(phase === 1 ? [] : ['signal', 'abort']), ...(phase < 2 ? ['request'] : []), 'active', 'stopped']) {
      outputs.push(exercise(phase, false, false, false, 'task', failure));
    }
  }
  return outputs;

  function exercise(phase: number, initialAborted: boolean, initialStale: boolean, initialStopped: boolean, messageId: string | null, failure?: string) {
    const calls: string[] = []; const results: unknown[] = []; const error = new Error('guard dependency failure');
    const step = (name: string) => { calls.push(name); if (failure === name) throw error; };
    let aborted = initialAborted, stale = initialStale, stopped = initialStopped, preparedToken = 7;
    const signal = { get aborted() { step('abort'); return aborted; } };
    const abortController = { get signal() { step('signal'); return signal; } };
    const preparedRequest = { get requestToken() { step('request'); return preparedToken; } };
    const activeChatRequestTokenRef = { get current() { step('active'); return (phase < 2 ? preparedToken : 7) + (stale ? 1 : 0); } };
    const fixture = createAgentRunPresentationFixture(baselineSource, names, {
      agentRunStopPolicy: { isStoppedAgentRunMessage: (id: unknown) => { assert.equal(id, messageId); step('stopped'); return stopped; } },
    });
    const api = fixture.module('requestCancellationGuards');
    const options = { abortController, preparedRequest, requestToken: 7, activeChatRequestTokenRef, messageId };
    const guard = phase === 0 || phase === 2 ? api[names[phase]](options) : () => api[names[phase]](options);
    assert.equal(typeof guard, 'function'); assert.deepEqual(calls, [], 'creation does not query cancellation or store');
    for (let round = 0; round < (failure ? 1 : 2); round++) {
      const start = calls.length;
      try {
        const value = guard(); assert.ok(!failure); assert.equal(value, (phase !== 1 && aborted) || stale || stopped);
        const order = [...(phase === 1 ? [] : ['signal', 'abort']),
          ...((phase !== 1 && aborted) ? [] : [...(phase < 2 ? ['request'] : []), 'active', ...(stale ? [] : ['stopped'])])];
        assert.deepEqual(calls.slice(start), order); results.push(value);
      } catch (caught) { assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1), failure); results.push('original error'); }
      aborted = !aborted; stale = !stale; stopped = !stopped; preparedToken = 20;
      options.requestToken = 999; // Factories capture the original approval token; direct predicates receive it per call.
      if (phase === 3) options.requestToken = 7;
    }
    return { phase, initialAborted, initialStale, initialStopped, messageId, failure, calls, results };
  }
}
const initial = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'runPreparedAgentProductionSession');
const approved = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'resolveAgentApprovalRequest');
assert.match(initial, /registerAgentRunAbortController\(runMessageId, abortController\);\s*const isCancelled = createInitialAgentRunCancellationGuard\(\{ abortController, preparedRequest, activeChatRequestTokenRef, messageId: runMessageId \}\);\s*const toolExecutor/u);
assert.match(initial, /finally \{\s*unregisterAbortController\(\);\s*\}\s*if \(isInitialAgentRequestStale\(\{ preparedRequest, activeChatRequestTokenRef, messageId: runMessageId \}\)\)/u);
assert.match(approved, /createMissingAgentExecutorResult\(\);\s*const isCancelled = createApprovedAgentRunCancellationGuard\(\{ abortController, requestToken, activeChatRequestTokenRef, messageId \}\);\s*const \{ onProgress/u);
assert.equal((approved.match(/if \(isApprovedAgentRequestCancelled\(\{ abortController, requestToken, activeChatRequestTokenRef, messageId \}\)\)/gu) ?? []).length, 3);
assert.equal(exerciseRequestCancellationGuards().length, 112);
console.log('Request cancellation guards smoke passed (96 cases with two live checks; 16 dependency errors; lazy creation/order/short circuit/fixed approval token).');
