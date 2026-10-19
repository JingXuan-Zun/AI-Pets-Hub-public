import assert from 'node:assert/strict';
import { beginDelegatedScope, delegatedScopeFields, resolveDelegatedSlotId } from '../src/components/chat/runController/chatDelegation';

// "Chat with one character, let another do the work": only explicit hand-offs count.
const slots = [
  { id: 'primary', personality: { name: '铃音' } },
  { id: 'companion-pet-2', personality: { name: '小玲', wakeWords: '玲玲' } },
  { id: 'companion-pet-3', personality: { name: '星灯' } },
];
assert.equal(resolveDelegatedSlotId('让小玲去把文件夹挪到副屏', slots, 'primary'), 'companion-pet-2');
assert.equal(resolveDelegatedSlotId('叫星灯帮我整理一下桌面', slots, 'primary'), 'companion-pet-3');
assert.equal(resolveDelegatedSlotId('小玲，帮我打开记事本', slots, 'primary'), 'companion-pet-2');
assert.equal(resolveDelegatedSlotId('麻烦玲玲看看下载文件夹', slots, 'primary'), 'companion-pet-2', 'wake words count as names');
assert.equal(resolveDelegatedSlotId('你觉得小玲怎么样', slots, 'primary'), null, 'only mentioning a name is not a hand-off');
assert.equal(resolveDelegatedSlotId('帮我把文件夹挪到副屏', slots, 'primary'), null);
assert.equal(resolveDelegatedSlotId('让铃音去做', slots, 'primary'), null, 'the character being chatted with is not a helper');

// While the hand-off runs, the helper's messages belong to the chatting character's conversation.
assert.deepEqual(delegatedScopeFields('companion-pet-2'), {});
const end = beginDelegatedScope('companion-pet-2', 'primary');
assert.deepEqual(delegatedScopeFields('companion-pet-2'), { scopePetId: 'primary' });
assert.deepEqual(delegatedScopeFields('companion-pet-3'), {});
end();
assert.deepEqual(delegatedScopeFields('companion-pet-2'), {});
console.log('chat delegation smoke ok');
