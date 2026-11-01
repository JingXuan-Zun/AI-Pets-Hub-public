import { loadExternalAgentMcpConfig } from '../agent/agentExternalMcpBridge';
import {
  parseAgentExternalSkillLibraryJson,
  removeAgentExternalSkillFromLibrary,
  serializeAgentExternalSkillLibrary,
  type AgentExternalSkillDefinition,
} from '../agent/agentExternalSkillLibrary';
import { readAgentSkillMarkdownMetadata } from '../agent/agentSkillMarkdownMetadata';
import type { PetConfig } from '../types';
import { forgetPluginRoleAccess } from './pluginRoleAccess';
import { listPluginPackages, packageIdFromSkillSource, type PluginPackageManifest } from './pluginPackages';
import type { SettingsControlCenterPageId } from '../components/settings/settingsControlCenterNavigation';
import type { PluginManifest, PluginPermission } from './pluginTypes';
import comfyUiPlugin from './builtin/comfyui.plugin.json';
import qqBridgePlugin from './builtin/qq-bridge.plugin.json';
import devAgentPlugin from './builtin/dev-agent.plugin.json';
import weixinBridgePlugin from './builtin/weixin-bridge.plugin.json';

// Every installed plugin as one list: imported skills, the user's MCP servers and the features
// built into the pet that work like plugins. Each source keeps its own storage; this only
// describes them the same way (compatibility layers, design doc §3).

const SKILL_LIBRARY_KEY = 'desktop-pet.agent-external-skills.v1';

function readSkillLibrary() {
  try {
    return parseAgentExternalSkillLibraryJson(window.localStorage.getItem(SKILL_LIBRARY_KEY));
  } catch {
    return parseAgentExternalSkillLibraryJson(null);
  }
}

function describeSkill(skill: AgentExternalSkillDefinition): PluginManifest {
  const metadata = readAgentSkillMarkdownMetadata(skill.instructions);
  const description = (metadata.description || (skill.description === '---' ? '' : skill.description))
    .replace(/\s+/gu, ' ').trim();
  return {
    description: description.slice(0, 160) || '导入的技能说明。',
    enabledByDefault: false,
    examples: skill.tags.length ? skill.tags.slice(0, 4) : undefined,
    id: `skill:${skill.id}`,
    kind: 'skill',
    name: metadata.title || skill.title,
    permissions: ['read-instructions'],
    readme: skill.instructions.slice(0, 4000),
    roleScoped: true,
    settingsPageId: 'platform-skills-api',
    source: skill.sourceName || '本地导入',
    status: { ready: Boolean(skill.instructions.trim()) },
    useWhen: description.slice(0, 160) || undefined,
  };
}

interface McpServerEntry { id: string; title: string; command: string }

function readMcpServers(config: Record<string, unknown>): McpServerEntry[] {
  const servers = config.servers ?? config.mcpServers;
  const entries = Array.isArray(servers)
    ? servers.map((server) => [typeof server?.id === 'string' ? server.id : '', server] as const)
    : servers && typeof servers === 'object' ? Object.entries(servers as Record<string, unknown>) : [];
  return entries.flatMap(([id, raw]) => {
    const server = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    if (!id || server.disabled === true) return [];
    const command = [server.command, ...(Array.isArray(server.args) ? server.args : [])]
      .filter((part): part is string => typeof part === 'string').join(' ');
    return [{ command, id, title: typeof server.title === 'string' && server.title.trim() ? server.title.trim() : id }];
  });
}

function describeMcpServer(server: McpServerEntry): PluginManifest {
  const remote = /^https?:\/\//iu.test(server.command);
  return {
    description: `外部工具服务器，角色可以调用它提供的工具。${server.command ? `启动方式：${server.command.slice(0, 80)}` : ''}`,
    enabledByDefault: true,
    id: `mcp:${server.id}`,
    kind: 'mcp',
    name: server.title,
    permissions: remote ? ['network'] : ['run-program'],
    roleScoped: true,
    settingsPageId: 'platform-mcp',
    source: 'MCP 配置',
    status: { ready: true },
    troubleshooting: ['工具列表为空：在 MCP 管理里点“检查”，看服务器是否启动成功（常见原因是没装 Node 或 Python）。'],
  };
}

// Built-in features described in the same plugin.json format as third-party packages
// (src/plugins/builtin/*.plugin.json); only whether they are set up is decided here.
interface BuiltinPluginFile {
  capabilityIds?: string[];
  description: string;
  examples?: string[];
  id: string;
  name: string;
  permissions: PluginPermission[];
  requires?: Array<{ install: string; name: string }>;
  roleScoped: boolean;
  settingsPageId: SettingsControlCenterPageId;
  setup?: string[];
  troubleshooting?: string[];
  useWhen?: string;
  version: string;
}

function describeBuiltin(file: BuiltinPluginFile, status: PluginManifest['status']): PluginManifest {
  return {
    capabilityIds: file.capabilityIds,
    description: file.description,
    enabledByDefault: true,
    examples: file.examples,
    id: `native:${file.id}`,
    kind: 'native',
    name: file.name,
    permissions: file.permissions,
    requires: file.requires,
    roleScoped: file.roleScoped,
    settingsPageId: file.settingsPageId,
    setup: file.setup,
    source: '桌宠内置',
    status,
    troubleshooting: file.troubleshooting,
    useWhen: file.useWhen,
  };
}

function describeNativePlugins(settings: PetConfig['settings']): PluginManifest[] {
  const qq = settings.qqBridge;
  return [
    describeBuiltin(comfyUiPlugin as BuiltinPluginFile, settings.comfyUi.workflows.length
      ? { ready: true }
      : { ready: false, note: '还没导入工作流：在下面导入一个 ComfyUI 工作流。' }),
    describeBuiltin(qqBridgePlugin as BuiltinPluginFile, qq.enabled && qq.ownerQq
      ? { ready: true }
      : { ready: false, note: '还没开启：在下面按四步设置好小号和 SnowLuma。' }),
    describeBuiltin(weixinBridgePlugin as BuiltinPluginFile, settings.weixinBridge?.enabled
      ? { ready: true }
      : { ready: false, note: '还没开启：在下面扫码登录手机微信。' }),
    describeBuiltin(devAgentPlugin as BuiltinPluginFile, settings.devAgent.enabled && settings.devAgent.workspaces.length
      ? { ready: true }
      : { ready: false, note: settings.devAgent.enabled ? '还没添加项目文件夹。' : '还没开启：在下面打开开发助手并添加项目。' }),
  ];
}

/** A plugin that came as a package: its own description, author and help replace the generic ones. */
function withPackage(plugin: PluginManifest, pack: PluginPackageManifest | undefined): PluginManifest {
  if (!pack) return plugin;
  return {
    ...plugin,
    description: pack.description || plugin.description,
    examples: pack.examples.length ? pack.examples : plugin.examples,
    name: pack.name || plugin.name,
    packageId: pack.id,
    permissions: pack.permissions.length ? pack.permissions : plugin.permissions,
    requires: pack.requires,
    setup: pack.setup,
    source: `插件包 v${pack.version}${pack.author ? ` · ${pack.author}` : ''}`,
    troubleshooting: pack.troubleshooting.length ? pack.troubleshooting : plugin.troubleshooting,
    useWhen: pack.useWhen || plugin.useWhen,
  };
}

export async function listInstalledPlugins(settings: PetConfig['settings']): Promise<PluginManifest[]> {
  const packages = new Map((await listPluginPackages()).map((pack) => [pack.id, pack]));
  const skills = readSkillLibrary().skills.map((skill) => {
    const packageId = packageIdFromSkillSource(skill.sourceName);
    return withPackage(describeSkill(skill), packageId ? packages.get(packageId) : undefined);
  });
  const mcp = readMcpServers(await loadExternalAgentMcpConfig().catch(() => ({})))
    .map((server) => withPackage(describeMcpServer(server), packages.get(server.id)?.kind === 'mcp' ? packages.get(server.id) : undefined));
  return [...describeNativePlugins(settings), ...skills, ...mcp];
}

/** Built-in plugins, synchronously, for checks on every chat turn. */
export function listNativePluginManifests(settings: PetConfig['settings']) {
  return describeNativePlugins(settings);
}

/** Removes an imported skill. MCP servers are removed in the MCP page; built-ins cannot be. */
export function uninstallSkillPlugin(pluginId: string) {
  const skillId = pluginId.replace(/^skill:/u, '');
  const library = removeAgentExternalSkillFromLibrary(readSkillLibrary(), skillId);
  window.localStorage.setItem(SKILL_LIBRARY_KEY, serializeAgentExternalSkillLibrary(library));
  forgetPluginRoleAccess(pluginId);
}
