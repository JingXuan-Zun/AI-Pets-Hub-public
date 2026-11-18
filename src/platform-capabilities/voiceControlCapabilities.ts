import type { LocalVoiceHealth, PetConfig, TtsProvider } from '../types';
import { getLocalVoiceHealth, warmupLocalVoice } from '../voice/runtime';
import { getVoiceInputSessionController } from '../voice/voiceInputSessionControl';
import { booleanArg, stringArg } from './platformCapabilityArgs';
import type { PlatformCapability, PlatformCapabilityContext } from './platformCapabilityTypes';

// Voice switches the character can reach from conversation (2026-11-11): what the voice is set to,
// the voice input switch, listening now, where the reading voice comes from, warming up the local
// voice. These were tools of the old executor, which the conversation loop no longer calls, so
// "把语音输入关掉" / "换成 Edge 的声音" had quietly stopped working. Voice packs, wake words and
// how replies are read have their own capabilities (voice.set_pet_voice / set_wake_words / set_reading).

type Settings = PetConfig['settings'];

const SOURCE_LABELS: Record<TtsProvider, string> = {
  api: 'API 语音',
  browser: 'Edge-TTS',
  'gpt-sovits': 'GPT-SoVITS 角色音色',
  local: '本地语音模型',
};
const SOURCES = Object.keys(SOURCE_LABELS) as TtsProvider[];
const LOCAL_HEALTH_TIMEOUT_MS = 6000;

function onOff(value: boolean) {
  return value ? '开' : '关';
}

function commitSettings(context: PlatformCapabilityContext, patch: Partial<Settings>) {
  const config = context.configRef.current;
  const next = { ...config, settings: { ...config.settings, ...patch } };
  context.configRef.current = next;
  context.onUpdateConfig(next, { persist: true });
}

function sourceLabel(provider: string) {
  return SOURCE_LABELS[provider as TtsProvider] ?? provider;
}

function localHealthText(health: LocalVoiceHealth) {
  const ready = [`朗读${health.ttsReady ? '就绪' : '未就绪'}`, `识别${health.sttReady ? '就绪' : '未就绪'}`].join('，');
  const missing = health.missingPackages.length ? `，缺少：${health.missingPackages.slice(0, 6).join('、')}` : '';
  const notes = health.messages.length ? `（${health.messages.slice(0, 3).join('；')}）` : '';
  return `本地语音${health.available ? '可用' : '不可用'}：${ready}${missing}${notes}`;
}

function usesLocalVoice(settings: Settings) {
  return settings.ttsProvider === 'local' || settings.sttProvider === 'local';
}

const voiceStatus: PlatformCapability = {
  args: [],
  description: 'How the voice is set right now: reading aloud on/off, voice input on/off, where the reading voice and the recognition come from (“语音现在是什么状态”“你现在用的什么声音”“为什么不念了”).',
  describe: () => '查看语音状态',
  group: '声音',
  id: 'voice.status',
  risk: 'read',
  run: async ({ configRef }) => {
    const settings = configRef.current.settings;
    const lines = [
      `朗读总开关：${onOff(settings.voiceEnabled)}；自动朗读回复：${onOff(settings.autoSpeakResponses)}`,
      `朗读的声音来自：${sourceLabel(settings.ttsProvider)}`,
      `语音输入：${onOff(settings.voiceInputEnabled)}；识别来自：${sourceLabel(settings.sttProvider)}`,
    ];
    if (usesLocalVoice(settings)) {
      // The local voice runtime can take very long to answer while it is starting or busy; the
      // switches above are what was asked for, so they are not held up by it.
      const health = await Promise.race([
        getLocalVoiceHealth(settings).catch(() => null),
        new Promise<null>((resolve) => { setTimeout(() => resolve(null), LOCAL_HEALTH_TIMEOUT_MS); }),
      ]);
      lines.push(health ? localHealthText(health) : '本地语音的运行状态一时读不到（可能还在启动或正忙），可以稍后再问，或到 设置 → 语音 里看。');
    }
    return { ok: true, text: lines.join('\n') };
  },
  title: '查看语音状态',
};

const setVoiceInput: PlatformCapability = {
  args: [{ description: 'true = voice input on, false = off.', key: 'enabled', required: true, type: 'boolean' }],
  description: 'The voice input switch (“把语音输入打开/关掉”“别用麦克风了”). Off means the microphone button and the wake words do nothing. To start or stop listening right now use voice.listen.',
  describe: (args) => `${booleanArg(args, 'enabled') === false ? '关闭' : '打开'}语音输入`,
  group: '声音',
  id: 'voice.set_input',
  risk: 'personal',
  run: async (context, args) => {
    const enabled = booleanArg(args, 'enabled');
    if (enabled === null) return { ok: false, text: '是要打开还是关掉语音输入？' };
    // Switching it off while she is listening would leave the microphone open.
    if (!enabled) await getVoiceInputSessionController()?.stop();
    commitSettings(context, { voiceInputEnabled: enabled });
    return { ok: true, text: enabled ? '语音输入打开了：可以点聊天框的麦克风，或者喊唤醒词。' : '语音输入关掉了：麦克风按钮和唤醒词都不再起作用，直到再打开。' };
  },
  title: '开关语音输入',
};

const listen: PlatformCapability = {
  args: [{ description: 'start = listen to the user now; stop = stop listening.', enumValues: ['start', 'stop'], key: 'action', required: true, type: 'string' }],
  description: 'Start or stop listening through the microphone right now (“开始听我说”“我要说话了”“别听了”“停止录音”). Starting needs the voice input switch on (voice.set_input).',
  describe: (args) => (stringArg(args, 'action') === 'stop' ? '停止听你说话' : '开始听你说话'),
  group: '声音',
  id: 'voice.listen',
  risk: 'personal',
  run: async (context, args) => {
    const action = stringArg(args, 'action');
    if (action !== 'start' && action !== 'stop') return { ok: false, text: '是要开始听，还是停止听？' };
    const controller = getVoiceInputSessionController();
    if (!controller) return { ok: false, text: '现在控制不了麦克风：桌宠窗口还没准备好。' };
    if (action === 'start' && !context.configRef.current.settings.voiceInputEnabled) {
      return { ok: false, text: '语音输入的开关是关着的，要先打开（voice.set_input）才能开始听。' };
    }
    const result = await (action === 'start' ? controller.start() : controller.stop());
    const text = result.responseText || result.errorText || (action === 'start' ? '开始听了。' : '不听了。');
    return { ok: result.ok !== false && !result.errorText, text };
  },
  title: '开始或停止听你说话',
};

const setVoiceSource: PlatformCapability = {
  args: [
    { description: `Where the reading voice comes from: ${SOURCES.map((source) => `${source} = ${SOURCE_LABELS[source]}`).join(', ')}.`, enumValues: SOURCES, key: 'source', required: true, type: 'string' },
    { description: 'Also turn reading aloud on (true) or off (false).', key: 'voiceEnabled', type: 'boolean' },
  ],
  description: 'Switch where the reading voice comes from (“换成 Edge 的声音”“用回她自己的声音/GPT-SoVITS”“用 API 语音”), and optionally turn reading aloud on or off altogether (“把声音关了”“开声音”). Which voice pack a character uses is voice.set_pet_voice.',
  describe: (args) => `把朗读的声音换成${sourceLabel(stringArg(args, 'source'))}`,
  group: '声音',
  id: 'voice.set_source',
  risk: 'personal',
  run: (context, args) => {
    const source = stringArg(args, 'source') as TtsProvider;
    const voiceEnabled = booleanArg(args, 'voiceEnabled');
    if (!SOURCES.includes(source)) return { ok: false, text: `声音来源只能是：${SOURCES.map((entry) => `${entry}（${SOURCE_LABELS[entry]}）`).join('、')}。` };
    commitSettings(context, { ttsProvider: source, ...(voiceEnabled === null ? {} : { voiceEnabled }) });
    const next = context.configRef.current.settings;
    return {
      ok: true,
      text: `朗读的声音换成了${SOURCE_LABELS[source]}，朗读总开关${onOff(next.voiceEnabled)}。${source === 'local' ? '本地语音第一次会慢一些，可以先预热（voice.warmup）。' : ''}`,
    };
  },
  title: '切换朗读的声音来源',
};

const warmup: PlatformCapability = {
  args: [],
  description: 'Load the local voice model ahead of time so the first sentence is not slow (“预热一下语音”“语音第一句太慢”). Only matters when the local voice is in use.',
  describe: () => '预热本地语音',
  group: '声音',
  id: 'voice.warmup',
  risk: 'read',
  run: async ({ configRef }) => {
    const settings = configRef.current.settings;
    try {
      await warmupLocalVoice(settings);
      const health = await getLocalVoiceHealth(settings);
      return { ok: health.available, text: `${health.available ? '预热好了。' : '预热过了，但本地语音还不能用。'}${localHealthText(health)}` };
    } catch (error) {
      return { ok: false, text: `预热没成功：${error instanceof Error ? error.message : String(error)}。可以到 设置 → 语音 看看运行环境和模型文件。` };
    }
  },
  title: '预热本地语音',
};

export const VOICE_CONTROL_CAPABILITIES: PlatformCapability[] = [voiceStatus, setVoiceInput, listen, setVoiceSource, warmup];
