import assert from 'node:assert/strict';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';
import { isAgentTaskRuntimeWaitingApproval } from '../src/components/chat/agentRuntimeUiStatusProjection';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const names = ['logInitialAgentRuntimeCompletion', 'completeApprovedAgentRuntimeLifecycle'];
export function exerciseRuntimeCompletionStages(baselineSource?: string) {
  const outputs: unknown[] = [];
  for (const state of [null, { taskId: 'task' }, { taskId: 'task', revision: null }, { taskId: 'task', revision: 3 }]) {
    for (const race of [false, true]) outputs.push(exercise(false, false, state, race));
    for (const waiting of [false, true]) for (const race of [false, true]) outputs.push(exercise(true, waiting, state, race));
  }
  for (const failure of ['status', 'steps', 'tools', 'state', 'log']) outputs.push(exercise(false, false, null, true, failure));
  for (const failure of ['waiting', 'release', 'status', 'steps', 'tools', 'state', 'log']) outputs.push(exercise(true, false, null, true, failure));
  for (const status of ['completed', 'needs-approval', 'needs-user', 'failed', 'cancelled', 'max-steps', 'budget-exceeded', 'running']) {
    for (const taskState of [null, ...['waiting_approval', 'completed', 'blocked', 'failed', 'running'].map(state => ({ state }))]) {
      const result: any = { status, taskState, steps: [], toolResults: [] }; const calls: any[] = [];
      const fixture = createAgentRunPresentationFixture(baselineSource, names, {
        agentRuntimeUiStatusProjection: { isAgentTaskRuntimeWaitingApproval },
        agent: { releaseAgentCanonicalEventJournal: (id: string) => calls.push(['release', id]) },
        frontendRuntimeLogger: { pushFrontendRuntimeLog: (...args: any[]) => calls.push(['log', ...args]) },
      });
      assert.equal(fixture.module('runtimeCompletionStages')[names[1]]({ sessionResult: result, messageId: 'task' }), undefined);
      assert.equal(calls.filter(([name]) => name === 'release').length, isAgentTaskRuntimeWaitingApproval(result) ? 0 : 1);
      assert.equal(calls.at(-1)[0], 'log'); outputs.push(json({ status, taskState, calls }));
    }
  }
  return outputs;

  function exercise(approved: boolean, waiting: boolean, initialState: any, race: boolean, failure?: string) {
    const calls: any[] = []; const error = new Error('original dependency failure');
    const step = (name: string, value: unknown) => { calls.push([name, json(value)]); if (failure === name) throw error; };
    let status = 'completed'; let state = initialState; const steps: number[] = []; const tools: number[] = [];
    const result = {
      get status() { step('status', status); if (race) steps.push(1); return status; },
      get steps() { step('steps', steps); return steps; },
      get toolResults() { step('tools', tools); return tools; },
      get taskState() { step('state', state); return state; },
    };
    const fixture = createAgentRunPresentationFixture(baselineSource, names, {
      agentRuntimeUiStatusProjection: { isAgentTaskRuntimeWaitingApproval: (value: any) => {
        assert.equal(value, result); step('waiting', waiting); if (race) status = 'after waiting'; return waiting;
      } },
      agent: { releaseAgentCanonicalEventJournal: (id: string) => {
        assert.equal(id, 'task'); step('release', id); if (race) { status = 'after release'; tools.push(1); state = { taskId: 'changed task', revision: 9 }; }
      } },
      frontendRuntimeLogger: { pushFrontendRuntimeLog: (...args: any[]) => step('log', args) },
    });
    try {
      assert.equal(fixture.module('runtimeCompletionStages')[approved ? names[1] : names[0]]({ result, sessionResult: result, runtimeRoute: 'stable', messageId: 'task' }), undefined);
      assert.ok(!failure);
      assert.deepEqual(calls.map(([name]) => name), [...(approved ? ['waiting', ...(!waiting ? ['release'] : [])] : []), 'status', 'steps', 'tools', 'state', 'state', 'log']);
      assert.deepEqual(calls.at(-1)[1], ['agent-session-v2', approved ? 'approved session continued' : 'session completed', {
        ...(!approved ? { runtimeRoute: 'stable' } : {}), status: approved && race ? waiting ? 'after waiting' : 'after release' : 'completed',
        stepCount: race ? 1 : 0, toolResultCount: approved && !waiting && race ? 1 : 0,
        taskId: state?.taskId ?? null, stateRevision: state?.revision ?? null,
      }]);
    } catch (caught) { assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)[0], failure); }
    return json({ approved, waiting, initialState, race, failure, calls });
  }
}
const prepared = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'runPreparedAgentProductionSession');
assert.match(prepared, /if \(isInitialAgentRequestStale\(\{ preparedRequest, activeChatRequestTokenRef, messageId: runMessageId \}\)\)\s*\{\s*return;\s*\}\s*logInitialAgentRuntimeCompletion\([\s\S]*publishInitialAgentRuntimeResult\(/u);
const stalePredicate = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'isInitialAgentRequestStale');
assert.match(stalePredicate, /preparedRequest.requestToken !== activeChatRequestTokenRef.current \|\| isStoppedAgentRunMessage\(messageId\)/u);
assert.doesNotMatch(stalePredicate, /abortController|signal/u);
const approval = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'resolveAgentApprovalRequest');
assert.match(approval, /completeApprovedAgentRuntimeLifecycle\(\{ sessionResult, messageId \}\);\s*\} catch \(error\)/u);
assert.match(approval, /finally \{\s*unregisterAbortController\(\);\s*finalizeChatSendRequest\(/u);
assert.equal(exerciseRuntimeCompletionStages().length, 84);
console.log('Runtime completion stages smoke passed (84 cases; actual waiting predicate/release order/live result/identity/errors).');
