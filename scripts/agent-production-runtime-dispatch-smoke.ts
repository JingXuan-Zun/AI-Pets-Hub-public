import assert from 'node:assert/strict';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const names = ['runPreparedAgentRuntimeStage', 'runApprovedAgentRuntimeStage'];
export async function exerciseProductionRuntimeDispatch(baselineSource?: string) {
  const outputs: unknown[] = [];
  for (const phase of names) {
    for (const present of [false, true]) {
      for (const target of phase === names[0] ? [true] : [false, true]) {
        for (const executor of phase === names[0] ? [true] : [false, true]) {
          for (const taskState of phase === names[0] ? [null] : [null, { taskId: 'task' }, { taskId: 'task', runId: 'run', surface: {} }, { taskId: 'task', runId: 'run', surface: { generation: 9, surfaceId: 'surface' } }]) {
            outputs.push(await exercise(phase, present, target, executor, taskState));
          }
        }
      }
    }
    for (const failure of phase === names[0] ? ['persona', 'runtime', 'reject'] : ['persona', 'runtime', 'reject', 'transaction']) {
      outputs.push(await exercise(phase, true, true, true, { taskId: 'task' }, failure));
    }
  }
  return outputs;

  async function exercise(phase: string, present: boolean, target: boolean, executorPresent: boolean, taskState: any, failure?: string) {
    const prepared = phase === names[0];
    const calls: any[] = [];
    const error = new Error('original dependency error');
    const step = (name: string, value: unknown) => { calls.push([name, json(value)]); if (failure === name) throw error; };
    const signal: any = { aborted: false };
    const preparedRequest: any = { currentConfig: { settings: { revision: 1 } }, outgoingText: 'original' };
    const configRef: any = { current: { settings: { revision: 1 } } };
    const targetSlot: any = target ? { personality: { name: 'pet' } } : null;
    const approvalRuntime: any = { taskState };
    const command = { kind: 'tool-call' };
    const approval: any = { command, plan: { goal: 'goal' } };
    const workingMemory = { summaryText: 'original memory' };
    const journal = { marker: 'journal' };
    const approvedToolResult = { marker: 'approved tool result' };
    const importedSkills = [{ marker: 'skill' }];
    const transactionResult = { ok: true, responseText: 'executed' };
    const transactionPromise = Promise.resolve(transactionResult);
    const missingExecutorResult = { ok: false, responseText: 'missing' };
    const executor = executorPresent ? async () => transactionResult : undefined;
    const onProgress = () => undefined;
    const toolExecutor = async () => transactionResult;
    const routed = { implementation: 'stable', result: present ? { marker: 'session' } : null, reason: 'original reason' };
    const runtimePromise = Promise.resolve(routed);
    let options: any;
    const runtime = (value: any) => {
      options = value;
      step('runtime', { ...value, onProgress: true, toolExecutor: true, ...(value.executeApprovedCommand ? { executeApprovedCommand: true } : {}) });
      assert.equal(value.canonicalEventJournal, journal); assert.equal(value.cancellationSignal, signal);
      assert.equal(value.onProgress, onProgress); assert.equal(value.toolExecutor, toolExecutor);
      if (prepared) { assert.equal(value.approvedToolResult, approvedToolResult); assert.equal(value.importedSkills, importedSkills); assert.equal(value.workingMemory, workingMemory); }
      else { assert.equal(value.continuation, approvalRuntime); assert.equal(value.approval.command, approval.command); assert.equal(value.approval.plan, approval.plan); }
      return failure === 'reject' ? Promise.reject(error) : runtimePromise;
    };
    const fixture = createAgentRunPresentationFixture(baselineSource, names, {
      agent: { runAgentProductionRuntime: runtime, runAgentProductionApprovedAction: runtime },
      personaRulePolicy: { buildPersonaBehaviorContractInstruction: (personality: any) => {
        step('persona', personality); assert.equal(personality, targetSlot.personality);
        preparedRequest.currentConfig = { settings: { revision: 99 } }; configRef.current = { settings: { revision: 99 } };
        preparedRequest.outgoingText = 'changed during persona'; workingMemory.summaryText = 'changed memory';
        return 'persona instruction';
      } },
      toolExecutionAdapter: { runAgentControllerToolTransactionWithLiveProgress: (value: any) => {
        step('transaction', { command: value.command, messageId: value.messageId, signal: value.signal });
        assert.equal(value.command, command); assert.equal(value.executor, executor); assert.equal(value.signal, signal); return transactionPromise;
      } },
    });
    for (const revision of [2, 3]) {
      preparedRequest.currentConfig = { settings: { revision } }; configRef.current = { settings: { revision } };
      preparedRequest.outgoingText = 'request ' + revision; workingMemory.summaryText = 'memory ' + revision;
      const before = calls.length;
      try {
        const promise = fixture.module('productionRuntimeDispatch')[phase]({
          approvedToolResult, canonicalEventJournal: journal, initialCommand: command, signal, onProgress, importedSkills,
          targetSlot, preparedRequest, toolExecutor, instruction: 'goal', workingMemory,
          approval, approvalRuntime, executor, messageId: 'task', missingExecutorResult, configRef,
        });
        assert.ok(!calls.slice(before).some(([name]) => name === 'transaction'), 'Runtime receives the execution callback before any action executes');
        if (failure !== 'reject') assert.equal(promise, runtimePromise);
        assert.equal(await promise, routed, 'preserve route/result/reason identity, including missing results');
        if (!prepared) {
          const promise = options.executeApprovedCommand(command);
          if (executorPresent) assert.equal(promise, transactionPromise);
          assert.equal(await promise, executorPresent ? transactionResult : missingExecutorResult);
        }
        assert.ok(!failure);
      } catch (caught) {
        assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)[0], failure === 'reject' ? 'runtime' : failure);
      }
    }
    return json({ phase, present, target, executorPresent, taskState, failure, calls });
  }
}
for (const [entry, stage] of [['runPreparedAgentProductionSession', names[0]], ['resolveAgentApprovalRequest', names[1]]]) {
  const source = readModuleProjectFunction('src/components/chat/agentRunController.ts', entry);
  assert.match(source, new RegExp(`const routedResult = await ${stage}\\(`, 'u'));
  assert.match(source, /if \(!routedResult\.result\) \{[\s\S]*throw new Error\(routedResult\.reason\)/u);
}
assert.equal((await exerciseProductionRuntimeDispatch()).length, 41);
console.log('Production Runtime dispatch smoke passed (41 cases, two calls each; seed/options/ordering/promise identity/deferred execution/errors).');
