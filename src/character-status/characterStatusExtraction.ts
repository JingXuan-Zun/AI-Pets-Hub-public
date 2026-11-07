import type { CharacterStatusFact } from './characterStatusBoard';

// The status facts come out of the cognition update that already runs after a conversation goes
// quiet (no extra model call, no hidden markers in replies). Only lines the characters said count.

export const STATUS_EXTRACTION_INSTRUCTION = [
  'status：只看 dialogue 里角色（不是用户）说过的话，记下关于角色自己或其他角色“在做什么、在哪、最近在忙什么”的事实，最多 3 条。',
  '每条写 {"speaker":"说这话的角色名","subject":"这件事是关于哪个角色","text":"十几个字的简短描述","quote":"原话片段"}。',
  '用户说的话一律不记；感情、私密话题、对用户的态度都不记；没有就写 []。',
].join('\n');

interface NamedRole {
  id: string;
  name: string;
}

function resolveRole(name: unknown, roles: NamedRole[]) {
  if (typeof name !== 'string' || !name.trim()) return null;
  const wanted = name.trim();
  return roles.find((role) => role.name === wanted)
    ?? roles.find((role) => role.name.length >= 2 && (wanted.includes(role.name) || role.name.includes(wanted)))
    ?? null;
}

function jsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(text.slice(start, end + 1)) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/** Facts from the update's "status" field; unknown names and user lines are dropped. */
export function parseStatusFacts(output: string, roles: NamedRole[], now: number): CharacterStatusFact[] {
  const status = jsonObject(output)?.status;
  if (!Array.isArray(status)) return [];
  return status.slice(0, 3).flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const entry = item as Record<string, unknown>;
    const speaker = resolveRole(entry.speaker, roles);
    const subject = resolveRole(entry.subject, roles);
    const text = typeof entry.text === 'string' ? entry.text.trim().slice(0, 60) : '';
    if (!speaker || !subject || !text) return [];
    return [{
      createdAt: now,
      id: `status-${now.toString(36)}-${index}`,
      kind: speaker.id === subject.id ? 'self' as const : 'about-other' as const,
      quote: typeof entry.quote === 'string' ? entry.quote.trim().slice(0, 80) : '',
      sourceName: speaker.name,
      sourcePetId: speaker.id,
      subjectName: subject.name,
      subjectPetId: subject.id,
      text,
    }];
  });
}
