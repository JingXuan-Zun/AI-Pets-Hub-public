import {
  CONCERN_HALF_LIFE_MS,
  MAX_CONCERNS,
  type CharacterCognition,
  type CognitionConcern,
} from './characterCognitionTypes';

// The cheap part of the cognition layer: no model calls, runs every turn. Charges leak with
// time (like a neuron's potential), topics that touch a concern feed it, and saying it out
// loud spends it. Everything here is pure so it can be tested and reasoned about.

export function effectiveCharge(concern: CognitionConcern, now: number) {
  const elapsed = Math.max(0, now - concern.chargedAt);
  return concern.charge * 0.5 ** (elapsed / CONCERN_HALF_LIFE_MS);
}

function normalize(text: string) {
  return text.replace(/\s+/gu, '').toLowerCase();
}

/** The concern a piece of text touches (by its keywords), if any. */
export function concernTouchedBy(concerns: CognitionConcern[], text: string) {
  const haystack = normalize(text);
  if (!haystack) return null;
  return concerns.find((concern) => concern.keywords.some((word) => word.trim().length >= 2 && haystack.includes(normalize(word)))) ?? null;
}

/** 0–100: how much she wants to say something right now. */
export function urgeToSpeak(cognition: CharacterCognition, now: number) {
  const strongest = cognition.concerns.reduce((max, concern) => Math.max(max, effectiveCharge(concern, now)), 0);
  return Math.round(Math.min(100, strongest + cognition.mood.intensity * 10));
}

/** Re-bases charges to `now` (so stored numbers stay meaningful) and keeps the strongest three. */
export function settleConcerns(concerns: CognitionConcern[], now: number) {
  return concerns
    .map((concern) => ({ ...concern, charge: Math.round(effectiveCharge(concern, now)), chargedAt: now }))
    .filter((concern) => concern.charge >= 3)
    .sort((left, right) => right.charge - left.charge)
    .slice(0, MAX_CONCERNS);
}

/**
 * After a turn: what the user said feeds the concern it touches; what she said herself spends
 * it (she brought it up, so it is no longer pressing).
 */
export function applyTurnToCognition(cognition: CharacterCognition, turn: { userText?: string; herText?: string }, now: number): CharacterCognition {
  const fed = turn.userText ? concernTouchedBy(cognition.concerns, turn.userText) : null;
  const spent = turn.herText ? concernTouchedBy(cognition.concerns, turn.herText) : null;
  if (!fed && !spent) return cognition;
  const concerns = cognition.concerns.map((concern) => {
    let charge = effectiveCharge(concern, now);
    if (fed?.id === concern.id) charge = Math.min(100, charge + 20);
    if (spent?.id === concern.id) charge *= 0.3;
    return { ...concern, charge: Math.round(charge), chargedAt: now, ...(spent?.id === concern.id ? { mentionedAt: now } : {}) };
  });
  return { ...cognition, concerns };
}

/** What her reply sees (only she sees her own). Short, and only when there is something on her mind. */
export function describeCognitionForReply(cognition: CharacterCognition, now: number) {
  const concerns = cognition.concerns
    .filter((concern) => effectiveCharge(concern, now) >= 15)
    .map((concern) => concern.text);
  const parts = [
    `你此刻的心情：${cognition.mood.label}`,
    concerns.length ? `你心里惦记着：${concerns.join('；')}` : '',
    cognition.toward ? `你想对${cognition.toward.target === 'user' ? '用户' : cognition.toward.target}说说话（${cognition.toward.why}）` : '',
  ].filter(Boolean);
  const text = `（这是你自己此刻的心里，只有你知道，不要直接念出来；合适的时候自然地带进话里：${parts.join('。')}。）`;
  return text.length > 220 ? `${text.slice(0, 218)}…）` : text;
}

/**
 * Group chat: how much this character's own mind adds to her turn score, on top of the
 * existing rules (being addressed still wins). At most +30 for wanting to talk, +15 when
 * the topic touches what she is thinking about, +10 when the last speaker wants to talk to her.
 */
export function groupAttentionBonus(options: {
  cognition: CharacterCognition | null;
  lastSpeakerCognition?: CharacterCognition | null;
  name: string;
  now: number;
  topicText: string;
}) {
  const { cognition, lastSpeakerCognition, name, now, topicText } = options;
  const reasons: string[] = [];
  let bonus = 0;
  if (cognition) {
    const urge = Math.round(urgeToSpeak(cognition, now) * 0.3);
    if (urge > 0) { bonus += urge; reasons.push('cognition-urge'); }
    if (concernTouchedBy(cognition.concerns, topicText)) { bonus += 15; reasons.push('concern-topic'); }
  }
  if (lastSpeakerCognition?.toward && lastSpeakerCognition.toward.target === name) {
    bonus += 10;
    reasons.push('wanted-by-speaker');
  }
  return { bonus, reasons };
}
