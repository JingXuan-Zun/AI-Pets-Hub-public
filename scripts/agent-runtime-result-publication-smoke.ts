import assert from 'node:assert/strict';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const names = ['publishInitialAgentRuntimeResult', 'publishApprovedAgentRuntimeResult'];
export function exerciseRuntimeResultPublication(baselineSource?: string) {
  const outputs: unknown[] = [];
  for (const event of [false, true]) for (const id of ['task', '', null]) for (const callback of [false, true]) for (const race of [false, true]) {
    outputs.push(exercise(names[0], event, id, callback, race));
  }
  for (const state of [null, { taskId: 'task' }, { taskId: 'task', revision: 3 }, { taskId: 'task', revision: 7 }]) {
    for (const race of [false, true]) outputs.push(exercise(names[1], true, 'task', false, race, undefined, state));
  }
  for (const failure of ['world', 'callback', 'event', 'update', 'updater', 'group']) outputs.push(exercise(names[0], true, 'task', true, false, failure));
  for (const failure of ['world', 'status', 'log']) outputs.push(exercise(names[1], true, 'task', false, false, failure));
  return outputs;

  function exercise(phase: string, event: boolean, id: string | null, callback: boolean, race: boolean, failure?: string, taskState: any = null) {
    const initial = phase === names[0];
    const calls: any[] = [];
    const error = new Error('original dependency failure');
    const step = (name: string, value: unknown) => { calls.push([name, json(value)]); if (failure === name) throw error; };
    let currentEvent: any = event ? { marker: 'original event' } : null;
    const preparedRequest: any = {
      get groupTaskConversationEvent() { step('event', currentEvent); return currentEvent; },
    };
    const callbacks = { marker: 'callbacks' };
    let currentStatus = 'completed';
    const result: any = {
      get status() { step('status', currentStatus); return currentStatus; },
      taskState, steps: [], toolResults: [],
    };
    const routedResult = { implementation: 'stable' };
    const taskScopedApprovedContinuation = { count: 1 };
    let fixture: ReturnType<typeof createAgentRunPresentationFixture>;
    fixture = createAgentRunPresentationFixture(baselineSource, names, {
      agentRuntimeWorldBridge: { publishAgentRuntimeWorldResult: (value: any) => {
        assert.equal(value, result); step('world', { sameResult: true });
        if (race) { currentEvent = { marker: 'world event' }; currentStatus = 'failed'; result.steps = [1]; routedResult.implementation = 'changed route'; taskScopedApprovedContinuation.count = 9; }
      } },
      agentApprovalMessageStore: { updateAgentRunMessage: (messageId: string, updater: any) => {
        step('update', messageId); assert.equal(messageId, id);
        const selected = currentEvent;
        fixture.messages[0] = failure === 'updater'
          ? { id: 'task', get text() { step('updater', null); return ''; } }
          : { ...fixture.messages[0], text: 'latest message' };
        fixture.store.updateMessage(messageId, updater);
        assert.equal(fixture.messages[0].groupTaskEvent, selected, 'persist the event selected before updater');
        assert.equal(fixture.messages[0].text, 'latest message');
        if (race) currentEvent = { marker: 'after update' };
      } },
      groupTaskApprovalLifecycle: { publishPreparedGroupTaskEvent: (value: any, request: any) => {
        assert.equal(value, callbacks); assert.equal(request, preparedRequest);
        step('group', request.groupTaskConversationEvent);
      } },
      frontendRuntimeLogger: { pushFrontendRuntimeLog: (...args: any[]) => step('log', args) },
    });
    const onRuntimeResult = callback ? (value: any) => {
      assert.equal(value.result, result); assert.equal(value.implementation, 'stable');
      step('callback', { sameResult: true, implementation: value.implementation });
      currentEvent = event ? { marker: 'callback event' } : null;
    } : undefined;
    try {
      const returned = fixture.module('runtimeResultPublication')[phase]({
        result, sessionResult: result, runtimeRoute: 'stable', onRuntimeResult, preparedRequest, runMessageId: id,
        groupTaskLifecycle: callbacks, routedResult, taskScopedApprovedContinuation,
      });
      assert.equal(returned, undefined); assert.ok(!failure);
      assert.equal(calls[0][0], 'world');
      if (initial) {
        assert.equal(calls.at(-1)[0], 'group');
        if (callback) assert.equal(calls[1][0], 'callback');
        if (!id) assert.ok(!calls.some(([name]) => name === 'update'));
      } else {
        assert.deepEqual(calls.map(([name]) => name), ['world', 'status', 'log']);
        assert.equal(calls.at(-1)[1][2].taskScopedApprovedContinuationCount, race ? 9 : 1);
      }
    } catch (caught) {
      assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)[0], failure);
    }
    const messages = failure === 'updater' ? fixture.messages.map(message => ({ id: message.id, throwingText: true })) : fixture.messages;
    return json({ phase, event, id, callback, race, failure, calls, messages, effects: fixture.effects });
  }
}
const prepared = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'runPreparedAgentProductionSession');
assert.equal((prepared.match(/publishInitialAgentRuntimeResult\(/gu) ?? []).length, 2);
const approval = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'resolveAgentApprovalRequest');
assert.match(approval, /sessionResult = taskScopedApprovedContinuation\.result;[\s\S]*publishApprovedAgentRuntimeResult\(\{ sessionResult, routedResult, taskScopedApprovedContinuation \}\)/u);
assert.equal(exerciseRuntimeResultPublication().length, 41);
console.log('Runtime result publication smoke passed (41 cases; publication order/live event/latest store/identity/errors).');
