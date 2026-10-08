import assert from 'node:assert/strict';
import * as status from '../src/components/chat/agentRuntimeUiStatusProjection';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const names = ['blockAgentDuplicateApproval', 'updateAgentApprovalContinuationPresentation', 'blockAgentDuplicateFollowUpApproval'];
export function exerciseContinuationPresentationStages(baselineSource?: string) {
  const outputs: unknown[] = [];
  for (const phase of names) {
    for (const sessionStatus of ['completed', 'needs-approval', 'needs-user', 'failed', 'max-steps', 'budget-exceeded', 'cancelled', 'running']) {
      for (const state of [null, 'active', 'waiting_approval', 'succeeded', 'failed', 'cancelled']) {
        for (const event of [false, true]) outputs.push(exercise(phase, sessionStatus, state, event));
      }
    }
    const dependencies = phase === names[1] ? ['status', 'outcome', 'event', 'update', 'projection'] : ['duplicate', 'update', 'projection', 'log'];
    for (const dependency of dependencies) outputs.push(exercise(phase, 'completed', 'succeeded', true, dependency));
  }
  return outputs;

  function exercise(phase: string, sessionStatus: string, state: string | null, event: boolean, failure?: string) {
    const calls: any[] = [];
    const error = new Error('dependency error');
    const step = (name: string, value: unknown) => { calls.push([name, json(value)]); if (failure === name) throw error; };
    const pending = { command: { kind: 'tool-call', toolCall: { name: 'read' } }, plan: { goal: 'goal' } };
    const sessionResult: any = { status: sessionStatus, taskState: state ? { state } : null, finalAnswer: 'answer', pendingApproval: pending, continuation: { revision: 8 } };
    const displayResult = { command: pending.command, result: { ok: true, responseText: 'display' } };
    const duplicate = { ok: false, responseText: 'duplicate', marker: 'original object' };
    const preparedRequest: any = { groupTaskConversationEvent: event ? { taskId: 'group' } : undefined };
    const callbacks = { marker: true };
    let fixture: ReturnType<typeof createAgentRunPresentationFixture>;
    const projection = (message: any, options: any) => {
      step('projection', { message, options }); assert.equal(message.text, 'latest');
      assert.equal(options.sessionResult ?? options.continuationSessionResult, sessionResult);
      if (phase !== names[1]) assert.equal(options.duplicateResult, duplicate);
      return { ...message, projected: options };
    };
    fixture = createAgentRunPresentationFixture(baselineSource, names, {
      approvalConflictResult: { createRepeatedApprovalLoopResult: (command: any, result: any) => {
        step('duplicate', { command, result }); assert.equal(command, pending.command); assert.equal(result, displayResult.result); return duplicate;
      } },
      agentRuntimeUiStatusProjection: { getAgentTaskRuntimeRunStatus: (result: any) => { step('status', result); return status.getAgentTaskRuntimeRunStatus(result); } },
      groupTaskContinuationPolicy: { resolveGroupTaskContinuationOutcome: (options: any) => { step('outcome', options); return options.runStatus; } },
      groupTaskApprovalLifecycle: { updatePreparedGroupTaskEvent: (options: any) => {
        step('event', { ...options, callbacks: Boolean(options.callbacks) });
        assert.equal(options.callbacks, callbacks); assert.equal(options.preparedRequest, preparedRequest);
        assert.equal(options.event, preparedRequest.groupTaskConversationEvent);
        const updated = { ...options.event, summary: options.summary, outcome: options.outcome };
        preparedRequest.groupTaskConversationEvent = updated; return updated;
      } },
      agentApprovalMessageStore: { updateAgentApprovalMessage: (id: string, updater: any) => {
        step('update', id); fixture.messages[0] = { ...fixture.messages[0], text: 'latest' };
        pending.plan.goal = 'changed during update'; fixture.store.updateMessage(id, updater);
      } },
      approvalContinuationProjection: {
        projectAgentDuplicateApproval: projection, projectAgentDuplicateFollowUpApproval: projection, projectAgentApprovalContinuationResult: projection,
      },
      frontendRuntimeLogger: { pushFrontendRuntimeLog: (...args: any[]) => step('log', args) },
    });
    let returned: unknown;
    try {
      returned = fixture.module('continuationPresentationStages')[phase]({
        sessionResult, continuationSessionResult: sessionResult, displayResult, pendingReadOnlyFollowUpApproval: pending,
        preparedRequest, groupTaskLifecycle: callbacks, messageId: 'task',
      });
      assert.ok(!failure);
      const order = phase === names[1] ? ['status', 'outcome', 'event', 'update', 'projection'] : ['duplicate', 'update', 'projection', 'log'];
      assert.deepEqual(calls.map(([name]) => name), order);
      if (phase === names[1]) assert.equal(returned, status.getAgentTaskRuntimeRunStatus(sessionResult));
      else { assert.equal(returned, undefined); assert.equal(calls.at(-1)[1][2].goal, 'changed during update'); }
    } catch (caught) {
      assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)[0], failure); returned = { error: failure };
    }
    return json({ phase, sessionStatus, state, event, failure, returned, calls, messages: fixture.messages, effects: fixture.effects, preparedRequest });
  }
}
const controller = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'resolveAgentApprovalRequest');
assert.ok(controller.includes(names[1] + '('));
for (const [dispatch, block] of [['dispatchApprovedPendingPresentation', names[0]], ['dispatchReadOnlyPendingPresentation', names[2]]]) {
  assert.ok(controller.includes(dispatch + '('));
  const dispatchSource = readModuleProjectFunction('src/components/chat/agentRunController.ts', dispatch);
  assert.match(dispatchSource, /outcome.kind === 'duplicate-blocked'/u);
  assert.ok(dispatchSource.includes(block + '('));
}
assert.match(controller, /if \(continuationStatus !== 'awaiting-approval'\) \{[\s\S]*await speakApprovedAgentResultReply/u);
const reply = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'speakApprovedAgentResultReply');
assert.match(reply, /return speakGroupTaskProductionResult\(\{/u);
assert.equal(exerciseContinuationPresentationStages().length, 301);
console.log('Continuation presentation stages smoke passed (301 cases; status/event/order/latest message/identity/errors).');
