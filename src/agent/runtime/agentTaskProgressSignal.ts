import { type AgentRuntimeStep } from './agentRuntimeContract';

function compactAgentTaskProgressText(value: string, maxLength: number) {
  const compactText = value.replace(/\s+/gu, ' ').trim();
  if (compactText.length <= maxLength) {
    return compactText;
  }

  return `${compactText.slice(0, Math.max(0, maxLength - 3))}...`;
}

function getLatestAgentTaskUnderstanding(steps: AgentRuntimeStep[]) {
  return [...steps].reverse().find((step) => (
    step.understanding
    && (
      step.understanding.userNeed
      || step.understanding.successCriteria
      || step.understanding.completedGoals?.length
      || step.understanding.remainingGoals?.length
      || step.understanding.blockedGoals?.length
      || step.understanding.verificationStatus
      || step.understanding.verificationEvidence?.length
      || step.understanding.verificationGaps?.length
    )
  ))?.understanding ?? null;
}

export function createAgentTaskProgressText(steps: AgentRuntimeStep[]) {
  const understanding = getLatestAgentTaskUnderstanding(steps);
  if (!understanding) {
    return '';
  }

  return [
    understanding.userNeed ? `userNeed=${compactAgentTaskProgressText(understanding.userNeed, 260)}` : '',
    understanding.successCriteria ? `successCriteria=${compactAgentTaskProgressText(understanding.successCriteria, 360)}` : '',
    understanding.completedGoals?.length
      ? `completedGoals=${compactAgentTaskProgressText(understanding.completedGoals.join(' | '), 420)}`
      : 'completedGoals=none yet',
    understanding.remainingGoals?.length
      ? `remainingGoals=${compactAgentTaskProgressText(understanding.remainingGoals.join(' | '), 420)}`
      : 'remainingGoals=none',
    understanding.blockedGoals?.length
      ? `blockedGoals=${compactAgentTaskProgressText(understanding.blockedGoals.join(' | '), 360)}`
      : '',
    understanding.verificationStatus ? `verificationStatus=${understanding.verificationStatus}` : 'verificationStatus=unknown',
    understanding.verificationEvidence?.length
      ? `verificationEvidence=${compactAgentTaskProgressText(understanding.verificationEvidence.join(' | '), 420)}`
      : 'verificationEvidence=none yet',
    understanding.verificationGaps?.length
      ? `verificationGaps=${compactAgentTaskProgressText(understanding.verificationGaps.join(' | '), 420)}`
      : '',
    'Before final_answer, update this board from the latest evidence. If remainingGoals is not empty, choose the next tool or ask one short necessary question instead of finishing.',
    'Before final_answer, verificationStatus must be satisfied or blocked and verificationEvidence must cite concrete tool evidence.',
  ].filter(Boolean).join('\n');
}
