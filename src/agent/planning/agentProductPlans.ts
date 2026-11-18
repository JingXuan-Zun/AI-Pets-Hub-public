import { type AgentChatCommand } from '../agentChatCommand';
import { readPlatformCapabilityToolInput } from '../agentRuntimePlatformCapabilityTools';
import { getPlatformCapability } from '../../platform-capabilities/platformCapabilityRegistry';
import { type AgentExecutionPlan, getToolCallTargetDescription, createPlanStep } from './agentPlanShared';

export function buildProductToolPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const toolName = command.toolCall?.name;
  if (!toolName) return null;
  const targetDescription = getToolCallTargetDescription(command);
  const explicitGoal = command.toolCall?.goal?.trim();
  switch (toolName) {
    case 'get_system_info': {
      const includeDisplays = command.toolCall?.input?.includeDisplays !== false;
      return {
        commandKind: command.kind,
        goal: explicitGoal || '读取当前电脑基础配置',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'read-system-info',
            'read-system-info',
            '读取本机操作系统、CPU、内存和图形设备摘要',
            {
              requiresDesktopMode: true,
              targetDescription: '本机基础配置',
            },
          ),
          ...(includeDisplays ? [
            createPlanStep(
              'read-display-info',
              'read-display-info',
              '读取当前屏幕数量、分辨率、工作区和缩放比例',
              {
                requiresDesktopMode: true,
                targetDescription: '显示器信息',
              },
            ),
          ] : []),
        ],
      };
    }

    case 'get_pet_settings':
      return {
        commandKind: command.kind,
        goal: explicitGoal || '读取桌宠配置',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'read-pet-settings',
            'read-pet-settings',
            '读取当前桌宠配置路径和值；敏感值会隐藏',
            {
              requiresDesktopMode: true,
              targetDescription: typeof command.toolCall?.input?.path === 'string'
                ? command.toolCall.input.path
                : typeof command.toolCall?.input?.query === 'string'
                  ? command.toolCall.input.query
                  : '桌宠配置',
            },
          ),
        ],
      };

    case 'use_platform_capability': {
      const { args, capability: capabilityId } = readPlatformCapabilityToolInput(command.toolCall?.input);
      const capability = getPlatformCapability(capabilityId);
      const actionKind = capability?.risk === 'change' ? 'use-platform-capability' : 'read-platform-capability';
      const summary = capability ? capability.describe(args) : `调用平台能力 ${capabilityId || '（未指定）'}`;
      return {
        commandKind: command.kind,
        goal: explicitGoal || summary,
        instruction: command.instruction,
        steps: [
          createPlanStep(actionKind, actionKind, summary, {
            requiresDesktopMode: true,
            reversible: true,
            targetDescription: capability?.group ?? '平台能力',
          }),
        ],
      };
    }

    case 'update_pet_settings':
      return {
        commandKind: command.kind,
        goal: explicitGoal || '更新桌宠配置',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'update-pet-settings',
            'update-pet-settings',
            '按请求更新桌宠配置，并在保存后回读规范化值',
            {
              details: [
                '将保留未在本次请求中提及的配置。',
                '敏感字段的值不会显示在聊天记录中。',
              ],
              requiresDesktopMode: true,
              reversible: true,
              targetDescription: '桌宠配置',
            },
          ),
        ],
      };
    default: return null;
  }
}
