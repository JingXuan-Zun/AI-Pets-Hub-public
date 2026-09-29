import assert from 'node:assert/strict';
import {
  GROUP_CHAT_MAX_DELAY_MS,
  GROUP_CHAT_MIN_DELAY_MS,
  normalizeGroupChatSpeedDelay,
} from '../src/components/chat/group/groupChatSpeed';

assert.equal(normalizeGroupChatSpeedDelay(6000), 6000);
assert.equal(normalizeGroupChatSpeedDelay(GROUP_CHAT_MIN_DELAY_MS), 5000);
assert.equal(normalizeGroupChatSpeedDelay(GROUP_CHAT_MAX_DELAY_MS), 30000);
assert.equal(normalizeGroupChatSpeedDelay(17500), 18000);
assert.equal(normalizeGroupChatSpeedDelay(1000), 5000);
assert.equal(normalizeGroupChatSpeedDelay(40000), 30000);
console.log('group chat speed smoke ok');
