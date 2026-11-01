// Phone WeChat through Tencent's official ClawBot channel. The login itself (scanned once with
// phone WeChat) is kept encrypted by the main process (electron/weixinBridgeService.cjs), not
// in the config; this only says whether the bridge should run.

export type WeixinBridgeSettings = {
  enabled: boolean;
  /** Replies also as voice in the character's own voice: always by default (for family who listen rather than read). */
  voiceReplyMode: 'mirror' | 'always' | 'off';
};

export const DEFAULT_WEIXIN_BRIDGE_SETTINGS: WeixinBridgeSettings = {
  enabled: false,
  voiceReplyMode: 'always',
};

export function normalizeWeixinBridgeSettings(value: unknown): WeixinBridgeSettings {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const mode = raw.voiceReplyMode;
  return { enabled: raw.enabled === true, voiceReplyMode: mode === 'mirror' || mode === 'off' ? mode : 'always' };
}

/** Status the main process reports (state machine of the QR login and the message loop). */
export type WeixinBridgeState = 'logged-out' | 'waiting-scan' | 'scanned' | 'need-verify' | 'expired-qr' | 'connected' | 'reconnecting' | 'expired' | 'stopped' | 'error';

export interface WeixinBridgeStatus {
  account: { botId: string } | null;
  detail: string;
  state: WeixinBridgeState;
}
