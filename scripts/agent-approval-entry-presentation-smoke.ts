import assert from 'node:assert/strict';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

const json = (value: unknown) => value === undefined ? null : JSON.parse(JSON.stringify(value));
const names = ['beginApprovedAgentRunPresentation', 'presentUnsupportedAgentApproval'];
export function exerciseApprovalEntryPresentation(baselineSource?: string) {
  const outputs: unknown[] = [];
  for (const event of [null, false, {}, undefined]) for (const fallback of [null, {}]) {
    for (const target of [null, { id: '' }, { id: 'pet' }]) for (const runtime of [null, { marker: 'runtime' }]) {
      for (const race of [false, true]) outputs.push(exercise(true, event, fallback, target, runtime, race));
    }
  }
  for (const command of [{ kind: 'action' }, { kind: 'tool', toolCall: { name: 'test' } }, null, undefined]) {
    for (const race of [false, true]) outputs.push(exercise(false, null, null, null, null, race, undefined, command));
  }
  for (const failure of ['event', 'fallback', 'group', 'speech', 'typing', 'pet', 'update', 'projection', 'goal', 'log']) {
    outputs.push(exercise(true, null, null, { id: 'pet' }, null, true, failure));
  }
  for (const failure of ['command', 'assess', 'update', 'projection']) outputs.push(exercise(false, null, null, null, null, true, failure));
  return outputs;

  function exercise(accepted: boolean, event: any, fallback: any, targetSlot: any, approvalRuntime: any, race: boolean, failure?: string, command: any = { kind: 'action' }) {
    const calls: any[] = []; const error = new Error('original dependency failure');
    const step = (name: string, value: unknown) => { calls.push([name, json(value)]); if (failure === name) throw error; };
    let goal = 'original goal'; let currentCommand = command;
    const approval: any = {
      get groupTaskEvent() { step('event', event); return event; },
      get command() { step('command', currentCommand ?? null); return currentCommand; },
      plan: { get goal() { step('goal', goal); return goal; } },
    };
    const approvalMessage: any = { get groupTaskEvent() { step('fallback', fallback); return fallback; } };
    const result = { ok: false, responseText: 'unsupported', marker: 'original result' };
    let fixture: ReturnType<typeof createAgentRunPresentationFixture>;
    const project = (message: any, options: any) => {
      step('projection', { message, accepted }); assert.equal(message.text, 'latest message');
      if (accepted) assert.equal(options.approvalRuntime, approvalRuntime);
      else { assert.equal(options.approval, approval); assert.equal(options.result, result); }
      if (race) goal = 'after projection';
      return { ...message, status: accepted ? 'running' : 'failed', runtime: accepted ? approvalRuntime : null };
    };
    fixture = createAgentRunPresentationFixture(baselineSource, names, {
      chatStore: { desktopPetChatStore: {
        setTyping: (value: boolean) => { step('typing', value); assert.equal(value, true); },
        setTypingPetId: (value: string | null) => { step('pet', value); assert.equal(value, targetSlot?.id ?? null); },
      } },
      agent: { assessAgentCommandResult: (value: any, options: any) => {
        assert.equal(value, command); step('assess', { value, options });
        assert.equal(options.ok, false); assert.equal(options.errorText, 'Legacy Agent approval is no longer supported by the active entry path.');
        assert.equal(options.responseText, options.errorText); if (race) currentCommand = { kind: 'changed command' }; return result;
      } },
      agentApprovalMessageStore: { updateAgentApprovalMessage: (id: string, updater: any) => {
        step('update', id); assert.equal(id, 'task'); fixture.messages[0] = { ...fixture.messages[0], text: 'latest message' };
        fixture.store.updateMessage(id, updater);
      } },
      approvalDecisionProjection: { projectAgentApprovalAccepted: project },
      approvalResultProjection: { projectAgentUnsupportedApproval: project },
      frontendRuntimeLogger: { pushFrontendRuntimeLog: (...args: any[]) => step('log', args) },
    });
    const stopGroupChat = (options: any) => { step('group', options); assert.deepEqual(json(options), { immediate: true, cancelActiveRequest: false }); };
    const stopPetSpeech = () => { step('speech', null); if (race && targetSlot) targetSlot.id = 'changed pet'; };
    try {
      const returned = fixture.module('approvalEntryPresentation')[accepted ? names[0] : names[1]]({ approval, approvalMessage, approvalRuntime, targetSlot, messageId: 'task', stopGroupChat, stopPetSpeech });
      assert.equal(returned, undefined); assert.ok(!failure);
      const order = accepted ? ['event', ...((event === null || event === undefined) ? ['fallback'] : []), ...(!(event ?? fallback) ? ['group'] : []), 'speech', 'typing', 'pet', 'update', 'projection', 'goal', 'log'] : ['command', 'assess', 'update', 'projection'];
      assert.deepEqual(calls.map(([name]) => name), order);
      if (accepted) assert.equal(calls.at(-1)[1][2].goal, race ? 'after projection' : 'original goal');
    } catch (caught) { assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)[0], failure); }
    return json({ accepted, event, fallback, targetSlot, approvalRuntime, race, failure, calls, effects: fixture.effects, messages: fixture.messages });
  }
}
const approval = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'resolveAgentApprovalRequest');
const activation = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'activateApprovedAgentRequest');
assert.match(activation, /activeChatRequestTokenRef.current = requestToken;[\s\S]*groupChatContinuationEnabledRef.current = false;\s*beginApprovedAgentRunPresentation\(/u);
assert.match(approval, /activateApprovedAgentRequest\([\s\S]*const abortController[\s\S]*try\s*\{\s*if \(!approvalRuntime\)\s*\{\s*presentUnsupportedAgentApproval\([\s\S]*return;/u);
assert.equal(exerciseApprovalEntryPresentation().length, 118);
console.log('Approval entry presentation smoke passed (118 cases; event precedence/order/live target/latest message/identity/errors).');
