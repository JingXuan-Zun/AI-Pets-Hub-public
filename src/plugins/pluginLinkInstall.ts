import { parseMcpQuickAdd, type McpServerDraft } from './mcpQuickAdd';
import { missingMcpEnvKeys } from './mcpInstall';

// "Install this for me" with a GitHub link: what the link is, from a few files read before
// anything is installed. One of ours (plugin.json with id + kind) or a bare SKILL.md installs
// as a package; an MCP server (most of them) is set up from the configuration in its README.

export interface PluginLinkFiles {
  link: { owner: string; ref: string; repo: string; subPath: string; url: string };
  ok: true;
  packageJson?: string;
  pluginJson?: string;
  readme?: string;
  skillMd?: string;
}

interface PlanBase {
  description: string;
  name: string;
  url: string;
}

export type PluginLinkPlan =
  | PlanBase & { kind: 'package'; packageKind: 'mcp' | 'skill'; permissions: string[] }
  | PlanBase & { kind: 'mcp'; missingKeys: string[]; needs: string; servers: McpServerDraft[] }
  | PlanBase & { kind: 'unknown'; reason: string };

function parseObject(text: string | undefined): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text ?? '');
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** The README's opening sentence (after the title and badges). */
function firstParagraph(readme: string) {
  const line = readme.split(/\r?\n/u).map((item) => item.trim()).find((item) => item && !/^(?:#|!\[|\[!\[|<|```|>|\||-{3,}|={3,})/u.test(item));
  return (line ?? '').replace(/\*\*|`|\[([^\]]*)\]\([^)]*\)/gu, '$1').slice(0, 200);
}

/** Front matter `description:` of a SKILL.md. */
function skillDescription(skillMd: string) {
  return /^---[\s\S]*?\ndescription:\s*(.+)\n[\s\S]*?---/u.exec(skillMd)?.[1]?.trim().replace(/^["']|["']$/gu, '') ?? '';
}

/** What it needs installed on the computer, from how it starts. */
export function describeMcpNeeds(command: string) {
  const base = command.split(/[\\/]/u).pop()?.toLowerCase().replace(/\.(?:cmd|exe)$/u, '') ?? '';
  if (['npx', 'npm', 'node', 'pnpm', 'bunx', 'yarn'].includes(base)) return 'Node.js';
  if (['uvx', 'uv', 'python', 'python3', 'py', 'pipx'].includes(base)) return 'Python（uv）';
  if (base === 'docker') return 'Docker';
  if (!command) return '不用装（连接一个网上的服务）';
  return command;
}

const CODE_BLOCK = /```[^\n]*\n([\s\S]*?)```/gu;
const LAUNCH_LINE = /^\s*(?:npx|uvx|pnpm dlx|bunx)\s+.+$/gmu;

/** A real launch command (npx, uvx, python, a path…), not a stray word from a broken block. */
const COMMAND = /^(?:[A-Za-z]:)?[\w.\\/-]+$/u;
const usable = (servers: McpServerDraft[]) => servers.length > 0 && servers.every((server) => (server.url ? /^https?:\/\//u.test(server.url) : COMMAND.test(server.command)));

function isJsonObject(block: string) {
  try {
    const value: unknown = JSON.parse(block);
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  } catch {
    return false;
  }
}

/** The MCP setup in a README: its JSON configuration, or else a launch command for this package. */
export function findMcpSetup(readme: string, names: string[]) {
  const blocks = [...readme.matchAll(CODE_BLOCK)].map((match) => match[1]);
  const mentions = (servers: McpServerDraft[]) => servers.some((server) => names.some((name) => name && `${server.command} ${server.args.join(' ')} ${server.url}`.toLowerCase().includes(name.toLowerCase())));
  // Whole JSON objects only: READMEs also show fragments for other apps ("context_servers": […],)
  // that are not JSON and would otherwise be read as a command line.
  const parsed = blocks
    .filter((block) => /"(?:mcpServers|servers|command|url)"\s*:/u.test(block) && isJsonObject(block))
    .map((block) => parseMcpQuickAdd(block))
    .flatMap((result) => (result.ok && usable(result.servers) ? [result.servers] : []));
  const json = parsed.find(mentions) ?? parsed[0];
  if (json) return json;
  const lines = blocks.flatMap((block) => block.match(LAUNCH_LINE) ?? []).map((line) => parseMcpQuickAdd(line.trim()));
  const launches = lines.flatMap((result) => (result.ok && usable(result.servers) ? [result.servers] : []));
  return launches.find(mentions) ?? null;
}

export function planPluginLink(files: PluginLinkFiles): PluginLinkPlan {
  const url = files.link.url + (files.link.subPath ? `/tree/${files.link.ref}/${files.link.subPath}` : '');
  const plugin = parseObject(files.pluginJson);
  const npm = parseObject(files.packageJson);
  const skillName = files.skillMd ? /^---[\s\S]*?\nname:\s*(.+)\n[\s\S]*?---/u.exec(files.skillMd)?.[1]?.trim().replace(/^["']|["']$/gu, '') ?? '' : '';
  // A folder inside a bigger repository is named after the folder, not the repository.
  const name = str(plugin?.name) || str(npm?.name) || skillName || files.link.subPath.split('/').pop() || files.link.repo;
  const description = str(plugin?.description) || str(npm?.description) || (files.skillMd ? skillDescription(files.skillMd) : '') || firstParagraph(files.readme ?? '');
  // Ours: plugin.json with an id and a kind (other projects use plugin.json for other things).
  const kind = str(plugin?.kind);
  if (plugin && str(plugin.id) && (kind === 'skill' || kind === 'mcp')) {
    const permissions = Array.isArray(plugin.permissions) ? plugin.permissions.filter((item): item is string => typeof item === 'string') : [];
    return { description, kind: 'package', name, packageKind: kind, permissions, url };
  }
  if (files.skillMd) return { description, kind: 'package', name, packageKind: 'skill', permissions: ['read-instructions'], url };
  // A folder in a bigger repository is matched by its own name ("time"), not the repository's ("servers").
  const ownName = files.link.subPath.split('/').pop() || files.link.repo;
  const servers = files.readme ? findMcpSetup(files.readme, [ownName, str(npm?.name)]) : null;
  if (servers?.length) {
    return { description, kind: 'mcp', missingKeys: missingMcpEnvKeys(servers), name, needs: describeMcpNeeds(servers[0].command), servers, url };
  }
  return { description, kind: 'unknown', name, reason: '没找到插件说明（plugin.json / SKILL.md），说明文档里也没有 MCP 的启动配置，不知道怎么装。', url };
}
