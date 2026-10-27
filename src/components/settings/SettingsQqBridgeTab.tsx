import { useState } from 'react';
import type { PetConfig } from '../../types';
import { testOneBotConnection } from '../../qq-bridge/oneBotClient';
import { normalizeQqBridgeSettings, normalizeQqNumber, type QqBridgeSettings } from '../../qq-bridge/qqBridgeSettings';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';

// Phone QQ ⇄ the characters through a OneBot v11 service on this computer (SnowLuma, NapCat…).
// Saves immediately, like the ComfyUI page.

type CommitConfig = (updater: (config: PetConfig) => PetConfig) => unknown;

function updateQqBridge(commit: CommitConfig, patch: Partial<QqBridgeSettings>, accessToken?: string) {
  commit((config) => ({
    ...config,
    settings: {
      ...config.settings,
      ...(accessToken === undefined ? {} : { qqBridgeAccessToken: accessToken }),
      qqBridge: normalizeQqBridgeSettings({ ...config.settings.qqBridge, ...patch }),
    },
  }));
}

export function SettingsQqBridgeTab({ localConfig, onCommit }: { localConfig: PetConfig; onCommit: CommitConfig }) {
  const qq = normalizeQqBridgeSettings(localConfig.settings.qqBridge);
  const [wsUrl, setWsUrl] = useState(qq.wsUrl);
  const [ownerQq, setOwnerQq] = useState(qq.ownerQq);
  const [accessToken, setAccessToken] = useState(localConfig.settings.qqBridgeAccessToken ?? '');
  const [feedback, setFeedback] = useState('');
  const [testing, setTesting] = useState(false);

  const save = () => {
    updateQqBridge(onCommit, { ownerQq: normalizeQqNumber(ownerQq), wsUrl: wsUrl.trim() }, accessToken.trim());
    setFeedback('已保存。');
  };

  const test = async () => {
    setTesting(true);
    setFeedback('正在连接…');
    const result = await testOneBotConnection(wsUrl.trim(), accessToken.trim());
    setTesting(false);
    if ('account' in result) {
      updateQqBridge(onCommit, { ownerQq: normalizeQqNumber(ownerQq), wsUrl: wsUrl.trim() }, accessToken.trim());
      setFeedback(`连接成功：机器人账号 ${result.account}。已保存。`);
    } else {
      setFeedback(`连接失败：${result.error}`);
    }
  };

  const pickSnowLumaDir = async () => {
    const shell = window.desktopPetShell;
    if (!shell?.pickDirectory || !shell.snowLuma) {
      setFeedback('只能在桌面版里选择。');
      return;
    }
    const picked = await shell.pickDirectory('选择 SnowLuma 文件夹');
    if (!picked.ok || !picked.path) return;
    const inspected = await shell.snowLuma.inspect(picked.path);
    if (!inspected.ok) {
      setFeedback(inspected.error ?? '这个文件夹不对。');
      return;
    }
    updateQqBridge(onCommit, { snowLumaDir: picked.path });
    setFeedback('已选好 SnowLuma 文件夹。打开 QQ 连接后会在后台自动启动它。');
  };

  const openSnowLumaLog = async () => {
    const result = await window.desktopPetShell?.snowLuma?.openLog();
    if (result && !result.ok) setFeedback(result.error ?? '打不开日志。');
  };

  const inputClass = 'w-full rounded-sm border border-border bg-background/60 px-3 py-2 text-xs text-foreground';

  return (
    <section className="space-y-4 rounded-sm border border-border bg-secondary/20 p-4">
      <div>
        <div className="text-2xs font-bold uppercase tracking-widest text-primary">QQ 连接</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          在手机 QQ 上跟角色聊天：你给机器人小号发私信，就像在聊天窗口里打字一样，由当前的角色回复；她要做需要确认的事时，会在 QQ 里问你，回复“好”或“不要”就行。电脑和桌宠要开着。
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-border bg-background/30 p-3">
        <span className="flex-1 space-y-1">
          <span className="block text-xs font-semibold text-foreground">开启 QQ 连接</span>
          <span className="block text-2xs leading-5 text-muted-foreground">开启后桌宠会自动连接，断了会自动重连。</span>
        </span>
        <SettingsToggleSwitch
          checked={qq.enabled}
          hideLabel
          label="开启 QQ 连接"
          onChange={(checked) => updateQqBridge(onCommit, { enabled: checked })}
        />
      </label>

      <label className="block space-y-1 rounded-sm border border-border bg-background/30 p-3">
        <span className="block text-xs font-semibold text-foreground">语音回复</span>
        <select
          className={inputClass}
          value={qq.voiceReplyMode}
          onChange={(event) => updateQqBridge(onCommit, { voiceReplyMode: event.target.value as QqBridgeSettings['voiceReplyMode'] })}
        >
          <option value="mirror">跟着你：你发语音她回语音，或者你让她发语音时</option>
          <option value="always">总是语音</option>
          <option value="off">不发语音</option>
        </select>
        <span className="block text-2xs leading-5 text-muted-foreground">用角色自己的声音（角色音色包）发 QQ 语音，同时也发文字。你发来的语音会先在本机转成文字再交给她。</span>
      </label>

      <div className="space-y-3 rounded-sm border border-border bg-background/30 p-3">
        <div className="space-y-1">
          <span className="text-2xs font-bold text-muted-foreground">SnowLuma 文件夹（开启 QQ 连接时，桌宠会在后台自动启动它，不显示窗口）</span>
          <div className="flex gap-2">
            <input className={inputClass} readOnly value={qq.snowLumaDir} placeholder="点右边按钮选择解压好的 SnowLuma 文件夹" />
            <button type="button" className="shrink-0 rounded-sm border border-border px-3 py-1.5 text-xs hover:bg-secondary" onClick={() => { void pickSnowLumaDir(); }}>选择文件夹</button>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-3">
          <span className="flex-1 text-2xs leading-5 text-muted-foreground">开启 QQ 连接时自动在后台启动 SnowLuma；关掉开关或退出桌宠时，一起关掉它。电脑上的 QQ 要先用小号登录。</span>
          <SettingsToggleSwitch
            checked={qq.autoStartSnowLuma}
            hideLabel
            label="自动启动 SnowLuma"
            onChange={(checked) => updateQqBridge(onCommit, { autoStartSnowLuma: checked })}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="rounded-sm border border-border px-3 py-1.5 text-xs hover:bg-secondary" onClick={() => { void openSnowLumaLog(); }}>查看 SnowLuma 日志</button>
          <span className="text-2xs text-muted-foreground">第一次启动时的临时管理员密码也在日志里。</span>
        </div>
      </div>

      <div className="space-y-3 rounded-sm border border-border bg-background/30 p-3">
        <label className="block space-y-1">
          <span className="text-2xs font-bold text-muted-foreground">你的 QQ 号（只有这个号发来的私信才会回复）</span>
          <input className={inputClass} inputMode="numeric" value={ownerQq} onChange={(event) => setOwnerQq(event.target.value)} placeholder="例如 12345678" />
        </label>
        <label className="block space-y-1">
          <span className="text-2xs font-bold text-muted-foreground">OneBot 正向 WebSocket 地址</span>
          <input className={inputClass} value={wsUrl} onChange={(event) => setWsUrl(event.target.value)} placeholder="ws://127.0.0.1:3001" />
        </label>
        <label className="block space-y-1">
          <span className="text-2xs font-bold text-muted-foreground">Access Token（SnowLuma 里没设就留空）</span>
          <input className={inputClass} type="password" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="rounded-sm border border-border px-3 py-1.5 text-xs hover:bg-secondary" onClick={save}>保存</button>
          <button type="button" className="rounded-sm border border-primary/50 px-3 py-1.5 text-xs text-primary hover:bg-primary/10 disabled:opacity-50" disabled={testing} onClick={() => { void test(); }}>测试连接</button>
          {feedback ? <span className="text-2xs text-muted-foreground">{feedback}</span> : null}
        </div>
      </div>

      <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-2xs leading-5 text-amber-900">
        用 SnowLuma 这类工具登录 QQ 不是腾讯官方允许的方式，账号有被冻结的风险：请用小号，不要用主号。消息会经过腾讯的服务器，聊得越露骨，小号越容易出问题。
      </div>
    </section>
  );
}
