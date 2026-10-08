import assert from 'node:assert/strict';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';

const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const names = ['completeDeniedAgentApproval', 'completeFailedAgentApproval'];
export function exerciseApprovalTerminalStages(baselineSource?: string) {
  const outputs: unknown[] = [];
  for (const phase of ['denied', 'failed']) {
    for (const journal of [false, true]) {
      for (const runtime of [null, {}, { taskState: { taskId: 'task' } }, { taskState: { taskId: 'task', runId: 'run' } }]) {
        for (const event of [false, true]) outputs.push(exercise(phase, journal, runtime, event));
      }
    }
    const dependencies = phase === 'denied'
      ? ['append', 'event', 'update', 'projection', 'log', 'world', 'publish', 'complete', 'release']
      : ['append', 'release', 'world', 'text', 'assess', 'event', 'update', 'projection', 'publish', 'complete', 'log'];
    for (const dependency of dependencies) outputs.push(exercise(phase, true, { taskState: { taskId: 'task', runId: 'run' } }, true, dependency));
  }
  return outputs;

  function exercise(phase: string, journal: boolean, runtime: any, event: boolean, failure?: string) {
    const calls: any[] = [];
    const originalError = new Error('dependency failure');
    const step = (name: string, value?: unknown) => {
      calls.push([name, json(value ?? null)]);
      if (failure === name) throw originalError;
    };
    const approval: any = { command: { kind: 'tool-call' }, plan: { goal: 'original goal' }, groupTaskEvent: event ? { taskId: 'approval' } : null };
    const approvalMessage: any = { petId: 'pet', groupTaskEvent: { taskId: 'message' } };
    const callbacks = { marker: true };
    const result = { ok: false, assessment: { status: 'failed' } };
    let fixture: ReturnType<typeof createAgentRunPresentationFixture>;
    const project = (message: any, options: any) => {
      step('projection', { message, options });
      assert.equal(message.text, 'latest message');
      assert.equal(options.approval, approval);
      if (phase === 'failed') assert.equal(options.result, result);
      return { ...message, options };
    };
    fixture = createAgentRunPresentationFixture(baselineSource, names, {
      agent: {
        releaseAgentCanonicalEventJournal: (id: string) => step('release', id),
        assessAgentCommandResult: (command: any, options: any) => {
          step('assess', { command, options }); assert.equal(command, approval.command); return result;
        },
      },
      agentRuntimeWorldBridge: { publishAgentRuntimeWorldResult: (options: any) => {
        step('world', options); assert.equal(options.taskState, runtime?.taskState ?? null);
      } },
      frontendRuntimeLogger: { pushFrontendRuntimeLog: (...args: any[]) => step('log', args) },
      groupTaskConversationEvent: { updateGroupTaskConversationEvent: (options: any) => {
        step('event', options); assert.equal(options.event, approval.groupTaskEvent ?? approvalMessage.groupTaskEvent);
        return { ...options.event, outcome: options.outcome, summary: options.summary };
      } },
      groupTaskApprovalLifecycle: {
        publishGroupTaskEvent: (current: any, value: any) => { assert.equal(current, callbacks); step('publish', value); },
        completeGroupTaskMessageLifecycle: (current: any, value: any, petId: string) => { assert.equal(current, callbacks); step('complete', { value, petId }); },
      },
      agentApprovalMessageStore: { updateAgentApprovalMessage: (id: string, updater: any) => {
        step('update', id); fixture.messages[0] = { ...fixture.messages[0], text: 'latest message' };
        fixture.store.updateMessage(id, updater);
      } },
      approvalDecisionProjection: { projectAgentApprovalDenied: project },
      approvalFailureProjection: { projectAgentApprovalFailure: project },
      sessionVisibleText: { createAgentApprovalFailureVisibleText: (text: string) => { step('text', text); return 'visible: ' + text; } },
    });
    const canonicalEventJournal = journal ? { append: (entry: any) => {
      step('append', entry); approval.plan.goal = 'changed during append';
    } } : null;
    const options = { canonicalEventJournal, approvalRuntime: runtime, approval, approvalMessage, messageId: 'task', groupTaskLifecycle: callbacks, errorText: 'original error' };
    try {
      const returned = fixture.module('approvalTerminalStages')[phase === 'denied' ? names[0] : names[1]](options);
      assert.equal(returned, undefined); assert.ok(!failure);
      const order = phase === 'denied'
        ? ['event', 'update', 'projection', 'log', 'world', 'publish', 'complete', 'release']
        : ['release', 'world', 'text', 'assess', 'event', 'update', 'projection', 'publish', 'complete', 'log'];
      if (journal && runtime?.taskState) order.unshift('append');
      assert.deepEqual(calls.map(([name]) => name), order);
      const entry = calls.find(([name]) => name === 'append')?.[1];
      if (entry) {
        assert.equal(entry.type, phase === 'denied' ? 'task_cancelled' : 'task_failed');
        assert.equal(entry.runId, runtime.taskState.runId ?? runtime.taskState.taskId);
      }
    } catch (caught) {
      assert.ok(failure); assert.equal(caught, originalError); assert.equal(calls.at(-1)[0], failure);
    }
    return json({ phase, journal, runtime, event, failure, calls, messages: fixture.messages, effects: fixture.effects });
  }
}
const outputs = exerciseApprovalTerminalStages();
assert.equal(outputs.length, 52);
console.log('Approval terminal stages smoke passed (52 cases; journal/order/latest message/identity/exceptions).');
