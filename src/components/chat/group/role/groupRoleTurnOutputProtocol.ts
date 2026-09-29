import type { GroupRoleTurnOutput } from './groupRoleTurnOutput';
import { GROUP_TOPIC_SIGNALS } from './groupTopicSignalProtocol';
import { GROUP_CONTRIBUTION_SIGNALS } from './groupContributionSignalProtocol';

const TOPIC_SIGNAL_SET = new Set<string>(GROUP_TOPIC_SIGNALS);
const CONTRIBUTION_SIGNAL_SET = new Set<string>(GROUP_CONTRIBUTION_SIGNALS);

function parseRelationshipSignal(value: unknown): GroupRoleTurnOutput['relationshipSignal'] | null {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object') return null;
  const signal = value as Record<string, unknown>;
  const deltas = signal.deltas as Record<string, unknown> | undefined;
  if (typeof signal.targetRoleName !== 'string' || typeof signal.reason !== 'string' || !deltas
    || !['intimacy', 'trust', 'vigilance'].every((key) => (
      Number.isInteger(deltas[key]) && Number(deltas[key]) >= -10 && Number(deltas[key]) <= 10
    ))) return null;
  return {
    deltas: { intimacy: Number(deltas.intimacy), trust: Number(deltas.trust), vigilance: Number(deltas.vigilance) },
    reason: signal.reason, targetRoleName: signal.targetRoleName,
  };
}

export function parseGroupRoleTurnOutput(value: unknown): GroupRoleTurnOutput | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.text !== 'string') {
    return null;
  }
  if (
    record.topicSignal !== undefined
    && (typeof record.topicSignal !== 'string' || !TOPIC_SIGNAL_SET.has(record.topicSignal))
  ) {
    return null;
  }
  if (record.contributionSignal !== undefined
    && (typeof record.contributionSignal !== 'string'
      || !CONTRIBUTION_SIGNAL_SET.has(record.contributionSignal))) return null;
  const relationshipSignal = parseRelationshipSignal(record.relationshipSignal);
  if (relationshipSignal === null) return null;
  const baseOutput: GroupRoleTurnOutput = {
    text: record.text,
    ...(typeof record.contributionSignal === 'string'
      ? { contributionSignal: record.contributionSignal as GroupRoleTurnOutput['contributionSignal'] }
      : {}),
    ...(typeof record.topicSignal === 'string'
      ? { topicSignal: record.topicSignal as GroupRoleTurnOutput['topicSignal'] }
      : {}),
    ...(relationshipSignal ? { relationshipSignal } : {}),
  };
  if (record.taskProposal === undefined) return baseOutput;
  if (!record.taskProposal || typeof record.taskProposal !== 'object') {
    return null;
  }
  const proposal = record.taskProposal as Record<string, unknown>;
  if (typeof proposal.summary !== 'string' || typeof proposal.requestedCapability !== 'string') {
    return null;
  }

  return {
    ...baseOutput,
    taskProposal: {
      summary: proposal.summary,
      requestedCapability: proposal.requestedCapability,
    },
  };
}
