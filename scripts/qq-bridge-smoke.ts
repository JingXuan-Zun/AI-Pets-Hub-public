import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  buildOneBotUrl,
  createOneBotClient,
  extractOneBotText,
  findOneBotImages,
  parseOneBotPrivateMessage,
  splitOneBotText,
} from '../src/qq-bridge/oneBotClient';
import { collectQqRelayOutgoing, createQqRelayState, formatQqApprovalQuestion } from '../src/qq-bridge/qqBridgeRelay';
import { asksForVoiceReply, normalizeQqBridgeSettings, resolveQqBridgeBlocker, wantsVoiceReply } from '../src/qq-bridge/qqBridgeSettings';
import { limitVoiceText } from '../src/qq-bridge/useQqBridge';
import { readFileSync } from 'node:fs';
import type { ChatMessage } from '../src/types';

const require = createRequire(import.meta.url);

// Settings: off by default, needs the owner's number, keeps a ws:// address.
assert.deepEqual(normalizeQqBridgeSettings(undefined), { autoStartSnowLuma: true, enabled: false, ownerQq: '', snowLumaDir: '', voiceReplyMode: 'mirror', wsUrl: 'ws://127.0.0.1:3001' });
assert.equal(normalizeQqBridgeSettings({ ownerQq: ' 123-456 ' }).ownerQq, '123456');
assert.equal(normalizeQqBridgeSettings({ wsUrl: 'http://x' }).wsUrl, 'ws://127.0.0.1:3001', 'only ws:// or wss:// addresses');
assert.equal(resolveQqBridgeBlocker(normalizeQqBridgeSettings({ enabled: true })), '还没填你的 QQ 号');
assert.equal(resolveQqBridgeBlocker(normalizeQqBridgeSettings({ enabled: true, ownerQq: '10001' })), null);

// OneBot messages: text out of CQ codes and segment arrays; only private messages.
assert.equal(buildOneBotUrl('ws://127.0.0.1:3001', 'a b'), 'ws://127.0.0.1:3001?access_token=a%20b');
assert.equal(buildOneBotUrl('ws://127.0.0.1:3001', ''), 'ws://127.0.0.1:3001');
assert.equal(extractOneBotText('你好[CQ:face,id=14]呀'), '你好呀');
assert.equal(extractOneBotText([{ data: { text: '在吗' }, type: 'text' }, { data: { file: 'x' }, type: 'image' }]), '在吗');
assert.deepEqual(
  parseOneBotPrivateMessage({ message: '晚上好', message_id: 7, message_type: 'private', post_type: 'message', user_id: 10001 }),
  { images: [], messageId: '7', text: '晚上好', userId: '10001', voiceFile: null },
);
assert.equal(parseOneBotPrivateMessage({ message: 'hi', message_type: 'group', post_type: 'message', user_id: 1 }), null, 'group messages are not for the bridge');
assert.equal(parseOneBotPrivateMessage({ meta_event_type: 'heartbeat', post_type: 'meta_event' }), null);
const long = `${'甲'.repeat(1000)}\n${'乙'.repeat(1000)}`;
assert.deepEqual(splitOneBotText(long).map((piece) => piece.length), [1000, 1000], 'long replies split at a line break');

// Voice messages: a record segment (alone) is a message too, carrying its file id.
assert.deepEqual(
  parseOneBotPrivateMessage({ message: [{ data: { file: 'abc.amr' }, type: 'record' }], message_id: 8, message_type: 'private', post_type: 'message', user_id: 10001 }),
  { images: [], messageId: '8', text: '', userId: '10001', voiceFile: 'abc.amr' },
);
assert.equal(parseOneBotPrivateMessage({ message: '[CQ:record,file=x.silk,url=y]', message_type: 'private', post_type: 'message', user_id: 1 })?.voiceFile, 'x.silk');

// Pictures: segments or CQ codes, with Tencent's address or just a file id.
assert.deepEqual(
  parseOneBotPrivateMessage({ message: [{ data: { file: 'a.jpg', url: 'https://multimedia.nt.qq.com.cn/x' }, type: 'image' }], message_id: 9, message_type: 'private', post_type: 'message', user_id: 10001 })?.images,
  [{ file: 'a.jpg', url: 'https://multimedia.nt.qq.com.cn/x' }],
  'a picture alone is a message too',
);
assert.deepEqual(findOneBotImages('看[CQ:image,file=b.png,url=https://gchat.qpic.cn/a&#44;b]'), [{ file: 'b.png', url: 'https://gchat.qpic.cn/a,b' }]);

// Downloading them: only Tencent image hosts, only images, size-capped.
const { fetchQqImage } = require('../electron/snowLumaService.cjs') as {
  fetchQqImage: (url: string, fetchImpl?: unknown) => Promise<{ dataUrl?: string; error?: string; ok: boolean }>;
};
const fakeFetch = (type: string) => async () => ({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer, headers: { get: () => type }, ok: true, status: 200 });
assert.equal((await fetchQqImage('https://multimedia.nt.qq.com.cn/download?x=1', fakeFetch('image/jpeg'))).dataUrl, 'data:image/jpeg;base64,AQID');
assert.match((await fetchQqImage('https://evil.example.com/a.jpg', fakeFetch('image/jpeg'))).error ?? '', /不是 QQ/u, 'other hosts are refused');
assert.match((await fetchQqImage('https://qq.com.cn.evil.com/a', fakeFetch('image/jpeg'))).error ?? '', /不是 QQ/u, 'look-alike hosts too');
assert.match((await fetchQqImage('file:///C:/secret.png', fakeFetch('image/png'))).error ?? '', /不是 QQ/u);
assert.match((await fetchQqImage('https://gchat.qpic.cn/a', fakeFetch('text/html'))).error ?? '', /不是图片/u);

// When replies also go as voice: mirror what the user sent, or when asked for in text.
for (const text of ['发语音给我', '用语音回我', '想听你的声音', '说给我听嘛', '给我发个语音']) assert.equal(asksForVoiceReply(text), true, text);
for (const text of ['今天吃什么', '声音好听吗？', '语音识别准吗']) assert.equal(asksForVoiceReply(text), false, text);
assert.equal(wantsVoiceReply('mirror', true, '吃了吗'), true, 'voice in, voice out');
assert.equal(wantsVoiceReply('mirror', false, '吃了吗'), false, 'text in, text out');
assert.equal(wantsVoiceReply('mirror', false, '发语音给我'), true, 'asked for voice');
assert.equal(wantsVoiceReply('off', true, '发语音给我'), false);
assert.equal(wantsVoiceReply('always', false, '吃了吗'), true);
assert.equal(limitVoiceText('短的。'), '短的。');
assert.equal(limitVoiceText(`${'一'.repeat(200)}。${'二'.repeat(200)}`), `${'一'.repeat(200)}。`, 'long replies are voiced up to a sentence end');

// The client: connects with the token, hands over private messages, sends replies.
const sockets: Array<{ sent: string[]; url: string; socket: Record<string, unknown> }> = [];
const received: string[] = [];
const statuses: string[] = [];
const client = createOneBotClient({
  accessToken: 'secret',
  createSocket: (url) => {
    const entry = { sent: [] as string[], socket: {} as Record<string, unknown>, url };
    entry.socket = {
      close: () => { (entry.socket.onclose as ((event: unknown) => void) | null)?.({}); },
      onclose: null, onerror: null, onmessage: null, onopen: null, readyState: 1,
      send: (data: string) => { entry.sent.push(data); },
    };
    sockets.push(entry);
    return entry.socket as never;
  },
  onMessage: (message) => received.push(`${message.userId}:${message.text}`),
  onStatus: (status) => statuses.push(status),
  url: 'ws://127.0.0.1:3001',
});
assert.equal(sockets[0]?.url, 'ws://127.0.0.1:3001?access_token=secret');
(sockets[0]!.socket.onopen as (event: unknown) => void)({});
(sockets[0]!.socket.onmessage as (event: { data: unknown }) => void)({
  data: JSON.stringify({ message: [{ data: { text: '帮我查下天气' }, type: 'text' }], message_type: 'private', post_type: 'message', user_id: 10001 }),
});
assert.deepEqual(received, ['10001:帮我查下天气']);
assert.equal(client.sendPrivateText('10001', '好呀'), true);
assert.deepEqual(JSON.parse(sockets[0]!.sent[0]!).params, { message: '好呀', user_id: 10001 });
assert.equal(JSON.parse(sockets[0]!.sent[0]!).action, 'send_private_msg');
client.stop();
assert.equal(statuses.at(-1), 'disconnected');
assert.equal(sockets.length, 1, 'a deliberate stop does not reconnect');

// A send QQ refuses ("网络连接异常") is retried after a pause; one that keeps failing is reported.
{
  const sent: Array<{ echo: string; message: string }> = [];
  let socket: Record<string, unknown> = {};
  const failures: string[] = [];
  const retrying = createOneBotClient({
    createSocket: () => {
      socket = {
        close: () => undefined, onclose: null, onerror: null, onmessage: null, onopen: null, readyState: 1,
        send: (data: string) => { const parsed = JSON.parse(data); sent.push({ echo: parsed.echo, message: parsed.params.message }); },
      };
      return socket as never;
    },
    onMessage: () => undefined,
    onSendFailed: (text, reason) => failures.push(`${text}:${reason}`),
    sendRetryDelaysMs: [5, 5],
    url: 'ws://127.0.0.1:3001',
  });
  const answer = (index: number, status: string) => (socket.onmessage as (event: { data: string }) => void)({
    data: JSON.stringify({ echo: sent[index]!.echo, retcode: status === 'ok' ? 0 : 1200, status, wording: '网络连接异常!' }),
  });
  retrying.sendPrivateText('10001', '有点贵哦');
  answer(0, 'failed');
  await new Promise((resolve) => { setTimeout(resolve, 20); });
  assert.equal(sent.length, 2, 'retried once after a pause');
  assert.equal(sent[1]!.message, '有点贵哦');
  answer(1, 'ok');
  assert.deepEqual(failures, [], 'delivered on the retry');
  retrying.sendPrivateText('10001', '再试试');
  answer(2, 'failed');
  await new Promise((resolve) => { setTimeout(resolve, 20); });
  answer(3, 'failed');
  await new Promise((resolve) => { setTimeout(resolve, 20); });
  answer(4, 'failed');
  assert.equal(sent.length, 5, 'two retries, then it gives up');
  assert.deepEqual(failures, ['再试试:网络连接异常!'], 'and reports it');
  retrying.stop();
}

// Relay: finished replies and approval questions go to QQ; nothing before the phone message.
const message = (patch: Partial<ChatMessage>): ChatMessage => ({ createdAt: 1000, id: 'm', role: 'model', text: '', ...patch }) as ChatMessage;
const state = createQqRelayState(1000);
const messages = [
  message({ createdAt: 500, id: 'old', text: '之前的话' }),
  message({ id: 'u', role: 'user', text: '帮我查下天气' }),
  message({ id: 'a', text: '**马上查**' }),
];
const texts = (items: Array<{ text: string }>) => items.map((item) => item.text);
assert.deepEqual(collectQqRelayOutgoing(messages, state, true), [], 'the last reply is still being typed');
assert.deepEqual(texts(collectQqRelayOutgoing(messages, state, false)), ['马上查'], 'finished reply, bold markers removed');
assert.deepEqual(collectQqRelayOutgoing(messages, state, false), [], 'each reply is sent once');
messages.push(message({
  agentLoopRun: { pendingApproval: { detail: '', id: 'p1', title: '打开浏览器查天气' } } as ChatMessage['agentLoopRun'],
  id: 'b',
  text: '【任务记录】查天气：等你确认',
}));
assert.deepEqual(
  texts(collectQqRelayOutgoing(messages, state, true)),
  [formatQqApprovalQuestion('打开浏览器查天气')],
  'a task card only sends its question, not the record',
);
messages.push(message({ chatMode: 'group', id: 'g', petName: '星灯', text: '我也来' }));
assert.deepEqual(texts(collectQqRelayOutgoing(messages, state, false)), ['星灯：我也来'], 'group replies carry the speaker');
// Stickers: kaomoji and emoji stay in the text where they were; image stickers are sent after it.
messages.push(message({
  content: [
    { kind: 'text', text: '好吃' },
    { expressionId: 'k', expressionKind: 'kaomoji', kind: 'expression', value: '(๑´ڡ`๑)' },
    { assetId: 'asset-1', expressionId: 'i', expressionKind: 'image', kind: 'expression' },
  ],
  id: 's',
  text: '好吃',
}));
assert.deepEqual(collectQqRelayOutgoing(messages, state, false), [{ petId: null, speechText: '好吃', stickerAssetIds: ['asset-1'], text: '好吃(๑´ڡ`๑)' }], 'the voice says only the words');

// The token is a secret: encrypted on disk and left out of backups.
const { createConfigCredentialCodec } = require('../electron/configCredentials.cjs') as {
  createConfigCredentialCodec: (safeStorage: object) => { encode: (config: object, previous?: object) => { settings: Record<string, unknown> } };
};
const fakeSafeStorage = {
  encryptString: (value: string) => Buffer.from(`enc:${value}`),
  getSelectedStorageBackend: () => 'dpapi',
  isEncryptionAvailable: () => true,
};
const encoded = createConfigCredentialCodec(fakeSafeStorage).encode({ settings: { qqBridgeAccessToken: 'tok' } });
assert.equal((encoded.settings.qqBridgeAccessToken as { protectedCredential: number }).protectedCredential, 1, 'the token is encrypted on disk');
const backupSource = readFileSync(new URL('../src/privateDataBackup.ts', import.meta.url), 'utf8');
const secretList = backupSource.slice(backupSource.indexOf('SECRET_SETTING_KEYS'), backupSource.indexOf('] as const'));
assert.ok(secretList.includes("'qqBridgeAccessToken'"), 'backups leave the token out');

console.log('qq bridge smoke ok');
