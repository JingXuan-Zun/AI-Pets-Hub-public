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

const SETTING_KEY = /^[A-Za-z][A-Za-z0-9_]{0,40}$/u;
const SETTING_KINDS = new Set(['boolean', 'choice', 'number', 'text']);
const ENV_NAME = /^[A-Z][A-Z0-9_]{0,60}$/u;
// Settings the character may read and change: never secrets (the settings manifest refuses them too).
const SECRET_WORDS = /key|token|secret|password|密钥|令牌|密码/iu;

/** The plugin's own settings (see docs/plugin-format.md); invalid entries are dropped. */
function pluginSettings(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((item) => {
    const key = text(item?.key, 41);
    const kind = text(item?.kind, 10);
    const label = text(item?.label, 40);
    if (!SETTING_KEY.test(key) || !SETTING_KINDS.has(kind) || !label || SECRET_WORDS.test(key) || SECRET_WORDS.test(label)) return null;
    const choices = kind === 'choice' && Array.isArray(item.choices)
      ? item.choices.slice(0, 20).map((choice) => ({ label: text(choice?.label, 40) || text(choice?.value, 40), value: text(choice?.value, 60) })).filter((choice) => choice.value)
      : [];
    if (kind === 'choice' && !choices.length) return null;
    const min = Number(item.range?.min);
    const max = Number(item.range?.max);
    const range = kind === 'number' && Number.isFinite(min) && Number.isFinite(max) && min <= max ? { max, min } : null;
    const fallback = kind === 'boolean' ? item.default === true
      : kind === 'number' ? (Number.isFinite(Number(item.default)) ? Number(item.default) : range?.min ?? 0)
        : kind === 'choice' ? (choices.some((choice) => choice.value === item.default) ? item.default : choices[0].value)
          : text(item.default, 200);
    const env = text(item.env, 61);
    return {
      choices,
      default: fallback,
      env: ENV_NAME.test(env) ? env : '',
      forModel: text(item.forModel, 200),
      key,
      kind,
      label,
      range,
      risk: item.risk === 'change' ? 'change' : 'personal',
    };
  }).filter(Boolean);
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
      settings: pluginSettings(raw.settings),
      setup: textList(raw.setup, 12),
      skill,
      troubleshooting: textList(raw.troubleshooting, 12),
      useWhen: text(raw.useWhen, 300),
      version: text(raw.version, 30) || '0.1.0',
    },
  };
}

module.exports = { ID_PATTERN, MANIFEST_FILE, SKILL_FILE, normalizePluginManifest, readFrontMatter, toId };
