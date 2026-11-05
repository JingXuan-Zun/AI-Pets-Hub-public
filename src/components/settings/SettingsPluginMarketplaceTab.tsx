import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ensureHerBrowser } from '../../plugins/herBrowser';
import { ArrowLeft, ChevronRight, ExternalLink, FolderOpen, Github, Package, Trash2, Upload } from 'lucide-react';
import { readAgentSkillImportFile } from '../../agent/agentSkillArchiveImport';
import { installAgentImportedSkills } from '../../agent/agentSkillImportInstallation';
import { getDesktopPetSlot } from '../../multiPetRoster';
import { listInstalledPlugins, uninstallSkillPlugin } from '../../plugins/pluginCatalog';
import { installPluginFromFolder, installPluginFromGitHub, uninstallPluginPackage, updateMcpServers } from '../../plugins/pluginPackages';
import { publishPluginPackage } from '../../plugins/pluginMarketApi';
import { SettingsPluginMarketBrowser } from './SettingsPluginMarketBrowser';
import { SettingsPluginPackageSettings } from './SettingsPluginPackageSettings';
import { SettingsMcpQuickAdd } from './SettingsMcpQuickAdd';
import { forgetPluginRoleAccess, isPluginEnabledForPet, setPluginEnabledForPet } from '../../plugins/pluginRoleAccess';
import { PLUGIN_KIND_LABELS, PLUGIN_PERMISSION_LABELS, type PluginManifest } from '../../plugins/pluginTypes';
import type { PetConfig } from '../../types';
import { openSettingsPage } from '../chat/hub/settingsPageRequest';
import type { SettingsControlCenterPageId } from './settingsControlCenterNavigation';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';

interface SettingsPluginMarketplaceTabProps {
  config?: PetConfig;
  currentPetId: string;
  /** Navigates inside the settings window; the chat hub opens the settings window instead. */
  onOpenPage?: (pageId: SettingsControlCenterPageId) => void;
  /** The plugin's own settings, shown on its page (settings window only). */
  renderSettings?: (pageId: SettingsControlCenterPageId) => ReactNode;
  /** The chat window's page: only what is installed; installing happens in the settings window. */
  installedOnly?: boolean;
  /** Opens this plugin's own page (a link to an old page such as “QQ 连接” lands here). */
  focusedPlugin?: { id: string; nonce: number } | null;
}

interface PluginViewProps {
  plugin: PluginManifest;
  petId: string;
  petName: string;
  onChanged: (message: string) => void;
}

function StatusBadges({ plugin }: { plugin: PluginManifest }) {
  return (
    <>
      <span className="rounded-full border border-border px-2 py-0.5 text-2xs text-muted-foreground">{PLUGIN_KIND_LABELS[plugin.kind]}</span>
      <span className={`rounded-full px-2 py-0.5 text-2xs ${plugin.status.ready ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}>
        {plugin.status.ready ? '可用' : '待设置'}
      </span>
    </>
  );
}

function RoleSwitch({ plugin, petId, petName, onChanged }: PluginViewProps) {
  if (!plugin.roleScoped) return <span className="shrink-0 text-2xs text-muted-foreground">所有角色共用</span>;
  return (
    <SettingsToggleSwitch
      checked={isPluginEnabledForPet(plugin.id, petId, plugin.enabledByDefault)}
      label={`给${petName}用`}
      onChange={(next) => {
        setPluginEnabledForPet(plugin.id, petId, next);
        onChanged(`已为${petName}${next ? '开启' : '关闭'}「${plugin.name}」。`);
      }}
    />
  );
}

function Permissions({ plugin }: { plugin: PluginManifest }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-2xs text-muted-foreground">需要：</span>
      {plugin.permissions.map((permission) => (
        <span key={permission} className="rounded-md bg-muted/60 px-1.5 py-0.5 text-2xs text-foreground/80">{PLUGIN_PERMISSION_LABELS[permission]}</span>
      ))}
      <span className="ml-auto text-2xs text-muted-foreground">来源：{plugin.source}</span>
    </div>
  );
}

function PluginCard({ onOpen, ...props }: PluginViewProps & { onOpen: () => void }) {
  const { plugin } = props;
  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-wrap items-center gap-2 text-left">
          <h3 className="text-sm font-semibold text-foreground hover:text-primary">{plugin.name}</h3>
          <StatusBadges plugin={plugin} />
        </button>
        <RoleSwitch {...props} />
      </div>
      <button type="button" onClick={onOpen} className="mt-2 block w-full text-left">
        <p className="text-xs leading-5 text-muted-foreground">{plugin.description}</p>
        {plugin.status.note ? <p className="mt-1 text-2xs leading-5 text-amber-700">{plugin.status.note}</p> : null}
      </button>
      <div className="mt-3"><Permissions plugin={plugin} /></div>
      <button type="button" onClick={onOpen} className="mt-3 inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-2xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
        设置与说明<ChevronRight className="h-3.5 w-3.5" />
      </button>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h4 className="text-xs font-bold text-foreground">{title}</h4>
      <div className="mt-2 text-xs leading-5 text-muted-foreground">{children}</div>
    </section>
  );
}

/** One plugin's own page: what it does, what it needs, and its settings in place. */
function PluginDetail({ onBack, onOpenPage, renderSettings, settings, ...props }: PluginViewProps & {
  onBack: () => void;
  onOpenPage: (pageId: SettingsControlCenterPageId) => void;
  renderSettings?: (pageId: SettingsControlCenterPageId) => ReactNode;
  settings?: PetConfig['settings'];
}) {
  const { plugin, onChanged } = props;
  const removable = plugin.kind === 'skill' || plugin.kind === 'mcp' || Boolean(plugin.packageId);
  const publish = async () => {
    if (!plugin.packageId) return;
    if (!window.confirm(`把「${plugin.name}」上传到插件市场？审核通过后所有人都能下载。上传的是这个插件文件夹里的全部文件，请确认里面没有你的私人信息或密钥。`)) return;
    const result = await publishPluginPackage(plugin.packageId);
    onChanged(result.ok ? `已上传「${plugin.name}」，等待审核。` : `上传失败：${'error' in result ? result.error : ''}`);
  };
  const uninstall = async () => {
    if (!window.confirm(`卸载「${plugin.name}」？所有角色都会不能再用它。`)) return;
    if (plugin.packageId) {
      const result = await uninstallPluginPackage({ id: plugin.packageId, kind: plugin.kind === 'mcp' ? 'mcp' : 'skill' });
      if (!result.ok) { onChanged(`卸载失败：${result.error ?? ''}`); return; }
    } else if (plugin.kind === 'mcp') {
      const serverId = plugin.id.replace(/^mcp:/u, '');
      await updateMcpServers((servers) => servers.filter((server) => server.id !== serverId));
      forgetPluginRoleAccess(plugin.id);
    } else {
      uninstallSkillPlugin(plugin.id);
    }
    onChanged(`已卸载「${plugin.name}」。`);
    onBack();
  };
  const embedded = plugin.settingsPageId && plugin.kind !== 'skill' ? renderSettings?.(plugin.settingsPageId) : null;
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />插件市场
      </button>
      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-foreground">{plugin.name}</h3>
            <StatusBadges plugin={plugin} />
          </div>
          <RoleSwitch {...props} />
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{plugin.description}</p>
        {plugin.status.note ? <p className="mt-1 text-2xs leading-5 text-amber-700">{plugin.status.note}</p> : null}
        <div className="mt-3"><Permissions plugin={plugin} /></div>
      </section>

      {plugin.useWhen || plugin.examples?.length ? (
        <Section title="什么时候用">
          {plugin.useWhen ? <p>{plugin.useWhen}</p> : null}
          {plugin.examples?.length ? <p className="mt-1">可以这样跟角色说：{plugin.examples.map((example) => `“${example}”`).join('、')}</p> : null}
        </Section>
      ) : null}

      {plugin.requires?.length ? (
        <Section title="需要先装好">
          <ul className="space-y-1">{plugin.requires.map((item) => <li key={item.name}>· {item.name}{item.install ? `：${item.install}` : ''}</li>)}</ul>
        </Section>
      ) : null}

      {plugin.setup?.length ? (
        <Section title="怎么设置">
          <ol className="list-decimal space-y-1 pl-4">{plugin.setup.map((step) => <li key={step}>{step}</li>)}</ol>
        </Section>
      ) : null}

      {plugin.troubleshooting?.length ? (
        <Section title="常见问题">
          <ul className="space-y-1">{plugin.troubleshooting.map((tip) => <li key={tip}>· {tip}</li>)}</ul>
        </Section>
      ) : null}

      {plugin.usesHerBrowser && settings ? (
        <Section title="她的浏览器">
          <p>这个插件在她自己的浏览器里操作（和你平时用的 Chrome 分开，登录信息、记录都不互通）。第一次用前，打开它，把她的账号登录好，以后会一直记着。</p>
          <button
            type="button"
            onClick={() => void ensureHerBrowser(settings).then((result) => onChanged(result.ok ? '她的浏览器已经打开，可以在里面登录她的账号。' : `打不开她的浏览器：${result.error}`))}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
          >
            <ExternalLink className="h-3.5 w-3.5" />打开她的浏览器
          </button>
        </Section>
      ) : null}

      {plugin.packageId ? <SettingsPluginPackageSettings packageId={plugin.packageId} onChanged={onChanged} /> : null}

      {plugin.readme ? (
        <Section title="技能说明（SKILL.md）">
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted/30 p-3 font-sans text-2xs leading-5">{plugin.readme}</pre>
        </Section>
      ) : null}

      {embedded ? (
        <div>
          <h4 className="mb-2 text-xs font-bold text-foreground">设置</h4>
          {embedded}
        </div>
      ) : plugin.settingsPageId && plugin.kind !== 'skill' ? (
        <button type="button" onClick={() => onOpenPage(plugin.settingsPageId!)} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
          <ExternalLink className="h-3.5 w-3.5" />打开设置
        </button>
      ) : null}

      {plugin.packageId ? (
        <button type="button" onClick={() => void publish()} className="mr-2 inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
          <Upload className="h-3.5 w-3.5" />发布到插件市场
        </button>
      ) : null}
      {removable ? (
        <button type="button" onClick={() => void uninstall()} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-red-700">
          <Trash2 className="h-3.5 w-3.5" />卸载这个插件
        </button>
      ) : null}
    </div>
  );
}

/**
 * The plugin market. Installed plugins of every kind (built-in features, imported skills, MCP
 * servers) in one list, each turned on per character; clicking one opens its own page with its
 * settings. The online market comes later.
 */
export function SettingsPluginMarketplaceTab({ config, currentPetId, focusedPlugin = null, installedOnly = false, onOpenPage = openSettingsPage, renderSettings }: SettingsPluginMarketplaceTabProps) {
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [importing, setImporting] = useState(false);
  const [version, setVersion] = useState(0);
  const [githubUrl, setGithubUrl] = useState('');
  const [showMcpAdd, setShowMcpAdd] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const petName = (config && getDesktopPetSlot(config, currentPetId)?.personality.name.trim()) || '当前角色';
  const settings = config?.settings;

  useEffect(() => {
    if (!settings) return undefined;
    let active = true;
    void listInstalledPlugins(settings).then((list) => { if (active) setPlugins(list); });
    return () => { active = false; };
  }, [settings, version]);

  useEffect(() => {
    if (focusedPlugin) setSelectedId(focusedPlugin.id);
  }, [focusedPlugin]);

  const changed = useCallback((message: string) => {
    setFeedback(message);
    setVersion((value) => value + 1);
  }, []);

  const importSkill = async (file: File) => {
    setImporting(true);
    setFeedback('正在读取技能文件…');
    try {
      const preview = await readAgentSkillImportFile(file);
      installAgentImportedSkills(window.localStorage, currentPetId, preview);
      changed(`已安装 ${preview.skills.length} 个技能，并为${petName}开启。${preview.warnings.join('；')}`);
    } catch (error) {
      setFeedback(`安装失败：${error instanceof Error ? error.message : '无法读取文件。'}`);
    } finally {
      setImporting(false);
    }
  };

  const finishInstall = (result: Awaited<ReturnType<typeof installPluginFromFolder>>) => {
    if (result.ok) changed(`已安装「${result.manifest.name}」v${result.manifest.version}，并为${petName}开启。`);
    else setFeedback(`安装失败：${'error' in result ? result.error : ''}`);
  };
  const installFromFolder = async () => {
    const picked = await window.desktopPetShell?.pickDirectory?.('选择插件文件夹（里面有 plugin.json 或 SKILL.md）');
    if (!picked?.ok || !picked.path) return;
    setImporting(true);
    setFeedback('正在安装…');
    try { finishInstall(await installPluginFromFolder(picked.path, currentPetId)); } finally { setImporting(false); }
  };
  const installFromGitHub = async () => {
    if (!githubUrl.trim()) return;
    setImporting(true);
    setFeedback('正在从 GitHub 下载…');
    try {
      const result = await installPluginFromGitHub(githubUrl.trim(), currentPetId);
      finishInstall(result);
      if (result.ok) setGithubUrl('');
    } finally { setImporting(false); }
  };

  const selected = plugins.find((plugin) => plugin.id === selectedId);
  if (selected) {
    return (
      <PluginDetail
        plugin={selected}
        petId={currentPetId}
        petName={petName}
        onChanged={changed}
        onBack={() => setSelectedId(null)}
        onOpenPage={onOpenPage}
        renderSettings={renderSettings}
        settings={config?.settings}
      />
    );
  }

  return (
    <div className="m-0 space-y-4">
      {installedOnly ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-xs leading-5 text-muted-foreground">
            <span className="font-semibold text-foreground">{petName}</span> 已装的插件：开关只影响这个角色。点插件看说明和设置。
          </p>
          <button type="button" onClick={() => onOpenPage('extension-plugins')} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
            <Package className="h-3.5 w-3.5" />安装更多插件
          </button>
          {feedback ? <p className="w-full text-2xs text-primary">{feedback}</p> : null}
        </section>
      ) : (
      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-5 text-muted-foreground">
            正在为 <span className="font-semibold text-foreground">{petName}</span> 设置：开关只影响这个角色，切换角色后分别设置。点插件进入它的设置和说明。
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".zip,.json,.md,.markdown,text/plain,application/json,application/zip" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importSkill(file); event.currentTarget.value = ''; }} />
            <button type="button" disabled={importing} onClick={() => void installFromFolder()} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60">
              <FolderOpen className="h-3.5 w-3.5" />{importing ? '安装中…' : '从文件夹安装'}
            </button>
            <button type="button" disabled={importing} onClick={() => fileInputRef.current?.click()} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60">
              <Upload className="h-3.5 w-3.5" />安装技能（SKILL.md / ZIP）
            </button>
            {/* All three are plain buttons; only the MCP one opens a panel, and it is highlighted while open. */}
            <button type="button" aria-pressed={showMcpAdd} onClick={() => setShowMcpAdd((value) => !value)} className={showMcpAdd
              ? 'inline-flex h-8 items-center gap-1.5 rounded-md border border-primary bg-primary/10 px-3 text-xs font-semibold text-primary'
              : 'inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground'}>
              <Package className="h-3.5 w-3.5" />添加 MCP 工具
            </button>
          </div>
        </div>
        <form className="mt-3 flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); void installFromGitHub(); }}>
          <Github className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} placeholder="GitHub 链接，例如 https://github.com/作者/仓库 或 …/tree/main/插件文件夹" className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-xs outline-none focus:border-primary" />
          <button type="submit" disabled={importing || !githubUrl.trim()} className="h-8 shrink-0 rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">安装</button>
        </form>
        {feedback ? <p className="mt-2 text-2xs text-primary">{feedback}</p> : null}
      </section>
      )}

      {showMcpAdd && !installedOnly ? (
        <SettingsMcpQuickAdd onAdded={changed} settings={config?.settings} renderAdvanced={renderSettings ? () => renderSettings('platform-mcp') : undefined} />
      ) : null}

      {!settings ? (
        <p className="py-8 text-center text-xs text-muted-foreground">正在读取设置…</p>
      ) : (
        <div className={installedOnly ? 'grid gap-3' : 'grid gap-3 lg:grid-cols-2'}>
          {plugins.map((plugin) => (
            <PluginCard key={plugin.id} plugin={plugin} petId={currentPetId} petName={petName} onChanged={changed} onOpen={() => setSelectedId(plugin.id)} />
          ))}
        </div>
      )}

      {installedOnly ? null : <SettingsPluginMarketBrowser currentPetId={currentPetId} petName={petName} onInstalled={changed} />}
    </div>
  );
}
