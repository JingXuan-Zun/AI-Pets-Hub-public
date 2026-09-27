import { type AgentActionScope } from '../agentChatCommand';

export function createAgentTaskGoalId(value: string) {
  const normalized = value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 96) || 'task';
  return `goal:${normalized}`;
}

export function createAgentSubgoalId(options: {
  completion: AgentActionScope['completion'];
  targetRef: string;
}) {
  return `${options.completion}:${createAgentTaskGoalId(options.targetRef).slice(5)}`;
}
