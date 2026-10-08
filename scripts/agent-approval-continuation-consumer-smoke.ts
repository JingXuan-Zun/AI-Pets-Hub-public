import assert from 'node:assert/strict';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

const json = (value: unknown) => JSON.parse(JSON.stringify(value));
export async function exerciseApprovalContinuationConsumer(baselineSource?: string) {
  const outputs: unknown[] = [];
  for (const executorPresent of [false, true]) {
    for (const aborted of [false, true]) {
      for (const stale of [false, true]) {
        for (const stopped of [false, true]) {
          outputs.push(await exercise(executorPresent, aborted, stale, stopped));
        }
      }
    }
  }
  for (const failure of ['runtime', 'transaction', 'skip', 'progress']) outputs.push(await exercise(true, false, false, false, failure));
  return outputs;

  async function exercise(executorPresent: boolean, aborted: boolean, stale: boolean, stopped: boolean, failure?: string) {
    const calls: any[] = [];
    const error = new Error('original dependency error');
    const step = (name: string, value: unknown) => { calls.push([name, json(value)]); if (failure === name) throw error; };
    let liveStopped = false;
    const signal: any = { aborted: false };
    const activeChatRequestTokenRef = { current: 1 };
    const configRef: any = { current: { settings: { revision: 1 } } };
    const approval: any = { command: { kind: 'tool-call', sourceText: 'original' }, plan: { goal: 'original' } };
    const journal = { identity: 'original journal' };
    const result = { ok: true, responseText: 'transaction' };
    const missing = { ok: false, responseText: 'missing' };
    const skipped = { ok: false, responseText: 'skipped' };
    const returned = { count: 3, outcome: { kind: 'limit-reached' }, result: { marker: 'runtime-owned' } };
    const executor = executorPresent ? async () => result : undefined;
    const toolExecutor = async () => result;
    const onProgress = (event: unknown) => step('progress', event);
    const isCancelled = () => signal.aborted || activeChatRequestTokenRef.current !== 1 || liveStopped;
    const fixture = createAgentRunPresentationFixture(baselineSource, ['createAgentApprovalContinuationConsumer'], {
      agentRunStopPolicy: { isStoppedAgentRunMessage: () => liveStopped },
      approvalConflictResult: { createSkippedStaleOuterApprovalResult: (command: any) => { step('skip', command); return skipped; } },
      toolExecutionAdapter: { runAgentControllerToolTransactionWithLiveProgress: (options: any) => {
        step('transaction', { command: options.command, messageId: options.messageId, signal: options.signal });
        assert.equal(options.executor, executor); assert.equal(options.signal, signal); return Promise.resolve(result);
      } },
      agentApprovalContinuationExecution: { runChatAgentApprovalContinuations: async (options: any) => {
        step('runtime', { command: options.approvedCommand, plan: options.approvedPlan, initialResult: options.initialResult, settings: options.settings, logLabel: options.logLabel });
        assert.equal(options.approvedCommand, approval.command); assert.equal(options.approvedPlan, approval.plan);
        assert.equal(options.settings, configRef.current.settings); assert.equal(options.canonicalEventJournal, journal);
        assert.equal(options.cancellationSignal, signal); assert.equal(options.toolExecutor, toolExecutor); assert.equal(options.onProgress, onProgress);
        calls.push(['cancelled', options.isCancelled()]);
        assert.equal(options.isCancelled(), isCancelled());
        assert.equal(await options.executeApprovedCommand(approval.command), executorPresent ? result : missing);
        assert.equal(options.createSkippedResult(approval.command), skipped);
        options.onProgress({ iteration: configRef.current.settings.revision });
        return returned;
      } },
    });
    const consumer = fixture.module('approvalContinuationConsumer').createAgentApprovalContinuationConsumer({
      approval, canonicalEventJournal: journal, signal, executor, messageId: 'task', missingExecutorResult: missing,
      isCancelled, onProgress, configRef, toolExecutor, activeChatRequestTokenRef, requestToken: 1,
    });
    assert.deepEqual(calls, [], 'creating a callback must not read configuration or invoke dependencies');
    signal.aborted = aborted; activeChatRequestTokenRef.current = stale ? 2 : 1; liveStopped = stopped;
    for (const revision of [2, 3]) {
      configRef.current = { settings: { revision } };
      approval.command = { kind: 'tool-call', sourceText: 'command ' + revision };
      approval.plan = { goal: 'goal ' + revision };
      const initialResult = { revision };
      try {
        assert.equal(await consumer(initialResult, { logLabel: 'iteration ' + revision }), returned);
        assert.ok(!failure);
      } catch (caught) {
        assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)[0], failure);
      }
    }
    return json({ executorPresent, aborted, stale, stopped, failure, calls });
  }
}
const controller = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'resolveAgentApprovalRequest');
assert.match(controller, /createApprovedAgentRuntimeCallbacks\(\{[\s\S]*signal: abortController\.signal, executor: onAgentChatCommand,[\s\S]*messageId, missingExecutorResult, isCancelled, configRef,/u);
const assembly = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'createApprovedAgentRuntimeCallbacks');
assert.match(assembly, /createAgentApprovalContinuationConsumer\(\{\s*approval, canonicalEventJournal, signal: signal, executor: executor,\s*messageId, missingExecutorResult, isCancelled, onProgress, configRef, toolExecutor,/u);
assert.equal((controller.match(/await consumeTaskScopedApprovedContinuations\(/gu) ?? []).length, 2);
assert.match(controller, /const isCancelled = createApprovedAgentRunCancellationGuard\(\{ abortController, requestToken, activeChatRequestTokenRef, messageId \}\)/u);
const guardFactory = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'createApprovedAgentRunCancellationGuard');
assert.match(guardFactory, /return \(\) => isApprovedAgentRequestCancelled\(\{ abortController, requestToken, activeChatRequestTokenRef, messageId \}\)/u);
const guardPredicate = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'isApprovedAgentRequestCancelled');
assert.match(guardPredicate, /abortController\.signal\.aborted[\s\S]*requestToken !== activeChatRequestTokenRef\.current[\s\S]*isStoppedAgentRunMessage\(messageId\)/u);
assert.equal((await exerciseApprovalContinuationConsumer()).length, 20);
console.log('Approval continuation consumer smoke passed (20 cases, two live iterations each; ownership/identity/cancellation/errors).');
