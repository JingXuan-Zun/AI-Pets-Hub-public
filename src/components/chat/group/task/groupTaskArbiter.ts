import type { GroupTaskCandidate } from './groupTaskBridge';

export type GroupTaskArbitration = {
  action: 'submit-to-agent-runtime' | 'reject';
  candidate: GroupTaskCandidate;
  reason: string;
};

export function arbitrateGroupTask(candidate: GroupTaskCandidate): GroupTaskArbitration {
  if (!candidate.requestedCapability.trim() || !candidate.summary.trim()) {
    return { action: 'reject', candidate, reason: 'missing-task-details' };
  }

  return {
    action: 'submit-to-agent-runtime',
    candidate,
    reason: 'single-group-task-candidate',
  };
}
