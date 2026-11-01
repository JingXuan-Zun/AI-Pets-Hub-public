const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { makeVoiceVideo } = require('./weixinVoiceVideo.cjs');

// Chatting with the characters from phone WeChat through Tencent's official ClawBot channel
// (iLink bot API, the protocol of the MIT-licensed @tencent-weixin/openclaw-weixin package):
// scan a QR code once with phone WeChat, then long-poll for messages and reply over HTTPS.
// No desktop WeChat, no injection. Only the WeChat user who scanned is answered.

const API_BASE = 'https://ilinkai.weixin.qq.com';
const CDN_BASE = 'https://novac2c.cdn.weixin.qq.com/c2c';
const CHANNEL_VERSION = '2.4.10';
const BOT_AGENT = 'AIPetsHub/1.0';
const BOT_TYPE = '3';
const LONG_POLL_MS = 35_000;
const API_TIMEOUT_MS = 15_000;
const STALE_TOKEN = -14;
const STALE_PAUSE_MS = 10 * 60_000;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_REPLY_CHARS = 2000;
const STATE_FILE = 'weixin-bridge.json';

function clientVersion(version) {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map((part) => Number.parseInt(part, 10) || 0);
  return ((major & 0xff) << 16) | ((minor & 0xff) << 8) | (patch & 0xff);
}

function commonHeaders() {
  return { 'iLink-App-ClientVersion': String(clientVersion(CHANNEL_VERSION)), 'iLink-App-Id': 'bot' };
}

function postHeaders(token) {
  const uin = Buffer.from(String(crypto.randomBytes(4).readUInt32BE(0)), 'utf8').toString('base64');
  return {
    ...commonHeaders(),
    AuthorizationType: 'ilink_bot_token',
    'Content-Type': 'application/json',
    'X-WECHAT-UIN': uin,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** uint64 ids are quoted before JSON.parse so they keep every digit. */
function parseJson(text) {
  return JSON.parse(text.replace(/"(message_id|msg_id|svr_id)"\s*:\s*(-?\d+)/gu, '"$1":"$2"'));
}

function timeoutSignal(ms, external) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const onAbort = () => controller.abort();
  external?.addEventListener('abort', onAbort, { once: true });
  return { cleanup: () => { clearTimeout(timer); external?.removeEventListener('abort', onAbort); }, signal: controller.signal };
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

function decryptAesEcb(data, keyBase64) {
  let key = Buffer.from(keyBase64, 'base64');
  if (key.length === 32 && /^[0-9a-f]{32}$/iu.test(key.toString('ascii'))) key = Buffer.from(key.toString('ascii'), 'hex');
  if (key.length !== 16) throw new Error('bad image key');
  const decipher = crypto.createDecipheriv('aes-128-ecb', key, null);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

function imageMime(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
  if (bytes[0] === 0x52 && bytes[8] === 0x57) return 'image/webp';
  return 'image/jpeg';
}

function createWeixinBridgeService({ userDataPath, safeStorage, log, emit, fetchImpl = globalThis.fetch, makeVideo = makeVoiceVideo }) {
  const statePath = path.join(userDataPath, STATE_FILE);
  let account = null; // { baseUrl, botId, token, userId, syncBuf }
  let status = { detail: '', state: 'logged-out' };
  let monitor = null;
  let login = null;
  let lastContextToken = '';

  const setStatus = (state, detail = '') => {
    status = { account: account ? { botId: account.botId } : null, detail, state };
    emit('desktop-pet:weixin-status-changed', status);
  };

  function canEncrypt() {
    return Boolean(safeStorage?.isEncryptionAvailable?.()) && safeStorage.getSelectedStorageBackend?.() !== 'basic_text';
  }

  function loadAccount() {
    try {
      const saved = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      if (!saved?.tokenCipher || !canEncrypt()) return null;
      const token = safeStorage.decryptString(Buffer.from(saved.tokenCipher, 'base64'));
      return { baseUrl: saved.baseUrl || API_BASE, botId: saved.botId, syncBuf: saved.syncBuf || '', token, userId: saved.userId };
    } catch {
      return null;
    }
  }

  function saveAccount() {
    if (!account || !canEncrypt()) return; // without OS encryption the login lasts until the app quits
    const tokenCipher = safeStorage.encryptString(account.token).toString('base64');
    fs.writeFileSync(statePath, JSON.stringify({ baseUrl: account.baseUrl, botId: account.botId, syncBuf: account.syncBuf, tokenCipher, userId: account.userId }), 'utf8');
  }

  async function apiGet(baseUrl, endpoint, timeoutMs, signal) {
    const { cleanup, signal: combined } = timeoutSignal(timeoutMs, signal);
    try {
      const response = await fetchImpl(new URL(endpoint, `${baseUrl}/`).toString(), { headers: commonHeaders(), signal: combined });
      const text = await response.text();
      if (!response.ok) throw new Error(`${response.status}`);
      return JSON.parse(text);
    } finally {
      cleanup();
    }
  }

  async function apiPost(endpoint, body, timeoutMs, signal) {
    const { cleanup, signal: combined } = timeoutSignal(timeoutMs, signal);
    try {
      const response = await fetchImpl(new URL(endpoint, `${account.baseUrl}/`).toString(), {
        body: JSON.stringify({ ...body, base_info: { bot_agent: BOT_AGENT, channel_version: CHANNEL_VERSION } }),
        headers: postHeaders(account.token), method: 'POST', signal: combined,
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`${endpoint} ${response.status}`);
      return parseJson(text);
    } finally {
      cleanup();
    }
  }

  /** Starts a QR login; the status events say what to show (QR, scanned, verify code, done). */
  async function startLogin() {
    login?.controller.abort();
    const controller = new AbortController();
    const qr = await apiGet(API_BASE, `ilink/bot/get_bot_qrcode?bot_type=${BOT_TYPE}`, API_TIMEOUT_MS);
    if (!qr?.qrcode || !qr.qrcode_img_content) throw new Error('没有拿到登录二维码');
    login = { baseUrl: API_BASE, controller, qrcode: qr.qrcode, verifyCode: '' };
    setStatus('waiting-scan', qr.qrcode_img_content);
    void pollLogin(login);
    return { ok: true, qrContent: qr.qrcode_img_content };
  }

  async function pollLogin(current) {
    const deadline = Date.now() + 5 * 60_000;
    while (!current.controller.signal.aborted && Date.now() < deadline) {
      let reply;
      try {
        const verify = current.verifyCode ? `&verify_code=${encodeURIComponent(current.verifyCode)}` : '';
        reply = await apiGet(current.baseUrl, `ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(current.qrcode)}${verify}`, LONG_POLL_MS, current.controller.signal);
      } catch {
        reply = { status: 'wait' }; // timeouts and gateway errors: keep waiting
      }
      if (current.controller.signal.aborted) return;
      switch (reply?.status) {
        case 'scaned':
          current.verifyCode = '';
          setStatus('scanned', '请在手机微信上确认');
          break;
        case 'need_verifycode':
          setStatus('need-verify', current.verifyCode ? '数字不对，请重新输入手机微信上显示的数字' : '请输入手机微信上显示的数字');
          await new Promise((resolve) => { current.resumeVerify = resolve; current.controller.signal.addEventListener('abort', resolve, { once: true }); });
          continue;
        case 'verify_code_blocked':
          setStatus('error', '验证码输错太多次，请稍后重新扫码');
          return;
        case 'scaned_but_redirect':
          if (reply.redirect_host) current.baseUrl = `https://${reply.redirect_host}`;
          break;
        case 'binded_redirect':
          setStatus(account ? 'connected' : 'error', account ? '' : '这个微信已经连接过别的设备，请在手机微信的 ClawBot 里断开后重试');
          return;
        case 'expired':
          setStatus('expired-qr', '二维码过期了，请重新获取');
          return;
        case 'confirmed': {
          if (!reply.bot_token || !reply.ilink_bot_id) {
            setStatus('error', '登录失败：微信没有返回账号信息');
            return;
          }
          account = { baseUrl: reply.baseurl || API_BASE, botId: reply.ilink_bot_id, syncBuf: '', token: reply.bot_token, userId: reply.ilink_user_id || '' };
          saveAccount();
          log?.('weixin login confirmed', { persisted: canEncrypt() });
          login = null;
          start();
          return;
        }
        default:
          break;
      }
      await sleep(1000, current.controller.signal);
    }
    if (!current.controller.signal.aborted) setStatus('expired-qr', '二维码过期了，请重新获取');
  }

  function submitVerifyCode(code) {
    if (!login?.resumeVerify || !/^\d{2,10}$/u.test(String(code ?? '').trim())) return { error: '请输入手机上显示的数字。', ok: false };
    login.verifyCode = String(code).trim();
    login.resumeVerify();
    login.resumeVerify = null;
    return { ok: true };
  }

  async function toInbound(message) {
    const items = Array.isArray(message.item_list) ? message.item_list : [];
    const texts = [];
    const images = [];
    let voice = false;
    for (const item of items) {
      if (item.type === 1 && item.text_item?.text) texts.push(item.text_item.text);
      if (item.type === 3) {
        voice = true;
        if (item.voice_item?.text) texts.push(item.voice_item.text); // WeChat transcribes voice itself
      }
      if (item.type === 2 && item.image_item?.media && images.length < 4) {
        try {
          images.push(await downloadImage(item.image_item));
        } catch (error) {
          log?.('weixin image not received', { error: error.message });
        }
      }
    }
    return { images, text: texts.join('\n').trim(), voice };
  }

  async function downloadImage(image) {
    const media = image.media;
    const url = media.full_url || `${CDN_BASE}/download?encrypted_query_param=${encodeURIComponent(media.encrypt_query_param || '')}`;
    if (!/^https:\/\/[^/]*\.(?:weixin\.qq\.com|qpic\.cn|wechat\.com)\//iu.test(url)) throw new Error('unexpected image host');
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`image ${response.status}`);
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > MAX_IMAGE_BYTES) throw new Error('image too large');
    const key = image.aeskey ? Buffer.from(image.aeskey, 'hex').toString('base64') : media.aes_key;
    const bytes = key ? decryptAesEcb(raw, key) : raw;
    return `data:${imageMime(bytes)};base64,${bytes.toString('base64')}`;
  }

  async function runMonitor(controller) {
    let failures = 0;
    let timeoutMs = LONG_POLL_MS;
    setStatus('connected');
    while (!controller.signal.aborted && account) {
      let reply;
      try {
        reply = await apiPost('ilink/bot/getupdates', { get_updates_buf: account.syncBuf }, timeoutMs + 5000, controller.signal);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error.name === 'AbortError') continue; // the long poll simply ended
        failures += 1;
        setStatus('reconnecting', `网络不通，${failures >= 3 ? '30 秒' : '2 秒'}后重试`);
        await sleep(failures >= 3 ? 30_000 : 2000, controller.signal);
        continue;
      }
      if (reply.longpolling_timeout_ms > 0) timeoutMs = reply.longpolling_timeout_ms;
      if ((reply.ret ?? 0) !== 0 || (reply.errcode ?? 0) !== 0) {
        if (reply.ret === STALE_TOKEN || reply.errcode === STALE_TOKEN) {
          setStatus('expired', '微信登录失效了，请重新扫码');
          await sleep(STALE_PAUSE_MS, controller.signal);
          continue;
        }
        failures += 1;
        setStatus('reconnecting', `微信返回错误 ${reply.errcode ?? reply.ret}${reply.errmsg ? `：${reply.errmsg}` : ''}`);
        await sleep(failures >= 3 ? 30_000 : 2000, controller.signal);
        continue;
      }
      if (failures) setStatus('connected');
      failures = 0;
      if (reply.get_updates_buf) {
        account.syncBuf = reply.get_updates_buf;
        saveAccount();
      }
      for (const message of reply.msgs ?? []) {
        if (message.message_type !== 1) continue; // only what the user sent
        if (account.userId && message.from_user_id && message.from_user_id !== account.userId) {
          log?.('weixin message from another user ignored');
          continue;
        }
        if (message.context_token) lastContextToken = message.context_token;
        const inbound = await toInbound(message);
        if (inbound.text || inbound.images.length) emit('desktop-pet:weixin-message', inbound);
      }
    }
  }

  function start() {
    if (monitor) return { ok: true };
    account = account ?? loadAccount();
    if (!account) {
      setStatus('logged-out');
      return { ok: false, error: '还没扫码登录。' };
    }
    const controller = new AbortController();
    monitor = controller;
    void runMonitor(controller).finally(() => { if (monitor === controller) monitor = null; });
    return { ok: true };
  }

  function stop() {
    monitor?.abort();
    monitor = null;
    login?.controller.abort();
    login = null;
    setStatus(account ?? loadAccount() ? 'stopped' : 'logged-out');
  }

  /** Encrypts and uploads one file to the WeChat CDN; returns what a media item points at. */
  async function uploadMedia(bytes, mediaType) {
    const aesKey = crypto.randomBytes(16);
    const filekey = crypto.randomBytes(16).toString('hex');
    const cipher = crypto.createCipheriv('aes-128-ecb', aesKey, null);
    const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
    const target = await apiPost('ilink/bot/getuploadurl', {
      aeskey: aesKey.toString('hex'), filekey, filesize: ciphertext.length, media_type: mediaType, no_need_thumb: true,
      rawfilemd5: crypto.createHash('md5').update(bytes).digest('hex'), rawsize: bytes.length, to_user_id: account.userId,
    }, API_TIMEOUT_MS);
    const uploadUrl = target.upload_full_url?.trim()
      || (target.upload_param ? `${CDN_BASE}/upload?encrypted_query_param=${encodeURIComponent(target.upload_param)}&filekey=${encodeURIComponent(filekey)}` : '');
    if (!uploadUrl) throw new Error('微信没有给上传地址');
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetchImpl(uploadUrl, { body: new Uint8Array(ciphertext), headers: { 'Content-Type': 'application/octet-stream' }, method: 'POST' });
        const downloadParam = response.headers?.get?.('x-encrypted-param');
        if (response.status === 200 && downloadParam) {
          // The key travels as base64 of its hex text, the form the official plugin sends.
          return { cipherSize: ciphertext.length, media: { aes_key: Buffer.from(aesKey.toString('hex')).toString('base64'), encrypt_query_param: downloadParam, encrypt_type: 1 } };
        }
        lastError = new Error(response.headers?.get?.('x-error-message') || `上传失败 ${response.status}`);
        if (response.status >= 400 && response.status < 500) break;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error('上传失败');
  }

  async function sendItem(item) {
    const reply = await apiPost('ilink/bot/sendmessage', {
      msg: {
        client_id: crypto.randomUUID(), context_token: lastContextToken || undefined, from_user_id: '',
        item_list: [item], message_state: 2, message_type: 2, to_user_id: account.userId,
      },
    }, API_TIMEOUT_MS);
    if ((reply.ret ?? 0) !== 0) throw new Error(`微信拒收：${reply.errmsg ?? reply.ret}`);
  }

  /**
   * Her voice as a short video (picture + audio): bots can't send voice bubbles on this channel,
   * the server drops them silently. One tap on the phone plays it.
   */
  async function sendVoice(wavBase64, imageBase64) {
    if (!account || !monitor) return { error: '微信没有连接。', ok: false };
    try {
      const wav = Buffer.from(String(wavBase64 ?? ''), 'base64');
      if (!wav.length) throw new Error('没有声音');
      const image = imageBase64 ? Buffer.from(String(imageBase64), 'base64') : null;
      const video = await makeVideo(wav, image);
      const uploaded = await uploadMedia(video, 2);
      await sendItem({ type: 5, video_item: { media: uploaded.media, video_size: uploaded.cipherSize } });
      log?.('weixin voice video sent', { bytes: video.length });
      return { ok: true };
    } catch (error) {
      log?.('weixin voice not sent', { error: error.message });
      return { error: error.message, ok: false };
    }
  }

  /** A picture (e.g. a sticker), base64 of the image file. */
  async function sendImage(imageBase64) {
    if (!account || !monitor) return { error: '微信没有连接。', ok: false };
    try {
      const bytes = Buffer.from(String(imageBase64 ?? ''), 'base64');
      if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('图片为空或太大');
      const uploaded = await uploadMedia(bytes, 1);
      await sendItem({ image_item: { media: uploaded.media, mid_size: uploaded.cipherSize }, type: 2 });
      return { ok: true };
    } catch (error) {
      log?.('weixin image not sent', { error: error.message });
      return { error: error.message, ok: false };
    }
  }

  async function send(text) {
    if (!account || !monitor) return { error: '微信没有连接。', ok: false };
    const body = String(text ?? '').trim().slice(0, MAX_REPLY_CHARS);
    if (!body) return { ok: true };
    try {
      const reply = await apiPost('ilink/bot/sendmessage', {
        msg: {
          client_id: crypto.randomUUID(), context_token: lastContextToken || undefined, from_user_id: '',
          item_list: [{ text_item: { text: body }, type: 1 }], message_state: 2, message_type: 2, to_user_id: account.userId,
        },
      }, API_TIMEOUT_MS);
      if ((reply.ret ?? 0) !== 0) return { error: `微信拒收：${reply.errmsg ?? reply.ret}`, ok: false };
      return { ok: true };
    } catch (error) {
      return { error: error.message, ok: false };
    }
  }

  function logout() {
    stop();
    account = null;
    lastContextToken = '';
    fs.rmSync(statePath, { force: true });
    setStatus('logged-out');
    return { ok: true };
  }

  return { getStatus: () => status, logout, send, sendImage, sendVoice, start, startLogin, stop, submitVerifyCode };
}

function registerWeixinBridgeIpcHandlers({ ipcMain, service, log = () => undefined }) {
  const handle = (channel, handler) => {
    ipcMain.handle(channel, async (_event, request) => {
      try {
        return await handler(request ?? {});
      } catch (error) {
        log(`failed ${channel}`, error instanceof Error ? error.message : String(error));
        return { error: error instanceof Error ? error.message : '微信连接出错了。', ok: false };
      }
    });
  };
  handle('desktop-pet:weixin-status', async () => service.getStatus());
  handle('desktop-pet:weixin-start-login', () => service.startLogin());
  handle('desktop-pet:weixin-verify', ({ code }) => service.submitVerifyCode(code));
  handle('desktop-pet:weixin-start', async () => service.start());
  handle('desktop-pet:weixin-stop', async () => { service.stop(); return { ok: true }; });
  handle('desktop-pet:weixin-logout', async () => service.logout());
  handle('desktop-pet:weixin-send', ({ text }) => service.send(text));
  handle('desktop-pet:weixin-send-voice', ({ imageBase64, wavBase64 }) => service.sendVoice(wavBase64, imageBase64));
  handle('desktop-pet:weixin-send-image', ({ imageBase64 }) => service.sendImage(imageBase64));
}

module.exports = { createWeixinBridgeService, registerWeixinBridgeIpcHandlers };
