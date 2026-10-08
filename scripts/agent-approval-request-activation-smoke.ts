import assert from 'node:assert/strict';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

export function exerciseApprovalRequestActivation(baselineSource?: string) {
  const outputs: unknown[] = [];
  for (const petId of [undefined, null, '', 'approval-pet']) for (const activePetId of [null, 'active-pet']) {
    for (const targetExists of [false, true]) for (const race of [false, true]) outputs.push(exercise(petId, activePetId, targetExists, race));
  }
  for (const failure of ['store', 'config', 'pet', 'active', 'resolve', 'token-read', 'token-write', 'group-write', 'presentation']) {
    outputs.push(exercise(null, 'active-pet', true, true, failure));
  }
  return outputs;

  function exercise(petId: string | null | undefined, activePetId: string | null, targetExists: boolean, race: boolean, failure?: string) {
    const calls: unknown[][] = []; const error = new Error('activation dependency failure');
    const step = (name: string, value: unknown = null) => { calls.push([name, value]); if (failure === name) throw error; };
    let token = 7; let group = true;
    const config = { marker: 'original config' }; const changedConfig = { marker: 'changed config' }; let currentConfig = config;
    const activeChatRequestTokenRef = {
      get current() { step('token-read', token); return token; },
      set current(value: number) { step('token-write', value); token = value; },
    };
    const groupChatContinuationEnabledRef = {
      get current() { return group; },
      set current(value: boolean) { step('group-write', value); group = value; },
    };
    const configRef = { get current() { step('config'); return currentConfig; } };
    const approvalMessage = { get petId() { step('pet', petId ?? null); if (race) currentConfig = changedConfig; return petId; } };
    const currentChatState = { get activePetId() { step('active', activePetId); return activePetId; } };
    const targetSlot = targetExists ? { id: 'target' } : null;
    const approval = { marker: 'approval' }, approvalRuntime = { marker: 'runtime' };
    const stopGroupChat = () => assert.fail('presentation owns group stop');
    const stopPetSpeech = () => assert.fail('presentation owns speech stop');
    const fixture = createAgentRunPresentationFixture(baselineSource, ['activateApprovedAgentRequest'], {
      chatStore: { desktopPetChatStore: { getState: () => { step('store'); return currentChatState; } } },
      multiPetChat: { resolveActiveChatSlot: (receivedConfig: unknown, receivedId: unknown) => {
        assert.equal(receivedConfig, config); assert.equal(receivedId, petId ?? activePetId); step('resolve', receivedId ?? null);
        if (race) token = 20; return targetSlot;
      } },
      approvalEntryPresentation: { beginApprovedAgentRunPresentation: (options: any) => {
        assert.equal(options.approval, approval); assert.equal(options.approvalRuntime, approvalRuntime);
        assert.equal(options.approvalMessage, approvalMessage); assert.equal(options.targetSlot, targetSlot);
        assert.equal(options.messageId, 'task'); assert.equal(options.stopGroupChat, stopGroupChat); assert.equal(options.stopPetSpeech, stopPetSpeech);
        assert.equal(token, race ? 21 : 8); assert.equal(group, false); step('presentation');
        if (race) { token = 99; group = true; }
      } },
    });
    try {
      const returned = fixture.module('approvalRequestActivation').activateApprovedAgentRequest({ activeChatRequestTokenRef, configRef,
        groupChatContinuationEnabledRef, approval, approvalMessage, approvalRuntime, messageId: 'task', stopGroupChat, stopPetSpeech });
      assert.ok(!failure); assert.equal(returned.currentChatState, currentChatState); assert.equal(returned.targetSlot, targetSlot);
      assert.equal(returned.requestToken, race ? 21 : 8); assert.equal(returned.then, undefined, 'activation remains synchronous');
      assert.deepEqual(calls.map(([name]) => name), ['store', 'config', 'pet', ...(petId == null ? ['active'] : []), 'resolve', 'token-read', 'token-write', 'group-write', 'presentation']);
    } catch (caught) { assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)?.[0], failure); }
    return { petId: petId ?? null, activePetId, targetExists, race, failure, calls, token, group };
  }
}
const controller = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'resolveAgentApprovalRequest');
assert.match(controller, /if \(decision === 'deny'\)[\s\S]*return;[\s\S]*activateApprovedAgentRequest\([\s\S]*const abortController[\s\S]*try/u);
assert.match(controller, /const \{ currentChatState, targetSlot, requestToken \} = activateApprovedAgentRequest\(\{\s*activeChatRequestTokenRef, configRef, groupChatContinuationEnabledRef,\s*approval, approvalMessage, approvalRuntime, messageId, stopGroupChat, stopPetSpeech,/u);
assert.match(controller, /createAgentApprovalPreparedRequest\(\{ currentChatState, configRef,[\s\S]*targetSlot, requestToken, getPlaybackToken/u);
assert.equal(exerciseApprovalRequestActivation().length, 41);
console.log('Approval request activation smoke passed (41 cases; live store/config/token, fallback/order/identity/synchronous errors).');
