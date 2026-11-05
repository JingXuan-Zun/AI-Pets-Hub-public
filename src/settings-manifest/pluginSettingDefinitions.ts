import { normalizeQqBridgeSettings, resolveQqBridgeBlocker } from '../qq-bridge/qqBridgeSettings';
import type { PetConfig } from '../types';
import { normalizeWeixinBridgeSettings } from '../weixin-bridge/weixinBridgeSettings';
import { registerSettings, type SettingDefinition } from './settingsManifest';

// The built-in plugins' settings the character may change (the first users of the settings
// manifest). Logins, addresses and tokens stay on the settings pages.

const VOICE_REPLY_CHOICES = [
  { label: '总是语音', value: 'always' },
  { label: '跟着对方（发语音就回语音）', value: 'mirror' },
  { label: '不发语音', value: 'off' },
];

function withSettings(config: PetConfig, patch: Partial<PetConfig['settings']>): PetConfig {
  return { ...config, settings: { ...config.settings, ...patch } };
}

const weixin: SettingDefinition[] = [
  {
    afterChange: (_config, value) => (value ? '要有人扫码登录过才能用；还没登录的话，可以把登录二维码发给用户。' : ''),
    forModel: '“把微信连接关了”“开启微信连接”：手机微信能不能找到你。只说“把微信关了”时也可能是指电脑上的微信程序，说不清先问用户是哪一个。',
    group: '微信连接',
    id: 'weixin.enabled',
    kind: 'boolean',
    label: '开关',
    pageId: 'platform-weixin',
    read: (config) => normalizeWeixinBridgeSettings(config.settings.weixinBridge).enabled,
    risk: 'change',
    write: (config, value) => withSettings(config, { weixinBridge: { ...normalizeWeixinBridgeSettings(config.settings.weixinBridge), enabled: value === true } }),
  },
  {
    choices: VOICE_REPLY_CHOICES,
    forModel: '“微信上别发语音了”“微信里都用语音回我”：在微信上回复时要不要附一段她的语音（以短视频发过去）。',
    group: '微信连接',
    id: 'weixin.voiceReplyMode',
    kind: 'choice',
    label: '语音回复',
    pageId: 'platform-weixin',
    read: (config) => normalizeWeixinBridgeSettings(config.settings.weixinBridge).voiceReplyMode,
    risk: 'personal',
    write: (config, value) => withSettings(config, { weixinBridge: { ...normalizeWeixinBridgeSettings(config.settings.weixinBridge), voiceReplyMode: value as 'always' } }),
  },
];

const qq: SettingDefinition[] = [
  {
    afterChange: (config, value) => (value ? resolveQqBridgeBlocker(normalizeQqBridgeSettings(config.settings.qqBridge)) ?? '' : ''),
    forModel: '“把 QQ 连接关了”“开启 QQ 连接”：手机 QQ 能不能找到你。只说“把 QQ 关了”时也可能是指电脑上的 QQ 程序，说不清先问用户是哪一个。',
    group: 'QQ 连接',
    id: 'qq.enabled',
    kind: 'boolean',
    label: '开关',
    pageId: 'platform-qq',
    read: (config) => normalizeQqBridgeSettings(config.settings.qqBridge).enabled,
    risk: 'change',
    write: (config, value) => withSettings(config, { qqBridge: { ...normalizeQqBridgeSettings(config.settings.qqBridge), enabled: value === true } }),
  },
  {
    choices: VOICE_REPLY_CHOICES,
    forModel: '“QQ 上别发语音了”“QQ 里用语音回我”：在 QQ 上回复时要不要附一条她的语音。',
    group: 'QQ 连接',
    id: 'qq.voiceReplyMode',
    kind: 'choice',
    label: '语音回复',
    pageId: 'platform-qq',
    read: (config) => normalizeQqBridgeSettings(config.settings.qqBridge).voiceReplyMode,
    risk: 'personal',
    write: (config, value) => withSettings(config, { qqBridge: { ...normalizeQqBridgeSettings(config.settings.qqBridge), voiceReplyMode: value as 'mirror' } }),
  },
];

const comfyUi: SettingDefinition[] = [
  {
    forModel: '“画图多等一会儿”“画图超时了”：画一张图最多等多久（带高清放大的工作流慢）。',
    format: (value) => `${Math.round(Number(value) / 60)} 分钟`,
    group: '画图（ComfyUI）',
    id: 'comfyui.timeoutSeconds',
    kind: 'number',
    label: '一张图最多等（秒）',
    pageId: 'platform-workflow',
    range: { max: 1800, min: 60, step: 60 },
    read: (config) => config.settings.comfyUi.timeoutSeconds,
    risk: 'personal',
    write: (config, value) => withSettings(config, { comfyUi: { ...config.settings.comfyUi, timeoutSeconds: Math.round(Number(value)) } }),
  },
  {
    choices: (config) => config.settings.comfyUi.workflows.map((workflow) => ({ label: workflow.name, value: workflow.id })),
    forModel: '“以后默认用写实那个画”：不指定时用哪个工作流画图。',
    group: '画图（ComfyUI）',
    id: 'comfyui.defaultWorkflow',
    kind: 'choice',
    label: '默认工作流',
    pageId: 'platform-workflow',
    read: (config) => config.settings.comfyUi.defaultWorkflowId,
    risk: 'personal',
    write: (config, value) => withSettings(config, { comfyUi: { ...config.settings.comfyUi, defaultWorkflowId: String(value) } }),
  },
];

registerSettings([...weixin, ...qq, ...comfyUi]);
