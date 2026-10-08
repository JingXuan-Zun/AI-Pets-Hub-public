import assert from 'node:assert/strict';
import { register } from 'node:module';

// constants.ts pulls Vite-only asset globs; the voice layer only needs the Edge-TTS defaults from it.
register(`data:text/javascript,${encodeURIComponent(`
export async function load(url, context, nextLoad) {
  if (/\\/src\\/constants\\.ts$/u.test(url)) {
    return {
      format: 'module',
      shortCircuit: true,
      source: 'export const DEFAULT_BROWSER_TTS_API_URL = "http://127.0.0.1:9880"; export const DEFAULT_BROWSER_TTS_VOICE = "";',
    };
  }
  return nextLoad(url, context);
}`)}`);

// Desktop shell + sidecar fakes so the generic TTS entry point can be exercised in Node.
(globalThis as unknown as { window: unknown }).window = {
  desktopPetShell: {
    desktopMode: true,
    pushRuntimeLog: () => undefined,
    startGptSovitsService: async () => ({ available: true, status: 'ready', modelId: 'voice' }),
  },
};
const ttsBodies: Array<Record<string, unknown>> = [];
globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
  if (String(input).endsWith('/tts')) ttsBodies.push(JSON.parse(String(init?.body)));
  return new Response(new Uint8Array([1]), { status: 200 });
}) as typeof fetch;

const { resolveGptSovitsEmotion } = await import('../src/voice/gptSovitsEmotion');
const { prepareTtsPlayback } = await import('../src/voice/tts');
const { resolveTtsRequest } = await import('../src/voice/ttsRequest');
const {
  extractQueuedReplyStreamingSpeech,
  resolveReplySpeechSegmentationProfile,
} = await import('../src/components/chat/queuedReplyStreamingSpeechUtils');

let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases++; };

for (const [action, emotion] of [
  ['HAPPY', 'happy'], ['EATING', 'happy'], ['SAD', 'sad'], ['SLEEPING', 'sleepy'], [null, 'neutral'], [undefined, 'neutral'], ['WAVE', 'neutral'],
] as const) check(resolveGptSovitsEmotion(action), emotion, `emotion ${action}`);

const settingsValues = {
  ttsProvider: 'gpt-sovits', gptSovitsModelId: 'voice', gptSovitsDevice: 'auto', gptSovitsApiUrl: '',
  voiceEnabled: true, autoSpeakResponses: true, speechPlaybackRate: 1,
  speechSkipBracketContent: true, speechExpressivePunctuationEnabled: false,
};
const settings = settingsValues as never;

// The generic entry point forwards the expression action and never pause-splits GPT-SoVITS text.
await prepareTtsPlayback('别难过了，我一直都在。（摸摸头）', settings, {} as never, { expressionAction: 'SAD' });
await prepareTtsPlayback('今天天气真好，我们出去走走吧。', settings, {} as never);
check(ttsBodies.map((body) => [body.text, body.emotion]), [
  ['别难过了，我一直都在。', 'sad'],
  ['今天天气真好，我们出去走走吧。', 'neutral'],
], 'expression reaches sidecar as one whole sentence');

const paragraphReply = '第一段是一句完整的话。（动作\n描写）\n\n第二段也需要完整读出来。';
check(resolveTtsRequest(paragraphReply, settings)?.preparedText,
  '第一段是一句完整的话。\n第二段也需要完整读出来。', 'GPT-SoVITS preserves paragraphs after filtering stage directions');
check(resolveTtsRequest(paragraphReply, { ...settingsValues, ttsProvider: 'browser' } as never)?.preparedText,
  '第一段是一句完整的话。第二段也需要完整读出来。', 'other providers retain normalized text');

function segment(text: string, settingsOverride: Record<string, unknown>) {
  const profile = resolveReplySpeechSegmentationProfile(settingsOverride as never);
  const segments: string[] = [];
  let buffer = '';
  for (const chunk of Array.from(text)) {
    const extraction = extractQueuedReplyStreamingSpeech(buffer + chunk, segments.length > 0, segments.length, profile);
    buffer = extraction.remaining;
    segments.push(...extraction.segments);
  }
  if (buffer.trim()) segments.push(buffer.trim());
  return segments;
}

const reply = '你回来啦！今天过得怎么样？哇，真的吗？太好了，我们明天就一起去看樱花吧！';
const gptSegments = segment(reply, { ttsProvider: 'gpt-sovits' });
check(gptSegments.every((part) => Array.from(part).length >= 8), true, `gpt-sovits segments are not tiny: ${JSON.stringify(gptSegments)}`);
check(gptSegments.join(''), reply, 'gpt-sovits segments lose no text');
check(Array.from(gptSegments[0]).length <= 31, true, 'first gpt-sovits segment stays short for latency');
const browserSegments = segment(reply, { ttsProvider: 'browser' });
check(browserSegments[0], '你回来啦！', 'browser keeps its fast first segment');
check(resolveReplySpeechSegmentationProfile({ ttsProvider: 'local', localTtsVoiceToneStability: 70 } as never), { voiceToneStability: 70 }, 'local profile unchanged');
check(resolveReplySpeechSegmentationProfile({ ttsProvider: 'api' } as never), {}, 'api profile unchanged');

console.log(`GPT-SoVITS emotion/segmentation passed: ${cases} cases; segments ${JSON.stringify(gptSegments)}`);
