import { openSettingsPage } from '../components/chat/hub/settingsPageRequest';
import { SETTINGS_CONTROL_CENTER_MODULES, type SettingsControlCenterPageId } from '../components/settings/settingsControlCenterNavigation';
import '../settings-manifest/coreSettingDefinitions';
import '../settings-manifest/pluginSettingDefinitions';
import { refreshPluginSettings } from '../plugins/pluginPackageSettings';
import {
  describeSettingForModel,
  describeSettingValue,
  findSettings,
  getSetting,
  parseSettingValue,
} from '../settings-manifest/settingsManifest';
import { stringArg } from './platformCapabilityArgs';
import type { PlatformCapability } from './platformCapabilityTypes';

// The two tools over the settings manifest (find a setting by what the user said, change it)
// and opening a settings page for the user. See docs/settings-manifest-design.md.

const GROUP = '设置';

/** Installed plugins may have been added, removed or updated since last time. */
async function withPluginSettings() {
  await refreshPluginSettings().catch(() => undefined);
}

const find: PlatformCapability = {
  args: [{ description: 'What the user wants, in their words (“微信别发语音了”“画图多等一会儿”); empty = list all.', key: 'query', type: 'string' }],
  description: 'Find settings you can change for the user (WeChat, QQ, drawing and any installed plugin’s own settings): their id, current value and allowed values. Use before settings.set.',
  describe: (args) => `找设置：${stringArg(args, 'query') || '全部'}`,
  group: GROUP,
  id: 'settings.find',
  risk: 'read',
  run: async ({ configRef }, args) => {
    await withPluginSettings();
    const found = findSettings(stringArg(args, 'query'));
    if (!found.length) return { ok: true, text: '没有可以由你来改的设置。' };
    return { ok: true, text: found.map((definition) => describeSettingForModel(definition, configRef.current)).join('\n') };
  },
  title: '找设置',
};

const set: PlatformCapability = {
  args: [
    { description: 'Setting id from settings.find, e.g. weixin.voiceReplyMode', key: 'id', required: true, type: 'string' },
    { description: 'New value: true/false, a choice value, or a number', key: 'value', required: true, type: 'string' },
  ],
  description: 'Change one setting found with settings.find. Ones marked “改之前要问用户” show a confirmation first; the others change at once.',
  describe: (args) => `改设置：${stringArg(args, 'id')} → ${stringArg(args, 'value')}`,
  group: GROUP,
  id: 'settings.set',
  risk: 'personal',
  run: async (context, args) => {
    await withPluginSettings();
    const definition = getSetting(stringArg(args, 'id'));
    if (!definition) return { ok: false, text: '没有这项设置，先用 settings.find 找一下。' };
    const config = context.configRef.current;
    const parsed = parseSettingValue(definition, config, args.value);
    if ('error' in parsed) return { ok: false, text: parsed.error };
    const before = definition.read(config);
    const name = `${definition.group} · ${definition.label}`;
    const target = describeSettingValue(definition, config, parsed.value);
    if (before === parsed.value) return { ok: true, text: `${name}本来就是“${target}”。` };
    if (definition.risk === 'change') {
      if (!context.requestApproval) return { ok: false, text: '这项要用户同意才能改，这里问不了，请用户到设置页里改。' };
      const title = `把「${name}」改成“${target}”`;
      if (!(await context.requestApproval({ detail: title, title }))) return { ok: false, text: '用户没有同意，没有改。' };
    }
    const next = definition.write(context.configRef.current, parsed.value);
    context.configRef.current = next;
    context.onUpdateConfig(next, { persist: true });
    const note = definition.afterChange?.(next, parsed.value) ?? '';
    const text = `已把${name}改成“${target}”。${note}`;
    return definition.endsReply ? { endsReply: `（已切换到「${target}」，从下一句开始用它回复）`, ok: true, text } : { ok: true, text };
  },
  title: '改设置',
};

const ALL_PAGES = SETTINGS_CONTROL_CENTER_MODULES.flatMap((module) => module.pages.map((page) => ({ module: module.label, page })));

const openPage: PlatformCapability = {
  args: [{ description: 'Which page, in the user\'s words: “微信”“QQ”“画图”“语音模型”“记忆”…', key: 'page', required: true, type: 'string' }],
  description: 'Open a settings page for the user when they want to see or change something themselves (logins, addresses and keys are only there).',
  describe: (args) => `打开设置：${stringArg(args, 'page')}`,
  group: GROUP,
  id: 'settings.open_page',
  risk: 'read',
  run: (_context, args) => {
    const wanted = stringArg(args, 'page').replace(/设置|页面?|连接/gu, '').trim().toLowerCase();
    if (!wanted) return { ok: false, text: '要打开哪一页？' };
    const alias: Record<string, SettingsControlCenterPageId> = { comfyui: 'platform-workflow', 画图: 'platform-workflow', 画画: 'platform-workflow', 插件: 'extension-plugins' };
    const pageId = alias[wanted]
      ?? ALL_PAGES.find(({ page }) => page.label.toLowerCase() === wanted)?.page.id
      ?? ALL_PAGES.find(({ page }) => page.label.toLowerCase().includes(wanted) || wanted.includes(page.label.toLowerCase()))?.page.id
      ?? ALL_PAGES.find(({ page }) => page.description.toLowerCase().includes(wanted))?.page.id;
    if (!pageId) return { ok: false, text: `没找到这一页。有：${ALL_PAGES.filter(({ page }) => !page.hidden).map(({ page }) => page.label).join('、')}。` };
    openSettingsPage(pageId);
    const page = ALL_PAGES.find((entry) => entry.page.id === pageId)!;
    return { ok: true, text: `已经打开设置里的「${page.page.label}」。` };
  },
  title: '打开设置页',
};

export const SETTINGS_MANIFEST_CAPABILITIES: PlatformCapability[] = [find, set, openPage];
