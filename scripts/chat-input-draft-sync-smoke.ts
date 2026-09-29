import assert from 'node:assert/strict';
import { resolveChatDraftExternalInputSync } from '../src/components/chat/usePetChatConversationDraft.ts';
import { readProjectFile } from './smokeTestHarness.ts';

const now = 1_000;
const pendingExpiresAt = now + 1_800;

assert.deepEqual(
  resolveChatDraftExternalInputSync({
    inputValue: 'hello',
    now,
    pendingDraftValue: 'hello ',
    pendingDraftValueExpiresAt: pendingExpiresAt,
  }),
  {
    nextPendingDraftValue: 'hello ',
    nextPendingDraftValueExpiresAt: pendingExpiresAt,
    shouldApplyInputValue: false,
  },
  'a stale external input ack must not roll back a newer local draft that ends with a space',
);

assert.deepEqual(
  resolveChatDraftExternalInputSync({
    inputValue: 'hello ',
    now,
    pendingDraftValue: 'hello ',
    pendingDraftValueExpiresAt: pendingExpiresAt,
  }),
  {
    nextPendingDraftValue: null,
    nextPendingDraftValueExpiresAt: 0,
    shouldApplyInputValue: true,
  },
  'the matching external input ack should clear the local pending guard',
);

assert.deepEqual(
  resolveChatDraftExternalInputSync({
    inputValue: '/agent open browser ',
    now: pendingExpiresAt + 1,
    pendingDraftValue: 'hello ',
    pendingDraftValueExpiresAt: pendingExpiresAt,
  }),
  {
    nextPendingDraftValue: null,
    nextPendingDraftValueExpiresAt: 0,
    shouldApplyInputValue: true,
  },
  'an expired guard should allow a real external input command to replace the draft',
);

const draftSource = readProjectFile('src/components/chat/usePetChatConversationDraft.ts');
const scheduleInputSyncBody = draftSource.match(
  /const scheduleInputSync = useCallback\(\(nextValue: string\) => \{([\s\S]*?)\n  \}, \[commitInputValue, markPendingDraftValue\]\);/u,
)?.[1] ?? '';
const commitInputValueBody = draftSource.match(
  /const commitInputValue = useCallback\(\(nextValue: string\) => \{([\s\S]*?)\n  \}, \[markPendingDraftValue, onInputChange\]\);/u,
)?.[1] ?? '';

assert.ok(scheduleInputSyncBody, 'scheduleInputSync body should be present');
assert.ok(commitInputValueBody, 'commitInputValue body should be present');
assert.ok(
  scheduleInputSyncBody.indexOf('markPendingDraftValue(nextValue);') >= 0
    && scheduleInputSyncBody.indexOf('markPendingDraftValue(nextValue);')
      < scheduleInputSyncBody.indexOf('window.requestAnimationFrame'),
  'typing should mark the latest local draft as pending before waiting for requestAnimationFrame',
);
assert.ok(
  commitInputValueBody.indexOf('markPendingDraftValue(nextValue);') >= 0
    && commitInputValueBody.indexOf('markPendingDraftValue(nextValue);')
      < commitInputValueBody.indexOf('onInputChange(nextValue);'),
  'committing the draft should mark it pending before notifying the external chat store',
);

console.log('chat input draft sync smoke ok');
