import assert from 'node:assert/strict';
import * as status from '../src/components/chat/agentRuntimeUiStatusProjection';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';

const json = (value: unknown) => JSON.parse(JSON.stringify(value));
export function exerciseResultPresentationStages(baselineSource?: string) {
  const outputs: unknown[] = [];
  const names = ['updateInitialAgentRunPresentation', 'updateApprovedAgentRunPresentation'];
  for (const phase of ['initial', 'approved']) {
    for (const sessionStatus of ['completed', 'needs-approval', 'needs-user', 'failed', 'max-steps', 'budget-exceeded', 'cancelled', 'running']) {
      for (const state of [null, 'active', 'waiting_approval', 'succeeded', 'failed', 'cancelled']) {
        for (const pending of [false, true]) {
          for (const present of [false, true]) {
            outputs.push(exercise(phase, sessionStatus, state, pending, present));
          }
        }
      }
    }
  }
  for (const phase of ['initial', 'approved']) {
    const dependencies = phase === 'initial'
      ? ['placeholder', 'display', 'status', 'pending', 'waiting', 'update', 'projection']
      : ['display', 'status', 'approval-status', 'waiting', 'pending', 'outcome', 'event', 'update', 'projection'];
    for (const dependency of dependencies) outputs.push(exercise(phase, 'completed', 'succeeded', true, true, dependency));
  }
  return outputs;

  function exercise(phase: string, sessionStatus: string, state: string | null, pending: boolean, present: boolean, failure?: string) {
    const calls: any[] = [];
    const error = new Error('original dependency error');
    const step = (name: string, value?: unknown) => {
      calls.push([name, json(value ?? null)]);
      if (failure === name) throw error;
    };
    const command = { kind: 'tool-call', sourceText: 'original command' };
    const display = { command, result: { ok: true, responseText: 'display', followUp: 'next' } };
    const approvalRuntime = { sourceText: 'original input', userGoal: 'original goal', taskState: { taskId: 'task', revision: 8 } };
    const result: any = { status: sessionStatus, taskState: state ? { state } : null, finalAnswer: 'original answer', continuation: approvalRuntime };
    const followUp = { command, agentRuntime: approvalRuntime };
    const preparedRequest: any = { outgoingText: 'request', groupTaskEvent: { taskId: 'prepared' } };
    const approval: any = { command, groupTaskEvent: present ? { taskId: 'approval' } : null };
    const approvalMessage: any = { groupTaskEvent: { taskId: 'message' } };
    let fixture: ReturnType<typeof createAgentRunPresentationFixture>;
    const projection = (message: any, options: any) => {
      step('projection', { message, options });
      assert.equal(message.text, 'latest store text');
      assert.equal(options.displayResult, display);
      assert.equal(options.result ?? options.sessionResult, result);
      return { ...message, options };
    };
    fixture = createAgentRunPresentationFixture(baselineSource, names, {
      sessionMessageProjection: { createAgentProductionSessionPlaceholderCommand: (...args: any[]) => { step('placeholder', args); return command; } },
      sessionDisplayResult: { createAgentProductionSessionDisplayResult: (runtime: any, fallback: any) => {
        assert.equal(runtime, result); assert.equal(fallback, command); step('display', [runtime, fallback]);
        preparedRequest.outgoingText = 'changed during display'; return display;
      } },
      agentRuntimeUiStatusProjection: {
        getAgentTaskRuntimeRunStatus: (runtime: any) => { step('status', runtime); return status.getAgentTaskRuntimeRunStatus(runtime); },
        isAgentTaskRuntimeWaitingApproval: (runtime: any) => { step('waiting', runtime); return status.isAgentTaskRuntimeWaitingApproval(runtime); },
        resolveAgentApprovalUiStatus: (value: any) => { step('approval-status', value); return status.resolveAgentApprovalUiStatus(value); },
      },
      agent: { resolveAgentRuntimePendingFollowUpApproval: (options: any) => {
        step('pending', options); assert.equal(options.runtimeResult, result); assert.equal(options.result, display.result);
        assert.equal(options.sourceText, phase === 'initial' ? 'changed during display' : approvalRuntime.sourceText);
        return pending ? followUp : null;
      } },
      groupTaskContinuationPolicy: { resolveGroupTaskContinuationOutcome: (options: any) => { step('outcome', options); return options.hasPendingFollowUp ? 'waiting' : options.runStatus; } },
      groupTaskApprovalLifecycle: { updatePreparedGroupTaskEvent: (options: any) => {
        step('event', { ...options, callbacks: Boolean(options.callbacks) });
        assert.equal(options.preparedRequest, preparedRequest);
        assert.equal(options.event, approval.groupTaskEvent ?? approvalMessage.groupTaskEvent);
        const event = { ...options.event, outcome: options.outcome, summary: options.summary };
        preparedRequest.groupTaskEvent = event; return event;
      } },
      agentApprovalMessageStore: {
        updateAgentRunMessage: update, updateAgentApprovalMessage: update,
      },
      runResultProjection: { projectAgentRunResult: projection },
      approvalResultProjection: { projectAgentApprovalResult: projection },
    });
    function update(id: string, updater: (message: any) => any) {
      step('update', id);
      fixture.messages[0] = { ...fixture.messages[0], text: 'latest store text' };
      fixture.store.updateMessage(id, updater);
    }
    const functions = fixture.module('resultPresentationStages');
    let returned: any;
    try {
      returned = phase === 'initial'
        ? functions.updateInitialAgentRunPresentation({ result, instruction: 'goal', preparedRequest, runMessageId: present ? 'task' : null })
        : functions.updateApprovedAgentRunPresentation({ sessionResult: result, approval, approvalRuntime, approvalMessage, preparedRequest, groupTaskLifecycle: { marker: true }, messageId: 'task' });
      assert.ok(!failure, 'dependency must throw');
      assert.equal(phase === 'initial' ? returned : returned.pendingReadOnlyFollowUpApproval, pending ? followUp : null);
      if (phase === 'approved') assert.equal(returned.displayResult, display);
      if (phase === 'initial' && !present) assert.ok(!calls.some(([name]) => ['waiting', 'update', 'projection'].includes(name)));
      if (phase === 'approved' || present) {
        const options = fixture.messages[0].options;
        assert.equal(options.runStatus ?? options.taskRunStatus, status.getAgentTaskRuntimeRunStatus(result));
        assert.equal(options.shouldHideRunFollowUps ?? options.shouldHideApprovalFollowUps,
          status.isAgentTaskRuntimeWaitingApproval(result) || (phase === 'initial' && pending));
      }
    } catch (caught) {
      assert.ok(failure); assert.equal(caught, error, 'preserve original exception identity');
      assert.equal(calls.at(-1)[0], failure, 'stop immediately at failing dependency');
      returned = { error: failure };
    }
    return json({ phase, sessionStatus, state, pending, present, failure, calls, returned, messages: fixture.messages, effects: fixture.effects, preparedRequest });
  }
}

const results = exerciseResultPresentationStages();
assert.equal(results.length, 400);
console.log(`Agent result presentation stages smoke passed (${results.length} cases).`);
