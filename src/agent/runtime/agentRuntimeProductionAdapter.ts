import {
  type AgentRuntimeAdapter,
  type AgentRuntimeAdapterContext,
} from './agentRuntimeContract';

export interface CreateAgentRuntimeProductionAdapterOptions<Result> {
  id?: string | null;
  run: (context: AgentRuntimeAdapterContext) => Promise<Result>;
}

export function createAgentRuntimeProductionAdapter<Result>(
  options: CreateAgentRuntimeProductionAdapterOptions<Result>,
): AgentRuntimeAdapter<Result> {
  return {
    id: options.id?.trim() || 'production-runtime-adapter',
    async run(context) {
      if (!context) {
        throw new Error('Production AgentRuntime adapter requires Runtime context.');
      }
      return {
        implementation: 'stable',
        reason: 'AgentRuntime dispatched the single configured production session adapter.',
        result: await options.run(context),
      };
    },
  };
}
