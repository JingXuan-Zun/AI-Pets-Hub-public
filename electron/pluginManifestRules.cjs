// plugin.json rules shared by the app (electron/pluginPackageManifest.cjs) and the plugin market
// Worker (services/plugin-market): no file system here, so both run the same checks.

const MANIFEST_FILE = 'plugin.json';
const SKILL_FILE = 'SKILL.md';
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,62}$/u;
const KINDS = new Set(['skill', 'mcp']);
const PERMISSIONS = new Set(['read-instructions', 'run-program', 'network', 'send-messages', 'credentials', 'change-computer']);

function text(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function textList(value, maxItems = 12, max = 300) {
  return Array.isArray(value) ? value.map((item) => text(item, max)).filter(Boolean).slice(0, maxItems) : [];
}

function toId(value) {
  return String(value ?? '').normalize('NFKC').trim().toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '').slice(0, 63);
}

function readFrontMatter(markdown) {
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---/u.exec(markdown);
  const fields = {};
  if (match) {
    for (const line of match[1].split(/\r?\n/u)) {
      const field = /^([A-Za-z_-]+)\s*:\s*(.*)$/u.exec(line);
      if (field) fields[field[1].toLowerCase()] = field[2].trim().replace(/^["']|["']$/gu, '');
    }
  }
  const heading = /^#\s+(.+)$/mu.exec(markdown.slice(match ? match[0].length : 0));
  return { description: fields.description || '', name: fields.name || '', title: heading ? heading[1].trim() : '' };
}

function mcpEntry(value) {
  if (!value || typeof value !== 'object') return null;
  const url = text(value.url, 500);
  const command = text(value.command, 200);
  if (!url && !command) return null;
  const env = value.env && typeof value.env === 'object' && !Array.isArray(value.env)
    ? Object.fromEntries(Object.entries(value.env).filter(([, item]) => typeof item === 'string').slice(0, 30))
    : {};
  return { args: textList(value.args, 40, 500), command, env, url };
}

/** Checks a parsed plugin.json; returns { manifest } or { error } in words a user understands. */
function normalizePluginManifest(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'plugin.json 不是一个 JSON 对象。' };
  const id = text(raw.id, 63);
  if (!ID_PATTERN.test(id)) return { error: `插件 id“${id}”不合格：只能用小写字母、数字、点、横线和下划线，2～63 个字符。` };
  const kind = text(raw.kind, 20);
  if (!KINDS.has(kind)) return { error: `不支持的插件类型“${kind}”：目前支持 skill（技能）和 mcp（工具服务器）。` };
  const name = text(raw.name, 60);
  const description = text(raw.description, 300);
  if (!name || !description) return { error: 'plugin.json 需要 name（名字）和 description（一句话说明）。' };
  const skill = kind === 'skill' ? { file: text(raw.skill?.file, 200) || SKILL_FILE } : null;
  const mcp = kind === 'mcp' ? mcpEntry(raw.mcp) : null;
  if (kind === 'mcp' && !mcp) return { error: 'mcp 插件需要写 mcp.command（启动命令）或 mcp.url（服务地址）。' };
  const permissions = textList(raw.permissions, 10, 40).filter((item) => PERMISSIONS.has(item));
  return {
    manifest: {
      author: text(raw.author, 80),
      description,
      examples: textList(raw.examples, 8, 120),
      homepage: text(raw.homepage, 300),
      id,
      kind,
      manifestVersion: 1,
      mcp,
      name,
      permissions: permissions.length ? permissions : (kind === 'skill' ? ['read-instructions'] : ['run-program']),
      requires: Array.isArray(raw.requires) ? raw.requires.slice(0, 10).map((item) => ({
        install: text(item?.install, 300),
        name: text(item?.name, 60),
      })).filter((item) => item.name) : [],
      setup: textList(raw.setup, 12),
      skill,
      troubleshooting: textList(raw.troubleshooting, 12),
      useWhen: text(raw.useWhen, 300),
      version: text(raw.version, 30) || '0.1.0',
    },
  };
}

module.exports = { ID_PATTERN, MANIFEST_FILE, SKILL_FILE, normalizePluginManifest, readFrontMatter, toId };
