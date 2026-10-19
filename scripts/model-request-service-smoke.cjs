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
  // Gemini relay endpoint: the saved key only goes to the saved endpoint; a trailing /v1beta becomes apiVersion.
  let geminiOptions;
  const relayed = createModelRequestService({
    persistedConfigStore: { load: () => ({ ok: true, config: { settings: { geminiApiKey: 'gemini-secret', geminiApiUrl: 'https://relay.example/gemini/v1beta/' } } }) },
    createGeminiClient: (key, httpOptions) => {
      geminiOptions = httpOptions;
      return { models: { generateContent: async () => ({ text: 'relay reply' }) } };
    },
  });
  await relayed.open(1, { ...gemini, id: 'relay-1', endpoint: 'https://relay.example/gemini/v1beta' });
  assert.deepEqual(geminiOptions, { apiVersion: 'v1beta', baseUrl: 'https://relay.example/gemini' });
  await assert.rejects(relayed.open(1, { ...gemini, id: 'relay-2', endpoint: 'https://attacker.example' }));
  await assert.rejects(relayed.open(1, { ...gemini, id: 'relay-3' }));
  geminiOptions = 'unset';
  await service.open(1, { ...gemini, id: 'official-1' });
  assert.equal(geminiOptions, 'unset');
  // Function calls (with Gemini's thought signature) reach the renderer, not just the text.
  const calling = createModelRequestService({
    persistedConfigStore: { load: () => ({ ok: true, config: { settings: { geminiApiKey: 'gemini-secret' } } }) },
    createGeminiClient: () => ({ models: { generateContentStream: async () => (async function* () {
      yield { candidates: [{ content: { parts: [{ text: '我看看' }, { functionCall: { args: { city: '杭州' }, name: 'get_weather' }, thoughtSignature: 'sig' }] } }] };
    })() } }),
  });
  await calling.open(1, { ...gemini, id: 'calls-1', stream: true });
  assert.deepEqual(JSON.parse(new TextDecoder().decode((await calling.read(1, 'calls-1')).value)), {
    functionCalls: [{ args: { city: '杭州' }, name: 'get_weather', thoughtSignature: 'sig' }],
    text: '我看看',
  });
  const failing = createModelRequestService({ persistedConfigStore: {}, fetchImpl: async () => { throw new Error('raw-secret'); } });
  await assert.rejects(failing.open(1, { ...request, credential: 'raw-secret' }), (error) => !error.message.includes('raw-secret'));
  console.log('model request service smoke ok');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
