import { type AgentToolCallName } from '../agentChatCommand';
import { type AgentToolInputParamSpec } from '../agentToolInputSchema';

export const AGENT_OBSERVATION_INPUT_SPECS = {
  get_system_info: [
    {
      key: 'includeDisplays',
      type: 'boolean',
    },
  ],
} satisfies Partial<Record<AgentToolCallName, readonly AgentToolInputParamSpec[]>>;
