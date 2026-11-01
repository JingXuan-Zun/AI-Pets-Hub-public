import { resolveCompatibleBlocker, resolveDevAgentLaunch } from '../dev-agent/devAgentProviders';
import { normalizeDevAgentSettings } from '../dev-agent/devAgentSettings';
import { getDesktopPetSlot } from '../multiPetRoster';
import { stringArg } from '../platform-capabilities/platformCapabilityArgs';
import type { PlatformCapability, PlatformCapabilityContext } from '../platform-capabilities/platformCapabilityTypes';
import { isCapabilityEnabledForPet } from './pluginCapabilityAccess';
import { installPluginFromFolder, listPluginPackages } from './pluginPackages';
import { MCP_SERVER_TEMPLATE, buildSkillMarkdown, buildToolPluginManifest, buildToolPluginTask } from './pluginTemplates';

// Making a plugin together when none exists (design doc §5.3). The character first asks what it
// should do, when, and for an example, then repeats it back; the confirmation card for these
// capabilities is that summary (the "功能卡"). A skill is written by the character itself; a tool
// that needs code is handed to the dev assistant, starting from a working MCP template.

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,62}$/u;
const MAX_REPORT_CHARS = 1500;

function lines(value: string) {
  return value.split(/\r?\n|；|;/u).map((line) => line.replace(/^[-*·\d.、\s]+/u, '').trim()).filter(Boolean);
}

function makerName(context: PlatformCapabilityContext) {
  const name = context.petId ? getDesktopPetSlot(context.configRef.current, context.petId)?.personality.name.trim() : '';
  return name ? `和${name}一起做的` : '和角色一起做的';
}

async function nextVersion(id: string) {
  const existing = (await listPluginPackages()).find((pack) => pack.id === id);
  if (!existing) return { exists: false, version: '0.1.0' };
  const [major = 0, minor = 1, patch = 0] = existing.version.split('.').map((part) => Number.parseInt(part, 10) || 0);
  return { exists: true, version: `${major}.${minor}.${patch + 1}` };
}

const createSkill: PlatformCapability = {
  args: [
    { description: '插件 id：英文小写和横线，例如 japanese-buddy；修改已有的就用原来的 id', key: 'id', required: true, type: 'string' },
    { description: '名字，用户看得懂，例如“日语陪练”', key: 'name', required: true, type: 'string' },
    { description: '一句话：它做什么', key: 'description', required: true, type: 'string' },
    { description: '什么时候用它（你以后靠这句判断要不要用）', key: 'use_when', required: true, type: 'string' },
    { description: '完整的技能说明（Markdown）：你按它做事的步骤、规则、格式、注意事项、例子。写给以后的你看，要具体', key: 'instructions', required: true, type: 'string' },
    { description: '用户可以怎么说，一行一句', key: 'examples', type: 'string' },
  ],
  description: 'Make (or update) a skill plugin with the user when nothing installed or in the market does what they want and no code is needed (rules, steps, knowledge, a way of tutoring or reviewing). Before calling: ask what it should do, when, and for an example, then repeat it back and wait for the user to agree. Turned on for you right away.',
  describe: (args) => [
    `做一个技能插件「${stringArg(args, 'name')}」：${stringArg(args, 'description')}`,
    stringArg(args, 'use_when') ? `什么时候用：${stringArg(args, 'use_when')}` : '',
    stringArg(args, 'examples') ? `可以这样说：${lines(stringArg(args, 'examples')).slice(0, 3).join('；')}` : '',
  ].filter(Boolean).join('\n'),
  group: '插件',
  id: 'plugins.create_skill',
  risk: 'change',
  run: async (context, args) => {
    const id = stringArg(args, 'id').trim().toLowerCase();
    const name = stringArg(args, 'name').trim();
    const description = stringArg(args, 'description').trim();
    const instructions = stringArg(args, 'instructions').trim();
    if (!ID_PATTERN.test(id)) return { ok: false, text: 'id 要用英文小写、数字和横线，例如 japanese-buddy。' };
    if (!name || !description || instructions.length < 40) return { ok: false, text: '需要名字、一句话说明，和具体的技能说明（步骤、规则、例子）。' };
    if (!context.petId) return { ok: false, text: '不知道是哪个角色，没有做。' };
    const bridge = typeof window !== 'undefined' ? window.desktopPetShell?.plugins : undefined;
    if (!bridge?.writeDraft) return { ok: false, text: '只能在桌面版里做插件。' };
    const { exists, version } = await nextVersion(id);
    const manifest = {
      author: makerName(context), description, examples: lines(stringArg(args, 'examples')).slice(0, 8), id, kind: 'skill',
      name, permissions: ['read-instructions'], skill: { file: 'SKILL.md' }, useWhen: stringArg(args, 'use_when').trim(), version,
    };
    const written = await bridge.writeDraft(id, {
      'SKILL.md': buildSkillMarkdown({ description, id, instructions, name }),
      'plugin.json': `${JSON.stringify(manifest, null, 2)}\n`,
    });
    if (!written.ok) return { ok: false, text: 'error' in written ? written.error : '写不进去。' };
    const installed = await installPluginFromFolder(written.folder, context.petId);
    if (!installed.ok) return { ok: false, text: `做好了但装不上：${'error' in installed ? installed.error : ''}` };
    return {
      ok: true,
      text: [
        `${exists ? '已更新' : '已做好'}技能插件「${name}」v${version}，并为你开启。`,
        '现在就可以按它做事；用户觉得哪里不对，就照用户的意思改说明，再用 plugins.create_skill（同一个 id）更新，旧版本会保留。',
        '用户满意的话可以提醒：在 设置 → 扩展 → 插件市场 里点这个插件，可以“发布到插件市场”分享给别人。',
      ].join('\n'),
    };
  },
  title: '做一个技能插件',
};

const createTool: PlatformCapability = {
  args: [
    { description: '插件 id：英文小写和横线，例如 bilibili-hot', key: 'id', required: true, type: 'string' },
    { description: '名字，用户看得懂，例如“B 站热门”', key: 'name', required: true, type: 'string' },
    { description: '一句话：它做什么', key: 'description', required: true, type: 'string' },
    { description: '要哪些工具：每个工具的名字、参数、返回什么，一行一个', key: 'tools', required: true, type: 'string' },
    { description: '补充要求：数据从哪来、要不要密钥、注意什么', key: 'notes', type: 'string' },
  ],
  description: 'Make (or update) a tool plugin that needs code (fetching a website or API, reading a file format, controlling an app): the dev assistant writes it as an MCP tool, then it is installed and tested. Takes minutes. Before calling: agree with the user on what it does and which tools it has. Needs the dev assistant plugin set up; for rules or steps without code use plugins.create_skill instead.',
  describe: (args) => [
    `让开发助手做一个工具插件「${stringArg(args, 'name')}」：${stringArg(args, 'description')}`,
    `工具：${lines(stringArg(args, 'tools')).slice(0, 4).join('；')}`,
    '会在电脑上运行它写的程序，需要几分钟',
  ].join('\n'),
  group: '插件',
  id: 'plugins.create_tool',
  risk: 'change',
  run: async (context, args) => {
    const id = stringArg(args, 'id').trim().toLowerCase();
    const name = stringArg(args, 'name').trim();
    const description = stringArg(args, 'description').trim();
    const tools = stringArg(args, 'tools').trim();
    if (!ID_PATTERN.test(id)) return { ok: false, text: 'id 要用英文小写、数字和横线，例如 bilibili-hot。' };
    if (!name || !description || !tools) return { ok: false, text: '需要名字、一句话说明和要哪些工具。' };
    if (!context.petId) return { ok: false, text: '不知道是哪个角色，没有做。' };
    const config = context.configRef.current;
    const settings = normalizeDevAgentSettings(config.settings.devAgent);
    const shell = typeof window !== 'undefined' ? window.desktopPetShell : undefined;
    if (!isCapabilityEnabledForPet('dev.delegate', context.petId)) {
      return { ok: false, text: '开发助手插件没有给你开启：请用户在插件市场里为你打开“开发助手”。' };
    }
    if (!settings.enabled || !shell?.devAgent) {
      return { ok: false, text: '要写代码的插件需要开发助手：请用户在 设置 → 扩展 → 插件市场 → 开发助手 里打开并登录。不需要代码的话可以改用 plugins.create_skill。' };
    }
    const apiKey = config.settings.devAgentApiKey ?? '';
    const blocker = resolveCompatibleBlocker(settings, apiKey);
    if (blocker) return { ok: false, text: `开发助手的服务还没配好：${blocker}` };
    const { exists } = await nextVersion(id);
    const spec = { description, id, name, notes: stringArg(args, 'notes').trim(), tools };
    // A new plugin starts from the template; an update keeps the code and only refreshes the brief.
    const written = await shell.plugins?.writeDraft?.(id, exists
      ? { 'SPEC.md': `${buildToolPluginTask(spec)}\n` }
      : {
        'SPEC.md': `${buildToolPluginTask(spec)}\n`,
        'plugin.json': buildToolPluginManifest({ author: makerName(context), description, id, name }),
        'server.mjs': MCP_SERVER_TEMPLATE.replace('__PLUGIN_ID__', id),
      });
    if (!written?.ok) return { ok: false, text: written && 'error' in written ? written.error : '写不进插件草稿。' };
    const launch = resolveDevAgentLaunch(settings, apiKey);
    const task = exists
      ? `这个文件夹里的 MCP 工具插件要按新要求修改（新要求也写在 SPEC.md）。改完把 plugin.json 的 version 末位加一，并照 SPEC.md 的方法自测。\n\n${buildToolPluginTask(spec)}`
      : buildToolPluginTask(spec);
    const result = await shell.devAgent.run({
      allowedCommands: ['node'],
      env: launch.env,
      executablePath: settings.executablePath,
      model: launch.model,
      prompt: task,
      timeoutMs: settings.timeoutMinutes * 60_000,
      workspacePath: written.folder,
    });
    if (!result.ok) return { ok: false, text: `开发助手没做成：${result.error ?? '未知原因'}。草稿在 ${written.folder}，可以让用户看看或稍后再试。` };
    const installed = await installPluginFromFolder(written.folder, context.petId);
    if (!installed.ok) return { ok: false, text: `写好了但装不上：${'error' in installed ? installed.error : ''}` };
    const diagnostic = await shell.inspectMcpServer?.({ serverId: id });
    const toolNames = diagnostic?.ok
      ? ((await shell.listMcpTools?.({ serverId: id }))?.tools ?? []).filter((tool) => tool.serverId === id).map((tool) => tool.name)
      : [];
    const report = (result.result ?? '').trim();
    return {
      ok: Boolean(diagnostic?.ok),
      text: [
        diagnostic?.ok
          ? `「${name}」做好并装上了，已为你开启，连接测试通过，有这些工具：${toolNames.join('、') || '（没列出）'}。可以用 mcp 工具（server_id 是 ${id}）试一次给用户看。`
          : `「${name}」写好并装上了，但启动测试没通过：${diagnostic?.error ?? diagnostic?.stderrSnippet ?? '原因不明'}。可以把这个原因告诉用户，再用 plugins.create_tool（同一个 id）让开发助手修。`,
        `开发助手的说明：${report.length > MAX_REPORT_CHARS ? `${report.slice(0, MAX_REPORT_CHARS)}…` : report || '（没有说明）'}`,
        '如果它需要密钥，带用户去插件市场里这个插件的页面填写。',
      ].join('\n'),
    };
  },
  title: '让开发助手做一个工具插件',
};

export const PLUGIN_CREATION_CAPABILITIES: PlatformCapability[] = [createSkill, createTool];
