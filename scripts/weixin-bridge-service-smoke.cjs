// WeChat (official ClawBot / iLink) bridge against a fake server: QR login with a verify code,
// receiving text, voice-as-text and an encrypted image, ignoring other users, replying with the
// latest context token, keeping the cursor across restarts, and reporting an expired login.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createWeixinBridgeService } = require('../electron/weixinBridgeService.cjs');
const { makeVoiceVideo } = require('../electron/weixinVoiceVideo.cjs');

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'weixin-bridge-'));
const safeStorage = {
  decryptString: (buffer) => buffer.toString('utf8').replace(/^enc:/u, ''),
  encryptString: (text) => Buffer.from(`enc:${text}`, 'utf8'),
  getSelectedStorageBackend: () => 'dpapi',
  isEncryptionAvailable: () => true,
};
const imageKey = crypto.randomBytes(16);
const plainImage = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
const cipher = crypto.createCipheriv('aes-128-ecb', imageKey, null);
const encryptedImage = Buffer.concat([cipher.update(plainImage), cipher.final()]);

const qrStatuses = ['wait', 'scaned', 'need_verifycode', 'scaned', 'confirmed'];
const updates = [];
const sent = [];
const uploads = [];
const seenRequests = [];
const json = (value) => ({ arrayBuffer: async () => new ArrayBuffer(0), ok: true, status: 200, text: async () => JSON.stringify(value) });
const fetchImpl = async (url, init = {}) => {
  const { pathname, searchParams } = new URL(url);
  seenRequests.push({ body: typeof init.body === 'string' ? JSON.parse(init.body) : null, headers: init.headers ?? {}, path: pathname, query: Object.fromEntries(searchParams) });
  if (pathname.endsWith('/get_bot_qrcode')) return json({ qrcode: 'qr-1', qrcode_img_content: 'https://liteapp.weixin.qq.com/q/abc' });
  if (pathname.endsWith('/get_qrcode_status')) {
    const next = qrStatuses.shift();
    return json(next === 'confirmed'
      ? { baseurl: 'https://ilinkai.weixin.qq.com', bot_token: 'token-1', ilink_bot_id: 'bot@im.bot', ilink_user_id: 'me@im.wechat', status: 'confirmed' }
      : { status: next });
  }
  if (pathname.endsWith('/getupdates')) {
    const batch = updates.shift();
    if (!batch) { await new Promise((resolve) => setTimeout(resolve, 30)); return json({ ret: 0, msgs: [], get_updates_buf: 'cursor-2' }); }
    return json(batch);
  }
  if (pathname.endsWith('/sendmessage')) { sent.push(JSON.parse(init.body).msg); return json({ ret: 0 }); }
  if (pathname.endsWith('/getuploadurl')) return json({ upload_param: 'up-param' });
  if (pathname.endsWith('/c2c/upload')) {
    uploads.push({ bytes: init.body.length, filekey: searchParams.get('filekey') });
    return { headers: { get: (name) => (name === 'x-encrypted-param' ? 'down-param' : null) }, ok: true, status: 200, text: async () => '' };
  }
  if (url.startsWith('https://novac2c.cdn.weixin.qq.com/')) {
    return { arrayBuffer: async () => encryptedImage.buffer.slice(encryptedImage.byteOffset, encryptedImage.byteOffset + encryptedImage.byteLength), ok: true, status: 200 };
  }
  throw new Error(`unexpected ${url}`);
};
const events = [];
const madeVideos = [];
const makeVideo = async (wav, image) => { madeVideos.push({ image: image?.length ?? 0, wav: wav.length }); return Buffer.from('fake-mp4'); };
const until = async (check, label) => {
  for (let wait = 0; wait < 200; wait += 1) { if (check()) return; await new Promise((resolve) => setTimeout(resolve, 15)); }
  throw new Error(`timed out waiting for ${label}`);
};

(async () => {
  const service = createWeixinBridgeService({ emit: (channel, payload) => events.push([channel, payload]), fetchImpl, makeVideo, safeStorage, userDataPath: base });
  assert.deepEqual(service.start(), { error: '还没扫码登录。', ok: false });

  // QR login with a verify code.
  assert.equal((await service.startLogin()).qrContent, 'https://liteapp.weixin.qq.com/q/abc');
  await until(() => service.getStatus().state === 'need-verify', 'verify prompt');
  assert.equal(service.submitVerifyCode('abc').ok, false, 'only digits');
  assert.equal(service.submitVerifyCode('2468').ok, true);
  updates.push({ get_updates_buf: 'cursor-1', msgs: [
    { context_token: 'ctx-1', from_user_id: 'me@im.wechat', item_list: [{ text_item: { text: '你好呀' }, type: 1 }], message_type: 1 },
    { context_token: 'ctx-x', from_user_id: 'stranger@im.wechat', item_list: [{ text_item: { text: '陌生人' }, type: 1 }], message_type: 1 },
    { context_token: 'ctx-2', from_user_id: 'me@im.wechat', item_list: [{ type: 3, voice_item: { text: '这是语音转的字' } }, { image_item: { aeskey: imageKey.toString('hex'), media: { encrypt_query_param: 'p' } }, type: 2 }], message_type: 1 },
    { from_user_id: 'bot@im.bot', item_list: [{ text_item: { text: '机器人自己发的' }, type: 1 }], message_type: 2 },
  ] });
  await until(() => events.filter(([channel]) => channel === 'desktop-pet:weixin-message').length === 2, 'messages');
  assert.equal(seenRequests.find((request) => request.query.verify_code)?.query.verify_code, '2468', 'the verify code is sent with the next poll');
  const saved = JSON.parse(fs.readFileSync(path.join(base, 'weixin-bridge.json'), 'utf8'));
  assert.ok(saved.tokenCipher && !JSON.stringify(saved).includes('token-1'), 'the token is stored encrypted');

  const messages = events.filter(([channel]) => channel === 'desktop-pet:weixin-message').map(([, payload]) => payload);
  assert.deepEqual(messages[0], { images: [], text: '你好呀', voice: false });
  assert.equal(messages[1].text, '这是语音转的字');
  assert.equal(messages[1].voice, true);
  assert.equal(messages[1].images[0], `data:image/png;base64,${plainImage.toString('base64')}`, 'the image is decrypted');

  // Replies go to the user who scanned, with the latest context token.
  assert.equal((await service.send('收到啦')).ok, true);
  assert.deepEqual([sent[0].to_user_id, sent[0].context_token, sent[0].item_list[0].text_item.text, sent[0].message_type], ['me@im.wechat', 'ctx-2', '收到啦', 2]);
  const post = seenRequests.find((request) => request.path.endsWith('/sendmessage'));
  assert.equal(post.headers.Authorization, 'Bearer token-1');
  assert.equal(post.headers['iLink-App-Id'], 'bot');

  // Her voice goes as a short video (bots can't send voice bubbles); a sticker as an image item.
  // The video maker runs the real bundled ffmpeg on half a second of audio.
  const sampleRate = 24000;
  const pcm = Buffer.alloc(sampleRate);
  for (let i = 0; i < sampleRate / 2; i += 1) pcm.writeInt16LE(Math.round(Math.sin(i / 8) * 6000), i * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8); header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  const wav = Buffer.concat([header, pcm]);
  const mp4 = await makeVoiceVideo(wav, null);
  assert.equal(mp4.subarray(4, 8).toString('ascii'), 'ftyp', 'an MP4 comes out');
  const voiceResult = await service.sendVoice(wav.toString('base64'), plainImage.toString('base64'));
  assert.equal(voiceResult.ok, true, voiceResult.error);
  assert.deepEqual(madeVideos.at(-1), { image: plainImage.length, wav: wav.length }, 'the audio and the picture reach the video maker');
  const videoItem = sent.at(-1).item_list[0];
  assert.equal(videoItem.type, 5);
  assert.deepEqual([videoItem.video_item.media.encrypt_query_param, videoItem.video_item.media.encrypt_type, videoItem.video_item.video_size], ['down-param', 1, 16]);
  assert.equal(Buffer.from(videoItem.video_item.media.aes_key, 'base64').toString('ascii').length, 32, 'the key is sent as base64 of its hex text');
  const imageResult = await service.sendImage(plainImage.toString('base64'));
  assert.equal(imageResult.ok, true, imageResult.error);
  assert.equal(sent.at(-1).item_list[0].type, 2);
  assert.equal(sent.at(-1).item_list[0].image_item.mid_size, 16, 'cipher size of an 8-byte image');
  assert.equal(uploads.length, 2);
  assert.equal(seenRequests.filter((request) => request.path.endsWith('/getuploadurl')).map((request) => request.body.media_type).join(','), '2,1');

  // A restart reuses the login and the cursor.
  service.stop();
  await new Promise((resolve) => setTimeout(resolve, 50));
  await until(() => JSON.parse(fs.readFileSync(path.join(base, 'weixin-bridge.json'), 'utf8')).syncBuf === 'cursor-2', 'cursor saved');
  const again = createWeixinBridgeService({ emit: (channel, payload) => events.push([channel, payload]), fetchImpl, safeStorage, userDataPath: base });
  assert.equal(again.start().ok, true, 'no new scan needed');
  await until(() => seenRequests.filter((request) => request.path.endsWith('/getupdates')).some((request) => request.body?.get_updates_buf === 'cursor-2'), 'resumed cursor');

  // An expired login is reported so the page can ask for a new scan.
  updates.push({ errcode: -14, errmsg: 'session timeout', ret: -14 });
  await until(() => again.getStatus().state === 'expired', 'expired state');
  again.logout();
  assert.equal(fs.existsSync(path.join(base, 'weixin-bridge.json')), false, 'logout forgets the login');

  fs.rmSync(base, { force: true, recursive: true });
  console.log('weixin bridge service smoke passed');
  process.exit(0);
})().catch((error) => { console.error(error); process.exit(1); });
