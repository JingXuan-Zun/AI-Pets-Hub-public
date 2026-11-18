// Chatting with the characters from the phone through QQ: a OneBot v11 service (NapCat,
// LLBot, SnowLuma…) logged in on this computer, reached over its forward WebSocket. Any of
// them works; only SnowLuma gets extra help (auto-start, token read from its config). SnowLuma
// went private on 2026-11-09 after a legal notice from Tencent, so new setups use NapCat. The access
// token is not here: it is the top-level setting `qqBridgeAccessToken`, so it is encrypted
// and kept out of backups like other keys.

/** Which OneBot service the user runs; the chat part is the same for all of them. */
export type QqOneBotProvider = 'napcat' | 'snowluma' | 'other';

export type QqBridgeSettings = {
  enabled: boolean;
  provider: QqOneBotProvider;
  /** The OneBot forward WebSocket, e.g. ws://127.0.0.1:3001. */
  wsUrl: string;
  /** Only private messages from this QQ number are answered. */
  ownerQq: string;
  /** The unpacked SnowLuma folder; the pet starts it in the background when the switch is on. */
  snowLumaDir: string;
  autoStartSnowLuma: boolean;
  /** When replies also go as a voice message: 'mirror' = when you sent voice or asked for it. */
  voiceReplyMode: 'mirror' | 'always' | 'off';
};

export const DEFAULT_QQ_BRIDGE_SETTINGS: QqBridgeSettings = {
  autoStartSnowLuma: true,
  enabled: false,
  snowLumaDir: '',
  ownerQq: '',
  provider: 'napcat',
  voiceReplyMode: 'mirror',
  wsUrl: 'ws://127.0.0.1:3001',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeQqNumber(value: unknown) {
  return String(value ?? '').replace(/\D/gu, '').slice(0, 12);
}

export function normalizeQqBridgeSettings(value: unknown): QqBridgeSettings {
  const raw = isRecord(value) ? value : {};
  const wsUrl = typeof raw.wsUrl === 'string' && /^wss?:\/\//iu.test(raw.wsUrl.trim())
    ? raw.wsUrl.trim()
    : DEFAULT_QQ_BRIDGE_SETTINGS.wsUrl;
  const snowLumaDir = typeof raw.snowLumaDir === 'string' ? raw.snowLumaDir.trim() : '';
  // Settings from before the choice existed: a SnowLuma folder means SnowLuma is in use.
  const provider: QqOneBotProvider = raw.provider === 'napcat' || raw.provider === 'snowluma' || raw.provider === 'other'
    ? raw.provider
    : snowLumaDir ? 'snowluma' : DEFAULT_QQ_BRIDGE_SETTINGS.provider;
  return {
    autoStartSnowLuma: raw.autoStartSnowLuma !== false,
    enabled: raw.enabled === true,
    ownerQq: normalizeQqNumber(raw.ownerQq),
    provider,
    snowLumaDir,
    voiceReplyMode: raw.voiceReplyMode === 'always' || raw.voiceReplyMode === 'off' ? raw.voiceReplyMode : 'mirror',
    wsUrl,
  };
}

// "发语音给我" / "想听你的声音" / "用语音回我": the user asks for this reply as a voice message.
const VOICE_REQUEST_PATTERN = /(?:发|来|用|回|给我|录)[^，。！？\s]{0,4}(?:语音|声音)|(?:语音|声音)[^，。！？\s]{0,3}(?:回|发|说|讲)|说给我听|讲给我听|念给我听|想听你|听听你/u;

export function asksForVoiceReply(text: string) {
  return VOICE_REQUEST_PATTERN.test(text);
}

/** Whether replies to this phone message also go as voice. */
export function wantsVoiceReply(mode: QqBridgeSettings['voiceReplyMode'], sentVoice: boolean, text: string) {
  if (mode === 'off') return false;
  return mode === 'always' || sentVoice || asksForVoiceReply(text);
}

/** Whether the pet starts SnowLuma itself and reads its token (only for the SnowLuma choice). */
export function usesSnowLumaHelpers(settings: QqBridgeSettings) {
  return settings.provider === 'snowluma' && Boolean(settings.snowLumaDir);
}

export const QQ_ONEBOT_PROVIDER_LABELS: Record<QqOneBotProvider, string> = {
  napcat: 'NapCat（推荐）',
  other: '其他 OneBot v11 工具（LLBot 等）',
  snowluma: 'SnowLuma（已停止公开发布，只给已经装好的人用）',
};

/** Why the bridge cannot start, or null when it can. */
export function resolveQqBridgeBlocker(settings: QqBridgeSettings) {
  if (!settings.enabled) return '未开启';
  if (!settings.ownerQq) return '还没填你的 QQ 号';
  return null;
}
