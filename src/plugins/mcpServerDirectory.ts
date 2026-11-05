import { connectsToHerBrowser } from './herBrowser';
import { isMcpServerEnabledForPet } from './pluginCapabilityAccess';

// Which MCP plugins are installed and what each lets her do, kept at hand so the `mcp` tool can
// name them in its description. Without that she only saw "用户接入的 MCP 扩展工具" and kept to
// the tools she knew (asked to read a web page with a browser plugin installed, she opened it
// in the user's browser and could not read it).

export interface McpServerDirectoryEntry {
  /** Launch arguments, to tell whether it works in her browser. */
  args: unknown[];
  description: string;
  id: string;
  title: string;
}

const REFRESH_MS = 30_000;
let entries: McpServerDirectoryEntry[] = [];
let refreshedAt = 0;
let pending: Promise<void> | null = null;

export function readMcpServerDirectory(config: unknown): McpServerDirectoryEntry[] {
  const raw = config && typeof config === 'object' ? config as Record<string, unknown> : {};
  const servers = raw.servers ?? raw.mcpServers;
  const list = Array.isArray(servers)
    ? servers.map((server) => [typeof server?.id === 'string' ? server.id : '', server] as const)
    : servers && typeof servers === 'object' ? Object.entries(servers as Record<string, unknown>) : [];
  return list.flatMap(([id, value]) => {
    const server = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    if (!id || server.disabled === true) return [];
    const text = (field: unknown) => (typeof field === 'string' ? field.trim() : '');
    return [{ args: Array.isArray(server.args) ? server.args : [], description: text(server.description), id, title: text(server.title) || id }];
  });
}

/** Re-reads the MCP config now and then; the description uses whatever was read last. */
export function refreshMcpServerDirectory(force = false) {
  if (pending || (!force && Date.now() - refreshedAt < REFRESH_MS)) return pending ?? Promise.resolve();
  const shell = typeof window !== 'undefined' ? window.desktopPetShell : undefined;
  if (!shell?.loadMcpConfig) return Promise.resolve();
  pending = shell.loadMcpConfig()
    .then((loaded) => {
      if (loaded?.ok) entries = readMcpServerDirectory(loaded.config);
      refreshedAt = Date.now();
    })
    .catch(() => undefined)
    .finally(() => { pending = null; });
  return pending;
}

/** "chrome-devtools（让她能…）" for each plugin this character may use; empty when none. */
export function describeMcpServersForPet(petId: string | null | undefined, list = entries) {
  return list
    .filter((entry) => isMcpServerEnabledForPet(entry.id, petId))
    .map((entry) => `${entry.id}${entry.description ? `（${entry.description}）` : entry.title !== entry.id ? `（${entry.title}）` : ''}`)
    .join('；');
}

/**
 * For plugins that work in her own browser: whose accounts are signed in there. Reading a
 * message page she once named the user as the signed-in account, because the user's name was
 * on a message in the list.
 */
export function describeHerBrowserAccounts(petId: string | null | undefined, port: number, list = entries) {
  const inHerBrowser = list.filter((entry) => isMcpServerEnabledForPet(entry.id, petId) && connectsToHerBrowser(entry.args, port));
  if (!inHerBrowser.length) return '';
  return `${inHerBrowser.map((entry) => entry.id).join('、')} 在你自己的浏览器里操作，网站上登录的是你自己的账号，不是用户的。要说登录的是谁，看页面顶部的头像或个人菜单；消息、评论、关注列表里出现的名字是别人（常常就是用户）。`;
}

void refreshMcpServerDirectory(true);
