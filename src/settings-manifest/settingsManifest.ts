import type { PetConfig } from '../types';

// The settings manifest (docs/settings-manifest-design.md): a setting is declared once — what it
// is, how the user would ask for it, its values, whether changing it needs a yes — and the
// character can then find and change it through two tools (settings.find / settings.set)
// instead of one hand-written capability per feature. Plugins bring their settings the same way.
// Secrets never go in: ids and labels that look like keys, tokens, passwords, paths or
// addresses are refused when registered.

export type SettingValue = boolean | number | string;

export interface SettingChoice {
  label: string;
  value: string;
}

export interface SettingDefinition {
  /** 'weixin.voiceReplyMode' */
  id: string;
  /** Group shown to the user and searched: '微信连接'. */
  group: string;
  /** '语音回复' */
  label: string;
  /** For the model: when to use it and how people ask for it. */
  forModel: string;
  kind: 'boolean' | 'choice' | 'number' | 'text';
  /** Fixed choices, or ones that depend on the config (e.g. imported workflows). */
  choices?: SettingChoice[] | ((config: PetConfig) => SettingChoice[]);
  range?: { max: number; min: number; step?: number };
  /** Formats a number for her answer: '15 分钟'. */
  format?: (value: SettingValue) => string;
  /** personal: looks / own habits, changed at once. change: alters what she does, asks first. */
  risk: 'change' | 'personal';
  /** The settings page with this setting, to open it for the user. */
  pageId?: string;
  read: (config: PetConfig) => SettingValue;
  write: (config: PetConfig, value: SettingValue) => PetConfig;
  /** After a change: anything the user still has to do (“还没登录微信…”). */
  afterChange?: (config: PetConfig, value: SettingValue) => string;
  /** Her reply ends right after the change (it switches the chat model, so no further round). */
  endsReply?: boolean;
}

const SECRET_WORDS = /key|token|secret|password|path|url|address|密钥|令牌|密码|路径|地址/iu;
const registry = new Map<string, SettingDefinition>();
const MAX_TEXT_VALUE = 200;

export function registerSettings(definitions: SettingDefinition[]) {
  definitions.forEach((definition) => {
    if (SECRET_WORDS.test(definition.id) || SECRET_WORDS.test(definition.label)) {
      throw new Error(`设置清单不能收录看起来像密钥、地址或路径的设置：${definition.id}`);
    }
    registry.set(definition.id, definition);
  });
}

/** Replaces every setting whose id starts with the prefix (a plugin's settings after it changed or went away). */
export function replaceSettings(prefix: string, definitions: SettingDefinition[]) {
  [...registry.keys()].filter((id) => id.startsWith(prefix)).forEach((id) => registry.delete(id));
  registerSettings(definitions);
}

export function listSettings() {
  return [...registry.values()];
}

export function getSetting(id: string) {
  return registry.get(id) ?? null;
}

export function settingChoices(definition: SettingDefinition, config: PetConfig) {
  return typeof definition.choices === 'function' ? definition.choices(config) : definition.choices ?? [];
}

export function describeSettingValue(definition: SettingDefinition, config: PetConfig, value: SettingValue) {
  if (definition.kind === 'boolean') return value ? '开' : '关';
  if (definition.kind === 'choice') return settingChoices(definition, config).find((choice) => choice.value === value)?.label ?? String(value);
  return definition.format ? definition.format(value) : String(value);
}

/** One line per setting for her: id, name, current value and what it can be set to. */
export function describeSettingForModel(definition: SettingDefinition, config: PetConfig) {
  const current = describeSettingValue(definition, config, definition.read(config));
  const options = definition.kind === 'boolean' ? '可设 true/false'
    : definition.kind === 'choice' ? `可选 ${settingChoices(definition, config).map((choice) => `${choice.value}（${choice.label}）`).join(' / ')}`
      : definition.kind === 'text' ? '可填一段文字'
        : definition.range ? `范围 ${definition.range.min}～${definition.range.max}` : '';
  return `${definition.id}｜${definition.group} · ${definition.label}：现在 ${current}；${options}${definition.risk === 'change' ? '；改之前要问用户' : ''}。${definition.forModel}`;
}

function terms(text: string) {
  const words = text.toLowerCase().match(/[a-z0-9]+|[一-鿿]/gu) ?? [];
  return new Set(words);
}

/**
 * The settings that best match what the user said (keyword overlap with group, name and the
 * ways people ask). With no match the whole list comes back: it is short enough to read.
 */
export function findSettings(query: string, limit = 6) {
  const all = listSettings();
  const wanted = terms(query);
  if (!wanted.size) return all;
  const scored = all.map((definition) => {
    const haystack = terms(`${definition.group} ${definition.label} ${definition.forModel} ${definition.id}`);
    let score = 0;
    wanted.forEach((term) => { if (haystack.has(term)) score += 1; });
    return { definition, score };
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
  return scored.length ? scored.slice(0, limit).map((entry) => entry.definition) : all;
}

/** Turns what the model sent into a valid value, or says why it is not one. */
export function parseSettingValue(definition: SettingDefinition, config: PetConfig, raw: unknown): { error: string } | { value: SettingValue } {
  if (definition.kind === 'boolean') {
    if (typeof raw === 'boolean') return { value: raw };
    const text = String(raw ?? '').trim().toLowerCase();
    if (['true', 'on', '开', '开启', '打开', '1'].includes(text)) return { value: true };
    if (['false', 'off', '关', '关闭', '0'].includes(text)) return { value: false };
    return { error: '要填 true 或 false。' };
  }
  if (definition.kind === 'choice') {
    const text = String(raw ?? '').trim();
    const choices = settingChoices(definition, config);
    const match = choices.find((choice) => choice.value === text) ?? choices.find((choice) => choice.label === text);
    return match ? { value: match.value } : { error: `可选的只有：${choices.map((choice) => choice.label).join('、')}。` };
  }
  if (definition.kind === 'text') {
    const text = String(raw ?? '').trim();
    return text.length <= MAX_TEXT_VALUE ? { value: text } : { error: `太长了，最多 ${MAX_TEXT_VALUE} 个字。` };
  }
  const number = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim());
  if (!Number.isFinite(number)) return { error: '要填一个数字。' };
  const { max, min } = definition.range ?? { max: number, min: number };
  return { value: Math.min(max, Math.max(min, number)) };
}
