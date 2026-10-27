import { useEffect, useRef, useState } from 'react';
import type { PetConfig } from '../../types';
import {
  CLAUDE_MODEL_CHOICES,
  DEV_AGENT_COMPATIBLE_PRESETS,
  findCompatiblePreset,
  resolveCompatibleBlocker,
  resolveDevAgentLaunch,
} from '../../dev-agent/devAgentProviders';
import { normalizeAllowedCommands, normalizeDevAgentSettings, type DevAgentSettings, type DevAgentWorkspace } from '../../dev-agent/devAgentSettings';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';

/** The commands a project lets the assistant run, edited as one line and saved on leaving it. */
function AllowedCommandsInput({ className, onSave, value }: { className: string; onSave: (commands: string[]) => void; value: string[] }) {
  const saved = value.join('；');
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);
  return (
    <input
      className={className}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onSave(normalizeAllowedCommands(draft))}
      placeholder="允许它运行的检查命令，用分号隔开，如 npm test；npx tsc --noEmit（留空 = 不能运行命令）"
      title="只能运行以这些开头的命令，用来检查自己的改动；不能用 & | > 之类的符号"
    />
  );
}

// The development assistant: the characters hand coding work to Claude Code, which works in
// one of the project folders listed here, on the user's Claude account or another provider's
// Claude-compatible endpoint. Saves immediately, like the ComfyUI page.

type CommitConfig = (updater: (config: PetConfig) => PetConfig) => unknown;

const LOGIN_POLL_MS = 3000;
const LOGIN_WAIT_MS = 5 * 60 * 1000;

function updateDevAgent(commit: CommitConfig, patch: Partial<DevAgentSettings>, apiKey?: string) {
  commit((config) => ({
    ...config,
    settings: {
      ...config.settings,
      ...(apiKey === undefined ? {} : { devAgentApiKey: apiKey }),
      devAgent: normalizeDevAgentSettings({ ...config.settings.devAgent, ...patch }),
    },
  }));
}

export function SettingsDevAgentTab({ localConfig, onCommit }: { localConfig: PetConfig; onCommit: CommitConfig }) {
  const settings = normalizeDevAgentSettings(localConfig.settings.devAgent);
  const preset = findCompatiblePreset(settings.compatiblePreset);
  const [draftName, setDraftName] = useState('');
  const [draftPath, setDraftPath] = useState('');
  const [executablePath, setExecutablePath] = useState(settings.executablePath);
  const [baseUrl, setBaseUrl] = useState(settings.compatibleBaseUrl);
  const [model, setModel] = useState(settings.compatibleModel);
  const [apiKey, setApiKey] = useState(localConfig.settings.devAgentApiKey ?? '');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const loginWatchRef = useRef<number | null>(null);
  const bridge = typeof window !== 'undefined' ? window.desktopPetShell?.devAgent : undefined;

  useEffect(() => () => { if (loginWatchRef.current !== null) window.clearInterval(loginWatchRef.current); }, []);

  const addWorkspace = () => {
    const name = draftName.trim();
    const path = draftPath.trim();
    if (!name || !path) {
      setFeedback('项目名和文件夹路径都要填。');
      return;
    }
    const workspace: DevAgentWorkspace = { allowedCommands: [], id: `workspace-${Date.now().toString(36)}`, name, path };
    updateDevAgent(onCommit, { workspaces: [...settings.workspaces, workspace] });
    setDraftName('');
    setDraftPath('');
    setFeedback(`已添加项目“${name}”。`);
  };

  /** Native folder picker; the folder name becomes the project name when none is typed yet. */
  const pickWorkspaceFolder = async () => {
    const picked = await window.desktopPetShell?.pickDirectory?.('选择项目文件夹');
    if (!picked?.ok || !picked.path) return;
    setDraftPath(picked.path);
    if (!draftName.trim()) setDraftName(picked.path.split(/[\\/]/u).filter(Boolean).pop() ?? '');
  };

  const saveCompatible = () => {
    updateDevAgent(onCommit, { compatibleBaseUrl: baseUrl.trim(), compatibleModel: model.trim(), executablePath: executablePath.trim() }, apiKey.trim());
  };

  /** Account: `auth status` (free). Compatible endpoint: one tiny request with the key. */
  const check = async () => {
    if (!bridge) {
      setFeedback('只能在桌面版里检查。');
      return;
    }
    setBusy(true);
    try {
      saveCompatible();
      const current = normalizeDevAgentSettings({ ...settings, compatibleBaseUrl: baseUrl.trim(), compatibleModel: model.trim() });
      const blocker = resolveCompatibleBlocker(current, apiKey);
      if (blocker) {
        setFeedback(blocker);
        return;
      }
      setFeedback(current.provider === 'compatible' ? '正在用这个 Key 发一个很小的请求…' : '正在检查登录状态…');
      const status = await bridge.status({ env: resolveDevAgentLaunch(current, apiKey).env, executablePath: executablePath.trim(), probeLogin: true });
      if (!status.installed) setFeedback('没找到 Claude Code：请安装它，或在下面填 claude.exe 的路径。');
      else if (!status.loggedIn) setFeedback(current.provider === 'compatible' ? `用不了：${status.error ?? '未知原因'}` : '还没登录 Claude 账号，点“一键登录”。');
      else setFeedback(`可以用了（Claude Code ${status.version ?? ''}）。`);
    } finally {
      setBusy(false);
    }
  };

  /** Opens the sign-in window (it opens the browser), then watches until the account is signed in. */
  const login = async () => {
    if (!bridge) {
      setFeedback('只能在桌面版里登录。');
      return;
    }
    const opened = await bridge.login({ executablePath: executablePath.trim() });
    if (!opened.ok) {
      setFeedback(`没能打开登录：${opened.error ?? '未知原因'}`);
      return;
    }
    setFeedback('已打开登录窗口：在弹出的浏览器页面里登录你的 Claude 账号并点同意。登录好了这里会自动显示。');
    if (loginWatchRef.current !== null) window.clearInterval(loginWatchRef.current);
    const startedAt = Date.now();
    loginWatchRef.current = window.setInterval(() => {
      void bridge.status({ executablePath: executablePath.trim(), probeLogin: true }).then((status) => {
        if (status.loggedIn) {
          setFeedback('登录成功，开发助手可以用了。');
        } else if (Date.now() - startedAt < LOGIN_WAIT_MS) {
          return;
        } else {
          setFeedback('还没检测到登录。登录完成后点“检查”。');
        }
        if (loginWatchRef.current !== null) window.clearInterval(loginWatchRef.current);
        loginWatchRef.current = null;
      });
    }, LOGIN_POLL_MS);
  };

  const inputClass = 'w-full rounded-sm border border-border bg-background/60 px-3 py-2 text-xs text-foreground';
  const buttonClass = 'rounded-sm border border-border px-3 py-1.5 text-xs hover:bg-secondary disabled:opacity-50';
  const primaryButtonClass = 'rounded-sm border border-primary/50 px-3 py-1.5 text-xs text-primary hover:bg-primary/10 disabled:opacity-50';

  return (
    <section className="space-y-4 rounded-sm border border-border bg-secondary/20 p-4">
      <div>
        <div className="text-2xs font-bold uppercase tracking-widest text-primary">开发助手</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          让角色把写代码、改项目文件的活交给 Claude Code：比如跟她说“帮我把翻滚的无敌时间改成 0.3 秒”，她会先问你确认，然后交给开发助手在你的项目文件夹里改，做完用她自己的话告诉你改了什么。它只能改文件，不能自己运行命令。
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-border bg-background/30 p-3">
        <span className="flex-1 space-y-1">
          <span className="block text-xs font-semibold text-foreground">开启开发助手</span>
          <span className="block text-2xs leading-5 text-muted-foreground">每次交任务前都会先问你确认；一次只做一件事。</span>
        </span>
        <SettingsToggleSwitch checked={settings.enabled} hideLabel label="开启开发助手" onChange={(checked) => updateDevAgent(onCommit, { enabled: checked })} />
      </label>

      <div className="space-y-3 rounded-sm border border-border bg-background/30 p-3">
        <div className="text-2xs font-bold text-muted-foreground">用哪个服务</div>
        <div className="flex flex-wrap gap-2">
          {([['claude-account', 'Claude 账号（订阅额度）'], ['compatible', '其他服务商（按量付费）']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={settings.provider === value ? primaryButtonClass : buttonClass}
              onClick={() => updateDevAgent(onCommit, { provider: value })}
            >
              {label}
            </button>
          ))}
        </div>

        {settings.provider === 'claude-account' ? (
          <div className="space-y-3">
            <p className="text-2xs leading-5 text-muted-foreground">
              用你自己的 Claude 账号，占用订阅额度。第一次需要登录一次：点“一键登录”，会弹出一个小窗口并打开浏览器，在网页里登录、点同意就好。桌面版 Claude 已经登录也要再登一次（两边分开记）。
            </p>
            <label className="block space-y-1">
              <span className="text-2xs font-bold text-muted-foreground">模型</span>
              <select className={inputClass} value={settings.claudeModel} onChange={(event) => updateDevAgent(onCommit, { claudeModel: event.target.value as DevAgentSettings['claudeModel'] })}>
                {CLAUDE_MODEL_CHOICES.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={primaryButtonClass} onClick={() => { void login(); }}>一键登录</button>
              <button type="button" disabled={busy} className={buttonClass} onClick={() => { void check(); }}>检查</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-2xs leading-5 text-muted-foreground">
              用其他服务商提供的“Claude 兼容接口”，按它们的价格收费，不占 Claude 额度。选好服务商，点“获取 Key”到它的网站上创建一个 API Key，粘贴到下面。
            </p>
            <label className="block space-y-1">
              <span className="text-2xs font-bold text-muted-foreground">服务商</span>
              <select className={inputClass} value={settings.compatiblePreset} onChange={(event) => updateDevAgent(onCommit, { compatiblePreset: event.target.value as DevAgentSettings['compatiblePreset'] })}>
                {DEV_AGENT_COMPATIBLE_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-2xs font-bold text-muted-foreground">接口地址{preset.baseUrl ? '（留空用默认）' : ''}</span>
              <input className={inputClass} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder={preset.baseUrl || 'https://…/anthropic'} />
            </label>
            <label className="block space-y-1">
              <span className="text-2xs font-bold text-muted-foreground">模型{preset.defaultModel ? '（留空用默认）' : ''}</span>
              <input className={inputClass} list="dev-agent-models" value={model} onChange={(event) => setModel(event.target.value)} placeholder={preset.defaultModel || '模型名'} />
              <datalist id="dev-agent-models">{preset.models.map((item) => <option key={item} value={item} />)}</datalist>
            </label>
            <label className="block space-y-1">
              <span className="text-2xs font-bold text-muted-foreground">API Key（加密保存，不进备份）</span>
              <input className={inputClass} type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              {preset.keyPageUrl ? (
                <button type="button" className={primaryButtonClass} onClick={() => { void bridge?.openKeyPage(preset.keyPageUrl); }}>获取 Key（打开 {preset.label} 网站）</button>
              ) : null}
              <button type="button" className={buttonClass} onClick={() => { saveCompatible(); setFeedback('已保存。'); }}>保存</button>
              <button type="button" disabled={busy} className={buttonClass} onClick={() => { void check(); }}>测试</button>
            </div>
          </div>
        )}
        {feedback ? <p className="text-2xs leading-5 text-primary">{feedback}</p> : null}
      </div>

      <div className="space-y-3 rounded-sm border border-border bg-background/30 p-3">
        <div className="text-2xs font-bold text-muted-foreground">项目文件夹（开发助手只能在这里面改东西）</div>
        {settings.workspaces.length ? (
          <ul className="space-y-1.5">
            {settings.workspaces.map((item) => (
              <li key={item.id} className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-24 shrink-0 font-semibold text-foreground">{item.name}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground" title={item.path}>{item.path}</span>
                  <button
                    type="button"
                    className="shrink-0 rounded-sm border border-border px-2 py-1 text-2xs hover:bg-secondary"
                    onClick={() => updateDevAgent(onCommit, { workspaces: settings.workspaces.filter((entry) => entry.id !== item.id) })}
                  >
                    删除
                  </button>
                </div>
                <AllowedCommandsInput
                  className={inputClass}
                  value={item.allowedCommands}
                  onSave={(allowedCommands) => updateDevAgent(onCommit, {
                    workspaces: settings.workspaces.map((entry) => (entry.id === item.id ? { ...entry, allowedCommands } : entry)),
                  })}
                />
              </li>
            ))}
          </ul>
        ) : <p className="text-2xs text-muted-foreground">还没有项目。</p>}
        <div className="grid gap-2 sm:grid-cols-[8rem_1fr_auto_auto]">
          <input className={inputClass} value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="项目名，如 动作游戏" />
          <input className={inputClass} value={draftPath} onChange={(event) => setDraftPath(event.target.value)} placeholder="文件夹路径，如 D:\ue5\CombatLab" />
          <button type="button" className={buttonClass} onClick={() => { void pickWorkspaceFolder(); }}>选择文件夹</button>
          <button type="button" className={buttonClass} onClick={addWorkspace}>添加</button>
        </div>
      </div>

      <div className="space-y-3 rounded-sm border border-border bg-background/30 p-3">
        <label className="block space-y-1">
          <span className="text-2xs font-bold text-muted-foreground">claude.exe 路径（可选；留空会自动找）</span>
          <input className={inputClass} value={executablePath} onChange={(event) => setExecutablePath(event.target.value)} onBlur={() => updateDevAgent(onCommit, { executablePath: executablePath.trim() })} placeholder="留空自动查找" />
        </label>
        <label className="block space-y-1">
          <span className="text-2xs font-bold text-muted-foreground">一个任务最多等多少分钟</span>
          <input
            className={inputClass}
            type="number"
            min={1}
            max={60}
            value={settings.timeoutMinutes}
            onChange={(event) => updateDevAgent(onCommit, { timeoutMinutes: Number(event.target.value) })}
          />
        </label>
      </div>
    </section>
  );
}
