import assert from 'node:assert/strict';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';
import { resolveAgentStopTarget } from '../src/components/chat/agentRunStopPolicy';
import * as progress from '../src/components/chat/agentProgressMessageProjection';
import * as compatibility from '../src/components/chat/chatAgentRuntimeCompatibility';
import { readModuleProjectFile } from './projectModuleSource.mjs';

const json = (value: unknown) => JSON.parse(JSON.stringify(value));
export function exerciseStopRunLifecycle(baselineSource?: string) {
  const outputs: unknown[] = [];
  for (const field of ['run', 'approval', 'both', 'none']) for (const cancelled of [null, {}, { taskState: { taskId: 'task', phase: 'cancelled' } }]) {
    for (const race of [false, true]) outputs.push(exercise(field, cancelled, race));
  }
  for (const failure of ['read', 'target', 'abort', 'update', 'journal', 'cancel', 'projection', 'log', 'world', 'release']) outputs.push(exercise('both', { taskState: { taskId: 'task' } }, true, failure));
  for (const guard of ['missing', 'empty-id', 'terminal', 'no-status']) outputs.push(exercise('run', null, false, undefined, guard));
  return outputs;

  function exercise(field: string, cancelled: any, race: boolean, failure?: string, guard?: string) {
    const calls: any[] = []; const error = new Error('original dependency failure');
    const step = (name: string, value: unknown) => { calls.push([name, json(value)]); if (failure === name) throw error; };
    const runContinuation = { marker: 'run' }, approvalContinuation = { marker: 'approval' }, freshContinuation = { marker: 'fresh' };
    const journal = { marker: 'original journal' };
    const messages: any[] = [{ id: guard === 'empty-id' ? '' : 'task', text: 'initial',
      agentRun: { status: guard === 'terminal' ? 'completed' : 'running', agentRuntime: field === 'run' || field === 'both' ? runContinuation : null },
      agentApproval: field === 'approval' || field === 'both' ? { status: 'pending', agentRuntime: approvalContinuation } : null,
    }];
    if (guard === 'no-status') { messages[0].agentRun = null; messages[0].agentApproval = null; }
    const fixture = createAgentRunPresentationFixture(baselineSource, ['stopAgentRunMessage'], {
      agentProgressMessageProjection: progress, chatAgentRuntimeCompatibility: compatibility,
      agentRunStopPolicy: { resolveAgentStopTarget: (value: any, id: any) => { assert.equal(value, messages); step('target', id ?? null); return resolveAgentStopTarget(value, id); } },
      chatStore: { desktopPetChatStore: {
        getState: () => { step('read', null); return { messages }; },
        updateMessage: (id: string, updater: any) => { step('update', id); assert.equal(id, 'task'); messages[0] = { ...messages[0], text: 'latest message' }; messages[0] = updater(messages[0]); step('updated', null); },
      } },
      agentRunAbortRegistry: { abortAgentRunController: (id: string) => {
        step('abort', id); if (race && field !== 'none') messages[0].agentRun.agentRuntime = freshContinuation; return false;
      } },
      agent: {
        getAgentCanonicalEventJournal: (id: string) => { step('journal', id); return journal; },
        cancelAgentProductionRuntime: (options: any) => {
          assert.equal(options.canonicalEventJournal, journal);
          assert.equal(options.continuation, race ? freshContinuation : field === 'approval' ? approvalContinuation : runContinuation);
          step('cancel', options.continuation); return { continuation: cancelled };
        },
        releaseAgentCanonicalEventJournal: (id: string) => step('release', id),
      },
      stoppedMessageProjection: { projectStoppedAgentMessage: (message: any, continuation: any) => {
        assert.equal(message, messages[0]); assert.equal(message.text, 'latest message'); assert.equal(continuation, field === 'none' ? null : cancelled);
        step('projection', { message, continuation }); return { ...message, text: 'stopped', marker: 'projected' };
      } },
      frontendRuntimeLogger: { pushFrontendRuntimeLog: (...args: any[]) => step('log', args) },
      agentRuntimeWorldBridge: { publishAgentRuntimeWorldResult: (value: any) => {
        assert.equal(value.taskState, field === 'none' ? null : cancelled?.taskState ?? null); step('world', value);
      } },
    });
    try {
      const result = fixture.module('stopRunLifecycle').stopAgentRunMessage(guard === 'missing' ? 'missing' : guard === 'empty-id' ? undefined : 'task');
      assert.ok(!failure); assert.equal(result, !guard);
      const order = guard ? ['read', 'target'] : ['read', 'target', 'abort', 'update', ...(field === 'none' ? [] : ['journal', 'cancel']), 'projection', 'updated', 'log', 'world', 'release'];
      assert.deepEqual(calls.map(([name]) => name), order);
      if (!guard) assert.equal(messages[0].marker, 'projected');
    } catch (caught) { assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)[0], failure); }
    return json({ field, cancelled, race, failure, guard, messages, calls });
  }
}
assert.equal(exerciseStopRunLifecycle().length, 38);
const source = readModuleProjectFile('src/components/chat/agentRunController.ts');
assert.match(source, /export \{ stopAgentRunMessage \} from '.\/runController\/stopRunLifecycle'/u);
assert.match(source, /export const agentRunController = \{[\s\S]*stopAgentRunMessage,/u);
console.log('Stop run lifecycle smoke passed (38 cases; live continuation/order/identity/guards/error propagation).');
