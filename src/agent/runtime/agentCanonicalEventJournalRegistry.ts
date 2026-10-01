import { AgentCanonicalEventJournal } from './agentCanonicalEventJournal.ts';

const journalsByScope = new Map<string, AgentCanonicalEventJournal>();
const MAX_ACTIVE_JOURNALS = 64;

function normalizeScopeId(scopeId: string) {
  const normalized = scopeId.trim();
  if (!normalized) throw new Error('Journal scope id is required.');
  return normalized;
}

export function getOrCreateAgentCanonicalEventJournal(scopeId: string) {
  const normalized = normalizeScopeId(scopeId);
  const current = journalsByScope.get(normalized);
  if (current) return current;
  if (journalsByScope.size >= MAX_ACTIVE_JOURNALS) {
    const oldest = journalsByScope.keys().next().value;
    if (typeof oldest === 'string') journalsByScope.delete(oldest);
  }
  const journal = new AgentCanonicalEventJournal();
  journalsByScope.set(normalized, journal);
  return journal;
}

export function getAgentCanonicalEventJournal(scopeId: string) {
  return journalsByScope.get(normalizeScopeId(scopeId)) ?? null;
}

export function releaseAgentCanonicalEventJournal(scopeId: string) {
  journalsByScope.delete(normalizeScopeId(scopeId));
}

export function clearAgentCanonicalEventJournalRegistry() {
  journalsByScope.clear();
}
