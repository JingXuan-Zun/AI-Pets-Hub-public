import { useState } from 'react';
import type { PetConfig } from '../../types';
import { testOneBotConnection } from '../../qq-bridge/oneBotClient';
import { normalizeQqBridgeSettings, normalizeQqNumber, QQ_ONEBOT_PROVIDER_LABELS, usesSnowLumaHelpers, type QqBridgeSettings, type QqOneBotProvider } from '../../qq-bridge/qqBridgeSettings';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';

// Phone QQ ⇄ the characters through a OneBot v11 service on this computer (NapCat, LLBot, SnowLuma…).
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
    // No token typed in: use the one SnowLuma set for its server (a fresh install always has one).
    const detected = !accessToken.trim() && usesSnowLumaHelpers(qq)
      ? await window.desktopPetShell?.snowLuma?.wsToken?.({ dir: qq.snowLumaDir, ownerQq: normalizeQqNumber(ownerQq), wsUrl: wsUrl.trim() })
      : undefined;
    const result = await testOneBotConnection(wsUrl.trim(), accessToken.trim() || (detected?.found ? detected.token ?? '' : ''));
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

  const openSnowLumaWebui = async () => {
    const snowLuma = window.desktopPetShell?.snowLuma;
    if (!snowLuma?.openWebui) {
      setFeedback('只能在桌面版里打开。');
      return;
    }
    const result = await snowLuma.openWebui(qq.snowLumaDir);
    setFeedback(result.ok ? `已在浏览器打开 ${result.url}（SnowLuma 要先启动）` : result.error ?? '打不开管理页。');
  };

  const openDownload = async (target: 'qq' | 'napcat') => {
    const result = await window.desktopPetShell?.snowLuma?.openDownload?.(target);
    if (!result) setFeedback('只能在桌面版里打开。');
    else if (!result.ok) setFeedback(result.error ?? '打不开下载页。');
    else setFeedback(target === 'napcat'
      ? '已打开 NapCat 下载页：Windows 下载名字带 Shell 和 OneKey 的 zip（一键包），解压后按下面的步骤来。'
      : '已打开电脑版 QQ 下载页：安装后用小号登录。');
  };

  const [credentials, setCredentials] = useState<string | null>(null);
  const showInitialCredentials = async () => {
    const result = await window.desktopPetShell?.snowLuma?.initialCredentials?.();
    setCredentials(result?.ok && result.password
      ? `用户名 ${result.user}　密码 ${result.password}`
      : '没找到初始密码：说明你已经改过密码了，用你自己设的密码登录。（忘了的话，删掉 SnowLuma 文件夹里的 config\\webui.json 再重启 SnowLuma，会重新生成一个。）');
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

      <label className="block space-y-1 rounded-sm border border-border bg-background/30 p-3">
        <span className="block text-xs font-semibold text-foreground">用哪个 QQ 工具</span>
        <select
          className={inputClass}
          value={qq.provider}
          onChange={(event) => updateQqBridge(onCommit, { provider: event.target.value as QqOneBotProvider })}
        >
          {(['napcat', 'other', 'snowluma'] as const).map((id) => <option key={id} value={id}>{QQ_ONEBOT_PROVIDER_LABELS[id]}</option>)}
        </select>
        <span className="block text-2xs leading-5 text-muted-foreground">桌宠通过通用的 OneBot v11 接口收发消息，这几个工具都能用，聊天、语音、图片、在 QQ 里确认都一样。</span>
      </label>

      {qq.provider === 'napcat' ? (
        <div className="space-y-3 rounded-sm border border-border bg-background/30 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xs font-bold text-muted-foreground">第一次用：</span>
            <button type="button" className="rounded-sm border border-border px-3 py-1.5 text-xs hover:bg-secondary" onClick={() => { void openDownload('qq'); }}>下载电脑版 QQ</button>
            <button type="button" className="rounded-sm border border-border px-3 py-1.5 text-xs hover:bg-secondary" onClick={() => { void openDownload('napcat'); }}>下载 NapCat</button>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-2xs leading-5 text-muted-foreground">
            <li>装好电脑版 QQ。下载 NapCat 的 Windows 一键包（名字带 Shell、OneKey），解压到一个文件夹。</li>
            <li>运行里面的启动脚本，它会单独开一个 QQ，用<b>小号</b>扫码登录。窗口里会打印 WebUI 地址和登录 Token。</li>
            <li>打开 WebUI（一般是 http://127.0.0.1:6099/webui），在“网络配置”里新建一个 <b>WebSocket 服务器</b>：地址 127.0.0.1、端口 3001，设一个 Token，启用并保存。</li>
            <li>把同一个 Token 填到下面的 Access Token，地址填 ws://127.0.0.1:3001，点“测试连接”，再打开上面的“开启 QQ 连接”。</li>
          </ol>
          <p className="text-2xs leading-5 text-muted-foreground">NapCat 要你自己启动（桌宠暂时不会自动启动它），关掉它的窗口 QQ 连接就断了，重新打开后桌宠会自动重连。</p>
        </div>
      ) : null}

      {qq.provider === 'other' ? (
        <div className="rounded-sm border border-border bg-background/30 p-3 text-2xs leading-5 text-muted-foreground">
          在你用的工具里开启 OneBot v11 的<b>正向 WebSocket</b>（也叫 WebSocket 服务器 / WS Server），地址 127.0.0.1，记下端口和 Token，填到下面。工具要你自己启动。
        </div>
      ) : null}

      {qq.provider === 'snowluma' ? (
      <div className="space-y-3 rounded-sm border border-border bg-background/30 p-3">
        <p className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-2xs leading-5 text-amber-900">
          SnowLuma 在 2026 年 11 月收到腾讯律师函后停止公开发布，以后不会再更新，QQ 升级后可能就用不了了。已经装好的可以先接着用，新装建议换成 NapCat。
        </p>
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
          <button type="button" className="rounded-sm border border-primary/50 px-3 py-1.5 text-xs text-primary hover:bg-primary/10" onClick={() => { void openSnowLumaWebui(); }}>打开 SnowLuma 管理页</button>
          <button type="button" className="rounded-sm border border-border px-3 py-1.5 text-xs hover:bg-secondary" onClick={() => { void showInitialCredentials(); }}>显示初始密码</button>
          <button type="button" className="rounded-sm border border-border px-3 py-1.5 text-xs hover:bg-secondary" onClick={() => { void openSnowLumaLog(); }}>查看 SnowLuma 日志</button>
        </div>
        {credentials ? (
          <p className="select-text rounded-sm border border-border bg-background/60 px-3 py-2 text-xs text-foreground">
            {credentials}
            <span className="mt-1 block text-2xs text-muted-foreground">登录管理页后请马上改密码；不改的话，下次启动 SnowLuma 会换一个新的初始密码。</span>
          </p>
        ) : null}
        <ol className="list-decimal space-y-1 pl-5 text-2xs leading-5 text-muted-foreground">
          <li>电脑版 QQ 先打开（QQ 版本 9.9.21 或更新），选好 SnowLuma 文件夹，再打开上面的“开启 QQ 连接”。</li>
          <li>点“打开 SnowLuma 管理页”，用“显示初始密码”里的账号密码登录，按提示改密码。</li>
          <li>在管理页里把服务加载到<b>小号</b>的 QQ 上。之后每次重新打开桌面 QQ，都要再加载一次。</li>
        </ol>
        <p className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-2xs leading-5 text-amber-900">
          电脑上同时开着你的大号 QQ 时，不要打开 SnowLuma 的“自动加载 / 自动挂钩”，它会挂到所有 QQ 上，包括大号。（就算挂错了，桌宠发现登录的是你自己的 QQ 号也会自动断开。）
        </p>
      </div>
      ) : null}

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
          <span className="text-2xs font-bold text-muted-foreground">{qq.provider === 'snowluma' ? 'Access Token（一般留空：选了 SnowLuma 文件夹就会自动读取它的 Token）' : 'Access Token（和 QQ 工具里设的一样；没设就留空）'}</span>
          <input className={inputClass} type="password" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="rounded-sm border border-border px-3 py-1.5 text-xs hover:bg-secondary" onClick={save}>保存</button>
          <button type="button" className="rounded-sm border border-primary/50 px-3 py-1.5 text-xs text-primary hover:bg-primary/10 disabled:opacity-50" disabled={testing} onClick={() => { void test(); }}>测试连接</button>
          {feedback ? <span className="text-2xs text-muted-foreground">{feedback}</span> : null}
        </div>
      </div>

      <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-2xs leading-5 text-amber-900">
        用 NapCat、SnowLuma 这类工具登录 QQ 不是腾讯官方允许的方式，账号有被冻结的风险：请用小号，不要用主号。消息会经过腾讯的服务器，聊得越露骨，小号越容易出问题。
      </div>
    </section>
  );
}
