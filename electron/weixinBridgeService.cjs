const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { makeVoiceVideo } = require('./weixinVoiceVideo.cjs');

// Chatting with the characters from phone WeChat through Tencent's official ClawBot channel
// (iLink bot API, the protocol of the MIT-licensed @tencent-weixin/openclaw-weixin package):
// scan a QR code once with phone WeChat, then long-poll for messages and reply over HTTPS.
// No desktop WeChat, no injection. One scan binds one WeChat user, so each family member scans
// once and gets their own login; each login answers only the person who scanned it.

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
  // id → { baseUrl, botId, contextToken, detail, id, label, monitor, owner, state, syncBuf, token, userId }
  const accounts = new Map();
  let loaded = false;
  let running = false;
  let login = null;
  let loginStatus = null; // { detail, state } while a QR login is on screen

  const snapshot = () => ({
    accounts: [...accounts.values()].map(({ detail, id, label, owner, state }) => ({ detail, id, label, owner, state })),
    login: loginStatus,
    running,
  });
  const publish = () => emit('desktop-pet:weixin-status-changed', snapshot());
  const setLogin = (state, detail = '') => { loginStatus = state ? { detail, state } : null; publish(); };
  const setAccountState = (account, state, detail = '') => { account.state = state; account.detail = detail; publish(); };

  function canEncrypt() {
    return Boolean(safeStorage?.isEncryptionAvailable?.()) && safeStorage.getSelectedStorageBackend?.() !== 'basic_text';
  }

  function loadAccounts() {
    if (loaded) return;
    loaded = true;
    try {
      const saved = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      // The first version kept one login as the whole file: that was the owner's.
      const list = Array.isArray(saved?.accounts) ? saved.accounts : saved?.tokenCipher ? [{ ...saved, label: '我', owner: true }] : [];
      if (!canEncrypt()) return;
      for (const item of list) {
        if (!item?.tokenCipher || !item.botId) continue;
        accounts.set(item.botId, {
          baseUrl: item.baseUrl || API_BASE, botId: item.botId, contextToken: '', detail: '', id: item.botId,
          label: String(item.label || '家人'), monitor: null, owner: item.owner === true, state: 'stopped', syncBuf: item.syncBuf || '',
          token: safeStorage.decryptString(Buffer.from(item.tokenCipher, 'base64')), userId: item.userId || '',
        });
      }
    } catch {}
  }

  function saveAccounts() {
    if (!canEncrypt()) return; // without OS encryption the logins last until the app quits
    const list = [...accounts.values()].map((account) => ({
      baseUrl: account.baseUrl, botId: account.botId, label: account.label, owner: account.owner, syncBuf: account.syncBuf,
      tokenCipher: safeStorage.encryptString(account.token).toString('base64'), userId: account.userId,
    }));
    if (list.length) fs.writeFileSync(statePath, JSON.stringify({ accounts: list }), 'utf8');
    else fs.rmSync(statePath, { force: true });
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

  async function apiPost(account, endpoint, body, timeoutMs, signal) {
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

  /**
   * Starts a QR login for one person (label: how the character knows them, e.g. 妈妈). The first
   * login is the owner's. Status events say what to show (QR, scanned, verify code, done).
   */
  async function startLogin({ label, owner } = {}) {
    loadAccounts();
    login?.controller.abort();
    const controller = new AbortController();
    const qr = await apiGet(API_BASE, `ilink/bot/get_bot_qrcode?bot_type=${BOT_TYPE}`, API_TIMEOUT_MS);
    if (!qr?.qrcode || !qr.qrcode_img_content) throw new Error('没有拿到登录二维码');
    login = {
      baseUrl: API_BASE, controller, label: String(label ?? '').trim().slice(0, 20),
      owner: owner === true || accounts.size === 0, qrcode: qr.qrcode, verifyCode: '',
    };
    setLogin('waiting-scan', qr.qrcode_img_content);
    void pollLogin(login);
    return { ok: true, qrContent: qr.qrcode_img_content };
  }

  function addAccount(current, reply) {
    const userId = reply.ilink_user_id || '';
    // The same person scanning again replaces their old login and keeps their name.
    const previous = [...accounts.values()].find((account) => userId && account.userId === userId);
    if (previous) {
      previous.monitor?.abort();
      accounts.delete(previous.id);
    }
    const owner = previous ? previous.owner || current.owner : current.owner;
    if (owner) accounts.forEach((account) => { account.owner = false; });
    const account = {
      baseUrl: reply.baseurl || API_BASE, botId: reply.ilink_bot_id, contextToken: '', detail: '', id: reply.ilink_bot_id,
      label: current.label || previous?.label || (owner ? '我' : '家人'), monitor: null, owner, state: 'stopped', syncBuf: '',
      token: reply.bot_token, userId,
    };
    accounts.set(account.id, account);
    saveAccounts();
    log?.('weixin login confirmed', { accounts: accounts.size, persisted: canEncrypt() });
    if (running) startAccount(account);
    else publish();
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
          setLogin('scanned', '请在手机微信上确认');
          break;
        case 'need_verifycode':
          setLogin('need-verify', current.verifyCode ? '数字不对，请重新输入手机微信上显示的数字' : '请输入手机微信上显示的数字');
          await new Promise((resolve) => { current.resumeVerify = resolve; current.controller.signal.addEventListener('abort', resolve, { once: true }); });
          continue;
        case 'verify_code_blocked':
          setLogin('error', '验证码输错太多次，请稍后重新扫码');
          return;
        case 'scaned_but_redirect':
          if (reply.redirect_host) current.baseUrl = `https://${reply.redirect_host}`;
          break;
        case 'binded_redirect':
          setLogin('error', '这个微信已经连接过了；要重连的话，请先在手机微信的 ClawBot 里断开再扫码');
          return;
        case 'expired':
          setLogin('expired-qr', '二维码过期了，请重新获取');
          return;
        case 'confirmed': {
          login = null;
          if (!reply.bot_token || !reply.ilink_bot_id) {
            setLogin('error', '登录失败：微信没有返回账号信息');
            return;
          }
          loginStatus = null;
          addAccount(current, reply);
          return;
        }
        default:
          break;
      }
      await sleep(1000, current.controller.signal);
    }
    if (!current.controller.signal.aborted) setLogin('expired-qr', '二维码过期了，请重新获取');
  }

  function submitVerifyCode(code) {
    if (!login?.resumeVerify || !/^\d{2,10}$/u.test(String(code ?? '').trim())) return { error: '请输入手机上显示的数字。', ok: false };
    login.verifyCode = String(code).trim();
    login.resumeVerify();
    login.resumeVerify = null;
    return { ok: true };
  }

  function cancelLogin() {
    login?.controller.abort();
    login = null;
    setLogin(null);
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

  async function runMonitor(account, controller) {
    let failures = 0;
    let timeoutMs = LONG_POLL_MS;
    setAccountState(account, 'connected');
    while (!controller.signal.aborted && accounts.get(account.id) === account) {
      let reply;
      try {
        reply = await apiPost(account, 'ilink/bot/getupdates', { get_updates_buf: account.syncBuf }, timeoutMs + 5000, controller.signal);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error.name === 'AbortError') continue; // the long poll simply ended
        failures += 1;
        setAccountState(account, 'reconnecting', `网络不通，${failures >= 3 ? '30 秒' : '2 秒'}后重试`);
        await sleep(failures >= 3 ? 30_000 : 2000, controller.signal);
        continue;
      }
      if (reply.longpolling_timeout_ms > 0) timeoutMs = reply.longpolling_timeout_ms;
      if ((reply.ret ?? 0) !== 0 || (reply.errcode ?? 0) !== 0) {
        if (reply.ret === STALE_TOKEN || reply.errcode === STALE_TOKEN) {
          setAccountState(account, 'expired', '微信登录失效了，请重新扫码');
          await sleep(STALE_PAUSE_MS, controller.signal);
          continue;
        }
        failures += 1;
        setAccountState(account, 'reconnecting', `微信返回错误 ${reply.errcode ?? reply.ret}${reply.errmsg ? `：${reply.errmsg}` : ''}`);
        await sleep(failures >= 3 ? 30_000 : 2000, controller.signal);
        continue;
      }
      if (account.state !== 'connected') setAccountState(account, 'connected');
      failures = 0;
      if (reply.get_updates_buf) {
        account.syncBuf = reply.get_updates_buf;
        saveAccounts();
      }
      for (const message of reply.msgs ?? []) {
        if (message.message_type !== 1) continue; // only what the user sent
        if (account.userId && message.from_user_id && message.from_user_id !== account.userId) {
          log?.('weixin message from another user ignored');
          continue;
        }
        if (message.context_token) account.contextToken = message.context_token;
        const inbound = await toInbound(message);
        if (inbound.text || inbound.images.length) emit('desktop-pet:weixin-message', { ...inbound, accountId: account.id, label: account.label, owner: account.owner });
      }
    }
  }

  function startAccount(account) {
    if (account.monitor) return;
    const controller = new AbortController();
    account.monitor = controller;
    void runMonitor(account, controller).finally(() => { if (account.monitor === controller) account.monitor = null; });
  }

  function start() {
    loadAccounts();
    running = true;
    if (!accounts.size) {
      publish();
      return { ok: false, error: '还没扫码登录。' };
    }
    accounts.forEach(startAccount);
    return { ok: true };
  }

  function stop() {
    running = false;
    accounts.forEach((account) => {
      account.monitor?.abort();
      account.monitor = null;
      account.state = 'stopped';
      account.detail = '';
    });
    login?.controller.abort();
    login = null;
    loginStatus = null;
    publish();
  }

  /** The login a reply goes out on: the one named, or the owner's. */
  function pick(accountId) {
    loadAccounts();
    const account = accountId ? accounts.get(accountId) : [...accounts.values()].find((item) => item.owner);
    return account?.monitor ? account : null;
  }

  /** Encrypts and uploads one file to the WeChat CDN; returns what a media item points at. */
  async function uploadMedia(account, bytes, mediaType) {
    const aesKey = crypto.randomBytes(16);
    const filekey = crypto.randomBytes(16).toString('hex');
    const cipher = crypto.createCipheriv('aes-128-ecb', aesKey, null);
    const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
    const target = await apiPost(account, 'ilink/bot/getuploadurl', {
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

  async function sendItem(account, item) {
    const reply = await apiPost(account, 'ilink/bot/sendmessage', {
      msg: {
        client_id: crypto.randomUUID(), context_token: account.contextToken || undefined, from_user_id: '',
        item_list: [item], message_state: 2, message_type: 2, to_user_id: account.userId,
      },
    }, API_TIMEOUT_MS);
    if ((reply.ret ?? 0) !== 0) throw new Error(`微信拒收：${reply.errmsg ?? reply.ret}`);
  }

  /**
   * Her voice as a short video (picture + audio): bots can't send voice bubbles on this channel,
   * the server drops them silently. One tap on the phone plays it.
   */
  async function sendVoice(accountId, wavBase64, imageBase64) {
    const account = pick(accountId);
    if (!account) return { error: '微信没有连接。', ok: false };
    try {
      const wav = Buffer.from(String(wavBase64 ?? ''), 'base64');
      if (!wav.length) throw new Error('没有声音');
      const image = imageBase64 ? Buffer.from(String(imageBase64), 'base64') : null;
      const video = await makeVideo(wav, image);
      const uploaded = await uploadMedia(account, video, 2);
      await sendItem(account, { type: 5, video_item: { media: uploaded.media, video_size: uploaded.cipherSize } });
      log?.('weixin voice video sent', { bytes: video.length });
      return { ok: true };
    } catch (error) {
      log?.('weixin voice not sent', { error: error.message });
      return { error: error.message, ok: false };
    }
  }

  /** A picture (e.g. a sticker), base64 of the image file. */
  async function sendImage(accountId, imageBase64) {
    const account = pick(accountId);
    if (!account) return { error: '微信没有连接。', ok: false };
    try {
      const bytes = Buffer.from(String(imageBase64 ?? ''), 'base64');
      if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('图片为空或太大');
      const uploaded = await uploadMedia(account, bytes, 1);
      await sendItem(account, { image_item: { media: uploaded.media, mid_size: uploaded.cipherSize }, type: 2 });
      return { ok: true };
    } catch (error) {
      log?.('weixin image not sent', { error: error.message });
      return { error: error.message, ok: false };
    }
  }

  async function send(accountId, text) {
    const account = pick(accountId);
    if (!account) return { error: '微信没有连接。', ok: false };
    const body = String(text ?? '').trim().slice(0, MAX_REPLY_CHARS);
    if (!body) return { ok: true };
    try {
      await sendItem(account, { text_item: { text: body }, type: 1 });
      return { ok: true };
    } catch (error) {
      return { error: error.message, ok: false };
    }
  }

  /** Renames a login, or makes it the owner's (only the owner's messages go into the chat window). */
  function updateAccount(accountId, { label, owner } = {}) {
    loadAccounts();
    const account = accounts.get(accountId);
    if (!account) return { error: '没有这个登录。', ok: false };
    const name = typeof label === 'string' ? label.trim().slice(0, 20) : '';
    if (name) account.label = name;
    if (owner === true) accounts.forEach((item) => { item.owner = item === account; });
    saveAccounts();
    publish();
    return { ok: true };
  }

  /** Forgets one login; that person has to scan again to come back. */
  function removeAccount(accountId) {
    loadAccounts();
    const account = accounts.get(accountId);
    if (!account) return { ok: true };
    account.monitor?.abort();
    account.monitor = null;
    accounts.delete(accountId);
    if (account.owner && accounts.size) [...accounts.values()][0].owner = true;
    saveAccounts();
    publish();
    return { ok: true };
  }

  return {
    cancelLogin, getStatus: () => { loadAccounts(); return snapshot(); }, removeAccount, send, sendImage, sendVoice,
    start, startLogin, stop, submitVerifyCode, updateAccount,
  };
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
  handle('desktop-pet:weixin-start-login', ({ label, owner }) => service.startLogin({ label, owner }));
  handle('desktop-pet:weixin-cancel-login', async () => service.cancelLogin());
  handle('desktop-pet:weixin-verify', ({ code }) => service.submitVerifyCode(code));
  handle('desktop-pet:weixin-start', async () => service.start());
  handle('desktop-pet:weixin-stop', async () => { service.stop(); return { ok: true }; });
  handle('desktop-pet:weixin-update-account', async ({ accountId, label, owner }) => service.updateAccount(accountId, { label, owner }));
  handle('desktop-pet:weixin-remove-account', async ({ accountId }) => service.removeAccount(accountId));
  handle('desktop-pet:weixin-send', ({ accountId, text }) => service.send(accountId, text));
  handle('desktop-pet:weixin-send-voice', ({ accountId, imageBase64, wavBase64 }) => service.sendVoice(accountId, wavBase64, imageBase64));
  handle('desktop-pet:weixin-send-image', ({ accountId, imageBase64 }) => service.sendImage(accountId, imageBase64));
}

module.exports = { createWeixinBridgeService, registerWeixinBridgeIpcHandlers };
