import assert from 'node:assert/strict';
import { readOpenAITextStream } from '../src/services/openAITextStream';
import { getConfiguredTextResponseStream } from '../src/services/geminiService';
import type { PetConfig } from '../src/types';
import { generateStoryNarration } from '../src/components/chat/story/storyNarrator';
import { createEmptyStorySessionForSmoke } from './story-narration-smoke-fixture';

const encode = new TextEncoder();
const event = (text: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\r\n\r\n`;
let feed!: ReadableStreamDefaultController<Uint8Array>;
let cancelled = false;
const stream = new ReadableStream<Uint8Array>({ start(c) { feed = c; }, cancel() { cancelled = true; } });
const response = new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
const iterator = readOpenAITextStream(response);
const first = iterator.next();
feed.enqueue(encode.encode(event('第一段')));
assert.equal((await first).value, '第一段', 'first text must arrive before stream closes');
const next = iterator.next();
const bytes = encode.encode(event('中文🙂'));
for (const byte of bytes) feed.enqueue(new Uint8Array([byte]));
assert.equal((await next).value, '中文🙂');
feed.enqueue(encode.encode('data: [DONE]\n\n'));
assert.equal((await iterator.next()).done, true);
assert.equal(cancelled, true);

async function collect(text: string) {
  let output = '';
  for await (const chunk of readOpenAITextStream(new Response(text))) output += chunk;
  return output;
}
assert.equal(await collect(': heartbeat\n\ndata: {"choices":[{"delta":{"reasoning_content":"private"}}]}\n\n' + event('正文')), '正文');
await assert.rejects(() => collect('data: {"error":{"message":"disconnected"}}\n\n'), /disconnected/);
await assert.rejects(() => collect('data: [DONE]\n\n'), /未返回回复正文/);
await assert.rejects(
  () => collect('data: {"choices":[{"delta":{"reasoning_content":"private"},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n'),
  /内部推理/u,
);
await assert.rejects(
  () => collect('data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n'),
  /结束原因：length/u,
);
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.stream, true);
    assert.equal(body.max_tokens, 2048);
    assert.ok(init?.signal);
    return new Response(event('甲') + event('乙') + 'data: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
  };
  const chunks: string[] = [];
  for await (const chunk of getConfiguredTextResponseStream('测试', '只输出正文', {
    llmProvider: 'openai', customApiUrl: 'https://example.invalid/v1', customModelName: 'test', customApiKey: '', customModelRequestParams: [],
  } as PetConfig['settings'], { maxTokens: 2048 })) chunks.push(chunk);
  assert.deepEqual(chunks, ['甲', '乙']);
  const settings = { llmProvider: 'openai', customApiUrl: 'https://example.invalid/v1', customModelName: 'test', customApiKey: '', customModelRequestParams: [] } as PetConfig['settings'];
  let onFirst!: () => void;
  const firstPublished = new Promise<void>((resolve) => { onFirst = resolve; });
  let storyFeed!: ReadableStreamDefaultController<Uint8Array>;
  globalThis.fetch = async () => new Response(new ReadableStream({ start(c) { storyFeed = c; } }), { headers: { 'Content-Type': 'text/event-stream' } });
  const snapshots: string[] = [];
  const story = generateStoryNarration({ historyMessages: [], session: createEmptyStorySessionForSmoke(), settings, userInput: '继续',
    onText(text) { snapshots.push(text); onFirst(); },
  });
  storyFeed.enqueue(encode.encode(event('夜色')));
  await firstPublished;
  assert.deepEqual(snapshots, ['夜色'], 'story must publish before generation completes');
  storyFeed.enqueue(encode.encode(event('渐深。') + 'data: [DONE]\n\n'));
  assert.equal(await story, '夜色渐深。');
  assert.deepEqual(snapshots, ['夜色', '夜色渐深。']);

  let finishWhole!: (response: Response) => void;
  globalThis.fetch = async (_url, init) => {
    assert.equal(JSON.parse(String(init?.body)).stream, false);
    return new Promise<Response>((resolve) => { finishWhole = resolve; });
  };
  const wholeSnapshots: string[] = [];
  const wholeStory = generateStoryNarration({ historyMessages: [], session: createEmptyStorySessionForSmoke(),
    settings: { ...settings, chatStreamingEnabled: false }, userInput: '继续',
    onText(text) { wholeSnapshots.push(text); },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(wholeSnapshots, [], 'disabled streaming must not publish partial story text');
  finishWhole(new Response(JSON.stringify({ choices: [{ message: { content: '完整故事正文。' } }] }), {
    headers: { 'Content-Type': 'application/json' },
  }));
  assert.equal(await wholeStory, '完整故事正文。');
  assert.deepEqual(wholeSnapshots, []);

  const abort = new AbortController();
  globalThis.fetch = async (_url, init) => new Response(new ReadableStream({ start(c) {
    c.enqueue(encode.encode(event('已生成')));
    init?.signal?.addEventListener('abort', () => c.error(new Error('cancelled')), { once: true });
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
  const interrupted = getConfiguredTextResponseStream('测试', '正文', settings, { signal: abort.signal });
  assert.equal((await interrupted.next()).value, '已生成');
  abort.abort();
  await assert.rejects(() => interrupted.next(), /cancelled/);
} finally { globalThis.fetch = originalFetch; }
console.log('chat text stream smoke: PASS (early delivery, split UTF-8/SSE, cleanup, errors, request integration)');
