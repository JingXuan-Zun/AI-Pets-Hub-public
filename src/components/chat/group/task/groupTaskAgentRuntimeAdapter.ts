import type { AgentRuntimeAdapter, AgentRuntimeRunResult } from '../../../../agent/runtime/agentRuntimeContract';
import { runAgentRuntime } from '../../../../agent/runtime/agentRuntime';
import type { GroupTaskCandidate } from './groupTaskBridge';

export async function submitGroupTaskToAgentRuntime<Result>(options: {
  candidate: GroupTaskCandidate;
  adapter: AgentRuntimeAdapter<Result>;
}): Promise<AgentRuntimeRunResult<Result>> {
  return runAgentRuntime({
    adapter: options.adapter,
    taskIdentity: {
      sourceText: options.candidate.summary,
      userGoal: options.candidate.summary,
    },
  });
}
