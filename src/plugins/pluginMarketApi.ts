import { activatePluginPackage, type PluginPackageManifest } from './pluginPackages';
import type { PluginPermission } from './pluginTypes';

// The online plugin market (services/plugin-market, a Cloudflare Worker over R2). Listing is a
// plain fetch; downloading, checking and installing happen in the main process, which verifies
// the zip against the catalog's checksum before anything is written.

const DEFAULT_PLUGIN_MARKET_API_URL = 'https://ai-desktop-pet-plugin-api.qianxuanlian.workers.dev';
export const PLUGIN_MARKET_API_URL: string = import.meta.env?.VITE_PLUGIN_MARKET_API_URL?.trim() || DEFAULT_PLUGIN_MARKET_API_URL;

export interface MarketPlugin {
  author: string;
  description: string;
  examples: string[];
  homepage: string;
  id: string;
  kind: 'skill' | 'mcp';
  name: string;
  permissions: PluginPermission[];
  publishedAt: string;
  requires: Array<{ install: string; name: string }>;
  sha256: string;
  size: number;
  useWhen: string;
  version: string;
}

let cached: { at: number; items: MarketPlugin[] } | null = null;
const CACHE_MS = 5 * 60_000;

export async function fetchMarketPlugins(force = false): Promise<{ ok: true; items: MarketPlugin[] } | { ok: false; error: string }> {
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return { items: cached.items, ok: true };
  try {
    const response = await fetch(`${PLUGIN_MARKET_API_URL}/plugins`, { signal: AbortSignal.timeout(15_000) });
    if (response.status === 429) return { error: '刷新太频繁了，过一分钟再试。', ok: false };
    if (!response.ok) return { error: `插件市场暂时打不开（${response.status}）。`, ok: false };
    const body = await response.json() as { items?: MarketPlugin[] };
    const items = Array.isArray(body.items) ? body.items : [];
    cached = { at: Date.now(), items };
    return { items, ok: true };
  } catch {
    return { error: '连不上插件市场：检查网络，国内网络可能需要代理。', ok: false };
  }
}

/** Every word of the query appears in the plugin's name, description or "when to use". */
export function matchesMarketQuery(plugin: MarketPlugin, query: string) {
  const haystack = [plugin.id, plugin.name, plugin.description, plugin.useWhen, ...plugin.examples].join(' ').normalize('NFKC').toLowerCase();
  return query.normalize('NFKC').toLowerCase().split(/\s+/u).filter(Boolean).every((word) => haystack.includes(word));
}

export async function installMarketPlugin(plugin: Pick<MarketPlugin, 'id' | 'sha256'>, petId: string) {
  const bridge = window.desktopPetShell?.plugins;
  if (!bridge?.installMarket) return { error: '当前环境不能安装插件（需要桌面版）。', ok: false as const };
  const result = await bridge.installMarket(`${PLUGIN_MARKET_API_URL}/plugins/${encodeURIComponent(plugin.id)}/download`, plugin.sha256);
  return activatePluginPackage(result as { ok: true; manifest: PluginPackageManifest } | { ok: false; error: string }, petId);
}

export async function publishPluginPackage(packageId: string) {
  const bridge = window.desktopPetShell?.plugins;
  if (!bridge?.publish) return { error: '当前环境不能发布插件。', ok: false as const };
  return bridge.publish(packageId, PLUGIN_MARKET_API_URL);
}
