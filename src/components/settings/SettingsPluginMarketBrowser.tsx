import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, Search, Store } from 'lucide-react';
import { fetchMarketPlugins, installMarketPlugin, matchesMarketQuery, type MarketPlugin } from '../../plugins/pluginMarketApi';
import { listPluginPackages } from '../../plugins/pluginPackages';
import { PLUGIN_PERMISSION_LABELS } from '../../plugins/pluginTypes';

/** The online plugin market: browse what others published (after review) and install it. */
export function SettingsPluginMarketBrowser({ currentPetId, petName, onInstalled }: {
  currentPetId: string;
  petName: string;
  onInstalled: (message: string) => void;
}) {
  const [items, setItems] = useState<MarketPlugin[]>([]);
  const [installed, setInstalled] = useState<Map<string, string>>(new Map());
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setStatus('正在读取插件市场…');
    const [market, packages] = await Promise.all([fetchMarketPlugins(force), listPluginPackages()]);
    setInstalled(new Map(packages.map((pack) => [pack.id, pack.version])));
    if (!market.ok) { setStatus('error' in market ? market.error : ''); return; }
    setItems(market.items);
    setStatus(market.items.length ? '' : '市场里还没有插件。');
  }, []);

  useEffect(() => { void load(); }, [load]);

  const install = async (plugin: MarketPlugin) => {
    const permissions = plugin.permissions.map((permission) => PLUGIN_PERMISSION_LABELS[permission]).join('、');
    if (!window.confirm(`安装「${plugin.name}」v${plugin.version}？\n它需要：${permissions}\n作者：${plugin.author || '未填'}`)) return;
    setBusyId(plugin.id);
    const result = await installMarketPlugin(plugin, currentPetId);
    setBusyId(null);
    if (result.ok) {
      onInstalled(`已安装「${plugin.name}」v${plugin.version}，并为${petName}开启。`);
      void load();
    } else {
      setStatus(`安装失败：${'error' in result ? result.error : ''}`);
    }
  };

  const shown = query.trim() ? items.filter((plugin) => matchesMarketQuery(plugin, query)) : items;
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Store className="h-4 w-4 text-primary" />在线插件市场</div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜插件，例如 画画、天气" className="h-8 w-52 rounded-md border border-border bg-background pl-8 pr-2 text-xs outline-none focus:border-primary" />
          </div>
          <button type="button" onClick={() => void load(true)} title="刷新" className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <p className="mt-1 text-2xs text-muted-foreground">这里的插件都经过审核才公开。安装前会告诉你它要哪些权限。</p>
      {status ? <p className="mt-3 text-xs text-muted-foreground">{status}</p> : null}
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {shown.map((plugin) => {
          const have = installed.get(plugin.id);
          const label = !have ? '安装' : have === plugin.version ? '已安装' : `更新到 v${plugin.version}`;
          return (
            <article key={plugin.id} className="rounded-md border border-border bg-muted/10 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h4 className="text-sm font-semibold text-foreground">{plugin.name}</h4>
                    <span className="rounded-full border border-border px-1.5 py-0.5 text-2xs text-muted-foreground">{plugin.kind === 'mcp' ? 'MCP 工具' : '技能'}</span>
                    <span className="text-2xs text-muted-foreground">v{plugin.version}{plugin.author ? ` · ${plugin.author}` : ''}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{plugin.description}</p>
                </div>
                <button
                  type="button"
                  disabled={busyId !== null || have === plugin.version}
                  onClick={() => void install(plugin)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-2xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
                >
                  <Download className="h-3.5 w-3.5" />{busyId === plugin.id ? '安装中…' : label}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {plugin.permissions.map((permission) => (
                  <span key={permission} className="rounded bg-muted/60 px-1.5 py-0.5 text-2xs text-foreground/80">{PLUGIN_PERMISSION_LABELS[permission]}</span>
                ))}
                {plugin.requires.length ? <span className="text-2xs text-muted-foreground">需要先装：{plugin.requires.map((item) => item.name).join('、')}</span> : null}
                <span className="ml-auto text-2xs text-muted-foreground">{Math.max(1, Math.round(plugin.size / 1024))} KB</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
