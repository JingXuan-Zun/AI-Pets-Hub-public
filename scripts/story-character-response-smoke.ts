import assert from 'node:assert/strict';
import { normalizeStoryCharacterResponse } from '../src/components/chat/story/storyCharacterText';

assert.equal(normalizeStoryCharacterResponse('（我端着茶走进房间。）你好。'), '你好。');
assert.equal(normalizeStoryCharacterResponse('(我看向窗外。) 现在出发。'), '现在出发。');
assert.equal(normalizeStoryCharacterResponse('旁白：门缓缓打开。'), '门缓缓打开。');

console.log('story character response smoke: PASS');
