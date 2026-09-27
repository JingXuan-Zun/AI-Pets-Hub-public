import {
  type AgentChatCommandResult,
  type AgentChatFollowUpAction,
  type AgentToolCallCommand,
} from './agentChatCommand';
import { createDesktopOrganizationFollowUpActionFromToolCall } from './agentRuntimeDesktopOrganizationTools';
import {
  createFileManagementExecuteCommand,
  getFileManagementActionInput,
  getFileManagementModeInput,
  normalizeExecuteFileManagementAction,
} from './agentRuntimeLocalFileTools';

function getToolBooleanInput(toolCall: AgentToolCallCommand, key: string) {
  const value = toolCall.input?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

export function createAgentRuntimeResult(options: AgentChatCommandResult): AgentChatCommandResult {
  return {
    ...options,
    ok: options.ok ?? !options.errorText,
  };
}

function createAgentRuntimeObservation(toolCall: AgentToolCallCommand) {
  const goalText = toolCall.goal?.trim();
  const inputKeys = Object.keys(toolCall.input ?? {}).filter((key) => toolCall.input[key] !== undefined);
  return [
    `Tool: ${toolCall.name}`,
    goalText ? `Goal: ${goalText}` : '',
    inputKeys.length ? `Input keys: ${inputKeys.join(', ')}` : '',
  ].filter(Boolean).join(' | ');
}

function inferAgentRuntimeToolResultOk(result: AgentChatCommandResult) {
  if (typeof result.ok === 'boolean') {
    return result.ok;
  }

  if (result.errorText) {
    return false;
  }

  return !/失败|没有找到|没能|还没有|缺少|不可用|不能|无法|未通过|被拦截/u.test(result.responseText);
}

function createAgentRuntimeToolFollowUp(toolCall: AgentToolCallCommand, ok: boolean) {
  if (ok) {
    return null;
  }

  switch (toolCall.name) {
    case 'browser_search':
    case 'search_web':
      return '可以换一个更明确的搜索词或网址；如果浏览器路径没有配置，可以先在系统设置里检测或指定浏览器。';
    case 'get_default_app_for_uri':
      return '可以先读取系统默认应用；如果系统没有返回结果，再询问用户偏好的应用。';
    case 'list_running_apps':
      return '可以换一个窗口标题或进程名继续筛选。';
    case 'get_active_window_info':
      return '请确认当前运行的是桌面版应用，并且前台有可读窗口。';
    case 'list_capture_sources':
      return '可以改为只列 screen 或 window，或强制刷新捕获源列表。';
    case 'get_cursor_position':
      return '请确认当前运行的是桌面版应用，并且 Electron screen 能读取鼠标坐标。';
    case 'focus_window':
      return '可以先列出当前运行窗口，再按进程名或窗口标题唤出。';
    case 'open_resource':
      return '可以提供更明确的网址、文件/文件夹绝对路径，或应用名称。';
    case 'launch_local_app':
      return '可以换一个更完整的应用名，或者提供 exe/lnk 路径让我记住。';
    case 'remember_local_app':
      return '请确认路径存在，并且是 exe、lnk、url 或 appref-ms 文件。';
    case 'execute_memory_action':
      return '可以提供更明确的记忆分类、key 或查询词；写入/删除记忆需要用户确认。';
    case 'get_path_info':
      return '请提供本机绝对路径，例如 D:\\文件夹\\文件.txt。';
    case 'list_directory':
      return '请提供一个存在的本机文件夹绝对路径。';
    case 'search_files':
      return '请同时提供搜索根目录的绝对路径，以及要匹配的文件名关键词。';
    case 'read_text_file':
      return '请提供一个存在的文本文件绝对路径；二进制文件不会被读取内容。';
    case 'organize_desktop_icons':
      return '可以先让我重新观察桌面并生成整理计划，再确认执行。';
    case 'place_desktop_icon':
      return '请同时说明目标图标、参照图标，以及上/下/左/右方向。';
    case 'inspect_local_project':
      return '请提供本机绝对路径，例如 D:\\项目名。';
    case 'run_local_project_action':
      return '可以先让我分析项目，再说运行第几个候选动作。';
    case 'get_display_info':
    case 'get_system_info':
      return '请确认当前运行的是桌面版应用，并且桌面桥接能力可用。';
    case 'get_pet_settings':
      return '可以指定一个配置 path，或用 query 搜索当前桌宠配置路径。';
    case 'update_pet_settings':
      return '先读取对应配置路径，确认现有字段类型后再提交 changesJson。';
    case 'get_voice_status':
      return '可以到语音设置里检查播报、输入、TTS/STT 来源和本地语音环境。';
    case 'switch_tts_provider':
      return '请说明要切换到 Edge-TTS 本地、API 语音，还是本地语音。';
    case 'warmup_local_voice':
      return '可以先检查本地语音运行时、依赖和模型文件，再重新预热。';
    case 'set_voice_input':
      return '请明确是开启还是关闭语音输入。';
    case 'start_voice_input_session':
      return '请确认语音输入已开启，并允许应用访问麦克风。';
    case 'stop_voice_input_session':
      return '当前可能没有正在进行的语音输入监听。';
    default:
      return null;
  }
}

function createAgentRuntimeToolFollowUpAction(
  toolCall: AgentToolCallCommand,
  ok: boolean,
  followUpText: string | null,
): AgentChatFollowUpAction | null {
  if (!followUpText) {
    return null;
  }

  if (!ok) {
    return {
      kind: 'ask-user',
      label: '补充信息',
      prompt: followUpText,
    };
  }

  if (toolCall.name === 'organize_desktop_icons') {
    return createDesktopOrganizationFollowUpActionFromToolCall(toolCall);
  }

  if (toolCall.name === 'execute_file_management_action') {
    const mode = getFileManagementModeInput(toolCall);
    const action = normalizeExecuteFileManagementAction(getFileManagementActionInput(toolCall));
    const dryRun = getToolBooleanInput(toolCall, 'dryRun') === true;
    if (mode === 'preview' || action === 'preview' || dryRun) {
      const command = createFileManagementExecuteCommand(toolCall.goal ?? '', toolCall);
      if (command) {
        return {
          command,
          kind: 'run-command',
          label: '执行文件整理计划',
          requiresApproval: true,
        };
      }
    }
  }

  return null;
}

function createAgentRuntimeToolVerification(toolCall: AgentToolCallCommand, ok: boolean) {
  if (!ok) {
    return null;
  }

  switch (toolCall.name) {
    case 'browser_search':
    case 'search_web':
      return '浏览器搜索工具已返回结果；如果页面已打开但文本读取失败，会标记为已打开但未完整读取。';
    case 'get_default_app_for_uri':
      return '默认应用信息来自当前系统 URI 关联。';
    case 'list_running_apps':
      return '运行应用和窗口信息来自当前桌面进程窗口列表。';
    case 'get_active_window_info':
      return '当前活动窗口信息来自 Windows 前台窗口查询。';
    case 'list_capture_sources':
      return '捕获源列表来自当前屏幕和可见窗口枚举；这属于视觉观察上下文。';
    case 'get_cursor_position':
      return '鼠标位置来自当前屏幕坐标。';
    case 'focus_window':
      return '窗口聚焦请求已交给桌面运行时处理，并返回匹配窗口信息。';
    case 'open_resource':
      return '系统资源打开请求已交给操作系统处理。';
    case 'launch_local_app':
      return '应用启动工具已返回成功状态；如果已有窗口存在，会优先唤出已有窗口。';
    case 'remember_local_app':
      return '应用位置已写入本机应用记忆，并同步到全局知识库。';
    case 'execute_memory_action':
      return 'Agent 记忆工具已返回结果；写入和删除动作会走全局知识库持久化流程。';
    case 'get_path_info':
      return '路径信息来自本机只读文件系统检查。';
    case 'list_directory':
      return '目录条目来自本机只读文件系统检查，没有修改文件。';
    case 'search_files':
      return '文件搜索只匹配文件名，没有读取文件内容或修改文件。';
    case 'read_text_file':
      return '文本内容来自本机只读文件读取，运行时会限制读取大小并拒绝明显二进制文件。';
    case 'organize_desktop_icons':
      return '桌面整理工具已返回结果；预览模式不会移动图标，执行模式会在完成后做位置复查。';
    case 'place_desktop_icon':
      return '单图标摆放工具已返回结果，并由桌面图标流程负责复查位置。';
    case 'inspect_local_project':
      return '本地项目分析为只读检查，结果已缓存给后续运行候选动作使用。';
    case 'run_local_project_action':
      return '项目候选动作已交给受限运行器处理，不执行任意临时命令。';
    case 'get_display_info':
      return '屏幕信息来自当前桌面运行时。';
    case 'get_system_info':
      return '系统信息来自当前桌面运行时。';
    case 'get_pet_settings':
      return '桌宠配置来自当前运行配置；敏感值会在返回前隐藏。';
    case 'update_pet_settings':
      return '桌宠配置已经通过规范化后保存，并返回每个请求路径的实际值。';
    case 'get_voice_status':
      return '语音状态来自当前配置；本地语音健康状态来自桌面运行时。';
    case 'switch_tts_provider':
      return '语音播报来源已经写入当前配置，并会走现有设置持久化流程。';
    case 'warmup_local_voice':
      return '本地语音预热请求已经交给本地语音运行时处理。';
    case 'set_voice_input':
      return '语音输入开关已经写入当前配置；v1 不会直接启动麦克风监听会话。';
    case 'start_voice_input_session':
      return '语音输入监听已经由聊天层控制器启动；识别结果会回到当前聊天输入流。';
    case 'stop_voice_input_session':
      return '语音输入监听停止请求已经交给聊天层控制器处理。';
    default:
      return null;
  }
}

export function enrichAgentRuntimeToolResult(
  toolCall: AgentToolCallCommand,
  result: AgentChatCommandResult,
): AgentChatCommandResult {
  const ok = inferAgentRuntimeToolResultOk(result);
  const followUp = result.followUp ?? createAgentRuntimeToolFollowUp(toolCall, ok);
  const followUpActions = result.followUpActions?.length
    ? result.followUpActions
    : result.followUpAction
      ? [result.followUpAction]
      : [];
  const observations = [
    createAgentRuntimeObservation(toolCall),
    ...(result.observations ?? []),
  ].filter(Boolean);

  return createAgentRuntimeResult({
    ...result,
    errorText: ok ? result.errorText ?? null : result.errorText ?? result.responseText,
    followUp,
    followUpAction: followUpActions[0] ?? createAgentRuntimeToolFollowUpAction(toolCall, ok, followUp),
    followUpActions: followUpActions.length
      ? followUpActions
      : (() => {
          const action = createAgentRuntimeToolFollowUpAction(toolCall, ok, followUp);
          return action ? [action] : null;
        })(),
    observations,
    ok,
    verification: result.verification ?? createAgentRuntimeToolVerification(toolCall, ok),
  });
}
