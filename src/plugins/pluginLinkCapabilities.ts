import { stringArg } from '../platform-capabilities/platformCapabilityArgs';
import type { PlatformCapability } from '../platform-capabilities/platformCapabilityTypes';
import { addMcpServers } from './mcpInstall';
import { planPluginLink, type PluginLinkPlan } from './pluginLinkInstall';
import { installPluginFromGitHub } from './pluginPackages';
import { PLUGIN_PERMISSION_LABELS, type PluginPermission } from './pluginTypes';

// The user sends a GitHub link: she looks at what it is and tells them, and installs it only
// after they say yes — every time, "今天都允许" or not: it is code from the internet, not
// reviewed like the market's, and it runs on their computer.

const GROUP = '插件';

async function planFor(url: string): Promise<PluginLinkPlan | { error: string }> {
  const inspect = window.desktopPetShell?.plugins?.inspectLink;
  if (!inspect) return { error: '这里看不了链接（只有桌面版能装插件）。' };
  const files = await inspect(url);
  return files.ok ? planPluginLink(files) : { error: 'error' in files ? files.error : '读不到这个链接。' };
}

function permissionsText(permissions: string[]) {
  return permissions.map((item) => PLUGIN_PERMISSION_LABELS[item as PluginPermission] ?? item).join('、') || '没写';
}

/** What she tells the user before asking. */
export function describePluginLinkPlan(plan: PluginLinkPlan) {
  const lines = [`「${plan.name}」：${plan.description || '没有写说明'}`];
  if (plan.kind === 'package') {
    lines.push(plan.packageKind === 'skill' ? '类型：技能（一份做事的说明，不运行程序）。' : `类型：插件包（工具服务器）。要的权限：${permissionsText(plan.permissions)}。`);
  } else if (plan.kind === 'mcp') {
    const server = plan.servers[0];
    lines.push(`类型：MCP 工具（会在电脑上运行程序）。需要电脑上有：${plan.needs}。`);
    lines.push(`启动方式：${server.url || `${server.command} ${server.args.join(' ')}`.trim()}`);
    if (plan.missingKeys.length) lines.push(`还要用户自己的密钥：${plan.missingKeys.join('、')}。密钥不经过你：请用户到 设置 → 扩展 → 插件市场 → 添加 MCP 工具，把说明里的配置贴进去并填上。`);
  } else {
    lines.push(`装不了：${plan.reason}`);
  }
  lines.push(`来源：${plan.url}（GitHub，没经过插件市场审核）。`);
  return lines.join('\n');
}

const inspectLink: PlatformCapability = {
  args: [{ description: 'GitHub 链接（仓库或其中的文件夹）', key: 'url', required: true, type: 'string' }],
  description: 'The user sent a GitHub link and wants that plugin: find out what it is (skill / MCP tool / plugin package), what it needs and where it comes from. Tell the user in your own words, then install with plugins.install_link only if they agree.',
  describe: (args) => `看看这个插件：${stringArg(args, 'url')}`,
  group: GROUP,
  id: 'plugins.inspect_link',
  risk: 'read',
  run: async (_context, args) => {
    const plan = await planFor(stringArg(args, 'url'));
    if ('error' in plan) return { ok: false, text: plan.error };
    const next = plan.kind === 'unknown' || (plan.kind === 'mcp' && plan.missingKeys.length)
      ? ''
      : '\n把上面这些用你自己的话告诉用户（尤其是“没经过审核、会在电脑上运行”），用户同意后再用 plugins.install_link 安装。';
    return { ok: true, text: `${describePluginLinkPlan(plan)}${next}` };
  },
  title: '看看链接里的插件',
};

const installLink: PlatformCapability = {
  args: [{ description: '同一个 GitHub 链接', key: 'url', required: true, type: 'string' }],
  description: 'Install the plugin from a GitHub link the user sent, after plugins.inspect_link and after telling them what it is. The user is asked every time (unreviewed code).',
  describe: (args) => `从 GitHub 安装插件：${stringArg(args, 'url')}`,
  group: GROUP,
  id: 'plugins.install_link',
  risk: 'personal',
  run: async (context, args) => {
    const url = stringArg(args, 'url');
    const plan = await planFor(url);
    if ('error' in plan) return { ok: false, text: plan.error };
    if (plan.kind === 'unknown') return { ok: false, text: plan.reason };
    if (plan.kind === 'mcp' && plan.missingKeys.length) return { ok: false, text: describePluginLinkPlan(plan) };
    if (!context.petId) return { ok: false, text: '不知道是哪个角色，没有安装。' };
    if (!context.requestApproval) return { ok: false, text: '这里问不了用户，没有安装。请用户到 设置 → 扩展 → 插件市场 里装。' };
    // Always asked (irreversible): "今天都允许" does not cover code from the internet.
    const approved = await context.requestApproval({
      detail: describePluginLinkPlan(plan),
      irreversible: true,
      title: `安装「${plan.name}」（来自 GitHub，没经过审核）`,
    });
    if (!approved) return { ok: false, text: '用户没有同意，没有安装。' };

    if (plan.kind === 'package') {
      const result = await installPluginFromGitHub(url, context.petId, 'link');
      if (!result.ok) return { ok: false, text: `安装失败：${'error' in result ? result.error : ''}` };
      return { ok: true, text: `已安装「${result.manifest.name}」，并为你开启。可以用 plugins.describe 看它怎么用。` };
    }
    const added = await addMcpServers(plan.servers, { origin: 'link', settings: context.configRef.current.settings });
    const lines = added.results.map(({ id, result }) => (result.status === 'ok'
      ? `「${id}」装好了，能用 ${result.tools.length} 个工具。${result.summary ?? ''}`
      : `「${id}」加上了，但还没跑起来：${result.status === 'failed' ? result.message : ''}`));
    if (added.pointedAtHerBrowser) lines.push('它会在你自己的浏览器里操作；要用你的账号，请用户在插件页面点“打开她的浏览器”登录。');
    const working = added.results.some(({ result }) => result.status === 'ok');
    // On failure she explains and asks; she does not go and edit the app's files to force it.
    if (!working) lines.push(`把原因告诉用户，问要不要先装好缺的东西（需要：${plan.needs}）。不要自己去改配置文件。`);
    return { ok: working, text: lines.join('\n') };
  },
  title: '从链接安装插件',
};

export const PLUGIN_LINK_CAPABILITIES: PlatformCapability[] = [inspectLink, installLink];
