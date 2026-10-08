import { type LocalVoiceHealth, type PetConfig, type TtsProvider } from '../types';
import {
  getLocalVoiceHealth,
  warmupLocalVoice,
} from '../voice/runtime';
import {
  type AgentChatCommandResult,
  type AgentToolCallCommand,
} from './agentChatCommand';
import { type AgentRuntimeExecutorContext } from './agentRuntimeExecutor';

function getToolStringInput(toolCall: AgentToolCallCommand, keys: string[]) {
  const input = toolCall.input ?? {};
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function getToolBooleanInput(toolCall: AgentToolCallCommand, key: string) {
  const value = toolCall.input?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

function getVoiceProviderLabel(provider: TtsProvider) {
  if (provider === 'gpt-sovits') {
    return 'GPT-SoVITS 角色音色';
  }

  if (provider === 'api') {
    return 'API 语音';
  }

  if (provider === 'local') {
    return '本地语音模型';
  }

  return 'Edge-TTS 本地';
}

function formatEnabledText(enabled: boolean) {
  return enabled ? '已开启' : '已关闭';
}

function formatLocalVoiceHealthLine(health: LocalVoiceHealth | null) {
  if (!health) {
    return '本地语音健康状态：未读取。';
  }

  const runtimeText = health.runtimeLabel || health.executable || '未检测到运行时';
  const readyText = [
    health.ttsReady ? 'TTS 就绪' : 'TTS 未就绪',
    health.sttReady ? 'STT 就绪' : 'STT 未就绪',
    health.referenceReady ? '参考音频就绪' : '参考音频未就绪',
  ].join('，');
  const missingText = health.missingPackages.length
    ? `，缺少依赖：${health.missingPackages.slice(0, 6).join('、')}`
    : '';
  const messageText = health.messages.length
    ? `\n本地语音提示：${health.messages.slice(0, 3).join('；')}`
    : '';

  return `本地语音健康状态：${health.available ? '可用' : '不可用'}，${health.status}，${runtimeText}，设备 ${health.device}，${readyText}${missingText}。${messageText}`;
}

function formatVoiceStatus(settings: PetConfig['settings'], localHealth: LocalVoiceHealth | null) {
  return [
    '当前语音状态：',
    `播报总开关：${formatEnabledText(settings.voiceEnabled)}`,
    `自动播报：${formatEnabledText(settings.autoSpeakResponses)}`,
    `语音输入：${formatEnabledText(settings.voiceInputEnabled)}`,
    `播报来源：${getVoiceProviderLabel(settings.ttsProvider)}`,
    `识别来源：${getVoiceProviderLabel(settings.sttProvider)}`,
    `识别语言：${settings.speechRecognitionLang || '未设置'}`,
    settings.voiceName ? `音色名称：${settings.voiceName}` : '',
    formatLocalVoiceHealthLine(localHealth),
  ].filter(Boolean).join('\n');
}

function updateRuntimeSettings(
  context: AgentRuntimeExecutorContext,
  patch: Partial<PetConfig['settings']>,
) {
  const currentConfig = context.configRef.current;
  const nextConfig = {
    ...currentConfig,
    settings: {
      ...currentConfig.settings,
      ...patch,
    },
  };

  context.onUpdateConfig(nextConfig);
  return nextConfig;
}

export async function executeGetVoiceStatus(
  runtime: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const includeLocalHealth = getToolBooleanInput(toolCall, 'includeLocalHealth') !== false;
  const settings = runtime.configRef.current.settings;
  const localHealth = includeLocalHealth
    ? await getLocalVoiceHealth(settings)
    : null;

  return {
    observations: [
      `Voice enabled: ${settings.voiceEnabled}`,
      `Voice input enabled: ${settings.voiceInputEnabled}`,
      `Auto speak responses: ${settings.autoSpeakResponses}`,
      `TTS provider: ${settings.ttsProvider}`,
      `STT provider: ${settings.sttProvider}`,
      localHealth ? `Local voice health: ${localHealth.status}` : '',
    ].filter(Boolean),
    responseText: formatVoiceStatus(settings, localHealth),
  };
}

export function executeSetVoiceInput(
  runtime: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): AgentChatCommandResult {
  const enabled = getToolBooleanInput(toolCall, 'enabled');
  if (typeof enabled !== 'boolean') {
    return {
      responseText: '要调整语音输入，需要明确是开启还是关闭。',
    };
  }

  updateRuntimeSettings(runtime, {
    voiceInputEnabled: enabled,
  });

  return {
    observations: [
      `Voice input enabled set to: ${enabled}`,
    ],
    responseText: enabled
      ? '语音输入开关已经打开。现在可以用聊天框里的麦克风按钮开始一次语音输入；v1 还不会由 Agent 直接启动持续监听。'
      : '语音输入开关已经关闭。聊天框里的麦克风输入会保持不可用，直到你再次打开它。',
    verification: `voiceInputEnabled 已更新为 ${enabled}`,
  };
}

export async function executeStartVoiceInputSession(
  runtime: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const voiceInputController = runtime.voiceInputControllerRef?.current ?? null;
  if (!voiceInputController) {
    return {
      errorText: '当前聊天层还没有接入语音输入控制器。',
      ok: false,
      responseText: '我现在还不能直接启动麦克风监听：聊天层语音输入控制器没有准备好。',
    };
  }

  return voiceInputController.start({
    agentPrefix: getToolBooleanInput(toolCall, 'agentPrefix') ?? false,
  });
}

export async function executeStopVoiceInputSession(
  runtime: AgentRuntimeExecutorContext,
): Promise<AgentChatCommandResult> {
  const voiceInputController = runtime.voiceInputControllerRef?.current ?? null;
  if (!voiceInputController) {
    return {
      errorText: '当前聊天层还没有接入语音输入控制器。',
      ok: false,
      responseText: '我现在还不能停止麦克风监听：聊天层语音输入控制器没有准备好。',
    };
  }

  return voiceInputController.stop();
}

export function executeSwitchTtsProvider(
  runtime: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): AgentChatCommandResult {
  const provider = getToolStringInput(toolCall, ['provider', 'ttsProvider']);
  if (provider !== 'browser' && provider !== 'api' && provider !== 'local') {
    return {
      responseText: '要切换语音播报来源，需要说明使用 Edge-TTS 本地、API 语音，还是本地语音。',
    };
  }

  const enableVoice = getToolBooleanInput(toolCall, 'enableVoice');
  const autoSpeak = getToolBooleanInput(toolCall, 'autoSpeak');
  const patch: Partial<PetConfig['settings']> = {
    ttsProvider: provider,
  };

  if (typeof enableVoice === 'boolean') {
    patch.voiceEnabled = enableVoice;
  }

  if (typeof autoSpeak === 'boolean') {
    patch.autoSpeakResponses = autoSpeak;
  }

  const nextConfig = updateRuntimeSettings(runtime, patch);
  const providerLabel = getVoiceProviderLabel(provider);
  const followUp = provider === 'local'
    ? '如果第一次本地语音响应比较慢，可以继续让我预热本地语音模型。'
    : null;

  return {
    followUp,
    observations: [
      `TTS provider set to: ${provider}`,
      typeof enableVoice === 'boolean' ? `Voice enabled set to: ${enableVoice}` : '',
      typeof autoSpeak === 'boolean' ? `Auto speak set to: ${autoSpeak}` : '',
    ].filter(Boolean),
    responseText: `播报来源已经切换为${providerLabel}。播报总开关：${formatEnabledText(nextConfig.settings.voiceEnabled)}；自动播报：${formatEnabledText(nextConfig.settings.autoSpeakResponses)}。`,
    verification: `ttsProvider 已更新为 ${provider}`,
  };
}

export async function executeWarmupLocalVoice(
  runtime: AgentRuntimeExecutorContext,
): Promise<AgentChatCommandResult> {
  const settings = runtime.configRef.current.settings;
  try {
    await warmupLocalVoice(settings);
    const health = await getLocalVoiceHealth(settings);

    return {
      followUp: health.available ? null : '本地语音还没有完全就绪，可以到语音设置里检查运行时、依赖和模型文件。',
      observations: [
        `Local voice warmup requested with TTS provider: ${settings.ttsProvider}`,
        `Local voice health after warmup: ${health.status}`,
      ],
      ok: health.available,
      responseText: health.available
        ? `本地语音已经完成预热。${formatLocalVoiceHealthLine(health)}`
        : `我已经尝试预热本地语音，但当前状态还不可用。${formatLocalVoiceHealthLine(health)}`,
      verification: `本地语音预热后状态：${health.status}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      errorText: message,
      followUp: '可以先检查本地语音运行时、依赖和模型文件，再重新预热。',
      ok: false,
      responseText: `本地语音预热失败：${message}`,
      verification: `本地语音预热失败：${message}`,
    };
  }
}
