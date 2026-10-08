import assert from 'node:assert/strict';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const names = ['speakInitialAgentResultReply', 'speakApprovedAgentResultReply'];
export async function exerciseResultReplyStages(baselineSource?: string) {
  const outputs: unknown[] = [];
  for (const phase of names) {
    for (const group of [false, true]) for (const target of [false, true]) for (const id of ['task', '', null]) {
      for (const status of ['completed', 'needs-user', 'failed']) outputs.push(await exercise(phase, group, target, id, status));
    }
    for (const failure of phase === names[0] ? ['speaker', 'reject'] : ['goal', 'participant', 'speaker', 'reject']) {
      outputs.push(await exercise(phase, false, true, 'task', 'completed', failure));
    }
  }
  return outputs;

  async function exercise(phase: string, group: boolean, target: boolean, id: string | null, status: string, failure?: string) {
    const initial = phase === names[0];
    const calls: any[] = [];
    const error = new Error('original dependency failure');
    const step = (name: string, value: unknown) => { calls.push([name, json(value)]); if (failure === name) throw error; };
    let revision = 0;
    const approvalRuntime = { get userGoal() { step('goal', revision); return 'goal ' + revision; } };
    const preparedRequest: any = { isGroupMode: group, targetSlots: [] };
    const participantNames = ['original participants'];
    const targetSlot = target ? { id: 'pet', personality: { name: 'original target' } } : null;
    const groupTaskLifecycle = { marker: 'callbacks' };
    const result = { status, finalAnswer: 'answer', continuation: { taskId: 'same task' } };
    const playVoiceText = async () => { throw new Error('stage must forward voice callback'); };
    const runPetResponseTurn = async () => { throw new Error('stage must forward response callback'); };
    let resolve!: (value: any) => void;
    let reject!: (error: any) => void;
    let pending: Promise<any>;
    const completion = { marker: 'speaker completion' };
    const fixture = createAgentRunPresentationFixture(baselineSource, names, {
      groupPersonaSpeaker: { speakGroupTaskProductionResult: (options: any) => {
        step('speaker', { groupTaskLifecycle: options.groupTaskLifecycle, speakOptions: { ...options.speakOptions, preparedRequest: { isGroupMode: preparedRequest.isGroupMode }, playVoiceText: true, runPetResponseTurn: true } });
        assert.equal(options.groupTaskLifecycle, groupTaskLifecycle);
        const speak = options.speakOptions;
        assert.equal(speak.result, result); assert.equal(speak.preparedRequest, preparedRequest); assert.equal(speak.targetSlot, targetSlot);
        assert.equal(speak.playVoiceText, playVoiceText); assert.equal(speak.runPetResponseTurn, runPetResponseTurn);
        assert.equal(speak.compactReplyIntoMessageId, id);
        if (initial) { assert.equal(speak.participantNames, participantNames); assert.equal(speak.shouldAutoSpeakReply, !group); }
        else { assert.deepEqual(json(speak.participantNames), ['participant ' + revision]); assert.equal(speak.shouldAutoSpeakReply, !preparedRequest.isGroupMode); }
        return pending;
      } },
    });
    for (revision = 1; revision <= 2; revision += 1) {
      preparedRequest.isGroupMode = group;
      preparedRequest.targetSlots = [{ personality: { get name() { step('participant', revision); preparedRequest.isGroupMode = !group; return 'participant ' + revision; } } }];
      pending = new Promise((yes, no) => { resolve = yes; reject = no; });
      try {
        const returned = fixture.module('resultReplyStages')[phase]({
          groupTaskLifecycle, instruction: 'initial instruction', participantNames, playVoiceText, preparedRequest,
          messageId: id, result, runPetResponseTurn, shouldAutoSpeakReply: !group, targetSlot, approvalRuntime,
        });
        assert.equal(returned, pending, 'return the same promise without an async wrapper');
        const observed = returned.then((value: any) => ({ value }), (caught: any) => ({ caught }));
        if (failure === 'reject') reject(error); else resolve(completion);
        const outcome = await observed;
        if (outcome.caught) throw outcome.caught;
        assert.equal(outcome.value, completion); assert.ok(!failure);
      } catch (caught) {
        assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)[0], failure === 'reject' ? 'speaker' : failure);
        resolve(completion);
      }
    }
    if (!failure) assert.deepEqual(calls.map(([name]) => name), initial ? ['speaker', 'speaker'] : ['goal', 'participant', 'speaker', 'goal', 'participant', 'speaker']);
    return json({ phase, group, target, id, status, failure, calls });
  }
}
for (const [entry, stage, count] of [['runPreparedAgentProductionSession', names[0], 2], ['resolveAgentApprovalRequest', names[1], 2]] as const) {
  const source = readModuleProjectFunction('src/components/chat/agentRunController.ts', entry);
  assert.equal((source.match(new RegExp(`await ${stage}\\(`, 'gu')) ?? []).length, count);
}
assert.equal((await exerciseResultReplyStages()).length, 78);
console.log('Result reply stages smoke passed (78 cases, two calls each; live reads/identity/deferred reply/errors).');
