import assert from 'node:assert/strict';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

const names = ['createMissingAgentExecutorResult', 'createApprovedAgentRuntimeCallbacks'];
export function exerciseApprovedRuntimeCallbacks(baselineSource?: string) {
  const outputs: unknown[] = [];
  for (const executor of [false, true]) for (const id of ['task', '', null]) for (const race of [false, true]) outputs.push(exercise(executor, id, race));
  for (const failure of ['progress', 'tool', 'consumer']) outputs.push(exercise(true, 'task', true, failure));
  return outputs;

  function exercise(hasExecutor: boolean, messageId: string | null, race: boolean, failure?: string) {
    const calls: string[] = []; const error = new Error('original dependency failure');
    const step = (name: string) => { calls.push(name); if (failure === name) throw error; };
    const approval = { marker: 'approval' }, canonicalEventJournal = { marker: 'journal' }, configRef = { current: { marker: 'config' } };
    const signal = { marker: 'signal' }; let guardReads = 0;
    const isCancelled = () => { guardReads++; return false; };
    const executor = hasExecutor ? () => assert.fail('assembly must not execute a command') : undefined;
    let progress: any, tool: any, consumer: any, missing: any;
    const fixture = createAgentRunPresentationFixture(baselineSource, names, {
      guardedRequestCallbacks: {
        createAgentRunProgressHandler: (options: any) => {
          assert.equal(options.isCancelled, isCancelled); assert.equal(options.messageId, messageId); step('progress');
          if (race) configRef.current = { marker: 'after progress' }; progress = () => undefined; return progress;
        },
        createAgentRunToolExecutor: (options: any) => {
          assert.equal(options.isCancelled, isCancelled); assert.equal(options.messageId, messageId); assert.equal(options.executor, executor);
          assert.equal(options.signal, signal); assert.equal(options.missingExecutorResult, missing); step('tool'); tool = () => undefined; return tool;
        },
      },
      approvalContinuationConsumer: { createAgentApprovalContinuationConsumer: (options: any) => {
        assert.equal(options.approval, approval); assert.equal(options.canonicalEventJournal, canonicalEventJournal); assert.equal(options.configRef, configRef);
        assert.equal(options.isCancelled, isCancelled); assert.equal(options.messageId, messageId); assert.equal(options.executor, executor); assert.equal(options.signal, signal);
        assert.equal(options.missingExecutorResult, missing); assert.equal(options.onProgress, progress); assert.equal(options.toolExecutor, tool);
        step('consumer'); consumer = () => undefined; return consumer;
      } },
    });
    const api = fixture.module('approvedRuntimeCallbacks');
    const previous: any[] = [];
    for (let iteration = 0; iteration < 2; iteration++) {
      missing = api.createMissingAgentExecutorResult();
      assert.deepEqual(JSON.parse(JSON.stringify(missing)), { errorText: '当前没有可用的本机执行器。', ok: false, responseText: '当前没有可用的本机执行器。' });
      if (previous.length) assert.notEqual(missing, previous[0]); previous.push(missing);
      try {
        const result = api.createApprovedAgentRuntimeCallbacks({ approval, canonicalEventJournal, signal, executor, messageId, missingExecutorResult: missing, isCancelled, configRef });
        assert.ok(!failure); assert.equal(result.onProgress, progress); assert.equal(result.toolExecutor, tool); assert.equal(result.consumeTaskScopedApprovedContinuations, consumer);
        assert.equal(typeof result.then, 'undefined');
      } catch (caught) { assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1), failure); }
      missing.responseText = 'mutated first request';
    }
    const order = ['progress', 'tool', 'consumer']; const expected = failure ? order.slice(0, order.indexOf(failure) + 1) : order;
    assert.deepEqual(calls, [...expected, ...expected]); assert.equal(guardReads, 0);
    return { hasExecutor, messageId, race, failure, calls, config: configRef.current };
  }
}
const prepared = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'runPreparedAgentProductionSession');
assert.match(prepared, /const missingExecutorResult = createMissingAgentExecutorResult\(\);\s*const abortController/u);
const approval = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'resolveAgentApprovalRequest');
assert.match(approval, /createAgentApprovalPreparedRequest\([\s\S]*createMissingAgentExecutorResult\(\);[\s\S]*const isCancelled[\s\S]*createApprovedAgentRuntimeCallbacks\(\{\s*approval, canonicalEventJournal, signal: abortController.signal, executor: onAgentChatCommand,\s*messageId, missingExecutorResult, isCancelled, configRef,/u);
assert.match(approval, /createApprovedAgentRuntimeCallbacks\([\s\S]*runApprovedAgentRuntimeStage\([\s\S]*missingExecutorResult, onProgress, targetSlot, configRef, toolExecutor/u);
assert.equal(exerciseApprovedRuntimeCallbacks().length, 15);
console.log('Approved Runtime callbacks smoke passed (15 cases, two assemblies each; order/fresh fallback/callback identity/no execution/errors).');
