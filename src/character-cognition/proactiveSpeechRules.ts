// When a character speaks first (cognition layer phase 2, docs/cognition-layer-design-20261106.md §8).
// She only speaks when something on her mind has built up enough, and never more often than the
// user agreed to (2026-11-06): 1/h per character, 2/h in total and at least 20 min apart, not within
// 10 min of the user's last message, not in quiet hours, not while the user is away (when they come
// back only the most eager one says hello), at most 8 a day.

import { effectiveCharge } from './characterCognitionRules';
import type { CharacterCognition, CognitionConcern } from './characterCognitionTypes';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export const PROACTIVE_LIMITS = {
  /** Charge a concern needs before she brings it up on her own. */
  speakCharge: 50,
  /** Coming back after being away: any real concern is enough for the one hello. */
  welcomeBackCharge: 25,
  perCharacterPerHour: 1,
  totalPerHour: 2,
  minGapMs: 20 * MINUTE_MS,
  afterUserMessageMs: 10 * MINUTE_MS,
  perDay: 8,
  /** No input for this long = the user is away. */
  awayAfterMs: 10 * MINUTE_MS,
  /** Away at least this long before coming back counts for a hello. */
  welcomeBackAfterMs: 30 * MINUTE_MS,
} as const;

export interface ProactiveSpeechEntry {
  at: number;
  roleId: string;
  name: string;
  kind: 'concern' | 'welcome-back';
  /** The concern she brought up (shown in the settings panel so it is clear why she spoke). */
  concernText: string;
}

export interface ProactiveCandidate {
  roleId: string;
  name: string;
  cognition: CharacterCognition;
}

export interface ProactiveSpeechInput {
  now: number;
  enabled: boolean;
  quietHours: boolean;
  /** She is typing or talking, or the chat is in group / story mode. */
  chatBusy: boolean;
  lastUserMessageAt: number | null;
  /** Milliseconds since the last keyboard / mouse input, null when unknown. */
  idleMs: number | null;
  /** The user just came back after being away a while (one chance for a hello). */
  justCameBack: boolean;
  log: ProactiveSpeechEntry[];
  candidates: ProactiveCandidate[];
}

export type ProactiveSpeechDecision =
  | { speak: true; kind: ProactiveSpeechEntry['kind']; candidate: ProactiveCandidate; concern: CognitionConcern; charge: number }
  | { speak: false; reason: string };

function startOfLocalDay(now: number) {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

/** Her strongest concern that she has not just brought up herself. */
export function strongestConcern(cognition: CharacterCognition, now: number) {
  let best: { concern: CognitionConcern; charge: number } | null = null;
  for (const concern of cognition.concerns) {
    const charge = effectiveCharge(concern, now);
    if (!best || charge > best.charge) best = { concern, charge };
  }
  return best;
}

/** Why nobody may speak right now (the hard limits), or null when someone may. */
function blockedBy(input: ProactiveSpeechInput) {
  const { now, log } = input;
  const limits = PROACTIVE_LIMITS;
  if (!input.enabled) return '主动聊天关着';
  if (input.quietHours) return '现在是安静时段';
  if (input.chatBusy) return '正在聊天或说话，等一下';
  if (input.idleMs !== null && input.idleMs >= limits.awayAfterMs) return '你不在电脑前，等你回来';
  if (!input.justCameBack && input.lastUserMessageAt !== null && now - input.lastUserMessageAt < limits.afterUserMessageMs) {
    return '你刚说过话（10 分钟内不主动打扰）';
  }
  const today = log.filter((entry) => entry.at >= startOfLocalDay(now));
  if (today.length >= limits.perDay) return `今天已经主动说了 ${limits.perDay} 次`;
  const lastHour = log.filter((entry) => now - entry.at < HOUR_MS);
  if (lastHour.length >= limits.totalPerHour) return '这一小时已经主动说了 2 次';
  const last = log.reduce((max, entry) => Math.max(max, entry.at), 0);
  if (last && now - last < limits.minGapMs) return '离上一次主动说话还不到 20 分钟';
  return null;
}

export function decideProactiveSpeech(input: ProactiveSpeechInput): ProactiveSpeechDecision {
  const blocked = blockedBy(input);
  if (blocked) return { speak: false, reason: blocked };
  const kind = input.justCameBack ? 'welcome-back' : 'concern';
  const threshold = kind === 'welcome-back' ? PROACTIVE_LIMITS.welcomeBackCharge : PROACTIVE_LIMITS.speakCharge;
  const spokeThisHour = new Set(input.log.filter((entry) => input.now - entry.at < HOUR_MS).map((entry) => entry.roleId));
  const ranked = input.candidates
    .filter((candidate) => !spokeThisHour.has(candidate.roleId))
    .map((candidate) => ({ candidate, best: strongestConcern(candidate.cognition, input.now) }))
    .filter((item): item is { candidate: ProactiveCandidate; best: { concern: CognitionConcern; charge: number } } => Boolean(item.best && item.best.charge >= threshold))
    .sort((left, right) => right.best.charge - left.best.charge);
  const top = ranked[0];
  if (!top) return { speak: false, reason: '还没有谁有特别想说的事' };
  return { speak: true, kind, candidate: top.candidate, concern: top.best.concern, charge: Math.round(top.best.charge) };
}

/** Saying it out loud spends most of the charge, so she does not keep bringing it up. */
export function spendConcern(cognition: CharacterCognition, concernId: string, now: number): CharacterCognition {
  return {
    ...cognition,
    concerns: cognition.concerns.map((concern) => concern.id === concernId
      ? { ...concern, charge: Math.round(effectiveCharge(concern, now) * 0.3), chargedAt: now, mentionedAt: now }
      : concern),
    updatedAt: now,
  };
}

/** Tracks away → back from idle readings taken every heartbeat. */
export function trackPresence(state: { awaySince: number | null }, idleMs: number | null, now: number) {
  if (idleMs === null) return { awaySince: null, justCameBack: false };
  if (idleMs >= PROACTIVE_LIMITS.awayAfterMs) {
    return { awaySince: state.awaySince ?? now - idleMs, justCameBack: false };
  }
  const cameBack = state.awaySince !== null && now - idleMs - state.awaySince >= PROACTIVE_LIMITS.welcomeBackAfterMs;
  return { awaySince: null, justCameBack: cameBack };
}

/** The line request: her own persona answers; this only says why she is speaking now. */
export function buildProactiveLineInstruction(options: {
  kind: ProactiveSpeechEntry['kind'];
  concernText: string;
  moodLabel: string;
}) {
  return [
    '这是你自己想主动对用户说的话，不是用户发来的消息。',
    options.kind === 'welcome-back' ? '用户离开电脑一阵子，刚刚回来。' : '',
    `你心里一直惦记着：${options.concernText}`,
    options.moodLabel ? `你此刻的心情：${options.moodLabel}` : '',
    '用你平时的语气自然地开口，一两句话就好，像是忽然想起来想跟用户说。',
    '不要解释你为什么开口，不要提系统、提醒、设定、心情值这些词。',
  ].filter(Boolean).join('\n');
}
