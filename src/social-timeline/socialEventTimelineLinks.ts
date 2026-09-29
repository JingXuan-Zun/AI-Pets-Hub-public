import type {
  SocialEventLink,
  SocialEventLinkRelation,
  SocialEventTimelineEntry,
} from './socialEventTimelineTypes';

const REVERSE_RELATION: Partial<Record<SocialEventLinkRelation, SocialEventLinkRelation>> = {
  corrects: 'corrected-by',
  'derived-from': 'derived-into',
  reverts: 'reverted-by',
  supersedes: 'superseded-by',
};

function referenceIndex(entries: SocialEventTimelineEntry[]) {
  const index = new Map<string, SocialEventTimelineEntry[]>();
  entries.forEach((entry) => entry.evidence.forEach((evidence) => {
    if (!evidence.referenceId) return;
    index.set(evidence.referenceId, [...(index.get(evidence.referenceId) ?? []), entry]);
  }));
  return index;
}

function resolveTarget(entry: SocialEventTimelineEntry, link: SocialEventLink,
  byId: Map<string, SocialEventTimelineEntry>, byReference: Map<string, SocialEventTimelineEntry[]>) {
  if (link.targetEventId && byId.has(link.targetEventId)) return link.targetEventId;
  const candidates = (byReference.get(link.targetReferenceId) ?? [])
    .filter((candidate) => candidate.id !== entry.id && candidate.occurredAt <= entry.occurredAt)
    .sort((left, right) => right.occurredAt - left.occurredAt);
  return candidates[0]?.id ?? null;
}

function dedupeLinks(links: SocialEventLink[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.relation}:${link.targetEventId ?? ''}:${link.targetReferenceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveSocialEventTimelineLinks(entries: SocialEventTimelineEntry[]) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const byReference = referenceIndex(entries);
  const resolved = entries.map((entry) => ({
    ...entry,
    links: entry.links.map((link) => ({
      ...link, targetEventId: resolveTarget(entry, link, byId, byReference),
    })),
  }));
  const resolvedById = new Map(resolved.map((entry) => [entry.id, entry]));
  resolved.forEach((entry) => entry.links.forEach((link) => {
    const reverse = REVERSE_RELATION[link.relation];
    const target = link.targetEventId ? resolvedById.get(link.targetEventId) : null;
    if (!reverse || !target) return;
    target.links.push({ relation: reverse, targetEventId: entry.id, targetReferenceId: entry.id });
  }));
  return resolved.map((entry) => ({ ...entry, links: dedupeLinks(entry.links) }));
}
