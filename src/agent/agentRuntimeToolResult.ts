import {
  type AgentChatCommandResult,
  type AgentChatFollowUpAction,
  type AgentToolCallCommand,
} from './agentChatCommand';
import { createDesktopOrganizationFollowUpActionFromToolCall } from './agentRuntimeDesktopOrganizationTools';

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
    case 'remember_local_app':
      return '请确认路径存在，并且是 exe、lnk、url 或 appref-ms 文件。';
    case 'execute_memory_action':
      return '可以提供更明确的记忆分类、key 或查询词；写入/删除记忆需要用户确认。';
    case 'organize_desktop_icons':
      return '可以先让我重新观察桌面并生成整理计划，再确认执行。';
    case 'inspect_local_project':
      return '请提供本机绝对路径，例如 D:\\项目名。';
    case 'run_local_project_action':
      return '可以先让我分析项目，再说运行第几个候选动作。';
    case 'get_system_info':
      return '请确认当前运行的是桌面版应用，并且桌面桥接能力可用。';
    case 'get_pet_settings':
      return '可以指定一个配置 path，或用 query 搜索当前桌宠配置路径。';
    case 'update_pet_settings':
      return '先读取对应配置路径，确认现有字段类型后再提交 changesJson。';
    case 'use_platform_capability':
      return '检查能力名称和参数是否正确；能力列表在工具说明里。';
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

  return null;
}

function createAgentRuntimeToolVerification(toolCall: AgentToolCallCommand, ok: boolean) {
  if (!ok) {
    return null;
  }

  switch (toolCall.name) {
    case 'remember_local_app':
      return '应用位置已写入本机应用记忆，并同步到全局知识库。';
    case 'execute_memory_action':
      return 'Agent 记忆工具已返回结果；写入和删除动作会走全局知识库持久化流程。';
    case 'organize_desktop_icons':
      return '桌面整理工具已返回结果；预览模式不会移动图标，执行模式会在完成后做位置复查。';
    case 'inspect_local_project':
      return '本地项目分析为只读检查，结果已缓存给后续运行候选动作使用。';
    case 'run_local_project_action':
      return '项目候选动作已交给受限运行器处理，不执行任意临时命令。';
    case 'get_system_info':
      return '系统信息来自当前桌面运行时。';
    case 'get_pet_settings':
      return '桌宠配置来自当前运行配置；敏感值会在返回前隐藏。';
    case 'update_pet_settings':
      return '桌宠配置已经通过规范化后保存，并返回每个请求路径的实际值。';
    case 'use_platform_capability':
      return '平台能力已经执行，结果来自能力本身的回读。';
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
