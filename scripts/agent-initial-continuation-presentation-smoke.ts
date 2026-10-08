import assert from 'node:assert/strict';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

const json = (value: unknown) => value === undefined ? null : JSON.parse(JSON.stringify(value));
const names = ['updateInitialAgentContinuationPresentation', 'logUnconsumedInitialAgentApproval', 'logMissingInitialAgentApprovalExecutor'];
const kinds = ['duplicate-blocked', 'limit-reached', 'pending-user-approval', 'stale-context', 'consumed', 'cancelled', 'stale-outer-skipped'];
export function exerciseInitialContinuationPresentation(baselineSource?: string) {
  const outputs: unknown[] = [];
  for (const kind of kinds) for (const id of ['task', '', null]) for (const race of [false, true]) outputs.push(exercise(0, kind, id, race));
  for (const stop of [null, { decision: null }, { decision: { allowed: false } }]) {
    for (const tool of [null, { name: 'read' }, { name: '' }]) for (const race of [false, true]) outputs.push(exercise(1, 'consumed', 'task', race, undefined, stop, tool));
  }
  for (const tool of [null, { name: 'read' }, { name: '' }]) for (const race of [false, true]) outputs.push(exercise(2, 'consumed', 'task', race, undefined, null, tool));
  for (const failure of ['outcome', 'count', 'decision', 'log', 'update', 'projection']) outputs.push(exercise(0, 'duplicate-blocked', 'task', true, failure));
  for (const failure of ['stop', 'goal', 'command', 'log']) outputs.push(exercise(1, 'consumed', 'task', true, failure));
  for (const failure of ['goal', 'command', 'log']) outputs.push(exercise(2, 'consumed', 'task', true, failure));
  return outputs;

  function exercise(phase: number, kind: string, id: string | null, race: boolean, failure?: string, stop: any = null, tool: any = null) {
    const calls: any[] = []; const error = new Error('original dependency failure');
    const step = (name: string, value: unknown) => { calls.push([name, json(value)]); if (failure === name) throw error; };
    let goal = 'original goal'; const decision = { allowed: false, reason: 'original decision' };
    const result: any = { marker: 'original result' };
    const outcome = { get kind() { step('kind', kind); return kind; }, get decision() { step('decision', decision); return decision; } };
    const continuationRun = {
      get outcome() { step('outcome', null); return outcome; },
      get count() { step('count', 3); return 3; },
      get stop() { step('stop', stop); if (race) goal = 'after stop'; return stop; },
    };
    const command = { kind: 'fallback-kind', toolCall: tool };
    const pendingRunFollowUpApproval = {
      plan: { get goal() { step('goal', goal); return goal; } },
      get command() { step('command', command); return command; },
    };
    let fixture: ReturnType<typeof createAgentRunPresentationFixture>;
    fixture = createAgentRunPresentationFixture(baselineSource, names, {
      agent: { AGENT_RUNTIME_DEFAULT_APPROVAL_CONTINUATION_LIMIT: 6 },
      frontendRuntimeLogger: { pushFrontendRuntimeLog: (...args: any[]) => { step('log', args); if (race) result.marker = 'after log'; } },
      agentApprovalMessageStore: { updateAgentRunMessage: (messageId: string | null, updater: any) => {
        step('update', messageId); assert.equal(messageId, id);
        fixture.messages[0] = { ...fixture.messages[0], text: 'latest message' };
        fixture.store.updateMessage(messageId as string, updater);
      } },
      runResultProjection: { projectAgentRunContinuationResult: (message: any, options: any) => {
        assert.equal(options.result, result); step('projection', { message, marker: options.result.marker });
        assert.equal(message.text, 'latest message'); return { ...message, marker: options.result.marker };
      } },
    });
    try {
      assert.equal(fixture.module('initialContinuationPresentation')[names[phase]]({ continuationRun, pendingRunFollowUpApproval, result, runMessageId: id }), undefined);
      assert.ok(!failure);
      const logged = calls.find(([name]) => name === 'log');
      if (phase === 0) {
        const loggedStop = kinds.indexOf(kind) < 4; assert.equal(!!logged, loggedStop);
        const reads = Math.min(kinds.indexOf(kind) + 1, 4);
        assert.equal(calls.filter(([name]) => name === 'outcome').length, reads + (loggedStop ? 1 : 0));
        assert.equal(calls.filter(([name]) => name === 'kind').length, reads);
        if (loggedStop) assert.deepEqual(logged[1], ['agent-run', 'initial task-scoped approval continuation stopped', { count: 3, decision, limit: 6 }]);
        assert.equal(calls.at(-1)[0], id === 'task' ? 'projection' : 'update');
        if (id === 'task') assert.equal(fixture.messages[0].marker, loggedStop && race ? 'after log' : 'original result');
      } else {
        assert.deepEqual(logged[1], ['agent-run', 'initial task-scoped follow-up approval continuation not consumed', {
          decision: phase === 1 ? stop?.decision ?? null : null,
          ...(phase === 2 ? { reason: 'missing-executor' } : {}), goal: phase === 1 && race ? 'after stop' : 'original goal', tool: tool?.name ?? command.kind,
        }]);
        assert.equal(calls.filter(([name]) => name === 'command').length, tool ? 1 : 2);
        assert.equal(calls.at(-1)[0], 'log');
      }
    } catch (caught) { assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)[0], failure); }
    return json({ phase, kind, id, race, failure, stop, tool, calls, messages: fixture.messages, effects: fixture.effects });
  }
}
const prepared = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'runPreparedAgentProductionSession');
assert.match(prepared, /if \(continuationRun.count === 0\)\s*\{\s*logUnconsumedInitialAgentApproval\(/u);
assert.match(prepared, /result = continuationRun.result;\s*publishInitialAgentRuntimeResult\([\s\S]*updateInitialAgentContinuationPresentation\([\s\S]*if \(!isAgentTaskRuntimeWaitingApproval\(result\)\)/u);
assert.match(prepared, /else \{\s*logMissingInitialAgentApprovalExecutor\([\s\S]*await presentAgentRunPendingApproval\(/u);
assert.equal(exerciseInitialContinuationPresentation().length, 79);
console.log('Initial continuation presentation smoke passed (79 cases; Runtime outcomes/live reads/order/latest store/identity/errors).');
