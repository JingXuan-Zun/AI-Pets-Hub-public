import { strict as assert } from 'node:assert';
import { limitHistoryForPrompt } from '../src/services/geminiPromptService.ts';
import type { ChatMessage } from '../src/types.ts';

function message(index: number, text: string, role: 'model' | 'user' = index % 2 === 0 ? 'model' : 'user'): ChatMessage {
  return { id: `message-${index}`, role, text };
}

const ordinaryHistory = Array.from(
  { length: 120 },
  (_entry, index) => message(index, `第 ${index + 1} 条对话：${'内容'.repeat(20)}`),
);
const defaultDepthHistory = limitHistoryForPrompt(ordinaryHistory, 8192);
assert.equal(defaultDepthHistory.length, 100, '8192 depth should retain the expanded recent-turn limit');
assert.equal(defaultDepthHistory[0]?.id, 'message-20');
assert.equal(defaultDepthHistory.at(-1)?.id, 'message-119');

const longAssistantReply = '关键方案：先完成 A，再验证 B。' + '细节'.repeat(9000);
const recentLongReplyHistory = [
  ...Array.from({ length: 12 }, (_entry, index) => message(index, `前文 ${index + 1}`)),
  message(12, longAssistantReply, 'model'),
];
const retainedLongReply = limitHistoryForPrompt(recentLongReplyHistory, 8192);
assert.equal(retainedLongReply.at(-1)?.text, longAssistantReply, 'the latest detailed pet reply must remain available for the next follow-up');
assert.ok(retainedLongReply.length >= 10, 'recent conversation should retain the minimum complete context window');

console.log('chat history memory budget smoke passed');