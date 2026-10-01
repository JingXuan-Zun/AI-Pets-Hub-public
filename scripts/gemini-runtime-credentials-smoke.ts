import assert from 'node:assert/strict';
import { getConfiguredCognitionResponse, getConfiguredTextResponseStream, getPetResponseStrict } from '../src/services/geminiService';
import { summarizeAgentVisualSnapshot } from '../src/services/agentVisualSnapshotService';
import type { PetConfig, PetPersonality } from '../src/types';

const settings = {
  llmProvider: 'gemini', llmModel: 'gemini-test', geminiApiKey: ' runtime-key-a ',
  visionMode: 'inherit-brain', customModelRequestParams: [], webSearchEnabled: false,
  globalKnowledgeBase: '', memoryDepth: 10, timeAwarenessEnabled: false, webLearningEnabled: false,
} as PetConfig['settings'];
const originalFetch = globalThis.fetch;
const originalEnvKey = process.env.GEMINI_API_KEY;
const keys: string[] = [];
const systemInstructions: string[] = [];
try {
  delete process.env.GEMINI_API_KEY;
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    keys.push(request.headers.get('x-goog-api-key') ?? '');
    const body = JSON.parse(await request.text());
    systemInstructions.push(JSON.stringify(body.systemInstruction ?? {}));
    const payload = { candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] }, finishReason: 'STOP' }] };
    return new Response(request.url.includes('streamGenerateContent')
      ? `data: ${JSON.stringify(payload)}\n\n` : JSON.stringify(payload), {
      headers: { 'Content-Type': request.url.includes('streamGenerateContent') ? 'text/event-stream' : 'application/json' },
    });
  };
  const text = await getConfiguredCognitionResponse('test', 'test', settings, { task: 'agent-decision' });
  assert.equal(text, 'ok');
  const changed = { ...settings, geminiApiKey: 'runtime-key-b' };
  const chunks: string[] = [];
  for await (const chunk of getConfiguredTextResponseStream('test', 'test', changed)) chunks.push(chunk);
  assert.equal(chunks.join(''), 'ok');
  assert.equal(await summarizeAgentVisualSnapshot({ settings: changed, imageDataUrl: 'data:image/png;base64,AA==' }), 'ok');
  assert.deepEqual(keys, ['runtime-key-a', 'runtime-key-b', 'runtime-key-b']);
  await assert.rejects(() => getConfiguredCognitionResponse('test', 'test', { ...settings, geminiApiKey: '' }, {
    task: 'agent-decision',
  }), /Gemini API Key/u);
  assert.equal(keys.length, 3, 'Missing credentials must fail before sending a request.');
  const personaMarker = '每次回应称呼用户为星灯，使用简短自然的句子。';
  const personality: PetPersonality = {
    name: '回归角色', traits: [], greeting: '', systemInstruction: personaMarker,
    beginDialogs: [], chatAvatarUrl: '', customErrorMessage: '',
    userMemory: '', chatHistoryMemory: '', knowledgeBase: '',
  };
  assert.equal(await getPetResponseStrict([], '你好', personality, { ...changed, geminiApiKey: 'runtime-key-c' }), 'ok');
  assert.equal(keys[3], 'runtime-key-c');
  assert.ok(systemInstructions[3].includes(personaMarker), 'Normal chat must retain the user persona instruction.');
} finally {
  globalThis.fetch = originalFetch;
  if (originalEnvKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalEnvKey;
}
console.log('gemini runtime credentials smoke passed');
