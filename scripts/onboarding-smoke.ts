// First-run guide (docs/starter/xiaoling-onboarding-script.md): key handling, setup detection,
// key-check results, and that every line has its recorded clip.
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import {
  DEEPSEEK_API_URL,
  DEEPSEEK_MODEL,
  checkDeepSeekKey,
  classifyApiKeyResponse,
  findApiKeyInText,
  isChatModelConfigured,
  maskApiKeyInText,
  withDeepSeekSettings,
} from '../src/onboarding/onboardingApiSetup';
import { ONBOARDING_LINES, ONBOARDING_REPLIES, WELCOME_QUICK_REPLIES } from '../src/onboarding/onboardingLines';

let checks = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); checks += 1; };

// Keys pasted into the chat.
const key = 'sk-0123456789abcdef0123456789abcdef';
check(findApiKeyInText(`这是我的 key：${key} 谢谢`), key, 'a pasted key is found');
check(findApiKeyInText('我还没有 key'), null, 'no key, no match');
check(findApiKeyInText('sk-short'), null, 'too short to be a key');
check(maskApiKeyInText(`key ${key}`), 'key sk-…cdef', 'the history only keeps the last four characters');

// Is a chat model set up?
const blank = { customApiKey: '', customApiUrl: '', customModelName: '', geminiApiKey: '', llmProvider: 'openai' } as never;
check(isChatModelConfigured(blank), false, 'fresh install: not set up');
const deepseek = withDeepSeekSettings(blank, `  ${key} `);
check([deepseek.llmProvider, deepseek.customApiUrl, deepseek.customModelName, deepseek.customApiKey], ['openai', DEEPSEEK_API_URL, DEEPSEEK_MODEL, key], 'DeepSeek filled in like an existing setup');
check(isChatModelConfigured(deepseek), true, 'after the guide: set up');
check(isChatModelConfigured({ ...(blank as object), llmProvider: 'gemini', geminiApiKey: 'x' } as never), true, 'a Gemini setup counts too');

// What the key check reports.
check([200, 401, 402, 500].map(classifyApiKeyResponse), ['ok', 'invalid', 'no-balance', 'other'], 'status codes');
const run = async () => {
  check(await checkDeepSeekKey(key, async () => new Response('{}', { status: 402 })), 'no-balance', 'no balance');
  check(await checkDeepSeekKey(key, async () => { throw new Error('offline'); }), 'network', 'offline');
  let sent: { url: string; body: Record<string, unknown>; credential: string } | null = null;
  await checkDeepSeekKey(` ${key} `, async (url, init, credential) => {
    sent = { body: JSON.parse(String(init.body)), credential, url };
    return new Response('{}', { status: 200 });
  });
  check([sent!.url, sent!.body.model, sent!.body.max_tokens, sent!.credential], [`${DEEPSEEK_API_URL}/chat/completions`, DEEPSEEK_MODEL, 1, key], 'one tiny request with the trimmed key');

  // Every line has its clip; buttons send phrases the guide recognises.
  for (const id of Object.keys(ONBOARDING_LINES)) {
    assert.ok(fs.existsSync(`public/starter/voice/${id}.ogg`), `clip for ${id}`); checks += 1;
  }
  const phrases = new Set<string>(Object.values(ONBOARDING_REPLIES));
  const sends = [...Object.values(ONBOARDING_LINES).flatMap((line) => line.quickReplies ?? []), ...WELCOME_QUICK_REPLIES].filter((reply) => reply.kind === 'send');
  check(sends.every((reply) => phrases.has(reply.value)), true, 'every send button maps to a known phrase');
  console.log(`onboarding smoke ok: ${checks} checks`);
};
void run();
