import type { AgentChatEntryRouteDecision } from '../../../../agent/agentChatEntryRouter';

export type GroupTaskEntryRoute = {
  userDirectedTask: boolean;
  rewrittenGoal: string | null;
};

export function resolveGroupTaskEntryRoute(
  decision: AgentChatEntryRouteDecision,
): GroupTaskEntryRoute {
  return decision.mode === 'agent'
    ? { userDirectedTask: true, rewrittenGoal: decision.rewrittenGoal ?? null }
    : { userDirectedTask: false, rewrittenGoal: null };
}
