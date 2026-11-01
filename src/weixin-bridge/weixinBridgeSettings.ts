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

/** One person's login (each family member scans once). Only the owner's chat goes into the chat window. */
export interface WeixinAccountStatus {
  detail: string;
  id: string;
  label: string;
  owner: boolean;
  state: 'connected' | 'reconnecting' | 'expired' | 'stopped';
}

/** A QR login on screen: the QR link while waiting, then scanned / verify code / errors. */
export interface WeixinLoginStatus {
  detail: string;
  state: 'waiting-scan' | 'scanned' | 'need-verify' | 'expired-qr' | 'error';
}

export interface WeixinBridgeStatus {
  accounts: WeixinAccountStatus[];
  login: WeixinLoginStatus | null;
  running: boolean;
}

export interface WeixinInboundMessage {
  accountId: string;
  images: string[];
  label: string;
  owner: boolean;
  text: string;
  voice: boolean;
}
