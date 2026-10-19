import { desktopPetChatStore } from '../chatStore';
import {
  normalizeLifeCompanionSettings,
  type PetLifeCompanionSettings,
} from '../life-companion/lifeCompanionSettings';
import { applyDesktopPetSlotChanges, getDesktopPetSlots } from '../multiPetRoster';
import type { DesktopPetChatMode, PetConfig } from '../types';
import { listGptSovitsModels } from '../voice/gptSovitsRuntime';
import { booleanArg, numberArg, petListText, resolvePetSlot, stringArg } from './platformCapabilityArgs';
import type { PlatformCapability, PlatformCapabilityContext } from './platformCapabilityTypes';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/u;
const CHAT_MODE_LABELS: Record<DesktopPetChatMode, string> = { group: '群聊', single: '单聊', story: '剧情' };

function onOff(value: boolean) {
  return value ? '开' : '关';
}

function updateLifeCompanion(context: PlatformCapabilityContext, changes: Partial<PetLifeCompanionSettings>) {
  const config = context.configRef.current;
  const lifeCompanion = normalizeLifeCompanionSettings({ ...config.settings.lifeCompanion, ...changes });
  context.onUpdateConfig({ ...config, settings: { ...config.settings, lifeCompanion } });
  return lifeCompanion;
}

function missingPet(config: PetConfig, petArg: string) {
  return { ok: false, text: `没找到叫“${petArg}”的角色。现有角色：${petListText(config)}。` };
}

const lifeCompanionStatus: PlatformCapability = {
  args: [],
  description: 'Read the current life companion settings: screen watching consent, proactive chat, quiet hours.',
  describe: () => '查看生活陪伴的当前设置',
  group: '生活陪伴',
  id: 'life_companion.status',
  risk: 'read',
  run: ({ configRef }) => {
    const settings = normalizeLifeCompanionSettings(configRef.current.settings.lifeCompanion);
    return {
      ok: true,
      text: [
        `看屏幕陪伴：${settings.screenWatchConsented ? `已开启，每 ${settings.screenWatchIntervalSeconds} 秒看一次` : '关闭'}`,
        `大致感知你在做什么：${onOff(settings.desktopActivityAwarenessEnabled)}`,
        `主动聊天：${settings.proactiveEnabled ? `开，间隔 ${settings.minRandomIntervalMinutes}–${settings.maxRandomIntervalMinutes} 分钟` : '关'}`,
        `安静时段：${settings.quietHoursEnabled ? `${settings.quietHoursStart}–${settings.quietHoursEnd}` : '关'}`,
        `需要权限时开口问、没回应再提醒：${onOff(settings.approvalVoicePromptEnabled)}`,
      ].join('\n'),
    };
  },
  title: '查看生活陪伴设置',
};

const screenWatch: PlatformCapability = {
  args: [{ description: 'true to start watching the screen together, false to disconnect.', key: 'on', required: true, type: 'boolean' }],
  description: 'Start or stop consent-based screen watching (“陪着我”“看着我玩”/“别看了”). Turning it on is the user\'s consent.',
  describe: (args) => (booleanArg(args, 'on') === false ? '断开看屏幕陪伴' : '开启看屏幕陪伴：角色会定时看一眼你的屏幕，随时可以断开'),
  group: '生活陪伴',
  id: 'life_companion.screen_watch',
  risk: 'change',
  run: (context, args) => {
    const on = booleanArg(args, 'on');
    if (on === null) return { ok: false, text: '需要说明是开启还是断开看屏幕陪伴。' };
    const settings = updateLifeCompanion(context, on
      ? { desktopActivityAwarenessEnabled: true, screenWatchConsented: true }
      : { screenWatchConsented: false });
    return {
      ok: true,
      text: on
        ? `已开启看屏幕陪伴，每 ${settings.screenWatchIntervalSeconds} 秒看一次。想停的时候说“别看了”，或点桌宠下面的断开按钮。`
        : '已断开看屏幕陪伴，不会再看你的屏幕了。',
    };
  },
  title: '开启或断开看屏幕陪伴',
};

const proactiveChat: PlatformCapability = {
  args: [
    { description: 'Turn proactive chat on or off.', key: 'enabled', type: 'boolean' },
    { description: 'Shortest minutes between proactive messages (5–720).', key: 'minMinutes', type: 'number' },
    { description: 'Longest minutes between proactive messages (5–720).', key: 'maxMinutes', type: 'number' },
  ],
  description: 'Turn proactive chat (the character starting conversations on its own) on/off or change how often it happens.',
  describe: (args) => {
    const enabled = booleanArg(args, 'enabled');
    const min = numberArg(args, 'minMinutes');
    const max = numberArg(args, 'maxMinutes');
    return [
      enabled === null ? '' : `${enabled ? '开启' : '关闭'}主动聊天`,
      min !== null || max !== null ? `间隔改为 ${min ?? '原来的'}–${max ?? '原来的'} 分钟` : '',
    ].filter(Boolean).join('，') || '调整主动聊天';
  },
  group: '生活陪伴',
  id: 'life_companion.proactive',
  risk: 'change',
  run: (context, args) => {
    const enabled = booleanArg(args, 'enabled');
    const min = numberArg(args, 'minMinutes');
    const max = numberArg(args, 'maxMinutes');
    if (enabled === null && min === null && max === null) return { ok: false, text: '要怎么调整主动聊天？可以开关，或改间隔分钟数。' };
    const settings = updateLifeCompanion(context, {
      ...(enabled === null ? {} : { proactiveEnabled: enabled }),
      ...(min === null ? {} : { minRandomIntervalMinutes: min }),
      ...(max === null ? {} : { maxRandomIntervalMinutes: max }),
    });
    return {
      ok: true,
      text: settings.proactiveEnabled
        ? `主动聊天已开启，大约每 ${settings.minRandomIntervalMinutes}–${settings.maxRandomIntervalMinutes} 分钟会主动找你说话。`
        : '主动聊天已关闭。',
    };
  },
  title: '调整主动聊天',
};

const approvalVoicePrompt: PlatformCapability = {
  args: [{ description: 'true = ask out loud and remind; false = only show the card quietly.', key: 'on', required: true, type: 'boolean' }],
  description: 'Whether the character asks out loud when a task needs permission, and reminds (shaking the chat window) if unanswered (“需要权限的时候别念出来了”/“问我的时候说出来”).',
  describe: (args) => (booleanArg(args, 'on') === false ? '关闭需要权限时的开口询问和提醒' : '开启需要权限时的开口询问和提醒'),
  group: '生活陪伴',
  id: 'life_companion.approval_voice_prompt',
  risk: 'personal',
  run: (context, args) => {
    const on = booleanArg(args, 'on');
    if (on === null) return { ok: false, text: '要开还是关？' };
    updateLifeCompanion(context, { approvalVoicePromptEnabled: on });
    return { ok: true, text: on ? '好，以后需要权限时我会说出来问你，没回应会再提醒。' : '好，以后需要权限时只在卡片上安静地等你，不念出来也不提醒。' };
  },
  title: '需要权限时开口询问',
};

const quietHours: PlatformCapability = {
  args: [
    { description: 'Turn quiet hours on or off.', key: 'enabled', type: 'boolean' },
    { description: 'Start time, HH:MM (24h).', key: 'start', type: 'string' },
    { description: 'End time, HH:MM (24h).', key: 'end', type: 'string' },
  ],
  description: 'Set the quiet hours when characters will not start conversations (e.g. “晚上11点到早上9点别打扰我”).',
  describe: (args) => {
    const enabled = booleanArg(args, 'enabled');
    if (enabled === false) return '关闭安静时段';
    const start = stringArg(args, 'start');
    const end = stringArg(args, 'end');
    return start || end ? `把安静时段设为 ${start || '原来的开始时间'}–${end || '原来的结束时间'}` : '开启安静时段';
  },
  group: '生活陪伴',
  id: 'life_companion.quiet_hours',
  risk: 'change',
  run: (context, args) => {
    const enabled = booleanArg(args, 'enabled');
    const start = stringArg(args, 'start');
    const end = stringArg(args, 'end');
    const invalid = [start, end].find((value) => value && !TIME_PATTERN.test(value));
    if (invalid) return { ok: false, text: `时间“${invalid}”格式不对，需要像 23:00 这样的 24 小时制。` };
    if (enabled === null && !start && !end) return { ok: false, text: '要怎么设置安静时段？可以开关，或给出开始和结束时间。' };
    const settings = updateLifeCompanion(context, {
      ...(enabled === null ? (start || end ? { quietHoursEnabled: true } : {}) : { quietHoursEnabled: enabled }),
      ...(start ? { quietHoursStart: start } : {}),
      ...(end ? { quietHoursEnd: end } : {}),
    });
    return {
      ok: true,
      text: settings.quietHoursEnabled
        ? `安静时段已设为 ${settings.quietHoursStart}–${settings.quietHoursEnd}，这段时间角色不会主动打扰你。`
        : '安静时段已关闭。',
    };
  },
  title: '设置安静时段',
};

const listVoicePacks: PlatformCapability = {
  args: [],
  description: 'List the installed voice packs and which voice each character uses.',
  describe: () => '查看可用的语音包',
  group: '声音',
  id: 'voice.list_packs',
  risk: 'read',
  run: async ({ configRef }) => {
    const packs = (await listGptSovitsModels()).filter((pack) => pack.ready);
    const names = new Map(packs.map((pack) => [pack.id, pack.name]));
    const assignments = getDesktopPetSlots(configRef.current).map((slot) => {
      const packId = slot.personality.voicePackId?.trim() ?? '';
      return `${slot.personality.name}：${packId ? names.get(packId) ?? '已找不到的语音包' : '跟随全局'}`;
    });
    return {
      ok: true,
      text: [
        packs.length ? `可用语音包：${packs.map((pack) => `${pack.name}（${pack.kind === 'lite' ? '轻量版' : '训练版'}）`).join('、')}` : '还没有可用的语音包。',
        ...assignments,
        '（语音包文件放在哪：用 files 工具的 places 查看。）',
      ].join('\n'),
    };
  },
  title: '查看语音包',
};

const setPetVoice: PlatformCapability = {
  args: [
    { description: 'Character name; empty = the character the user is talking to.', key: 'pet', type: 'string' },
    { description: 'Voice pack name or id; empty = follow the global voice.', key: 'pack', required: true, type: 'string' },
  ],
  description: 'Give a character a different voice pack (“把小桃的声音换成 XX”). Call voice.list_packs first if the pack name is unclear.',
  describe: (args) => `把${stringArg(args, 'pet') || '当前角色'}的声音换成${stringArg(args, 'pack') || '全局语音'}`,
  group: '声音',
  id: 'voice.set_pet_voice',
  risk: 'change',
  run: async (context, args) => {
    const config = context.configRef.current;
    const petArg = stringArg(args, 'pet');
    const slot = resolvePetSlot(config, petArg, context.petId);
    if (!slot) return missingPet(config, petArg);
    const packArg = stringArg(args, 'pack');
    let packId = '';
    let packName = '全局语音';
    if (packArg && !/^(全局|默认|global|default)/iu.test(packArg)) {
      const packs = (await listGptSovitsModels()).filter((pack) => pack.ready);
      const wanted = packArg.toLowerCase();
      const pack = packs.find((entry) => entry.id.toLowerCase() === wanted)
        ?? packs.find((entry) => entry.name.toLowerCase() === wanted)
        ?? packs.find((entry) => entry.name.toLowerCase().includes(wanted));
      if (!pack) {
        return { ok: false, text: `没找到语音包“${packArg}”。可用的有：${packs.map((entry) => entry.name).join('、') || '（还没有）'}。` };
      }
      packId = pack.id;
      packName = pack.name;
    }
    context.onUpdateConfig(applyDesktopPetSlotChanges(config, slot.id, {
      personality: { ...slot.personality, voicePackId: packId },
    }));
    return { ok: true, text: `${slot.personality.name}的声音已换成${packName}。` };
  },
  title: '给角色换声音',
};

const setWakeWords: PlatformCapability = {
  args: [
    { description: 'Character name; empty = the character the user is talking to.', key: 'pet', type: 'string' },
    { description: 'Comma-separated wake phrases; empty = use the character\'s name.', key: 'words', required: true, type: 'string' },
  ],
  description: 'Change the phrases that wake a character by voice (“以后叫我喊‘小桃子’就行”).',
  describe: (args) => `把${stringArg(args, 'pet') || '当前角色'}的唤醒词改成“${stringArg(args, 'words') || '角色名字'}”`,
  group: '声音',
  id: 'voice.set_wake_words',
  risk: 'change',
  run: (context, args) => {
    const config = context.configRef.current;
    const petArg = stringArg(args, 'pet');
    const slot = resolvePetSlot(config, petArg, context.petId);
    if (!slot) return missingPet(config, petArg);
    const words = stringArg(args, 'words').replace(/[，、；;]/gu, ',');
    context.onUpdateConfig(applyDesktopPetSlotChanges(config, slot.id, {
      personality: { ...slot.personality, wakeWords: words },
    }));
    return { ok: true, text: words ? `以后喊“${words.split(',').map((word) => word.trim()).filter(Boolean).join('”或“')}”就能叫醒${slot.personality.name}。` : `${slot.personality.name}的唤醒词恢复成角色名字。` };
  },
  title: '修改唤醒词',
};

const listPets: PlatformCapability = {
  args: [],
  description: 'List all character slots: enabled and shown on the desktop, size, wandering, following the mouse.',
  describe: () => '查看所有桌宠',
  group: '角色',
  id: 'pets.list',
  risk: 'read',
  run: ({ configRef }) => ({
    ok: true,
    text: getDesktopPetSlots(configRef.current).map((slot) => (
      `${slot.personality.name}：${slot.enabled ? '已启用' : '未启用'}${slot.enabled && !slot.modelVisible ? '，隐藏中' : ''}，大小 ${slot.scale}，自由走动${slot.autoMovementEnabled ? '开' : '关'}，视线跟随${slot.pointerLookEnabled ? '开' : '关'}`
    )).join('\n'),
  }),
  title: '查看桌宠',
};

const setPetPresence: PlatformCapability = {
  args: [
    { description: 'Character name.', key: 'pet', required: true, type: 'string' },
    { description: 'Enable (true) or disable (false) the character slot.', key: 'enabled', type: 'boolean' },
    { description: 'Show (true) or hide (false) the character on the desktop.', key: 'visible', type: 'boolean' },
  ],
  description: 'Put a character on the desktop or take it away (“把高冷小桃叫出来”/“先让她休息”). The main character cannot be disabled or hidden.',
  describe: (args) => {
    const pet = stringArg(args, 'pet') || '角色';
    const enabled = booleanArg(args, 'enabled');
    const visible = booleanArg(args, 'visible');
    if (enabled === false) return `停用${pet}（从桌面上收起来）`;
    if (visible === false) return `把${pet}从桌面上隐藏`;
    return `让${pet}出现在桌面上`;
  },
  group: '角色',
  id: 'pets.set_presence',
  risk: 'change',
  run: (context, args) => {
    const config = context.configRef.current;
    const petArg = stringArg(args, 'pet');
    const slot = resolvePetSlot(config, petArg, null);
    if (!petArg || !slot) return missingPet(config, petArg);
    const enabled = booleanArg(args, 'enabled');
    const visible = booleanArg(args, 'visible');
    if (enabled === null && visible === null) return { ok: false, text: '要启用、停用、显示还是隐藏？' };
    if (slot.isPrimary && (enabled === false || visible === false)) return { ok: false, text: `${slot.personality.name}是主角色，不能停用或隐藏。` };
    const nextEnabled = enabled ?? (visible === true ? true : slot.enabled);
    const nextVisible = visible ?? (enabled === true ? true : slot.modelVisible);
    context.onUpdateConfig(applyDesktopPetSlotChanges(config, slot.id, { enabled: nextEnabled, modelVisible: nextVisible }));
    return {
      ok: true,
      text: nextEnabled && nextVisible ? `${slot.personality.name}已经出现在桌面上了。` : `${slot.personality.name}已经从桌面上收起来了。`,
    };
  },
  title: '让角色出现或收起',
};

const setChatMode: PlatformCapability = {
  args: [
    { description: 'single, group, or story.', enumValues: ['single', 'group', 'story'], key: 'mode', required: true, type: 'string' },
    { description: 'For single chat: which character to talk to.', key: 'pet', type: 'string' },
  ],
  description: 'Switch the chat window to solo chat with a character, group chat with every enabled character, or story mode (“叫大家一起聊”“我想单独和小桃聊”).',
  describe: (args) => {
    const mode = stringArg(args, 'mode') as DesktopPetChatMode;
    const pet = stringArg(args, 'pet');
    return mode === 'single' && pet ? `切换到和${pet}单聊` : `切换到${CHAT_MODE_LABELS[mode] ?? '指定'}模式`;
  },
  group: '聊天',
  id: 'chat.set_mode',
  risk: 'change',
  run: (context, args) => {
    const mode = stringArg(args, 'mode') as DesktopPetChatMode;
    if (!(mode in CHAT_MODE_LABELS)) return { ok: false, text: '聊天模式只能是单聊、群聊或剧情。' };
    const config = context.configRef.current;
    const petArg = stringArg(args, 'pet');
    if (mode === 'single' && petArg) {
      const slot = resolvePetSlot(config, petArg, null);
      if (!slot) return missingPet(config, petArg);
      desktopPetChatStore.setActivePetId(slot.id);
    }
    desktopPetChatStore.setChatMode(mode);
    return { ok: true, text: `已切换到${CHAT_MODE_LABELS[mode]}模式。` };
  },
  title: '切换聊天模式',
};

export const BUILTIN_PLATFORM_CAPABILITIES: PlatformCapability[] = [
  lifeCompanionStatus,
  screenWatch,
  proactiveChat,
  quietHours,
  approvalVoicePrompt,
  listVoicePacks,
  setPetVoice,
  setWakeWords,
  listPets,
  setPetPresence,
  setChatMode,
];
