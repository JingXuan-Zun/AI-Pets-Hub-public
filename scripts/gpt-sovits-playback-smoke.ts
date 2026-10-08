import assert from 'node:assert/strict';

// Fake desktop shell + sidecar so the renderer flow runs in Node (no Audio element: playback stays lazy).
const shellCalls: string[] = [];
let startResult: unknown = { available: true, status: 'ready', modelId: 'voice', models: [] };
(globalThis as unknown as { window: unknown }).window = {
  desktopPetShell: {
    desktopMode: true,
    pushRuntimeLog: () => undefined,
    startGptSovitsService: async () => {
      shellCalls.push('start');
      return startResult;
    },
  },
};

type FetchCall = { url: string; body: Record<string, unknown> | null };
const fetchCalls: FetchCall[] = [];
let ttsResponder: () => Response = () => new Response(new Uint8Array([82, 73, 70, 70]), { status: 200 });
globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
  const url = String(input);
  fetchCalls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
  if (init?.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
  if (url.endsWith('/tts')) return ttsResponder();
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}) as typeof fetch;

const playback = await import('../src/voice/ttsGptSovitsPlayback');
const runtime = await import('../src/voice/gptSovitsRuntime');
const { resolveTtsProvider } = await import('../src/voice/ttsRequest');

const settings = {
  ttsProvider: 'gpt-sovits', gptSovitsModelId: 'voice', gptSovitsDevice: 'auto', gptSovitsApiUrl: '', speechPlaybackRate: 1,
} as unknown as import('../src/voice/types').VoiceSettings;
let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases++; };

// URL guard: only loopback http, path stripped.
for (const [input, expected] of [
  ['', 'http://127.0.0.1:9881'], ['http://127.0.0.1:9900/x?y', 'http://127.0.0.1:9900'], ['http://localhost:9881', 'http://localhost:9881'],
  ['http://10.0.0.2:9881', 'http://127.0.0.1:9881'], ['https://127.0.0.1:9881', 'http://127.0.0.1:9881'], ['garbage', 'http://127.0.0.1:9881'],
]) check(playback.resolveGptSovitsBaseUrl(input), expected, `url ${input}`);

check(resolveTtsProvider(settings), 'gpt-sovits', 'provider routed');
check(resolveTtsProvider({ ...settings, ttsProvider: 'bogus' as never }), 'browser', 'unknown provider falls back');

// Health normalization: unknown status → error; available requires ready.
check(runtime.normalizeGptSovitsHealth({ status: 'weird', available: true }).status, 'error', 'unknown status');
check(runtime.normalizeGptSovitsHealth({ status: 'stopped', available: true }).available, false, 'available needs ready');
check(runtime.normalizeGptSovitsHealth({ status: 'ready', available: true, device: 'gpu', models: [{ id: 'a', ready: true }, { name: 'no id' }] }).models.length, 1, 'models filtered');

// First prepare starts the sidecar once; later prepares reuse the ready state.
await playback.prepareGptSovitsVoicePlayback('你好呀。', settings, 'happy');
await playback.prepareGptSovitsVoicePlayback('再说一句。', settings);
check(shellCalls, ['start'], 'start cached');
check(fetchCalls.map((call) => [call.url, call.body]), [
  ['http://127.0.0.1:9881/tts', { text: '你好呀。', model_id: 'voice', emotion: 'happy' }],
  ['http://127.0.0.1:9881/tts', { text: '再说一句。', model_id: 'voice', emotion: 'neutral' }],
], 'tts requests');

// Server error codes map to fixed user-facing text; cancellation maps to the shared cancel marker.
ttsResponder = () => new Response(JSON.stringify({ error: 'model_not_found' }), { status: 400 });
await assert.rejects(playback.prepareGptSovitsVoicePlayback('a', settings), /所选角色音色模型不存在/u); cases++;
ttsResponder = () => new Response(JSON.stringify({ error: 'C:\\secret\\trace' }), { status: 500 });
await assert.rejects(playback.prepareGptSovitsVoicePlayback('a', settings), /角色音色生成失败/u); cases++;
ttsResponder = () => new Response(JSON.stringify({ error: 'cancelled' }), { status: 409 });
await assert.rejects(playback.prepareGptSovitsVoicePlayback('a', settings), /local_voice_cancelled/u); cases++;

// A single connection loss restarts the sidecar and retries once within the same call.
let failuresLeft = 1;
ttsResponder = () => {
  if (failuresLeft-- > 0) throw new TypeError('Failed to fetch');
  return new Response(new Uint8Array([1]), { status: 200 });
};
await playback.prepareGptSovitsVoicePlayback('a', settings);
check(shellCalls, ['start', 'start'], 'restart and retry after connection loss');
// A sidecar that stays down surfaces the user-facing message after the one retry.
ttsResponder = () => { throw new TypeError('Failed to fetch'); };
await assert.rejects(playback.prepareGptSovitsVoicePlayback('a', settings), /本地服务未启动或已退出/u); cases++;
check(shellCalls, ['start', 'start', 'start'], 'only one retry');
ttsResponder = () => new Response(new Uint8Array([1]), { status: 200 });

// A failed start surfaces the shell's user-facing reason and is not cached.
startResult = { available: false, status: 'no-gpu', error: '未检测到可用的 NVIDIA 显卡' };
await assert.rejects(playback.warmupGptSovitsVoice({ ...settings, gptSovitsDevice: 'cuda' }), /NVIDIA/u); cases++;
startResult = { available: true, status: 'ready', modelId: 'voice' };
fetchCalls.length = 0;
await playback.warmupGptSovitsVoice({ ...settings, gptSovitsDevice: 'cuda' });
check(fetchCalls.map((call) => [call.url, call.body]), [['http://127.0.0.1:9881/warmup', { model_id: 'voice' }]], 'warmup request');

// Stop only pings /cancel when something is in flight.
fetchCalls.length = 0;
playback.stopGptSovitsVoicePlayback();
check(fetchCalls.length, 0, 'idle stop is silent');
let release: () => void = () => undefined;
ttsResponder = () => { throw new Error('unreachable'); };
globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
  fetchCalls.push({ url: String(input), body: null });
  if (String(input).endsWith('/tts')) {
    await new Promise<void>((resolve) => { release = resolve; init?.signal?.addEventListener('abort', () => resolve()); });
    throw Object.assign(new Error('aborted'), { name: 'AbortError' });
  }
  return new Response('{}', { status: 200 });
}) as typeof fetch;
const pending = playback.prepareGptSovitsVoicePlayback('长句子', settings);
await new Promise((resolve) => setTimeout(resolve, 10));
playback.stopGptSovitsVoicePlayback();
await assert.rejects(pending, /local_voice_cancelled/u); cases++;
release();
check(fetchCalls.map((call) => call.url), ['http://127.0.0.1:9881/tts', 'http://127.0.0.1:9881/cancel'], 'stop aborts and cancels');

console.log(`GPT-SoVITS playback passed: ${cases} cases`);
