import { stringArg } from '../platform-capabilities/platformCapabilityArgs';
import type { PlatformCapability, PlatformCapabilityContext } from '../platform-capabilities/platformCapabilityTypes';
import { getSettingsControlCenterPage } from '../components/settings/settingsControlCenterNavigation';
import { listInstalledPlugins } from './pluginCatalog';
import { fetchMarketPlugins, installMarketPlugin, matchesMarketQuery } from './pluginMarketApi';
import { PLUGIN_CREATION_CAPABILITIES } from './pluginCreationCapabilities';
import { isPluginEnabledForPet, setPluginEnabledForPet } from './pluginRoleAccess';
import { PLUGIN_KIND_LABELS, PLUGIN_PERMISSION_LABELS, type PluginManifest } from './pluginTypes';

// The character as plugin concierge (design doc §5.2): it can see what is installed, explain a
// plugin from its description, and turn one on for itself when the user agrees. Installing
// from the online market comes with the market.

function normalize(text: string) {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/gu, '');
}

async function findPlugins(context: PlatformCapabilityContext, query: string) {
  const plugins = await listInstalledPlugins(context.configRef.current.settings);
  const wanted = normalize(query);
  if (!wanted) return plugins;
  const exact = plugins.filter((plugin) => normalize(plugin.id) === wanted || normalize(plugin.name) === wanted);
  if (exact.length) return exact;
  return plugins.filter((plugin) => [plugin.id, plugin.name, plugin.description, plugin.useWhen ?? '']
    .some((text) => normalize(text).includes(wanted)));
}

function availability(plugin: PluginManifest, petId: string | null | undefined) {
  if (!plugin.roleScoped) return '所有角色共用';
  return isPluginEnabledForPet(plugin.id, petId, plugin.enabledByDefault) ? '你可以用' : '没给你开启';
}

function settingsPlace(plugin: PluginManifest) {
  return plugin.settingsPageId ? `设置 → ${getSettingsControlCenterPage(plugin.settingsPageId).label}` : '';
}

const listPlugins: PlatformCapability = {
  args: [{ description: '按名字或用途筛选，例如“画图”；不写就列出全部', key: 'query', type: 'string' }],
  description: 'Installed plugins (built-in features, imported skills, MCP tools), whether this character may use each, and whether it is set up. Use when the user asks what you can do, wants a feature you lack, or asks about plugins/扩展/技能.',
  describe: (args) => `查看已装插件${stringArg(args, 'query') ? `（${stringArg(args, 'query')}）` : ''}`,
  group: '插件',
  id: 'plugins.list',
  risk: 'read',
  run: async (context, args) => {
    const plugins = await findPlugins(context, stringArg(args, 'query'));
    if (!plugins.length) {
      return { ok: true, text: '没有找到相关的已装插件。在线插件市场还在准备中；可以请用户在 设置 → 扩展 → 插件市场 安装技能文件，或在 MCP 管理里接入工具。' };
    }
    return {
      ok: true,
      text: plugins.map((plugin) => [
        `- ${plugin.name}（${PLUGIN_KIND_LABELS[plugin.kind]}，${availability(plugin, context.petId)}，${plugin.status.ready ? '可用' : '待设置'}）：${plugin.description}`,
      ].join('')).join('\n'),
    };
  },
  title: '查看已装插件',
};

const describePlugin: PlatformCapability = {
  args: [{ description: '插件名字，来自 plugins.list', key: 'name', required: true, type: 'string' }],
  description: 'Full description of one installed plugin: what it does, permissions, how to set it up, example requests and common problems with fixes. Use before recommending a plugin or when helping the user fix one.',
  describe: (args) => `查看插件「${stringArg(args, 'name')}」的说明`,
  group: '插件',
  id: 'plugins.describe',
  risk: 'read',
  run: async (context, args) => {
    const [plugin, ...others] = await findPlugins(context, stringArg(args, 'name'));
    if (!plugin) return { ok: false, text: `没有叫“${stringArg(args, 'name')}”的已装插件，先用 plugins.list 看看。` };
    if (others.length) return { ok: false, text: `有好几个插件对得上：${[plugin, ...others].map((item) => item.name).join('、')}。请说具体是哪一个。` };
    return {
      ok: true,
      text: [
        `${plugin.name}（${PLUGIN_KIND_LABELS[plugin.kind]}，来源：${plugin.source}）`,
        plugin.description,
        `状态：${plugin.status.ready ? '可用' : `待设置。${plugin.status.note ?? ''}`}；${availability(plugin, context.petId)}。`,
        `需要的权限：${plugin.permissions.map((permission) => PLUGIN_PERMISSION_LABELS[permission]).join('、')}。`,
        plugin.useWhen ? `适合：${plugin.useWhen}` : '',
        plugin.examples?.length ? `用户可以这样说：${plugin.examples.join('；')}` : '',
        settingsPlace(plugin) ? `在哪设置：${settingsPlace(plugin)}` : '',
        plugin.troubleshooting?.length ? `常见问题：\n${plugin.troubleshooting.map((tip) => `- ${tip}`).join('\n')}` : '',
      ].filter(Boolean).join('\n'),
    };
  },
  title: '查看插件说明',
};

const setPluginEnabled: PlatformCapability = {
  args: [
    { description: '插件名字，来自 plugins.list', key: 'name', required: true, type: 'string' },
    { description: 'true 开启，false 关闭', key: 'enabled', required: true, type: 'boolean' },
  ],
  description: 'Turn an installed plugin on or off for yourself (the character in this chat only). Only after the user agreed; say what it does and what permissions it needs first.',
  describe: (args) => `${args.enabled === false ? '关闭' : '开启'}插件「${stringArg(args, 'name')}」（只对当前角色）`,
  group: '插件',
  id: 'plugins.set_enabled',
  risk: 'change',
  run: async (context, args) => {
    const [plugin, ...others] = await findPlugins(context, stringArg(args, 'name'));
    if (!plugin || others.length) return { ok: false, text: plugin ? '有好几个插件对得上，请说具体是哪一个。' : '没有这个已装插件。' };
    if (!plugin.roleScoped) return { ok: false, text: `「${plugin.name}」是所有角色共用的，不按角色开关；要改的话在 ${settingsPlace(plugin)} 里设置。` };
    if (!context.petId) return { ok: false, text: '不知道是哪个角色，没有改。' };
    const enabled = args.enabled !== false;
    setPluginEnabledForPet(plugin.id, context.petId, enabled);
    const next = enabled && !plugin.status.ready ? `不过它还没设置好：${plugin.status.note ?? ''}` : '';
    return { ok: true, text: `已${enabled ? '开启' : '关闭'}「${plugin.name}」，只影响你自己。${next}` };
  },
  title: '开关插件',
};

const searchMarket: PlatformCapability = {
  args: [{ description: '想要的功能，几个关键词，例如“天气”“记账”“画画”', key: 'query', required: true, type: 'string' }],
  description: 'Search the online plugin market (reviewed plugins others published) when nothing installed does what the user wants. Only a few keywords are sent, never the conversation.',
  describe: (args) => `在插件市场找「${stringArg(args, 'query')}」`,
  group: '插件',
  id: 'plugins.search_market',
  risk: 'read',
  run: async (_context, args) => {
    const market = await fetchMarketPlugins();
    if (!market.ok) return { ok: false, text: 'error' in market ? market.error : '插件市场打不开。' };
    const found = market.items.filter((plugin) => matchesMarketQuery(plugin, stringArg(args, 'query'))).slice(0, 5);
    if (!found.length) return { ok: true, text: '插件市场里没有找到合适的。可以和用户一起做一个：问清楚它要做什么、什么时候用、举个例子，复述一遍等用户同意，再用 plugins.create_skill（不用写代码）或 plugins.create_tool（需要代码）。' };
    return {
      ok: true,
      text: found.map((plugin) => `- ${plugin.name}（${plugin.kind === 'mcp' ? 'MCP 工具' : '技能'} v${plugin.version}，需要：${plugin.permissions.map((permission) => PLUGIN_PERMISSION_LABELS[permission]).join('、')}${plugin.requires.length ? `；要先装 ${plugin.requires.map((item) => item.name).join('、')}` : ''}）：${plugin.description}`).join('\n'),
    };
  },
  title: '在插件市场找插件',
};

const installFromMarket: PlatformCapability = {
  args: [{ description: '插件名字，来自 plugins.search_market', key: 'name', required: true, type: 'string' }],
  description: 'Install a plugin from the online market and turn it on for yourself. Only after telling the user what it does and which permissions it needs, and the user agreed.',
  describe: (args) => `从插件市场安装「${stringArg(args, 'name')}」`,
  group: '插件',
  id: 'plugins.install',
  risk: 'change',
  run: async (context, args) => {
    const market = await fetchMarketPlugins();
    if (!market.ok) return { ok: false, text: 'error' in market ? market.error : '插件市场打不开。' };
    const wanted = normalize(stringArg(args, 'name'));
    const plugin = market.items.find((item) => normalize(item.name) === wanted || normalize(item.id) === wanted);
    if (!plugin) return { ok: false, text: '插件市场里没有这个名字的插件，先用 plugins.search_market 找。' };
    if (!context.petId) return { ok: false, text: '不知道是哪个角色，没有安装。' };
    const result = await installMarketPlugin(plugin, context.petId);
    if (!result.ok) return { ok: false, text: `安装失败：${'error' in result ? result.error : ''}` };
    const before = plugin.requires.length ? `用之前还要先装：${plugin.requires.map((item) => `${item.name}${item.install ? `（${item.install}）` : ''}`).join('、')}。` : '';
    return { ok: true, text: `已安装「${plugin.name}」v${plugin.version}，并为你开启。${before}可以用 plugins.describe 看它怎么设置。` };
  },
  title: '从插件市场安装',
};

export const PLUGIN_CAPABILITIES: PlatformCapability[] = [listPlugins, describePlugin, setPluginEnabled, searchMarket, installFromMarket, ...PLUGIN_CREATION_CAPABILITIES];
