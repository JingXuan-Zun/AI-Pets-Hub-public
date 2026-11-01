import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { PetConfig } from '../../types';
import { clearFamilyChat } from '../../weixin-bridge/weixinFamilyChat';
import {
  normalizeWeixinBridgeSettings, type WeixinAccountStatus, type WeixinBridgeSettings, type WeixinBridgeStatus, type WeixinLoginStatus,
} from '../../weixin-bridge/weixinBridgeSettings';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';

type CommitConfig = (updater: (config: PetConfig) => PetConfig) => unknown;

const ACCOUNT_STATE_TEXT: Record<WeixinAccountStatus['state'], string> = {
  connected: '已连接',
  expired: '登录失效，需要重新扫码',
  reconnecting: '正在重连',
  stopped: '已暂停',
};

const LOGIN_STATE_TEXT: Record<WeixinLoginStatus['state'], string> = {
  error: '出错了',
  'expired-qr': '二维码过期了',
  'need-verify': '请输入手机上显示的数字',
  scanned: '已扫码，请在手机上确认',
  'waiting-scan': '请用手机微信扫码',
};

function updateWeixin(onCommit: CommitConfig, patch: Partial<WeixinBridgeSettings>) {
  onCommit((config) => ({ ...config, settings: { ...config.settings, weixinBridge: { ...normalizeWeixinBridgeSettings(config.settings.weixinBridge), ...patch } } }));
}

const inputClass = 'h-8 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary';
const buttonClass = 'rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground';

function AccountRow({ account, onRename, onRemove, onMakeOwner }: {
  account: WeixinAccountStatus;
  onMakeOwner: () => void;
  onRemove: () => void;
  onRename: (label: string) => void;
}) {
  const [name, setName] = useState(account.label);
  useEffect(() => setName(account.label), [account.label]);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-sm border border-border bg-background/40 px-3 py-2">
      <input
        value={name}
        maxLength={20}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => { if (name.trim() && name.trim() !== account.label) onRename(name.trim()); }}
        aria-label="称呼"
        className={`${inputClass} w-28`}
      />
      <span className="text-2xs font-semibold text-foreground">{account.owner ? '我自己' : '家人'}</span>
      <span className="text-2xs text-muted-foreground">{ACCOUNT_STATE_TEXT[account.state]}{account.detail ? `：${account.detail}` : ''}</span>
      <span className="flex-1" />
      {account.owner ? null : <button type="button" onClick={onMakeOwner} className={buttonClass}>设为我自己</button>}
      <button type="button" onClick={onRemove} className={`${buttonClass} hover:text-red-700`}>移除</button>
    </div>
  );
}

/** Phone WeChat through Tencent's official ClawBot channel: each person scans once, then chats from their phone. */
export function SettingsWeixinBridgeTab({ localConfig, onCommit }: { localConfig: PetConfig; onCommit: CommitConfig }) {
  const settings = normalizeWeixinBridgeSettings(localConfig.settings.weixinBridge);
  const [status, setStatus] = useState<WeixinBridgeStatus>({ accounts: [], login: null, running: false });
  const [qrImage, setQrImage] = useState('');
  const [code, setCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [feedback, setFeedback] = useState('');
  const weixin = typeof window !== 'undefined' ? window.desktopPetShell?.weixin : undefined;
  const login = status.login;
  const hasOwner = status.accounts.some((account) => account.owner);

  useEffect(() => {
    if (!weixin) return undefined;
    void weixin.status().then((current) => { if (current?.accounts) setStatus(current); });
    return weixin.onStatus((next) => { if (next?.accounts) setStatus(next); });
  }, [weixin]);

  // The QR "picture" is a link; it is drawn here so nothing leaves the computer to make it.
  useEffect(() => {
    if (login?.state !== 'waiting-scan' || !login.detail) {
      setQrImage('');
      return;
    }
    void QRCode.toDataURL(login.detail, { margin: 1, width: 220 }).then(setQrImage).catch(() => setQrImage(''));
  }, [login?.state, login?.detail]);

  const startLogin = async () => {
    if (!weixin) {
      setFeedback('只能在桌面版里连接微信。');
      return;
    }
    const label = newLabel.trim() || (hasOwner ? '' : '我');
    if (!label) {
      setFeedback('先填一下这位家人的称呼，比如“妈妈”，她就知道是谁在跟她说话。');
      return;
    }
    setFeedback('正在获取二维码…');
    // Scanning means the user wants it on: messages that arrive right after the scan are handled.
    if (!settings.enabled) updateWeixin(onCommit, { enabled: true });
    const result = await weixin.startLogin({ label, owner: !hasOwner });
    setFeedback('error' in result ? `获取二维码失败：${result.error}` : '');
    if (!('error' in result)) setNewLabel('');
  };

  const submitCode = async () => {
    const result = await weixin?.submitVerifyCode(code.trim());
    setFeedback(result?.ok ? '' : result?.error ?? '');
    if (result?.ok) setCode('');
  };

  const removeAccount = async (account: WeixinAccountStatus) => {
    if (!window.confirm(`移除「${account.label}」的微信连接？之后要重新扫码才能在微信上聊天，${account.owner ? '' : '和她的聊天记录也会删掉。'}`)) return;
    await weixin?.removeAccount(account.id);
    if (!account.owner) clearFamilyChat(account.id);
  };

  return (
    <section className="space-y-4 rounded-sm border border-border bg-secondary/20 p-4">
      <div className="text-2xs font-bold uppercase tracking-widest text-primary">微信连接</div>

      <div className="space-y-3 rounded-sm border border-border bg-background/30 p-3">
        <div className="text-xs font-semibold text-foreground">已连接的微信（{status.accounts.length}）</div>
        {status.accounts.length ? (
          <div className="space-y-2">
            {status.accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                onMakeOwner={() => void weixin?.updateAccount(account.id, { owner: true })}
                onRemove={() => void removeAccount(account)}
                onRename={(label) => void weixin?.updateAccount(account.id, { label })}
              />
            ))}
          </div>
        ) : <p className="text-2xs text-muted-foreground">还没有。先用你自己的手机微信扫码。</p>}

        {login ? (
          <div className="space-y-3 rounded-sm border border-primary/40 bg-background/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-foreground">{LOGIN_STATE_TEXT[login.state]}</span>
              {login.detail && login.state !== 'waiting-scan' ? <span className="text-2xs text-muted-foreground">{login.detail}</span> : null}
            </div>
            {qrImage ? (
              <div className="flex flex-wrap items-center gap-4">
                <img src={qrImage} alt="微信登录二维码" className="h-44 w-44 rounded-md border border-border bg-white p-1" />
                <p className="max-w-xs text-2xs leading-5 text-muted-foreground">用要连接的那个人的手机微信“扫一扫”，然后在手机上确认。二维码几分钟后会过期。</p>
              </div>
            ) : null}
            {login.state === 'need-verify' ? (
              <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); void submitCode(); }}>
                <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/gu, ''))} inputMode="numeric" placeholder="手机微信上显示的数字" className={`${inputClass} w-48`} />
                <button type="submit" className="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">提交</button>
              </form>
            ) : null}
            <button type="button" onClick={() => void weixin?.cancelLogin()} className={buttonClass}>取消</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {hasOwner ? (
              <input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} maxLength={20} placeholder="家人的称呼，比如 妈妈" className={`${inputClass} w-44`} />
            ) : null}
            <button type="button" onClick={() => void startLogin()} className={buttonClass}>{hasOwner ? '添加家人（扫码）' : '扫码登录（我自己）'}</button>
          </div>
        )}
        {feedback ? <p className="text-2xs text-primary">{feedback}</p> : null}
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-border bg-background/30 p-3">
        <span className="flex-1 space-y-1">
          <span className="block text-xs font-semibold text-foreground">开启微信连接</span>
          <span className="block text-2xs leading-5 text-muted-foreground">桌宠启动时自动连接，断了会自动重连。</span>
        </span>
        <SettingsToggleSwitch checked={settings.enabled} hideLabel label="开启微信连接" onChange={(checked) => updateWeixin(onCommit, { enabled: checked })} />
      </label>

      <label className="block space-y-1 rounded-sm border border-border bg-background/30 p-3">
        <span className="block text-xs font-semibold text-foreground">语音回复</span>
        <select
          className="w-full rounded-sm border border-border bg-background/60 px-3 py-2 text-xs text-foreground"
          value={settings.voiceReplyMode}
          onChange={(event) => updateWeixin(onCommit, { voiceReplyMode: event.target.value as WeixinBridgeSettings['voiceReplyMode'] })}
        >
          <option value="always">总是语音（适合不方便看字的家人）</option>
          <option value="mirror">跟着对方：发语音就回语音，或者让她发语音时</option>
          <option value="off">不发语音</option>
        </select>
        <span className="block text-2xs leading-5 text-muted-foreground">用角色自己的声音（角色音色包），以短视频的形式发过去，同时也发文字。</span>
      </label>

      <div className="space-y-2 rounded-sm border border-border bg-background/30 p-3 text-2xs leading-5 text-muted-foreground">
        <div className="text-xs font-semibold text-foreground">使用说明</div>
        <p>用微信官方的 ClawBot 通道在手机微信上跟角色聊天：每个人扫一次码就行，不用装电脑版微信。电脑和桌宠要开着。</p>
        <div className="pt-1 font-semibold text-foreground">第一次用</div>
        <p>1. 手机微信更新到最新（iOS 8.0.70 / 安卓 8.0.69 或更新），在 我 → 设置 → 插件 里能看到“微信ClawBot”。</p>
        <p>2. 先点“扫码登录（我自己）”，用你自己的手机微信扫码并确认；手机上要是显示一串数字，把它填进来。</p>
        <p>3. 家人要用的话：填上称呼（比如“妈妈”），点“添加家人（扫码）”，用家人的手机微信扫码。每个人扫一次。</p>
        <p>4. 在手机微信里给 ClawBot 发消息试试。以后桌宠启动会自动连上，不用再扫码。</p>
        <div className="pt-1 font-semibold text-foreground">你和家人有什么不同</div>
        <p>你（我自己）：跟在电脑聊天窗口里聊一样，聊天记录在聊天窗口里，她能帮你操作电脑，要确认的事会在微信里问你，回复“好”或“不要”就行。</p>
        <p>家人：每个人和她单独聊，互相看不到，也不进电脑的聊天窗口；她知道是谁在说话。为了安全，家人不能让她操作电脑。</p>
        <div className="pt-1 font-semibold text-foreground">能做什么</div>
        <p>文字来回发；她用自己的声音回复（短视频，点开就能听）；你发的图片她能看；发的语音由微信自动转成文字给她。</p>
        <div className="pt-1 font-semibold text-foreground">暂时不能</div>
        <p>不能在微信群里聊天（官方通道只支持一对一）；不能发微信语音条，也不能打语音或视频电话（官方通道不支持）。</p>
      </div>
    </section>
  );
}
