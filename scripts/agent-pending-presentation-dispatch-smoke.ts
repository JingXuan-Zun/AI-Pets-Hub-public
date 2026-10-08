import assert from 'node:assert/strict';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

const names = ['dispatchApprovedPendingPresentation', 'dispatchReadOnlyPendingPresentation'];
export async function exercisePendingPresentationDispatch(baselineSource?: string) {
  const outputs: unknown[] = [];
  for (const phase of [0, 1]) for (const kind of ['duplicate-blocked', 'limit-reached', 'pending-user-approval', 'stale-context', 'consumed', 'cancelled', 'stale-outer-skipped']) {
    for (const race of [false, true]) outputs.push(await exercise(phase, kind, race));
  }
  for (const race of [false, true]) outputs.push(await exercise(1, null, race));
  for (const phase of [0, 1]) for (const failure of ['outcome', 'block', 'present', 'reject']) outputs.push(await exercise(phase, failure === 'block' ? 'duplicate-blocked' : 'consumed', true, failure));
  return outputs;

  async function exercise(phase: number, kind: string | null, race: boolean, failure?: string) {
    const calls: any[] = []; const error = new Error('original dependency failure');
    const step = (name: string, value: unknown) => { calls.push([name, value]); if (failure === name && name !== 'reject') throw error; };
    const originalPending = { marker: 'original pending' }, changedPending = { marker: 'changed pending' }, followUp = { marker: 'follow-up' };
    const continuation = { marker: 'continuation' }; let currentPending = originalPending;
    const sessionResult = {
      get continuation() { step('continuation', null); if (race) currentPending = changedPending; return continuation; },
      get pendingApproval() { step('pending', currentPending.marker); return currentPending; },
    };
    const continuationRun = kind === null ? null : { get outcome() { step('outcome', kind); return { kind }; } };
    const displayResult = { marker: 'display' }, preparedRequest = { marker: 'prepared' };
    let resolve!: () => void, reject!: (error: Error) => void; let settled = false;
    const pending = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    const fixture = createAgentRunPresentationFixture(baselineSource, names, {
      continuationPresentationStages: {
        blockAgentDuplicateApproval: (options: any) => block(options),
        blockAgentDuplicateFollowUpApproval: (options: any) => { assert.equal(options.pendingReadOnlyFollowUpApproval, followUp); block(options); },
      },
      pendingApprovalStages: { presentAgentPendingApproval: (options: any) => {
        assert.equal(options.agentRuntime, continuation); assert.equal(options.pendingApproval, phase === 0 ? race ? changedPending : originalPending : followUp);
        assert.equal(options.preparedRequest, preparedRequest); assert.equal(options.messageId, 'task'); assert.equal(options.initial, false);
        step('present', { phase, id: options.messageId, pending: options.pendingApproval.marker }); return pending;
      } },
    });
    function block(options: any) {
      assert.equal(options.sessionResult, sessionResult); assert.equal(options.displayResult, displayResult); assert.equal(options.messageId, 'task'); step('block', phase);
    }
    try {
      const returned = fixture.module('pendingPresentationDispatch')[names[phase]]({ taskScopedApprovedContinuation: continuationRun, pendingReadOnlyContinuationRun: continuationRun, pendingReadOnlyFollowUpApproval: followUp, sessionResult, displayResult, preparedRequest, messageId: 'task' });
      if (!baselineSource) {
        if (kind === 'duplicate-blocked') assert.equal(returned, undefined, 'duplicate branch must stay synchronous');
        else assert.equal(returned, pending, 'return the original creation promise');
      }
      if (kind !== 'duplicate-blocked') {
        if (baselineSource && (failure === 'outcome' || failure === 'present')) await returned;
        const observed = returned.then(() => { settled = true; return null; }, (caught: any) => { settled = true; return caught; });
        await Promise.resolve(); assert.equal(settled, false, 'caller remains waiting for original creation');
        if (failure === 'reject') { step('reject', null); reject(error); } else resolve();
        const caught = await observed;
        if (failure === 'reject') throw caught;
        assert.equal(caught, null);
      } else if (baselineSource) await returned;
      assert.ok(!failure);
      assert.equal(calls.at(-1)[0], kind === 'duplicate-blocked' ? 'block' : 'present');
      assert.equal(calls.some(([name]) => name === 'present'), kind !== 'duplicate-blocked');
    } catch (caught) {
      assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)[0], failure);
    }
    return { phase, kind, race, failure, calls };
  }
}
const approval = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'resolveAgentApprovalRequest');
assert.equal((approval.match(/if \(pendingPresentation\) await pendingPresentation;/gu) ?? []).length, 2);
assert.match(approval, /if \(isAgentTaskRuntimeWaitingApproval\(sessionResult\) && sessionResult.pendingApproval\)\s*\{\s*const pendingPresentation = dispatchApprovedPendingPresentation\(/u);
assert.match(approval, /else if \(pendingReadOnlyFollowUpApproval\)\s*\{\s*const pendingPresentation = dispatchReadOnlyPendingPresentation\(/u);
assert.equal((await exercisePendingPresentationDispatch()).length, 38);
console.log('Pending presentation dispatch smoke passed (38 cases; synchronous duplicate/deferred creation/promise and input identity/live reads/errors).');
