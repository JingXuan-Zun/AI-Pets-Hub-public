import QRCode from 'qrcode';
import { stringArg } from '../platform-capabilities/platformCapabilityArgs';
import type { PlatformCapability, PlatformCapabilityContext } from '../platform-capabilities/platformCapabilityTypes';
import { normalizeWeixinBridgeSettings, type WeixinBridgeStatus } from './weixinBridgeSettings';

// WeChat from the chat: she can say who is connected, post a login QR code right in the chat
// (for the user or a family member to scan) and wait for the scan in the background, and type
// in the digits the phone shows. Starting a login asks first; the scan itself is done on the
// phone by the person, so nobody is connected without their own WeChat.

const GROUP = '微信连接';
const POLL_MS = 1500;
/** Who the login on screen is for, so the wait after the digits still says their name. */
let pendingLabel = '';
const STATE_LABELS: Record<string, string> = { connected: '已连接', expired: '登录失效，要重新扫码', reconnecting: '重连中', stopped: '没开' };

function bridge() {
  return typeof window === 'undefined' ? null : window.desktopPetShell?.weixin ?? null;
}

function waitMs(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

/** Waits (in the background) until the person scanned and confirmed, the code ran out, or the phone asks for digits. */
function waitForScan(context: PlatformCapabilityContext, label: string, accountsBefore: number) {
  const weixin = bridge()!;
  const enabledNote = () => (normalizeWeixinBridgeSettings(context.configRef.current.settings.weixinBridge).enabled
    ? '' : '不过微信连接现在是关着的，要用的话把它打开（weixin.enabled）。');
  return context.runInBackground?.({
    kind: 'weixin-login',
    run: async (signal) => {
      signal.addEventListener('abort', () => { void weixin.cancelLogin(); }, { once: true });
      while (!signal.aborted) {
        await waitMs(POLL_MS, signal);
        if (signal.aborted) break;
        const status: WeixinBridgeStatus = await weixin.status();
        const login = status.login;
        if (!login) {
          return status.accounts.length > accountsBefore || status.accounts.some((account) => account.label === label)
            ? { ok: true, text: `「${label}」的微信连上了，以后在手机微信里给 ClawBot 发消息就能找到你。${enabledNote()}` }
            : { ok: false, text: '登录没有完成（可能在设置页里取消了）。' };
        }
        if (login.state === 'need-verify') {
          return { ok: false, text: `「${label}」扫过码了，手机微信上显示了一串数字：请用户把这串数字告诉你，你用 weixin.submit_code 填进去。` };
        }
        if (login.state === 'expired-qr' || login.state === 'error') return { ok: false, text: login.detail || '二维码过期了，可以再发一个新的。' };
      }
      return { ok: false, text: '已经取消了。' };
    },
    title: `等「${label}」扫微信登录码`,
  });
}

const status: PlatformCapability = {
  args: [],
  description: 'Who is connected to you on WeChat (each family member scans once), and whether the WeChat connection is on.',
  describe: () => '查看微信连接',
  group: GROUP,
  id: 'weixin.status',
  risk: 'read',
  run: async ({ configRef }) => {
    const weixin = bridge();
    if (!weixin) return { ok: false, text: '微信连接只能在桌面版里用。' };
    const current = await weixin.status();
    const enabled = normalizeWeixinBridgeSettings(configRef.current.settings.weixinBridge).enabled;
    const people = current.accounts.length
      ? current.accounts.map((account) => `${account.label}${account.owner ? '（主人）' : ''}：${STATE_LABELS[account.state] ?? account.state}`).join('；')
      : '还没有人登录';
    return { ok: true, text: `微信连接${enabled ? '开着' : '关着'}。${people}。${current.login ? `正在等扫码：${current.login.detail}` : ''}` };
  },
  title: '微信连接状态',
};

const login: PlatformCapability = {
  args: [
    { description: 'Who will scan, how you will call them (“妈妈”“爸爸”); the user themself = “我”. Needed once someone is connected.', key: 'label', type: 'string' },
  ],
  description: 'Post a WeChat login QR code in the chat for the user or a family member to scan with phone WeChat (in the same reply, explain what it is and how to scan). You are told in the background when they are connected.',
  describe: (args) => `发微信登录二维码（给「${stringArg(args, 'label') || '你'}」扫）`,
  group: GROUP,
  id: 'weixin.login',
  risk: 'change',
  run: async (context, args) => {
    const weixin = bridge();
    if (!weixin) return { ok: false, text: '微信连接只能在桌面版里用。' };
    if (!context.presentImages || !context.runInBackground) return { ok: false, text: '这里发不了二维码，请用户到设置页的微信连接里扫码。' };
    const before = await weixin.status();
    const label = stringArg(args, 'label') || (before.accounts.length ? '' : '我');
    if (!label) return { ok: false, text: '已经有人连着了，这次是给谁扫？（比如“妈妈”）' };
    const started = await weixin.startLogin({ label, owner: before.accounts.length === 0 });
    pendingLabel = label;
    if ('error' in started) return { ok: false, text: `没拿到二维码：${started.error}` };
    // The QR is drawn here from the link WeChat gave, so nothing leaves the computer to make it.
    const dataUrl = await QRCode.toDataURL(started.qrContent, { margin: 1, width: 300 });
    context.presentImages([{ dataUrl, mimeType: 'image/png', name: `微信登录二维码-${label}.png` }], `微信登录二维码（给「${label}」扫）`);
    const waiting = waitForScan(context, label, before.accounts.length);
    if (waiting && !waiting.ok) return waiting;
    return { ok: true, text: `二维码已经发在聊天里了（几分钟内有效）。告诉用户：用「${label}」的手机微信扫一扫，再在手机上点确认；扫完会自动告诉你。` };
  },
  title: '发微信登录二维码',
};

const submitCode: PlatformCapability = {
  args: [{ description: 'The digits shown on the phone', key: 'code', required: true, type: 'string' }],
  description: 'Type in the digits phone WeChat shows during a login (the user tells you them).',
  describe: () => '填微信登录验证码',
  group: GROUP,
  id: 'weixin.submit_code',
  risk: 'personal',
  run: async (context, args) => {
    const weixin = bridge();
    if (!weixin) return { ok: false, text: '微信连接只能在桌面版里用。' };
    const before = await weixin.status();
    if (before.login?.state !== 'need-verify') return { ok: false, text: '现在没有在等验证码。' };
    const result = await weixin.submitVerifyCode(stringArg(args, 'code').replace(/\D/gu, ''));
    if (!result.ok) return { ok: false, text: result.error ?? '数字没填进去。' };
    waitForScan(context, pendingLabel || '这位', before.accounts.length);
    return { ok: true, text: '数字填进去了，等手机上确认；连上会自动告诉你。' };
  },
  title: '填微信验证码',
};

export const WEIXIN_CAPABILITIES: PlatformCapability[] = [status, login, submitCode];
