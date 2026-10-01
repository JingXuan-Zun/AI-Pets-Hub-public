import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { requestModelFetch } from '../src/services/modelTransport';
import { getGeminiClient } from '../src/services/geminiClient';
import { readOpenAITextStream } from '../src/services/openAITextStream';
const require = createRequire(import.meta.url);
const { createModelRequestService } = require('../electron/modelRequestService.cjs');
const previousWindow = globalThis.window;
const previousFetch = globalThis.fetch;
const config = { settings: { customApiKey: 'main-only-key', customApiUrl: 'https://model.example/v1', geminiApiKey: 'gemini-main-key' } };
const service = createModelRequestService({
  persistedConfigStore: { load: () => ({ ok: true, config }) },
  fetchImpl: async (_url: string, options: RequestInit) => {
    assert.equal(new Headers(options.headers).get('authorization'), 'Bearer main-only-key');
    if (options.method === 'GET') return Response.json({ data: [{ id: 'test-model' }] });
    const body = JSON.parse(String(options.body));
    if (!body.stream) return Response.json({ choices: [{ message: { content: 'hello' } }] });
    const bytes = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"你好"}}]}\n\ndata: [DONE]\n\n');
    return new Response(new ReadableStream({ start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    } }), { headers: { 'content-type': 'text/event-stream' } });
  },
  createGeminiClient: (key: string) => {
    assert.equal(key, 'gemini-main-key');
    return { models: { generateContent: async () => ({ text: 'gemini' }),
      generateContentStream: async () => (async function* () { yield { text: 'a' }; yield { text: 'b' }; })() } };
  },
});
try {
  globalThis.fetch = async () => { throw new Error('renderer must not fetch'); };
  globalThis.window = { desktopPetShell: { desktopMode: true,
    openModelRequest: (request: unknown) => service.open(1, request),
    readModelRequest: (id: string) => service.read(1, id),
    cancelModelRequest: async (id: string) => service.cancel(1, id),
  } } as unknown as Window & typeof globalThis;
  const key = 'desktop-pet-credential:customApiKey';
  const response = await requestModelFetch('https://model.example/v1/chat/completions', {
    method: 'POST', body: JSON.stringify({ stream: false }),
  }, key);
  assert.equal((await response.json()).choices[0].message.content, 'hello');
  const stream = await requestModelFetch('https://model.example/v1/chat/completions', {
    method: 'POST', headers: { Accept: 'text/event-stream' }, body: JSON.stringify({ stream: true }),
  }, key);
  let text = '';
  for await (const chunk of readOpenAITextStream(stream)) text += chunk;
  assert.equal(text, '你好');
  const models = await requestModelFetch('https://model.example/v1/models', { method: 'GET' }, key);
  assert.equal((await models.json()).data[0].id, 'test-model');
  const client = await getGeminiClient('desktop-pet-credential:geminiApiKey');
  assert.equal((await client.models.generateContent({ model: 'test', contents: [] })).text, 'gemini');
  let geminiText = '';
  for await (const chunk of await client.models.generateContentStream({ model: 'test', contents: [] })) geminiText += chunk.text;
  assert.equal(geminiText, 'ab');
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(requestModelFetch('https://model.example/v1/chat/completions', {
    method: 'POST', body: '{}', signal: controller.signal,
  }, key), { name: 'AbortError' });
  console.log('desktop model transport smoke ok');
} finally {
  service.cancelOwner(1);
  globalThis.window = previousWindow;
  globalThis.fetch = previousFetch;
}
