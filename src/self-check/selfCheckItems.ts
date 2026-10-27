import { resolveCompatibleBlocker, resolveDevAgentLaunch } from '../dev-agent/devAgentProviders';
import { normalizeDevAgentSettings } from '../dev-agent/devAgentSettings';
import { normalizeQqBridgeSettings } from '../qq-bridge/qqBridgeSettings';
import type { DiagnosticItem } from './selfCheckTypes';

// The first checks, picked from problems actually met: the model not answering, the local
// voice service down, and the phone-QQ connection lost. Rule from the design: whenever a
// bug that can come back is fixed, add a check for it here.

function usesLocalVoice(settings: { voiceEnabled: boolean; voiceInputEnabled: boolean; ttsProvider: string; sttProvider: string }) {
  return (settings.voiceEnabled && settings.ttsProvider === 'local') || (settings.voiceInputEnabled && settings.sttProvider === 'local');
}

const modelProvider: DiagnosticItem = {
  applies: () => true,
  area: 'model',
  async check({ config, testModel }) {
    const settings = config.settings;
    const filled = settings.llmProvider === 'gemini'
      ? Boolean(settings.geminiApiKey && settings.llmModel)
      : Boolean(settings.customApiUrl && settings.customModelName);
    if (!filled) {
      return { advice: '到 设置 → AI → 模型 填好接口地址、模型名和 Key。', status: 'problem', summary: '聊天模型还没配置完整。' };
    }
    const result = await testModel(settings);
    return result.ok
      ? { status: 'ok', summary: '聊天模型能正常回复。' }
      : { advice: '检查 Key 是否有效、余额是否充足、网络（代理）是否正常；也可以在 设置 → AI → 模型 点“测试连接”。', status: 'problem', summary: `聊天模型连不上：${result.error ?? '未知原因'}` };
  },
  id: 'network.model-provider',
  risk: 'manual-only',
  title: '聊天模型',
};

const localVoice: DiagnosticItem = {
  applies: ({ config }) => usesLocalVoice(config.settings),
  area: 'voice',
  async check({ config, getLocalVoiceHealth }) {
    const health = await getLocalVoiceHealth(config.settings);
    const detail = health.messages.slice(0, 2).join('；');
    switch (health.status) {
      case 'ready':
        return { status: 'ok', summary: `本地语音可用${health.device !== 'unknown' ? `（${health.device}）` : ''}。` };
      case 'idle':
        return { advice: '可以直接让它启动。', status: 'problem', summary: '本地语音服务还没启动。' };
      case 'missing-runtime':
      case 'missing-dependencies':
        return { advice: '到 设置 → AI → 语音模型 安装本地语音环境。', status: 'problem', summary: `本地语音环境不完整${detail ? `：${detail}` : '。'}` };
      case 'missing-assets':
        return { advice: '到 设置 → AI → 语音模型 检查或重新下载语音模型。', status: 'problem', summary: `本地语音模型文件缺失${detail ? `：${detail}` : '。'}` };
      default:
        return { advice: '可以试着重新启动本地语音服务。', status: 'problem', summary: `本地语音服务出错${detail ? `：${detail}` : '。'}` };
    }
  },
  async fix({ config, warmupLocalVoice }) {
    try {
      await warmupLocalVoice(config.settings);
      return { ok: true, summary: '已启动本地语音服务。' };
    } catch (error) {
      return { ok: false, summary: error instanceof Error ? error.message : String(error) };
    }
  },
  id: 'voice.local-runtime',
  risk: 'safe',
  // Probing the Python voice runtime takes about 20 seconds.
  timeoutMs: 60000,
  title: '本地语音',
};

const qqBridge: DiagnosticItem = {
  applies: ({ config }) => {
    const qq = normalizeQqBridgeSettings(config.settings.qqBridge);
    return qq.enabled && Boolean(qq.ownerQq);
  },
  area: 'network',
  async check({ config, testOneBot }) {
    const qq = normalizeQqBridgeSettings(config.settings.qqBridge);
    const result = await testOneBot(qq.wsUrl, config.settings.qqBridgeAccessToken ?? '');
    return 'account' in result
      ? { status: 'ok', summary: `QQ 连接正常（${result.account}）。` }
      : { advice: '确认电脑上的 QQ 登录的是小号，并且 SnowLuma（launcher.bat 的窗口）正在运行。', status: 'problem', summary: `QQ 连不上：${result.error}` };
  },
  id: 'network.qq-bridge',
  risk: 'manual-only',
  title: 'QQ 连接',
};

const devAgent: DiagnosticItem = {
  applies: ({ config }) => normalizeDevAgentSettings(config.settings.devAgent).enabled,
  area: 'config',
  async check({ config, testDevAgent }) {
    const settings = normalizeDevAgentSettings(config.settings.devAgent);
    if (!settings.workspaces.length) return { advice: '到 设置 → 扩展 → 开发助手 添加项目文件夹。', status: 'problem', summary: '还没有设置项目文件夹。' };
    const apiKey = config.settings.devAgentApiKey ?? '';
    const blocker = resolveCompatibleBlocker(settings, apiKey);
    if (blocker) return { advice: '到 设置 → 扩展 → 开发助手 填好服务信息。', status: 'problem', summary: `开发助手的服务还没配好：${blocker}` };
    const result = await testDevAgent(settings.executablePath, resolveDevAgentLaunch(settings, apiKey).env);
    if (!result.installed) return { advice: '安装 Claude Code，或在 设置 → 扩展 → 开发助手 填 claude.exe 的路径。', status: 'problem', summary: '没找到 Claude Code。' };
    if (!result.loggedIn) {
      return settings.provider === 'compatible'
        ? { advice: '检查 API Key、余额和模型名。', status: 'problem', summary: `兼容接口用不了：${result.error ?? ''}` }
        : { advice: '到 设置 → 扩展 → 开发助手 点“一键登录”。', status: 'problem', summary: 'Claude Code 还没登录 Claude 账号。' };
    }
    return { status: 'ok', summary: `开发助手可用（Claude Code ${result.version ?? ''}）。` };
  },
  id: 'config.dev-agent',
  risk: 'manual-only',
  timeoutMs: 90000,
  title: '开发助手',
};

export const SELF_CHECK_ITEMS: DiagnosticItem[] = [modelProvider, localVoice, qqBridge, devAgent];
