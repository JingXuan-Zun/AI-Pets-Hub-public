import assert from 'node:assert/strict';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';

const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const names = ['presentAgentRunPendingApproval', 'presentAgentPendingApproval'];
export async function exercisePendingApprovalStages(baselineSource?: string) {
  const outputs: unknown[] = [];
  for (const phase of ['run', 'approval']) {
    for (const initial of [false, true]) {
      for (const id of ['task', '', null]) {
        for (const failure of [null, 'text', 'create', 'reject', 'attach']) {
          const calls: any[] = [];
          const error = new Error('original error');
          const step = (name: string, value: unknown) => {
            calls.push([name, json(value)]);
            if (failure === name) throw error;
          };
          const agentRuntime = { taskState: { taskId: 'same task', revision: 7 } };
          const pendingApproval = { command: { kind: 'tool-call' }, plan: { goal: 'original goal' } };
          const preparedRequest = { outgoingText: 'original request' };
          const options: any = { agentRuntime, pendingApproval, preparedRequest, messageId: id, initial };
          const message = { id: 'created', agentApproval: { agentRuntime } };
          let resolve!: (value: any) => void;
          let reject!: (value: any) => void;
          const deferred = new Promise((yes, no) => { resolve = yes; reject = no; });
          const attach = (kind: string) => (messageId: string | null, approvalMessage: any) => {
            step('attach', { kind, messageId, approvalMessage });
            assert.equal(messageId, id, 'retain original target across await');
            assert.equal(approvalMessage, message, 'attach the exact created object');
          };
          const fixture = createAgentRunPresentationFixture(baselineSource, names, {
            sessionVisibleText: {
              createAgentPendingApprovalVisibleText: (goal: string) => { step('text', { kind: 'initial', goal }); return 'initial ' + goal; },
              createAgentApprovalNextStepVisibleText: (goal: string) => { step('text', { kind: 'next', goal }); return 'next ' + goal; },
            },
            approvalMessage: { createAgentApprovalMessage: (input: any) => {
              step('create', input);
              assert.equal(input.agentRuntime, agentRuntime); assert.equal(input.command, pendingApproval.command);
              assert.equal(input.plan, pendingApproval.plan); assert.equal(input.preparedRequest, preparedRequest);
              return deferred;
            } },
            pendingApprovalAttachment: {
              attachAgentRunPendingApproval: attach('run'), attachAgentPendingApproval: attach('approval'),
            },
          });
          const promise = fixture.module('pendingApprovalStages')[phase === 'run' ? names[0] : names[1]](options);
          const observed = promise.then(() => null, (caught: any) => caught);
          assert.ok(!calls.some(([name]) => name === 'attach'), 'never attach before creation settles');
          options.messageId = 'changed after start';
          if (failure === 'reject') reject(error); else resolve(message);
          const caught = await observed;
          assert.equal(caught, failure ? error : null, 'propagate exact sync/async dependency errors');
          assert.deepEqual(calls.map(([name]) => name), failure === 'text' ? ['text'] : ['create', 'reject'].includes(failure ?? '') ? ['text', 'create'] : ['text', 'create', 'attach']);
          outputs.push(json({ phase, initial, id, failure, calls }));
        }
      }
    }
  }
  return outputs;
}
assert.equal((await exercisePendingApprovalStages()).length, 60);
console.log('Pending approval stages smoke passed (60 cases; deferred creation/identity/target/errors).');
