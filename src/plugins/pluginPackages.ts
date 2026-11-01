import { parseAgentExternalSkillImport, parseAgentExternalSkillLibraryJson, removeAgentExternalSkillFromLibrary, serializeAgentExternalSkillLibrary } from '../agent/agentExternalSkillLibrary';
import { installAgentImportedSkills } from '../agent/agentSkillImportInstallation';
import { forgetPluginRoleAccess } from './pluginRoleAccess';
import type { PluginPermission } from './pluginTypes';

// Installed plugin packages (userData/plugins/<id>/plugin.json, see docs/plugin-format.md). The
// main process copies the files; here each package is handed to the runtime that already runs
// its kind: a skill joins the skill library, an MCP plugin becomes a server in the MCP config.

export interface PluginPackageManifest {
  author: string;
  description: string;
  examples: string[];
  folder: string;
  homepage: string;
  id: string;
  kind: 'skill' | 'mcp';
  mcp: { args: string[]; command: string; env: Record<string, string>; url: string } | null;
  name: string;
  permissions: PluginPermission[];
  requires: Array<{ install: string; name: string }>;
  setup: string[];
  skill: { file: string } | null;
  troubleshooting: string[];
  useWhen: string;
  version: string;
}

type PackageResult = { ok: true; manifest: PluginPackageManifest } | { ok: false; error: string };

const SKILL_LIBRARY_KEY = 'desktop-pet.agent-external-skills.v1';
const SKILL_SOURCE_PREFIX = 'plugin:';

/** The skill library entry of a skill plugin is marked by its source name. */
export function skillSourceForPackage(id: string) {
  return `${SKILL_SOURCE_PREFIX}${id}`;
}

export function packageIdFromSkillSource(sourceName: string) {
  return sourceName.startsWith(SKILL_SOURCE_PREFIX) ? sourceName.slice(SKILL_SOURCE_PREFIX.length) : null;
}

function bridge() {
  return typeof window === 'undefined' ? null : window.desktopPetShell?.plugins ?? null;
}

export async function listPluginPackages(): Promise<PluginPackageManifest[]> {
  // A failure here (e.g. a main process older than this page) must not hide built-in plugins.
  try {
    const result = await bridge()?.list();
    return result?.ok ? result.plugins as PluginPackageManifest[] : [];
  } catch {
    return [];
  }
}

async function registerSkill(manifest: PluginPackageManifest, petId: string) {
  const read = await bridge()?.readSkill(manifest.id);
  if (!read) throw new Error('读不到技能说明。');
  if ('error' in read) throw new Error(read.error);
  const preview = parseAgentExternalSkillImport(read.text, `${skillSourceForPackage(manifest.id)}.md`);
  if (!preview.skill) throw new Error(preview.errors.join('；') || '技能说明读不懂。');
  installAgentImportedSkills(window.localStorage, petId, { skills: [{ ...preview.skill, sourceName: skillSourceForPackage(manifest.id) }], warnings: [] });
}

function readServers(config: Record<string, unknown>) {
  const servers = config.servers ?? config.mcpServers;
  if (Array.isArray(servers)) return servers.filter((server) => server && typeof server === 'object') as Array<Record<string, unknown>>;
  if (servers && typeof servers === 'object') return Object.entries(servers).map(([id, server]) => ({ ...(server as object), id }));
  return [];
}

export async function updateMcpServers(update: (servers: Array<Record<string, unknown>>) => Array<Record<string, unknown>>) {
  const shell = window.desktopPetShell;
  const loaded = await shell?.loadMcpConfig?.();
  if (!loaded?.ok || !loaded.config) throw new Error('读不到 MCP 配置。');
  const config = loaded.config as Record<string, unknown>;
  const { mcpServers: _legacy, ...rest } = config;
  const saved = await shell?.saveMcpConfig?.({ config: { ...rest, servers: update(readServers(config)) } });
  if (!saved?.ok) throw new Error(saved?.error ?? 'MCP 配置保存失败。');
}

async function registerMcpServer(manifest: PluginPackageManifest) {
  const mcp = manifest.mcp;
  if (!mcp) throw new Error('插件没有写启动方式。');
  const server = mcp.url
    ? { id: manifest.id, title: manifest.name, url: mcp.url }
    : { args: mcp.args, command: mcp.command, cwd: manifest.folder, env: mcp.env, id: manifest.id, title: manifest.name };
  await updateMcpServers((servers) => [...servers.filter((item) => item.id !== manifest.id), server]);
}

/** After the main process copied the files: make the plugin usable, turned on for petId. */
export async function activatePluginPackage(result: PackageResult | undefined | null, petId: string): Promise<PackageResult> {
  if (!result) return { error: '当前环境不能安装插件（需要桌面版）。', ok: false };
  if (!result.ok) return result;
  try {
    if (result.manifest.kind === 'skill') await registerSkill(result.manifest, petId);
    else await registerMcpServer(result.manifest);
    return result;
  } catch (error) {
    return { error: `文件已装好，但启用失败：${error instanceof Error ? error.message : String(error)}`, ok: false };
  }
}

export async function installPluginFromFolder(folder: string, petId: string) {
  return activatePluginPackage(await bridge()?.installFolder(folder) as PackageResult | undefined, petId);
}

export async function installPluginFromGitHub(url: string, petId: string) {
  return activatePluginPackage(await bridge()?.installGitHub(url) as PackageResult | undefined, petId);
}

export async function uninstallPluginPackage(manifest: Pick<PluginPackageManifest, 'id' | 'kind'>) {
  if (manifest.kind === 'skill') {
    const library = parseAgentExternalSkillLibraryJson(window.localStorage.getItem(SKILL_LIBRARY_KEY));
    const skill = library.skills.find((item) => item.sourceName === skillSourceForPackage(manifest.id));
    if (skill) {
      window.localStorage.setItem(SKILL_LIBRARY_KEY, serializeAgentExternalSkillLibrary(removeAgentExternalSkillFromLibrary(library, skill.id)));
      forgetPluginRoleAccess(`skill:${skill.id}`);
    }
  } else {
    await updateMcpServers((servers) => servers.filter((item) => item.id !== manifest.id));
    forgetPluginRoleAccess(`mcp:${manifest.id}`);
  }
  const result = await bridge()?.uninstall(manifest.id);
  return result ?? { error: '当前环境不能卸载插件。', ok: false };
}
