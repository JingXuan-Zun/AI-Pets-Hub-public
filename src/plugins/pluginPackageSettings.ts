import { parseAgentExternalSkillLibraryJson, serializeAgentExternalSkillLibrary } from '../agent/agentExternalSkillLibrary';
import { pushFrontendRuntimeError } from '../frontendRuntimeLogger';
import { replaceSettings, type SettingDefinition, type SettingValue } from '../settings-manifest/settingsManifest';
import { listPluginPackages, skillSourceForPackage, updateMcpServers, type PluginPackageManifest, type PluginPackageSetting } from './pluginPackages';

// Settings a third-party plugin declares in plugin.json (“默认城市”“温度单位”…). The values are
// kept here, in this computer's storage, and reach the plugin the way its kind can read them:
// an MCP plugin as environment variables when its server starts (restarted after a change), a
// skill as a short “用户的设置” note at the end of its instructions. They join the settings
// manifest as plugin.<id>.<key>, so the character can find and change them like any other.

const STORAGE_KEY = 'desktop-pet.plugin-settings.v1';
const ID_PREFIX = 'plugin.';
const SKILL_NOTE_START = '\n\n<!-- 用户的设置（桌宠自动维护） -->';

type Stored = Record<string, Record<string, SettingValue>>;

function readStore(): Stored {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Stored : {};
  } catch {
    return {};
  }
}

function writeStore(store: Stored) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Not saved: the plugin keeps its defaults.
  }
}

export function readPluginSettingValues(manifest: Pick<PluginPackageManifest, 'id' | 'settings'>) {
  const saved = readStore()[manifest.id] ?? {};
  return Object.fromEntries((manifest.settings ?? []).map((setting) => [setting.key, saved[setting.key] ?? setting.default]));
}

function describeValue(setting: PluginPackageSetting, value: SettingValue) {
  if (setting.kind === 'boolean') return value ? '开' : '关';
  if (setting.kind === 'choice') return setting.choices.find((choice) => choice.value === value)?.label ?? String(value);
  return String(value);
}

/** The environment an MCP plugin's server starts with: its own env plus its settings. */
export function pluginServerEnv(manifest: PluginPackageManifest) {
  const values = readPluginSettingValues(manifest);
  const fromSettings = Object.fromEntries((manifest.settings ?? []).filter((setting) => setting.env).map((setting) => [setting.env, String(values[setting.key])]));
  return { ...(manifest.mcp?.env ?? {}), ...fromSettings };
}

/** A skill's instructions with its settings note at the end (replacing an older note). */
export function withSkillSettingsNote(instructions: string, manifest: PluginPackageManifest) {
  const base = instructions.split(SKILL_NOTE_START)[0];
  const settings = manifest.settings ?? [];
  if (!settings.length) return base;
  const values = readPluginSettingValues(manifest);
  const lines = settings.map((setting) => `- ${setting.label}：${describeValue(setting, values[setting.key])}`);
  return `${base}${SKILL_NOTE_START}\n用户的设置（按这些来）：\n${lines.join('\n')}`;
}

/** Makes the plugin see its current settings (after install or a change). */
export async function applyPluginSettings(manifest: PluginPackageManifest) {
  if (!manifest.settings?.length) return;
  if (manifest.kind === 'mcp' && manifest.mcp && !manifest.mcp.url) {
    const env = pluginServerEnv(manifest);
    await updateMcpServers((servers) => servers.map((server) => (server.id === manifest.id ? { ...server, env } : server)));
    await window.desktopPetShell?.resetMcpSession?.({ serverId: manifest.id }).catch(() => undefined);
    return;
  }
  if (manifest.kind === 'skill') {
    const library = parseAgentExternalSkillLibraryJson(window.localStorage.getItem('desktop-pet.agent-external-skills.v1'));
    const skills = library.skills.map((skill) => (skill.sourceName === skillSourceForPackage(manifest.id)
      ? { ...skill, instructions: withSkillSettingsNote(skill.instructions, manifest) }
      : skill));
    window.localStorage.setItem('desktop-pet.agent-external-skills.v1', serializeAgentExternalSkillLibrary({ ...library, skills }));
  }
}

/** Saves one value (from the settings page or the character) and hands it to the plugin. */
export function setPluginSettingValue(manifest: PluginPackageManifest, key: string, value: SettingValue) {
  const store = readStore();
  writeStore({ ...store, [manifest.id]: { ...(store[manifest.id] ?? {}), [key]: value } });
  void applyPluginSettings(manifest).catch((error) => pushFrontendRuntimeError('plugins', 'plugin setting not applied', error));
}

function definitionFor(manifest: PluginPackageManifest, setting: PluginPackageSetting): SettingDefinition {
  return {
    choices: setting.choices,
    forModel: setting.forModel || `插件「${manifest.name}」的设置。`,
    group: manifest.name,
    id: `${ID_PREFIX}${manifest.id}.${setting.key}`,
    kind: setting.kind,
    label: setting.label,
    pageId: 'extension-plugins',
    range: setting.range ?? undefined,
    read: () => readPluginSettingValues(manifest)[setting.key],
    risk: setting.risk,
    // The value is stored here and handed to the plugin; the app config itself does not change.
    write: (config, value) => {
      setPluginSettingValue(manifest, setting.key, value);
      return config;
    },
  };
}

/** Puts the installed plugins' settings into the settings manifest (call before finding or changing settings). */
export async function refreshPluginSettings() {
  const packages = await listPluginPackages();
  replaceSettings(ID_PREFIX, packages.flatMap((manifest) => (manifest.settings ?? []).map((setting) => definitionFor(manifest, setting))));
  return packages;
}
