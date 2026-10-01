const assert = require('node:assert/strict');
const { createModelRequestService } = require('../electron/modelRequestService.cjs');
async function main() {
  let received;
  let aborted = false;
  let readerCancelled = false;
  const service = createModelRequestService({
    persistedConfigStore: { load: () => ({ ok: true, config: { settings: {
      customApiKey: 'saved-secret', customApiUrl: 'https://model.example', geminiApiKey: 'gemini-secret',
    } } }) },
    fetchImpl: async (url, options) => {
      received = { url, options };
      options.signal.addEventListener('abort', () => { aborted = true; });
      return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('data: hello\n\n')); },
        cancel() { readerCancelled = true; } }), { headers: { 'content-type': 'text/event-stream' } });
    },
    createGeminiClient: (key) => {
      assert.equal(key, 'gemini-secret');
      return { models: { generateContent: async () => ({ text: 'Gemini reply' }),
        generateContentStream: async () => (async function* () { yield { text: 'one' }; yield { text: 'two' }; })() } };
    },
  });
  const request = { id: 'test-1', provider: 'openai', credentialField: 'customApiKey',
    credential: 'desktop-pet-credential:customApiKey', endpoint: 'https://model.example/v1/chat/completions', body: { messages: [] }, stream: true };
  assert.equal((await service.open(1, request)).status, 200);
  assert.equal(received.options.headers.Authorization, 'Bearer saved-secret');
  assert.equal(received.options.redirect, 'error');
  await assert.rejects(service.read(2, request.id));
  service.cancel(2, request.id);
  assert.equal(new TextDecoder().decode((await service.read(1, request.id)).value), 'data: hello\n\n');
  service.cancel(1, request.id);
  assert.equal(aborted, true);
  assert.equal(readerCancelled, true);
  await assert.rejects(service.read(1, request.id));
  await assert.rejects(service.open(1, { ...request, endpoint: 'https://attacker.example' }));
  await assert.rejects(service.open(1, { ...request, credentialField: 'tavilyApiKey' }));
  await service.open(1, { ...request, operation: 'models', endpoint: 'https://model.example/v1/models' });
  assert.equal(received.options.method, 'GET');
  assert.equal(received.options.body, undefined);
  service.cancel(1, request.id);
  const gemini = { id: 'gemini-1', provider: 'gemini', credentialField: 'geminiApiKey',
    credential: 'desktop-pet-credential:geminiApiKey', args: { model: 'test', contents: [] } };
  await service.open(1, gemini);
  assert.deepEqual(JSON.parse(new TextDecoder().decode((await service.read(1, gemini.id)).value)), { text: 'Gemini reply' });
  assert.equal((await service.read(1, gemini.id)).done, true);
  await service.open(1, { ...gemini, stream: true });
  for (const text of ['one', 'two']) assert.equal(JSON.parse(new TextDecoder().decode((await service.read(1, gemini.id)).value)).text, text);
  assert.equal((await service.read(1, gemini.id)).done, true);
  await assert.rejects(service.open(1, { ...gemini, args: { ...gemini.args, config: { httpOptions: { baseUrl: 'https://attacker.example' } } } }));
  const failing = createModelRequestService({ persistedConfigStore: {}, fetchImpl: async () => { throw new Error('raw-secret'); } });
  await assert.rejects(failing.open(1, { ...request, credential: 'raw-secret' }), (error) => !error.message.includes('raw-secret'));
  console.log('model request service smoke ok');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
