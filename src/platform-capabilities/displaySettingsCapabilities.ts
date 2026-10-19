import {
  clampChatAvatarDisplaySize,
  clampChatBubbleTransparency,
  clampChatFontSize,
  clampChatFontWeight,
  clampUiGlassTransparency,
  CHAT_FONT_SIZE_MAX,
  CHAT_FONT_SIZE_MIN,
} from '../chatAppearanceSettings';
import { applyDesktopPetSlotChanges } from '../multiPetRoster';
import type { PetConfig } from '../types';
import { clampSpeechPlaybackRate } from '../voice/speechPlaybackRate';
import { booleanArg, numberArg, petListText, resolvePetSlot, stringArg } from './platformCapabilityArgs';
import type { PlatformCapability, PlatformCapabilityArgs, PlatformCapabilityContext } from './platformCapabilityTypes';

// The settings people say out loud: “字大一点”“气泡透明点”“别显示头像”“小桃变大一点”“别乱跑”
// “读慢一点”. Each is a plain argument instead of a config path the model has to guess. They only
// change how things look or sound, show at once and are easy to change back, so they run without
// a confirmation card.

type Settings = PetConfig['settings'];

const PET_SCALE_MIN = 0.5;
const PET_SCALE_MAX: Record<string, number> = { '2d': 3, '3d': 6, live2d: 4 };

function onOff(value: boolean) {
  return value ? '开' : '关';
}

function commitSettings(context: PlatformCapabilityContext, patch: Partial<Settings>) {
  const config = context.configRef.current;
  const next = { ...config, settings: { ...config.settings, ...patch } };
  context.configRef.current = next;
  context.onUpdateConfig(next, { persist: true });
}

function chatDisplayText(settings: Settings) {
  return [
    `聊天字号 ${settings.chatFontSize}（${CHAT_FONT_SIZE_MIN}-${CHAT_FONT_SIZE_MAX}）`,
    `字重 ${settings.chatFontWeight}（300-1000，400 是常规）`,
    `气泡透明度 ${settings.chatBubbleTransparency}%`,
    `界面玻璃透明度 ${settings.uiGlassTransparency}%`,
    `头像 ${onOff(settings.chatAvatarsEnabled)}，大小 ${settings.chatAvatarSize}`,
    `逐字显示回复 ${onOff(settings.chatStreamingEnabled)}`,
    `你的显示名“${settings.chatUserDisplayName || '（未设置）'}”`,
  ].join('\n');
}

const readChatDisplay: PlatformCapability = {
  args: [],
  description: 'Current chat window look: font size and weight, bubble and glass transparency, avatars, streaming, the user’s display name. Read before relative changes like “字大一点”.',
  describe: () => '查看聊天显示设置',
  group: '聊天显示',
  id: 'chat.read_display',
  risk: 'read',
  run: ({ configRef }) => ({ ok: true, text: chatDisplayText(configRef.current.settings) }),
  title: '查看聊天显示设置',
};

const DISPLAY_FIELDS: Array<{ key: string; apply: (args: PlatformCapabilityArgs, settings: Settings) => Partial<Settings> | null }> = [
  { key: 'fontSize', apply: (args, settings) => (numberArg(args, 'fontSize') === null ? null : { chatFontSize: clampChatFontSize(numberArg(args, 'fontSize'), settings.chatFontSize) }) },
  { key: 'fontWeight', apply: (args, settings) => (numberArg(args, 'fontWeight') === null ? null : { chatFontWeight: clampChatFontWeight(numberArg(args, 'fontWeight'), settings.chatFontWeight) }) },
  { key: 'bubbleTransparency', apply: (args) => (numberArg(args, 'bubbleTransparency') === null ? null : { chatBubbleTransparency: clampChatBubbleTransparency(numberArg(args, 'bubbleTransparency')) }) },
  { key: 'glassTransparency', apply: (args) => (numberArg(args, 'glassTransparency') === null ? null : { uiGlassTransparency: clampUiGlassTransparency(numberArg(args, 'glassTransparency')) }) },
  { key: 'avatars', apply: (args) => (booleanArg(args, 'avatars') === null ? null : { chatAvatarsEnabled: booleanArg(args, 'avatars')! }) },
  { key: 'avatarSize', apply: (args, settings) => (numberArg(args, 'avatarSize') === null ? null : { chatAvatarSize: clampChatAvatarDisplaySize(numberArg(args, 'avatarSize'), settings.chatAvatarSize) }) },
  { key: 'streaming', apply: (args) => (booleanArg(args, 'streaming') === null ? null : { chatStreamingEnabled: booleanArg(args, 'streaming')! }) },
  { key: 'userName', apply: (args) => (typeof args.userName === 'string' ? { chatUserDisplayName: stringArg(args, 'userName').slice(0, 24) } : null) },
];

const setChatDisplay: PlatformCapability = {
  args: [
    { description: `Font size, ${CHAT_FONT_SIZE_MIN}-${CHAT_FONT_SIZE_MAX} (default 14).`, key: 'fontSize', type: 'number' },
    { description: 'Font weight, 300-1000 (400 normal, 700 bold).', key: 'fontWeight', type: 'number' },
    { description: 'Chat bubble transparency, 0-100 (%).', key: 'bubbleTransparency', type: 'number' },
    { description: 'Window glass transparency, 0-100 (%).', key: 'glassTransparency', type: 'number' },
    { description: 'Show avatars beside messages.', key: 'avatars', type: 'boolean' },
    { description: 'Avatar size, 24-72.', key: 'avatarSize', type: 'number' },
    { description: 'Show replies word by word as they arrive.', key: 'streaming', type: 'boolean' },
    { description: 'The name shown for the user’s own messages.', key: 'userName', type: 'string' },
  ],
  description: 'Change how the chat window looks (“字大一点”“气泡透明一点”“不要头像”“回复一次性显示”). Only pass what changes; for relative changes read chat.read_display first.',
  describe: () => '调整聊天显示',
  group: '聊天显示',
  id: 'chat.set_display',
  risk: 'personal',
  run: (context, args) => {
    const settings = context.configRef.current.settings;
    const patch = DISPLAY_FIELDS.reduce<Partial<Settings>>((merged, field) => ({ ...merged, ...(field.apply(args, settings) ?? {}) }), {});
    if (!Object.keys(patch).length) return { ok: false, text: '要改聊天显示的哪一项？' };
    commitSettings(context, patch);
    return { ok: true, text: `已调整。现在的聊天显示：\n${chatDisplayText(context.configRef.current.settings)}` };
  },
  title: '调整聊天显示',
};

const setPetBehavior: PlatformCapability = {
  args: [
    { description: '哪个角色（名字），不写就是当前在聊的角色', key: 'pet', type: 'string' },
    { description: 'Size on the desktop: 1 is normal; 0.5 is the smallest.', key: 'size', type: 'number' },
    { description: 'Walk around the desktop on its own.', key: 'wander', type: 'boolean' },
    { description: 'Turn the head to follow the mouse pointer.', key: 'followMouse', type: 'boolean' },
  ],
  description: 'A character’s size and habits on the desktop (“小桃变大一点”“别到处乱跑”“别老盯着鼠标”). For relative size changes check pets.list first.',
  describe: (args) => `调整${stringArg(args, 'pet') || '角色'}的大小或动作习惯`,
  group: '角色',
  id: 'pets.set_behavior',
  risk: 'personal',
  run: (context, args) => {
    const config = context.configRef.current;
    const slot = resolvePetSlot(config, stringArg(args, 'pet'), context.petId);
    if (!slot) return { ok: false, text: `没找到这个角色。现有角色：${petListText(config)}。` };
    const size = numberArg(args, 'size');
    const wander = booleanArg(args, 'wander');
    const followMouse = booleanArg(args, 'followMouse');
    if (size === null && wander === null && followMouse === null) return { ok: false, text: '要调大小、自由走动还是视线跟随？' };
    const scale = size === null ? undefined : Number(Math.min(PET_SCALE_MAX[slot.modelType] ?? 3, Math.max(PET_SCALE_MIN, size)).toFixed(2));
    const next = applyDesktopPetSlotChanges(config, slot.id, {
      autoMovementEnabled: wander ?? undefined,
      pointerLookEnabled: followMouse ?? undefined,
      scale,
    });
    context.configRef.current = next;
    context.onUpdateConfig(next, { persist: true });
    const parts = [
      scale === undefined ? '' : `大小 ${scale}`,
      wander === null ? '' : `自由走动${onOff(wander)}`,
      followMouse === null ? '' : `视线跟随鼠标${onOff(followMouse)}`,
    ].filter(Boolean);
    return { ok: true, text: `${slot.personality.name}：${parts.join('，')}。` };
  },
  title: '调整角色大小和习惯',
};

const setReading: PlatformCapability = {
  args: [
    { description: 'Read every reply aloud automatically.', key: 'autoSpeak', type: 'boolean' },
    { description: 'Reading speed, 0.6-1.6 (1 is normal).', key: 'speed', type: 'number' },
    { description: 'Skip text in brackets (actions like “（笑）”) when reading aloud.', key: 'skipBrackets', type: 'boolean' },
  ],
  description: 'How replies are read aloud (“读快一点”“括号里的动作别读出来”“别自动念了”). Voice source and voice packs have their own tools.',
  describe: () => '调整朗读方式',
  group: '声音',
  id: 'voice.set_reading',
  risk: 'personal',
  run: (context, args) => {
    const settings = context.configRef.current.settings;
    const autoSpeak = booleanArg(args, 'autoSpeak');
    const speed = numberArg(args, 'speed');
    const skipBrackets = booleanArg(args, 'skipBrackets');
    if (autoSpeak === null && speed === null && skipBrackets === null) return { ok: false, text: '要调自动朗读、语速还是括号内容？' };
    const patch: Partial<Settings> = {};
    if (autoSpeak !== null) patch.autoSpeakResponses = autoSpeak;
    if (speed !== null) patch.speechPlaybackRate = clampSpeechPlaybackRate(speed, settings.speechPlaybackRate);
    if (skipBrackets !== null) patch.speechSkipBracketContent = skipBrackets;
    commitSettings(context, patch);
    const next = context.configRef.current.settings;
    return { ok: true, text: `自动朗读${onOff(next.autoSpeakResponses)}，语速 ${next.speechPlaybackRate}，括号内容${next.speechSkipBracketContent ? '不读' : '照读'}。` };
  },
  title: '调整朗读方式',
};

// “把活动范围框关掉/隐藏” had no tool, so the character tried clicks, commands and settings
// files one after another and still could not do it.
const setActivityArea: PlatformCapability = {
  args: [
    { description: 'Show the blue frame around the area the pets may move in.', key: 'frameVisible', type: 'boolean' },
    { description: 'Keep the pets inside that area (false = they may use the whole desktop, and the frame is gone too).', key: 'limitEnabled', type: 'boolean' },
  ],
  description: 'The pets’ activity area on the desktop and its blue frame (“把活动范围框关掉/隐藏”“显示活动范围”“别限制活动范围”“让她在整个桌面跑”). Hiding the frame keeps the limit; turning the limit off frees the whole desktop.',
  describe: () => '调整活动范围',
  group: '角色',
  id: 'desktop.set_activity_area',
  risk: 'personal',
  run: (context, args) => {
    const frameVisible = booleanArg(args, 'frameVisible');
    const limitEnabled = booleanArg(args, 'limitEnabled');
    if (frameVisible === null && limitEnabled === null) return { ok: false, text: '要显示/隐藏活动范围框，还是开/关活动范围限制？' };
    const patch: Partial<Settings> = {};
    if (frameVisible !== null) patch.activityBorderVisible = frameVisible;
    if (limitEnabled !== null) patch.activityAreaLimitEnabled = limitEnabled;
    commitSettings(context, patch);
    const next = context.configRef.current.settings;
    return {
      ok: true,
      text: next.activityAreaLimitEnabled
        ? `活动范围限制开着，范围框${next.activityBorderVisible ? '显示' : '已隐藏'}。`
        : '活动范围限制已关闭，角色可以在整个桌面活动，范围框不再显示。',
    };
  },
  title: '调整活动范围',
};

export const DISPLAY_SETTINGS_CAPABILITIES: PlatformCapability[] = [readChatDisplay, setChatDisplay, setPetBehavior, setReading, setActivityArea];
