// "Add an MCP tool" in one box, the way MCP READMEs give it: a command line
// (npx -y @modelcontextprotocol/server-filesystem D:\文档), a URL, or the JSON block
// ({ "mcpServers": { "name": { "command": … } } }, one server object, or several).

export interface McpServerDraft {
  args: string[];
  command: string;
  env: Record<string, string>;
  id: string;
  title: string;
  url: string;
}

export type McpQuickAddResult = { ok: true; servers: McpServerDraft[] } | { ok: false; error: string };

/** Splits a command line like a shell would for quotes; backslashes stay (Windows paths). */
export function splitCommandLine(line: string) {
  const parts: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let started = false;
  for (const char of line.trim()) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/u.test(char)) {
      if (started || current) parts.push(current);
      current = '';
      started = false;
    } else {
      current += char;
    }
  }
  if (started || current) parts.push(current);
  return parts;
}

/** A short id from what the server is: the package name without its scope and "server-"/"mcp-". */
export function suggestMcpServerId(command: string, args: string[], url = '') {
  if (url) {
    try {
      return toServerId(new URL(url).hostname.replace(/^(?:www|mcp|api)\./u, '').split('.')[0]);
    } catch {
      return 'remote-mcp';
    }
  }
  // Launchers (npx, uvx, node, python…) run the thing named in their first real argument.
  const launcher = /^(?:npx|npm|pnpm|bunx|bun|yarn|uvx|uv|pipx|node|python3?|py|deno)(?:\.cmd|\.exe)?$/iu.test(command.split(/[\\/]/u).pop() ?? '');
  const target = (launcher ? args.find((arg) => !arg.startsWith('-') && !/^(?:run|dlx|exec|x)$/iu.test(arg)) : undefined) ?? command;
  const unversioned = target.replace(/(.)@[\w.^~-]+$/u, '$1');
  const [scope, name] = unversioned.startsWith('@') && unversioned.includes('/')
    ? unversioned.slice(1).split('/')
    : ['', unversioned.split(/[\\/]/u).pop() ?? unversioned];
  const clean = (value: string) => toServerId(value.replace(/\.(?:js|mjs|py|exe|cmd)$/iu, '').replace(/^(?:mcp[-_])?server[-_]/iu, '').replace(/[-_]?mcp(?:[-_]server)?$/iu, '').replace(/^mcp[-_]/iu, ''));
  // "@playwright/mcp": the package is just "mcp", the scope says what it is.
  return clean(name) || clean(scope) || 'mcp-tool';
}

function toServerId(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '').slice(0, 40);
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === 'string')) as Record<string, string>;
}

function serverFromObject(id: string, raw: Record<string, unknown>): McpServerDraft | null {
  const command = typeof raw.command === 'string' ? raw.command.trim() : '';
  const url = typeof raw.url === 'string' ? raw.url.trim() : typeof raw.serverUrl === 'string' ? raw.serverUrl.trim() : '';
  if (!command && !/^https?:\/\//iu.test(url)) return null;
  const args = Array.isArray(raw.args) ? raw.args.filter((arg): arg is string => typeof arg === 'string') : [];
  const finalId = toServerId(id) || suggestMcpServerId(command, args, url);
  return { args: command ? args : [], command, env: stringRecord(raw.env), id: finalId, title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : finalId, url: command ? '' : url };
}

export function parseMcpQuickAdd(input: string, nameHint = ''): McpQuickAddResult {
  const text = input.trim().replace(/^```\w*\s*|```$/gu, '').trim();
  if (!text) return { error: '请贴上启动命令、网址，或 README 里的 JSON 配置。', ok: false };
  if (text.startsWith('{') || text.startsWith('[')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { error: 'JSON 格式不对：检查是不是少了括号或逗号（README 里的整段都复制进来）。', ok: false };
    }
    const root = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    const container = (root.mcpServers ?? root.servers ?? root.mcp ?? root) as unknown;
    const entries: Array<[string, unknown]> = Array.isArray(container)
      ? container.map((item, index) => [typeof (item as { id?: unknown })?.id === 'string' ? (item as { id: string }).id : `mcp-${index + 1}`, item])
      : container && typeof container === 'object' && ('command' in container || 'url' in container)
        ? [[nameHint || '', container]]
        : Object.entries(container as Record<string, unknown>);
    const servers = entries.flatMap(([id, raw]) => {
      const server = raw && typeof raw === 'object' ? serverFromObject(id, raw as Record<string, unknown>) : null;
      return server ? [server] : [];
    });
    return servers.length ? { ok: true, servers } : { error: '这段 JSON 里没找到服务器配置（需要 command 或 url）。', ok: false };
  }
  if (/^https?:\/\//iu.test(text)) {
    const id = toServerId(nameHint) || suggestMcpServerId('', [], text);
    return { ok: true, servers: [{ args: [], command: '', env: {}, id, title: id, url: text }] };
  }
  const [command, ...args] = splitCommandLine(text.replace(/\r?\n/gu, ' '));
  if (!command) return { error: '没看懂这一行命令。', ok: false };
  const id = toServerId(nameHint) || suggestMcpServerId(command, args);
  return { ok: true, servers: [{ args, command, env: {}, id, title: id, url: '' }] };
}

/** What a failed connection check means, in words a user can act on. */
export function explainMcpProblem(issueCode: string | undefined, command: string, detail = '') {
  const tail = detail.trim() ? `\n详细：${detail.trim().slice(-200)}` : '';
  switch (issueCode) {
    case 'runtime-missing':
      return `电脑上没有它需要的运行环境（多半是 Node.js 或 Python）。装好后重新测试：Node.js 在 https://nodejs.org 下载。${tail}`;
    case 'command-missing':
      return `找不到启动命令“${command}”：检查拼写，或者先安装它。${tail}`;
    case 'package-unavailable':
      return `下载这个工具包失败：检查网络（国内可以给 npm 设置镜像），然后重新测试。${tail}`;
    case 'permission-denied':
      return `被系统或安全软件拦住了：在安全软件里放行后重新测试。${tail}`;
    case 'startup-timeout':
      return `启动超时：第一次运行常常要先下载，等一会儿再点“重新测试”。${tail}`;
    case 'cwd-missing':
      return `它的工作文件夹不存在。${tail}`;
    default:
      return `启动后出错了，没拿到工具列表。${tail}`;
  }
}
