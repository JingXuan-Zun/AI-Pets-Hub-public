import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { PetConfig } from '../../types';
import { normalizeWeixinBridgeSettings, type WeixinBridgeSettings, type WeixinBridgeStatus } from '../../weixin-bridge/weixinBridgeSettings';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';

type CommitConfig = (updater: (config: PetConfig) => PetConfig) => unknown;

const STATE_TEXT: Record<WeixinBridgeStatus['state'], string> = {
  connected: '已连接',
  error: '出错了',
  expired: '登录失效，需要重新扫码',
  'expired-qr': '二维码过期了',
  'logged-out': '还没扫码登录',
  'need-verify': '请输入手机上显示的数字',
  reconnecting: '正在重连',
  scanned: '已扫码，请在手机上确认',
  stopped: '已暂停',
  'waiting-scan': '请用手机微信扫码',
};

function updateWeixin(onCommit: CommitConfig, patch: Partial<WeixinBridgeSettings>) {
  onCommit((config) => ({ ...config, settings: { ...config.settings, weixinBridge: { ...normalizeWeixinBridgeSettings(config.settings.weixinBridge), ...patch } } }));
}

function setEnabled(onCommit: CommitConfig, enabled: boolean) {
  updateWeixin(onCommit, { enabled });
}

/** Phone WeChat through Tencent's official ClawBot channel: scan once, then chat from the phone. */
export function SettingsWeixinBridgeTab({ localConfig, onCommit }: { localConfig: PetConfig; onCommit: CommitConfig }) {
  const settings = normalizeWeixinBridgeSettings(localConfig.settings.weixinBridge);
  const [status, setStatus] = useState<WeixinBridgeStatus>({ account: null, detail: '', state: 'logged-out' });
  const [qrImage, setQrImage] = useState('');
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState('');
  const weixin = typeof window !== 'undefined' ? window.desktopPetShell?.weixin : undefined;

  useEffect(() => {
    if (!weixin) return undefined;
    void weixin.status().then((current) => { if (current) setStatus(current); });
    return weixin.onStatus((next) => { if (next) setStatus(next); });
  }, [weixin]);

  // The QR "picture" is a link; it is drawn here so nothing leaves the computer to make it.
  useEffect(() => {
    if (status.state !== 'waiting-scan' || !status.detail) {
      setQrImage('');
      return;
    }
    void QRCode.toDataURL(status.detail, { margin: 1, width: 220 }).then(setQrImage).catch(() => setQrImage(''));
  }, [status.state, status.detail]);

  const startLogin = async () => {
    if (!weixin) {
      setFeedback('只能在桌面版里连接微信。');
      return;
    }
    setFeedback('正在获取二维码…');
    // Scanning means the user wants it on: messages that arrive right after the scan are handled.
    if (!settings.enabled) setEnabled(onCommit, true);
    const result = await weixin.startLogin();
    setFeedback('error' in result ? `获取二维码失败：${result.error}` : '');
  };

  const submitCode = async () => {
    const result = await weixin?.submitVerifyCode(code.trim());
    setFeedback(result?.ok ? '' : result?.error ?? '');
    if (result?.ok) setCode('');
  };

  const logout = async () => {
    if (!window.confirm('退出微信登录？之后要重新扫码才能在微信上聊天。')) return;
    await weixin?.logout();
    setFeedback('已退出。');
  };

  const needsScan = ['logged-out', 'expired', 'expired-qr', 'error'].includes(status.state);
  const busyLogin = ['waiting-scan', 'scanned', 'need-verify'].includes(status.state);

  return (
    <section className="space-y-4 rounded-sm border border-border bg-secondary/20 p-4">
      <div className="text-2xs font-bold uppercase tracking-widest text-primary">微信连接</div>

      <div className="space-y-3 rounded-sm border border-border bg-background/30 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-foreground">状态：{STATE_TEXT[status.state]}</span>
          {status.detail && status.state !== 'waiting-scan' ? <span className="text-2xs text-muted-foreground">{status.detail}</span> : null}
        </div>

        {qrImage ? (
          <div className="flex flex-wrap items-center gap-4">
            <img src={qrImage} alt="微信登录二维码" className="h-44 w-44 rounded-md border border-border bg-white p-1" />
            <p className="max-w-xs text-2xs leading-5 text-muted-foreground">用手机微信“扫一扫”，然后在手机上确认。二维码几分钟后会过期，过期了点“重新获取二维码”。</p>
          </div>
        ) : null}

        {status.state === 'need-verify' ? (
          <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); void submitCode(); }}>
            <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/gu, ''))} inputMode="numeric" placeholder="手机微信上显示的数字" className="h-8 w-48 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary" />
            <button type="submit" className="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">提交</button>
          </form>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {needsScan || busyLogin ? (
            <button type="button" onClick={() => void startLogin()} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
              {busyLogin ? '重新获取二维码' : '扫码登录'}
            </button>
          ) : null}
          {status.account ? (
            <button type="button" onClick={() => void logout()} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-red-700">退出登录</button>
          ) : null}
        </div>
        {feedback ? <p className="text-2xs text-primary">{feedback}</p> : null}
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-border bg-background/30 p-3">
        <span className="flex-1 space-y-1">
          <span className="block text-xs font-semibold text-foreground">开启微信连接</span>
          <span className="block text-2xs leading-5 text-muted-foreground">桌宠启动时自动连接，断了会自动重连。</span>
        </span>
        <SettingsToggleSwitch checked={settings.enabled} hideLabel label="开启微信连接" onChange={(checked) => setEnabled(onCommit, checked)} />
      </label>

      <label className="block space-y-1 rounded-sm border border-border bg-background/30 p-3">
        <span className="block text-xs font-semibold text-foreground">语音回复</span>
        <select
          className="w-full rounded-sm border border-border bg-background/60 px-3 py-2 text-xs text-foreground"
          value={settings.voiceReplyMode}
          onChange={(event) => updateWeixin(onCommit, { voiceReplyMode: event.target.value as WeixinBridgeSettings['voiceReplyMode'] })}
        >
          <option value="always">总是语音（适合不方便看字的家人）</option>
          <option value="mirror">跟着你：你发语音她回语音，或者你让她发语音时</option>
          <option value="off">不发语音</option>
        </select>
        <span className="block text-2xs leading-5 text-muted-foreground">用角色自己的声音（角色音色包），以短视频的形式发过去，同时也发文字。</span>
      </label>

      <div className="space-y-2 rounded-sm border border-border bg-background/30 p-3 text-2xs leading-5 text-muted-foreground">
        <div className="text-xs font-semibold text-foreground">使用说明</div>
        <p>用微信官方的 ClawBot 通道在手机微信上跟角色聊天：扫一次码就行，不用装电脑版微信。电脑和桌宠要开着。</p>
        <div className="pt-1 font-semibold text-foreground">第一次用</div>
        <p>1. 手机微信更新到最新（iOS 8.0.70 / 安卓 8.0.69 或更新），在 我 → 设置 → 插件 里能看到“微信ClawBot”。</p>
        <p>2. 点上面的“扫码登录”，用这个手机微信扫码并确认；手机上要是显示一串数字，把它填进来。</p>
        <p>3. 在手机微信里给 ClawBot 发消息试试。开启连接后，以后桌宠启动会自动连上，不用再扫码。</p>
        <div className="pt-1 font-semibold text-foreground">能做什么</div>
        <p>你发的消息由当前的角色回复：文字来回发；她用自己的声音回复（短视频，点开就能听）；她会发表情图片；你发的图片她能看；你发的语音由微信自动转成文字给她。</p>
        <p>她要做需要确认的事时，会在微信里问你，回复“好”或“不要”就行。</p>
        <div className="pt-1 font-semibold text-foreground">暂时不能</div>
        <p>不能在微信群里聊天（官方通道只支持一对一）；不能发微信语音条，也不能打语音或视频电话（官方通道不支持）。</p>
      </div>
    </section>
  );
}
