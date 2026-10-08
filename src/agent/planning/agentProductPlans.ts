import { type AgentChatCommand } from '../agentChatCommand';
import { type AgentExecutionPlan, getToolCallTargetDescription, createPlanStep } from './agentPlanShared';

function getVoiceProviderText(value: unknown) {
  if (value === 'api') {
    return 'API 语音';
  }

  if (value === 'local') {
    return '本地语音模型';
  }

  if (value === 'browser') {
    return 'Edge-TTS 本地';
  }

  return '未指定语音来源';
}

function getVoiceInputEnabledText(value: unknown) {
  return value === false ? '关闭语音输入' : '开启语音输入';
}

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

    case 'get_display_info':
      return {
        commandKind: command.kind,
        goal: explicitGoal || '读取当前屏幕信息',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'read-display-info',
            'read-display-info',
            '读取当前屏幕数量、分辨率、工作区和缩放比例',
            {
              requiresDesktopMode: true,
              targetDescription: '显示器信息',
            },
          ),
        ],
      };

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

    case 'get_voice_status':
      return {
        commandKind: command.kind,
        goal: explicitGoal || '读取当前语音状态',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'read-voice-status',
            'read-voice-status',
            '读取语音播报、语音输入、TTS/STT 来源和本地语音健康状态',
            {
              requiresDesktopMode: true,
              targetDescription: '语音设置',
            },
          ),
        ],
      };

    case 'switch_tts_provider': {
      const provider = command.toolCall?.input?.provider ?? command.toolCall?.input?.ttsProvider;
      return {
        commandKind: command.kind,
        goal: explicitGoal || `切换语音播报来源：${getVoiceProviderText(provider)}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'switch-tts-provider',
            'switch-tts-provider',
            `修改语音播报来源为${getVoiceProviderText(provider)}`,
            {
              details: [
                typeof command.toolCall?.input?.enableVoice === 'boolean'
                  ? `播报总开关：${command.toolCall.input.enableVoice ? '开启' : '关闭'}`
                  : '',
                typeof command.toolCall?.input?.autoSpeak === 'boolean'
                  ? `自动播报：${command.toolCall.input.autoSpeak ? '开启' : '关闭'}`
                  : '',
              ].filter(Boolean),
              requiresDesktopMode: true,
              reversible: true,
              targetDescription: getVoiceProviderText(provider),
            },
          ),
        ],
      };
    }

    case 'warmup_local_voice':
      return {
        commandKind: command.kind,
        goal: explicitGoal || '预热本地语音模型',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'warmup-local-voice',
            'warmup-local-voice',
            '启动或唤醒本地语音运行时并加载所需模型',
            {
              details: [
                '可能会占用本机 CPU/GPU 和一点启动时间。',
              ],
              requiresDesktopMode: true,
              targetDescription: '本地语音运行时',
            },
          ),
        ],
      };

    case 'set_voice_input':
      return {
        commandKind: command.kind,
        goal: explicitGoal || getVoiceInputEnabledText(command.toolCall?.input?.enabled),
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'set-voice-input',
            'set-voice-input',
            getVoiceInputEnabledText(command.toolCall?.input?.enabled),
            {
              details: [
                'v1 只修改语音输入开关，不会直接启动麦克风监听。',
              ],
              requiresDesktopMode: true,
              reversible: true,
              targetDescription: '语音输入设置',
            },
          ),
        ],
      };

    case 'start_voice_input_session':
      return {
        commandKind: command.kind,
        goal: explicitGoal || '开始一次语音输入监听',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'start-voice-input-session',
            'start-voice-input-session',
            '打开麦克风并开始一次语音输入监听',
            {
              details: [
                '会停止当前角色语音播报，以减少回声。',
                '识别到最终文本后会按聊天输入发送。',
              ],
              requiresDesktopMode: true,
              targetDescription: '麦克风语音输入',
            },
          ),
        ],
      };

    case 'stop_voice_input_session':
      return {
        commandKind: command.kind,
        goal: explicitGoal || '停止当前语音输入监听',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'stop-voice-input-session',
            'stop-voice-input-session',
            '停止当前正在进行的语音输入监听',
            {
              requiresDesktopMode: true,
              targetDescription: '麦克风语音输入',
            },
          ),
        ],
      };
    default: return null;
  }
}
