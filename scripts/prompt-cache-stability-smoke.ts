// Prompt caching (2026-11-05): the history window must keep the same first message for many
// turns, and cache usage must be read from DeepSeek and OpenAI-style usage blocks.
import { strict as assert } from 'node:assert';
import { limitHistoryForPrompt } from '../src/services/geminiPromptService';
import { summarizePromptCacheUsage } from '../src/services/openAITextStream';
import type { ChatMessage } from '../src/types';

const message = (index: number): ChatMessage => ({
  createdAt: index,
  id: `m${index}`,
  role: index % 2 ? 'model' : 'user',
  text: `第 ${index} 条消息`,
} as ChatMessage);

const firstIds: string[] = [];
for (let length = 120; length <= 160; length += 1) {
  const history = Array.from({ length }, (_, index) => message(index));
  const window = limitHistoryForPrompt(history, 32768);
  assert.ok(window.length <= 100, 'never more than 100 messages');
  assert.ok(window.length >= 10, 'never fewer than 10');
  assert.equal(window.at(-1)?.id, `m${length - 1}`, 'always ends with the newest message');
  firstIds.push(window[0].id);
}
const changes = firstIds.filter((id, index) => index > 0 && id !== firstIds[index - 1]).length;
assert.ok(changes <= 3, `the first message changes rarely (changed ${changes} times in 40 turns)`);

const short = Array.from({ length: 30 }, (_, index) => message(index));
assert.equal(limitHistoryForPrompt(short, 32768).length, 30, 'short histories are kept whole');

assert.deepEqual(
  summarizePromptCacheUsage({ completion_tokens: 300, prompt_cache_hit_tokens: 38400, prompt_cache_miss_tokens: 1937, prompt_tokens: 40337 }),
  { completionTokens: 300, hitRate: 95, hitTokens: 38400, missTokens: 1937, promptTokens: 40337 },
);
assert.deepEqual(
  summarizePromptCacheUsage({ completion_tokens: 5, prompt_tokens: 1000, prompt_tokens_details: { cached_tokens: 800 } }),
  { completionTokens: 5, hitRate: 80, hitTokens: 800, missTokens: 200, promptTokens: 1000 },
);
assert.equal(summarizePromptCacheUsage(null), null);
console.log(`prompt cache stability smoke ok: window start changed ${changes} times in 40 turns`);
