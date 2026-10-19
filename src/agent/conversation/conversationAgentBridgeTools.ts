import type { AgentChatCommand, AgentChatCommandResult, AgentToolCallName } from '../agentChatCommand';
import { isDeclaredReadOnlyMcpTool } from '../agentMcpRegistry';
import { runCharacterAnimationSkill } from '../agentCharacterSkillRuntime';
import { buildAgentPermissionRoute } from '../agentPermissionRouter';
import { getDesktopPetSlot, PRIMARY_DESKTOP_PET_SLOT_ID } from '../../multiPetRoster';
import { resolvePetModelMotionBindingsForModel } from '../../pet-runtime/content/petModelMotionBindings';
import type { ConversationTool, ConversationToolRuntime } from './conversationTools';

// The rest of the platform's tools, reused from the existing Agent runtime instead of being
// rewritten: web pages, commands, system info, desktop icons, skills, MCP, game companion and
// local projects. Each call goes through the same permission policy as before; when that
// policy wants a confirmation, the card says in plain words what will happen.

const MAX_RESULT_CHARS = 4000;
const BLOCKED_COMMAND = /\b(?:remove-item|rm|del|erase|rd|rmdir|diskpart|bcdedit|cipher|takeown|icacls|shutdown|restart-computer|stop-computer|logoff|taskkill|stop-process)\b|\breg(?:istry)?\s+(?:delete|add|import|load|unload)\b|\bnet\s+user\b/iu;

// Commands that only look things up run without a card, like reading files does. Only the
// first word decides, and anything that could run a second command inside it — $(...),
// (...), {...}, @(...), variables — or write a file (-OutFile) still asks.
const READ_ONLY_COMMAND = /^(?:get-[a-z]+|test-path|test-connection|select-string|measure-object|resolve-path|dir|ls|gci|gps|ps|cat|type|where|where\.exe|whoami|hostname|ipconfig|systeminfo|tasklist|ver|nslookup|ping)$/iu;
const EMBEDDED_CODE = /[$(){}@`]|-outfile\b|-filepath\b|-destination\b/iu;

// "(Get-Process -Name x).MainWindowTitle" only reads a property; a parenthesised look-up with
// nothing else inside is unwrapped before the check.
const PARENTHESISED_LOOKUP = /\((\s*get-[a-z]+[^()$`{}@;|]*)\)/giu;

export function isReadOnlyCommand(command: string) {
  const trimmed = command.trim().replace(PARENTHESISED_LOOKUP, '$1');
  const firstWord = trimmed.split(/\s+/u)[0] ?? '';
  return READ_ONLY_COMMAND.test(firstWord) && !EMBEDDED_CODE.test(trimmed) && !BLOCKED_COMMAND.test(trimmed);
}

interface BridgeSpec {
  /** Old runtime tool and its input, from the conversation tool's arguments. */
  call: (args: Record<string, unknown>) => { input: Record<string, unknown>; name: AgentToolCallName } | string;
  description: string;
  /** Confirmation text; the policy decides whether it is shown. */
  describe: (args: Record<string, unknown>) => string;
  name: string;
  /** True when the call only reads (e.g. loading a skill's instructions), whatever the old policy says. */
  readOnly?: (args: Record<string, unknown>) => boolean;
  properties: Record<string, unknown>;
  required: string[];
}

function str(args: Record<string, unknown>, key: string) {
  const value = args[key];
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

function clip(value: string, max = 80) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

const BRIDGE_SPECS: BridgeSpec[] = [
  {
    call: (args) => {
      const action = str(args, 'action');
      if (!['open_url', 'read_page', 'list_tabs', 'focus_tab', 'status'].includes(action)) return `不支持的 action “${action}”。`;
      if (action === 'open_url' && !/^https?:\/\//iu.test(str(args, 'url'))) return 'open_url 需要以 http:// 或 https:// 开头的网址。';
      return { input: { action, ...(str(args, 'url') ? { url: str(args, 'url') } : {}), ...(str(args, 'tab_id') ? { tabId: str(args, 'tab_id') } : {}) }, name: 'control_browser' };
    },
    description: '应用自带的浏览器：open_url 打开网页，read_page 读取当前页面的文字（总结网页、视频页、文章时用），list_tabs / focus_tab 管理标签页。要读网页内容用它；只是给用户打开网页看用 open_url 工具。',
    describe: (args) => (str(args, 'action') === 'open_url' ? `在应用浏览器里打开：${clip(str(args, 'url'), 100)}` : `浏览器：${str(args, 'action')}`),
    name: 'browser',
    properties: {
      action: { enum: ['open_url', 'read_page', 'list_tabs', 'focus_tab', 'status'], type: 'string' },
      tab_id: { description: 'focus_tab 时的标签页 id（来自 list_tabs）', type: 'string' },
      url: { description: 'open_url 的网址', type: 'string' },
    },
    required: ['action'],
  },
  {
    call: (args) => {
      const command = str(args, 'command');
      if (!command) return '需要 command。';
      // Same limits as the command service, checked before the user is asked.
      if (/[\r\n]/u.test(command) || /(?:&&|\|\||[|<>;`])/u.test(command)) return '不能用：命令里不能有管道 |、重定向 > <、分号或 && 连接，也不能多行。改成一条简单命令再试。';
      if (BLOCKED_COMMAND.test(command)) return '不能用：删除、关机、结束进程、改注册表这类命令不允许运行。删文件请用 files 工具（移到回收站）。';
      return { input: { command, ...(str(args, 'cwd') ? { cwd: str(args, 'cwd') } : {}), shell: str(args, 'shell') === 'cmd' ? 'cmd' : 'powershell' }, name: 'run_controlled_command' };
    },
    description: '在电脑上运行一条简单命令（默认 PowerShell），返回输出。只查询信息的命令（Get-Process、Get-ChildItem、Test-Path、tasklist、ipconfig 等）直接运行；会改动东西的命令会请用户确认。查信息时命令往往比点界面更快更稳。限制：一次一条，不能用管道 |、重定向、分号或 && 连接；不能删除、关机、结束进程。',
    describe: (args) => `运行命令：${clip(str(args, 'command'), 120)}`,
    name: 'run_command',
    readOnly: (args) => isReadOnlyCommand(str(args, 'command')),
    properties: {
      command: { description: '要运行的命令', type: 'string' },
      cwd: { description: '在哪个目录运行（可选，完整路径）', type: 'string' },
      shell: { enum: ['powershell', 'cmd'], type: 'string' },
    },
    required: ['command'],
  },
  {
    call: () => ({ input: { includeDisplays: true }, name: 'get_system_info' }),
    description: '读取电脑配置：系统版本、CPU、内存、显卡，以及屏幕数量、分辨率和缩放。',
    describe: () => '读取电脑配置',
    name: 'system_info',
    properties: {},
    required: [],
  },
  {
    // The organizer could always work on one screen (its icons, laid out on that screen); the
    // bridge only passed mode and grouping, so "整理副屏的图标" came back as impossible.
    call: (args) => {
      const screen = str(args, 'screen');
      const toScreen = str(args, 'to_screen');
      const oneScreen = screen === 'primary' || screen === 'secondary';
      return {
        input: {
          mode: str(args, 'action') === 'execute' ? 'execute' : 'preview',
          ...(str(args, 'group_by') ? { groupBy: str(args, 'group_by') } : {}),
          ...(oneScreen ? { scope: 'display-icons', sourceDisplay: screen, targetDisplay: toScreen === 'primary' || toScreen === 'secondary' ? toScreen : screen } : {}),
        },
        name: 'organize_desktop_icons',
      };
    },
    description: '整理桌面图标：先 preview 生成排列预览，用户满意后再 execute 按预览移动图标（execute 时 screen、group_by 要和 preview 一样）。只整理某一块屏幕时 screen 写 primary（主屏）或 secondary（副屏）：只动那块屏幕上的图标，排在那块屏幕上；不写就是整理全部图标。',
    describe: (args) => {
      const screen = str(args, 'screen') === 'secondary' ? '副屏' : str(args, 'screen') === 'primary' ? '主屏' : '';
      return str(args, 'action') === 'execute' ? `按刚才的预览移动${screen}桌面图标` : `预览${screen}桌面图标的整理方案`;
    },
    name: 'desktop_icons',
    properties: {
      action: { enum: ['preview', 'execute'], type: 'string' },
      group_by: { description: '分组方式（可选）：kind 按类型，category 按用途，extension 按扩展名', enum: ['none', 'kind', 'category', 'extension'], type: 'string' },
      screen: { description: '只整理哪块屏幕上的图标（可选）', enum: ['primary', 'secondary', 'all'], type: 'string' },
      to_screen: { description: '整理后摆到哪块屏幕（可选，默认就是 screen 那块）', enum: ['primary', 'secondary'], type: 'string' },
    },
    required: ['action'],
  },
  {
    call: (args) => (str(args, 'action') === 'run'
      ? (str(args, 'skill_id')
        ? { input: { skillId: str(args, 'skill_id'), ...(str(args, 'intent') ? { intent: str(args, 'intent') } : {}), ...(str(args, 'input_json') ? { inputJson: str(args, 'input_json') } : {}) }, name: 'execute_agent_skill' }
        : 'run 需要 skill_id（先 list 看有哪些）。')
      : { input: { ...(str(args, 'query') ? { query: str(args, 'query') } : {}) }, name: 'list_agent_skills' }),
    description: '用户导入的技能（一份做事的说明书，例如视频分镜和提示词）：list 查看有哪些（关键词可用中文），run 读取其中一个的说明，然后按说明继续做。',
    describe: (args) => `运行技能「${str(args, 'skill_id')}」${str(args, 'intent') ? `：${clip(str(args, 'intent'))}` : ''}`,
    name: 'skills',
    // Running a skill only loads its instructions; any real action it leads to goes through
    // the normal tools and their own confirmation.
    readOnly: () => true,
    properties: {
      action: { enum: ['list', 'run'], type: 'string' },
      input_json: { description: 'run 时传给技能的参数，JSON 字符串（可选）', type: 'string' },
      intent: { description: 'run 时想让技能做什么（可选）', type: 'string' },
      query: { description: 'list 的关键词（可选）', type: 'string' },
      skill_id: { description: 'run 的技能 id（来自 list）', type: 'string' },
    },
    required: ['action'],
  },
  {
    call: (args) => (str(args, 'action') === 'call'
      ? (str(args, 'server_id') && str(args, 'tool_name')
        ? { input: { name: str(args, 'tool_name'), serverId: str(args, 'server_id'), ...(str(args, 'arguments_json') ? { argumentsJson: str(args, 'arguments_json') } : {}) }, name: 'call_mcp_tool' }
        : 'call 需要 server_id 和 tool_name（先 list 看有哪些）。')
      : { input: { ...(str(args, 'server_id') ? { serverId: str(args, 'server_id') } : {}) }, name: 'list_mcp_tools' }),
    description: '用户接入的 MCP 扩展工具：list 查看各扩展提供的工具和参数，call 调用其中一个。',
    describe: (args) => `调用扩展工具 ${str(args, 'server_id')}/${str(args, 'tool_name')}`,
    name: 'mcp',
    // Listing only reads; a call skips the card when the server declares that tool read-only.
    readOnly: (args) => str(args, 'action') !== 'call' || isDeclaredReadOnlyMcpTool(str(args, 'server_id'), str(args, 'tool_name')),
    properties: {
      action: { enum: ['list', 'call'], type: 'string' },
      arguments_json: { description: 'call 的参数，JSON 字符串', type: 'string' },
      server_id: { type: 'string' },
      tool_name: { type: 'string' },
    },
    required: ['action'],
  },
  {
    call: (args) => {
      const action = str(args, 'action') || 'status';
      return { input: { action, ...(str(args, 'target') ? { query: str(args, 'target') } : {}), ...(str(args, 'game') ? { gameHint: str(args, 'game') } : {}) }, name: 'manage_game_companion_loop' };
    },
    description: '陪玩：start 开始低频看游戏画面并适时搭话，stop 停止，status 查看状态。target 写游戏窗口标题（可选）。',
    describe: (args) => (str(args, 'action') === 'start' ? `开始看「${str(args, 'target') || str(args, 'game') || '游戏'}」的画面陪你玩` : `陪玩：${str(args, 'action')}`),
    name: 'game_companion',
    properties: {
      action: { enum: ['start', 'stop', 'status'], type: 'string' },
      game: { description: '游戏名（可选）', type: 'string' },
      target: { description: '游戏窗口标题（可选）', type: 'string' },
    },
    required: ['action'],
  },
  {
    call: (args) => {
      const path = str(args, 'path');
      if (str(args, 'action') === 'run') {
        return { input: { ...(path ? { path } : {}), ...(Number.isFinite(Number(args.action_index)) && args.action_index !== undefined ? { actionIndex: Number(args.action_index) } : {}), ...(str(args, 'question') ? { question: str(args, 'question') } : {}) }, name: 'run_local_project_action' };
      }
      return path ? { input: { path, ...(str(args, 'question') ? { question: str(args, 'question') } : {}) }, name: 'inspect_local_project' } : 'inspect 需要 path。';
    },
    description: '本机项目（代码、游戏、工具目录）：inspect 只读分析目录结构和启动方式；run 运行 inspect 给出的候选动作（action_index）。',
    describe: (args) => `运行本机项目里的动作：${clip(str(args, 'path') || '上次检查的项目')}`,
    name: 'local_project',
    properties: {
      action: { enum: ['inspect', 'run'], type: 'string' },
      action_index: { description: 'run 时选第几个候选动作（来自 inspect）', type: 'number' },
      path: { description: '项目文件夹的完整路径', type: 'string' },
      question: { description: '想了解什么（可选）', type: 'string' },
    },
    required: ['action'],
  },
];

function toCommand(call: { input: Record<string, unknown>; name: AgentToolCallName }): AgentChatCommand {
  return { kind: 'tool-call', toolCall: { input: call.input, name: call.name } } as AgentChatCommand;
}

function formatResult(result: AgentChatCommandResult) {
  const text = [result.responseText, result.ok ? '' : result.errorText].filter(Boolean).join('\n').trim() || (result.ok ? '完成。' : '失败。');
  const clipped = text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}\n（结果太长，后面省略了）` : text;
  return result.ok ? clipped : `失败：${clipped}`;
}

function bridgeTool(spec: BridgeSpec): ConversationTool {
  return {
    confirmation: (args) => {
      const call = spec.call(args);
      if (typeof call === 'string' || spec.readOnly?.(args)) return null;
      const route = buildAgentPermissionRoute(toCommand(call));
      return route.requiresApproval && !route.blockedStep ? spec.describe(args) : null;
    },
    definition: {
      function: { description: spec.description, name: spec.name, parameters: { properties: spec.properties, required: spec.required, type: 'object' } },
      type: 'function',
    },
    run: async (runtime, args) => {
      const call = spec.call(args);
      if (typeof call === 'string') return call;
      if (!runtime.executeAgentCommand) return '失败：当前不能使用这个工具。';
      const route = buildAgentPermissionRoute(toCommand(call));
      if (route.blockedStep) return `失败：权限策略不允许这一步（${route.blockedStep.decision.reason}）。`;
      return formatResult(await runtime.executeAgentCommand(toCommand(call), { petId: runtime.petId, signal: runtime.signal ?? null }));
    },
  };
}

const ANIMATION_SUGGESTIONS = ['dance', 'wave', 'clap', 'jump', 'bow', 'nod', 'shake-head', 'salute', 'spin', 'sit', 'heart', 'peace', 'scratch-head'];

/**
 * The character performs a motion itself ("跳个舞", "挥挥手"). The old route caught these
 * phrases before routing; in the conversation loop the model decides and calls this.
 */
const playAnimationTool: ConversationTool = {
  confirmation: () => null,
  definition: {
    function: {
      description: `让你自己（角色）在桌面上做一个动作。用户让你跳舞、挥手、鼓掌、比心、转圈等时调用，然后用平常的语气回应。常用动作：${ANIMATION_SUGGESTIONS.join('、')}；也可以写角色自带的动作名。`,
      name: 'play_animation',
      parameters: {
        properties: {
          animation: { description: '动作 id，例如 dance、wave、heart', type: 'string' },
        },
        required: ['animation'],
        type: 'object',
      },
    },
    type: 'function',
  },
  run: async (runtime, args) => {
    const animation = str(args, 'animation');
    if (!animation) return '需要 animation。';
    // Runs the animation runtime directly: the 'character.animation' skill it used to go
    // through was deleted with the skill package system, so every call failed.
    const result = runCharacterAnimationSkill({
      config: runtime.configRef.current,
      dryRun: false,
      input: { animationId: animation, ...(runtime.petId ? { targetPetId: runtime.petId } : {}) },
      intent: animation,
      resolveMotionBindings: ({ customModelPresets, modelType, modelUrl }) => (
        resolvePetModelMotionBindingsForModel(modelType, modelUrl, customModelPresets)
      ),
    });
    if (result.ok) return `完成：${result.animationIds.join('、')}`;
    if (/no playable motion bindings/iu.test(result.summary)) {
      return '失败：这个角色还没有配置能播放的动作（可以在设置的“动作”里给它绑定动作或视频）。如实告诉用户。';
    }
    return `失败：没有找到叫「${animation}」的动作。`;
  },
};

/** Only characters with bound motions get play_animation; others would fail every call. */
function canPlayAnimation(runtime: Pick<ConversationToolRuntime, 'configRef' | 'petId'>) {
  const config = runtime.configRef.current;
  const slot = getDesktopPetSlot(config, runtime.petId || PRIMARY_DESKTOP_PET_SLOT_ID)
    ?? getDesktopPetSlot(config, PRIMARY_DESKTOP_PET_SLOT_ID);
  return Boolean(slot && resolvePetModelMotionBindingsForModel(slot.modelType, slot.modelUrl, config.customModelPresets).length > 0);
}

/** web_search reuses the chat's own search (the one characters already used without asking). */
const webSearchTool: ConversationTool = {
  confirmation: () => null,
  definition: {
    function: {
      description: '联网搜索，返回搜索结果摘要（标题、链接、片段）。查新闻、天气、资料、价格等实时信息时用。',
      name: 'web_search',
      parameters: { properties: { query: { description: '搜索关键词', type: 'string' } }, required: ['query'], type: 'object' },
    },
    type: 'function',
  },
  run: async (runtime, args) => {
    const query = str(args, 'query');
    if (!query) return '需要 query。';
    const { buildExternalWebSearchInstruction } = await import('../../services/geminiService');
    const { settings, personality } = runtime.configRef.current;
    const text = await buildExternalWebSearchInstruction(query, personality, settings, 'allow', 'tool');
    if (!text.trim()) return '联网搜索没有开启（或这次没有结果）。可以用 open_url 打开搜索页给用户看，或告诉用户可以在设置里开启联网搜索。';
    return text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}\n（结果太长，后面省略了）` : text;
  },
};

export function listConversationAgentBridgeTools(runtime: Pick<ConversationToolRuntime, 'configRef' | 'executeAgentCommand' | 'petId'>): ConversationTool[] {
  return [
    webSearchTool,
    ...(canPlayAnimation(runtime) ? [playAnimationTool] : []),
    ...(runtime.executeAgentCommand ? BRIDGE_SPECS.map(bridgeTool) : []),
  ];
}
