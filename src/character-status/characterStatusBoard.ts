import { useSyncExternalStore } from 'react';

// 角色近况板 (docs/cross-chat-character-awareness-design-20261008.md): what each character is up
// to, as the characters themselves said it in chat. A says "B is at the library" to the user;
// when the user goes to B, B knows and goes along with it. Only what characters say is recorded,
// never what the user says, and only doings / whereabouts, not feelings or private topics.

export interface CharacterStatusFact {
  id: string;
  /** Who it is about. */
  subjectPetId: string;
  subjectName: string;
  /** Who said it. */
  sourcePetId: string;
  sourceName: string;
  text: string;
  quote: string;
  kind: 'self' | 'about-other';
  createdAt: number;
}

/** Placeholder durations from the design (§9: to be settled with chat memory later). */
export const STATUS_FACT_TTL_MS = 24 * 60 * 60 * 1000;
export const TOLD_USER_WINDOW_MS = 2 * 60 * 60 * 1000;
const MAX_FACTS = 60;
const PER_CHARACTER_IN_NOTE = 2;
const OTHERS_IN_NOTE = 6;

const STORAGE_KEY = 'desktop-pet.character-status.v1';
const listeners = new Set<() => void>();
let cache: { raw: string | null; facts: CharacterStatusFact[] } = { facts: [], raw: null };

export function readStatusFacts(): CharacterStatusFact[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cache.raw) return cache.facts;
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    const facts = Array.isArray(parsed) ? parsed.filter((fact) => fact && typeof fact.subjectPetId === 'string' && typeof fact.text === 'string') as CharacterStatusFact[] : [];
    cache = { facts, raw };
    return facts;
  } catch {
    return [];
  }
}

function writeFacts(facts: CharacterStatusFact[]) {
  try {
    const raw = JSON.stringify(facts);
    window.localStorage.setItem(STORAGE_KEY, raw);
    cache = { facts, raw };
  } catch {
    // Storage unavailable: the board just stays as it was.
  }
  listeners.forEach((listener) => listener());
}

const normalize = (text: string) => text.replace(/\s+/gu, '').toLowerCase();

/** Adds new facts: exact repeats are skipped; a new self-report replaces her older self-reports. */
export function mergeStatusFacts(existing: CharacterStatusFact[], incoming: CharacterStatusFact[], now: number) {
  let facts = existing.filter((fact) => now - fact.createdAt < STATUS_FACT_TTL_MS);
  for (const fact of incoming) {
    const repeat = facts.some((item) => item.subjectPetId === fact.subjectPetId && item.sourcePetId === fact.sourcePetId && normalize(item.text) === normalize(fact.text));
    if (repeat) continue;
    if (fact.kind === 'self') facts = facts.filter((item) => !(item.kind === 'self' && item.subjectPetId === fact.subjectPetId));
    facts = [...facts, fact];
  }
  return facts.slice(-MAX_FACTS);
}

export function addStatusFacts(incoming: CharacterStatusFact[], now = Date.now()) {
  if (incoming.length) writeFacts(mergeStatusFacts(readStatusFacts(), incoming, now));
}

export function removeStatusFact(id: string) {
  writeFacts(readStatusFacts().filter((fact) => fact.id !== id));
}

export function clearStatusFacts() {
  writeFacts([]);
}

function ago(now: number, at: number) {
  const minutes = Math.max(1, Math.round((now - at) / 60_000));
  return minutes < 60 ? `${minutes} 分钟前` : `${Math.round(minutes / 60)} 小时前`;
}

/** What she knows of the others, and what others recently told the user about her (design §6). */
export function describeStatusBoardFor(roleId: string, facts: CharacterStatusFact[], now: number) {
  const live = facts.filter((fact) => now - fact.createdAt < STATUS_FACT_TTL_MS);
  const perSubject = new Map<string, CharacterStatusFact[]>();
  [...live]
    .filter((fact) => fact.subjectPetId !== roleId)
    .sort((left, right) => (left.kind === right.kind ? right.createdAt - left.createdAt : left.kind === 'self' ? -1 : 1))
    .forEach((fact) => {
      const list = perSubject.get(fact.subjectPetId) ?? [];
      if (list.length < PER_CHARACTER_IN_NOTE) perSubject.set(fact.subjectPetId, [...list, fact]);
    });
  const others = [...perSubject.values()].flat().slice(0, OTHERS_IN_NOTE)
    .map((fact) => `- ${fact.subjectName}：${fact.text}（${fact.kind === 'self' ? `${fact.subjectName}自己说的` : `${fact.sourceName}提到的`}，${ago(now, fact.createdAt)}）`);
  const toldAboutHer = live
    .filter((fact) => fact.kind === 'about-other' && fact.subjectPetId === roleId && now - fact.createdAt < TOLD_USER_WINDOW_MS)
    .slice(-3)
    .map((fact) => `- ${fact.sourceName}刚才跟用户说：“${fact.quote || fact.text}”`);
  const parts: string[] = [];
  if (others.length) parts.push(['【其他角色的近况（你们平时互相聊天知道的，可以自然提起）】', ...others].join('\n'));
  if (toldAboutHer.length) {
    parts.push(['【别人最近跟用户提到的关于你的事】', ...toldAboutHer,
      '跟你自己的近况不冲突时就当作是真的，自然接上，不要否认，也不要说“我怎么不知道”；冲突时按你的性格自然澄清。'].join('\n'));
  }
  return parts.join('\n\n');
}

export function useStatusFacts() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    readStatusFacts,
    readStatusFacts,
  );
}
