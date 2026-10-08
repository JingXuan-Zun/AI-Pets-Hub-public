import assert from 'node:assert/strict';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const names = ['runInitialAgentApprovalContinuations', 'runReadOnlyAgentApprovalContinuations'];
export async function exerciseApprovalContinuationDispatch(baselineSource?: string) {
  const outputs: unknown[] = [];
  for (const phase of names) {
    for (const aborted of [false, true]) for (const stale of [false, true]) for (const stopped of [false, true]) {
      for (const target of phase === names[0] ? [true] : [false, true]) outputs.push(await exercise(phase, aborted, stale, stopped, target));
    }
    for (const failure of ['persona', 'runtime', 'transaction', 'skip', 'log']) outputs.push(await exercise(phase, false, false, false, true, failure));
  }
  return outputs;

  async function exercise(phase: string, aborted: boolean, stale: boolean, stopped: boolean, target: boolean, failure?: string) {
    const calls: any[] = [];
    const error = new Error('dependency failure');
    const step = (name: string, value: unknown) => { calls.push([name, json(value)]); if (failure === name) throw error; };
    const initial = phase === names[0];
    const signal: any = { aborted };
    const activeChatRequestTokenRef = { current: stale ? 2 : 1 };
    const preparedRequest: any = { requestToken: 1, currentConfig: { settings: { revision: 1 } } };
    const configRef: any = { current: { settings: { revision: 1 } } };
    const targetSlot: any = target ? { personality: { name: 'pet' } } : null;
    const approvedCommand = { kind: 'tool-call', sourceText: 'original' };
    const approvedPlan = { goal: 'original' };
    const initialPendingApproval = { command: approvedCommand, plan: approvedPlan };
    const initialResult = { marker: 'initial result' };
    const journal = { marker: 'journal' };
    const result = { ok: true, responseText: 'transaction' };
    const transactionPromise = Promise.resolve(result);
    const skipped = { ok: false, responseText: 'skipped' };
    const returned = { count: 1, result: initialResult, outcome: { kind: 'completed' } };
    const runtimePromise = Promise.resolve(returned);
    const executor = async () => result;
    const toolExecutor = async () => result;
    const onProgress = () => undefined;
    const isCancelled = () => signal.aborted || (initial ? preparedRequest.requestToken : 1) !== activeChatRequestTokenRef.current || stopped;
    let runtimeOptions: any;
    const fixture = createAgentRunPresentationFixture(baselineSource, names, {
      agentRunStopPolicy: { isStoppedAgentRunMessage: () => stopped },
      personaRulePolicy: { buildPersonaBehaviorContractInstruction: (personality: any) => {
        step('persona', personality); assert.equal(personality, targetSlot.personality);
        preparedRequest.currentConfig = { settings: { revision: 99 } }; configRef.current = { settings: { revision: 99 } };
        return 'persona instruction';
      } },
      agent: { runAgentProductionApprovalContinuations: (options: any) => {
        runtimeOptions = options;
        step('runtime', { ...options, createSkippedResult: true, executeApprovedCommand: true, isCancelled: true, onIteration: true, toolExecutor: true, ...(options.onProgress ? { onProgress: true } : {}) });
        assert.equal(options.approvedCommand, approvedCommand); assert.equal(options.approvedPlan, approvedPlan);
        assert.equal(options.initialPendingApproval, initialPendingApproval); assert.equal(options.initialResult, initialResult);
        assert.equal(options.canonicalEventJournal, journal); assert.equal(options.cancellationSignal, signal); assert.equal(options.toolExecutor, toolExecutor);
        assert.equal(options.maxContinuations, initial ? undefined : 1);
        assert.equal(options.onProgress, initial ? undefined : onProgress);
        return runtimePromise;
      } },
      approvalConflictResult: { createSkippedStaleOuterApprovalResult: (command: any) => { step('skip', command); return skipped; } },
      toolExecutionAdapter: { runAgentControllerToolTransactionWithLiveProgress: (options: any) => {
        step('transaction', { command: options.command, messageId: options.messageId, signal: options.signal });
        assert.equal(options.executor, executor); assert.equal(options.signal, signal); return transactionPromise;
      } },
      frontendRuntimeLogger: { pushFrontendRuntimeLog: (...args: any[]) => step('log', args) },
    });
    for (const revision of [2, 3]) {
      preparedRequest.currentConfig = { settings: { revision } }; configRef.current = { settings: { revision } };
      preparedRequest.requestToken = revision;
      if (initial) activeChatRequestTokenRef.current = stale ? revision + 1 : revision;
      try {
        const promise = fixture.module('approvalContinuationDispatch')[phase]({
          approvedCommand, approvedPlan, canonicalEventJournal: journal, signal, executor, messageId: 'task',
          initialPendingApproval, initialResult, isCancelled, preparedRequest, configRef, targetSlot, toolExecutor, onProgress,
          activeChatRequestTokenRef, requestToken: 1,
        });
        assert.equal(promise, runtimePromise, 'do not add an async wrapper'); assert.equal(await promise, returned);
        calls.push(['cancelled', runtimeOptions.isCancelled()]); assert.equal(runtimeOptions.isCancelled(), isCancelled());
        assert.equal(runtimeOptions.isCancelled(), aborted || stale || stopped);
        preparedRequest.requestToken += 1;
        calls.push(['cancelled-after-request-token-change', runtimeOptions.isCancelled()]);
        assert.equal(runtimeOptions.isCancelled(), isCancelled(), 'initial guard reads mutable request token; approval guard retains local token');
        assert.equal(runtimeOptions.executeApprovedCommand(approvedCommand), transactionPromise);
        assert.equal(runtimeOptions.createSkippedResult(approvedCommand), skipped);
        runtimeOptions.onIteration({ count: revision, decision: 'continue', pendingPlan: approvedPlan, pendingCommand: approvedCommand });
        assert.ok(!failure);
      } catch (caught) {
        assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)[0], failure);
      }
    }
    return json({ phase, aborted, stale, stopped, target, failure, calls });
  }
}
const prepared = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'runPreparedAgentProductionSession');
const approval = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'resolveAgentApprovalRequest');
assert.match(prepared, /if \(onAgentChatCommand\) \{[\s\S]*await runInitialAgentApprovalContinuations/u);
assert.match(approval, /pendingReadOnlyFollowUpApproval && onAgentChatCommand[\s\S]*await runReadOnlyAgentApprovalContinuations/u);
assert.equal((await exerciseApprovalContinuationDispatch()).length, 34);
console.log('Approval continuation dispatch smoke passed (34 cases, two calls each; options/order/live guard/promise identity/errors).');
