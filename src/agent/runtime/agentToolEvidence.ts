import {
  type AgentStructuredToolCandidateEvidence,
  type AgentStructuredToolEvidence,
} from '../agentChatCommand';
import { type AgentRuntimeToolResultEntry } from './agentRuntimeContract';

export function compactAgentText(value: unknown, maxLength = 900) {
  const text = typeof value === 'string'
    ? value
    : value === undefined || value === null
      ? ''
      : JSON.stringify(value);
  const compactText = text.replace(/\s+/gu, ' ').trim();
  return compactText.length <= maxLength
    ? compactText
    : `${compactText.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function getAgentStructuredEvidence(
  entry: AgentRuntimeToolResultEntry | null,
): AgentStructuredToolEvidence | null {
  return entry?.result.stateSummary?.structuredEvidence
    ?? entry?.result.receipt?.stateSummary?.structuredEvidence
    ?? null;
}

export function getAgentPostActionState(entry: AgentRuntimeToolResultEntry | null) {
  const state = getAgentStructuredEvidence(entry)?.postActionState;
  return typeof state === 'string' ? state.trim().toLowerCase() : '';
}

export function hasAgentCandidateLocationEvidence(
  candidate: AgentStructuredToolCandidateEvidence,
) {
  return Boolean(
    candidate.region?.trim()
    || (
      Number.isFinite(Number(candidate.center?.x))
      && Number.isFinite(Number(candidate.center?.y))
    )
    || (
      Number.isFinite(Number(candidate.centerRatio?.x))
      && Number.isFinite(Number(candidate.centerRatio?.y))
    )
    || (
      Number.isFinite(Number(candidate.bounds?.x))
      && Number.isFinite(Number(candidate.bounds?.y))
      && Number.isFinite(Number(candidate.bounds?.width))
      && Number.isFinite(Number(candidate.bounds?.height))
    )
  );
}
