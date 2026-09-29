import {
  type AgentSessionV3PilotEvent,
  type AgentSessionV3PilotPhase,
} from './agentSessionV3PilotStateMachine';
import { type AgentSessionV3PilotEventDriver } from './agentSessionV3PilotRunner';

export type AgentSessionV3PilotDrivenPhase = Exclude<AgentSessionV3PilotPhase, 'done' | 'failed'>;

export type AgentSessionV3PilotPhaseHandler = (
  context: Parameters<AgentSessionV3PilotEventDriver>[0],
) => AgentSessionV3PilotEvent | null | Promise<AgentSessionV3PilotEvent | null>;

export type AgentSessionV3PilotPhaseHandlers = Partial<Record<
  AgentSessionV3PilotDrivenPhase,
  AgentSessionV3PilotPhaseHandler
>>;

export interface CreateAgentSessionV3PilotPhaseDriverOptions {
  handlers: AgentSessionV3PilotPhaseHandlers;
  onUnhandledPhase?: AgentSessionV3PilotPhaseHandler | null;
}

export function createAgentSessionV3PilotPhaseDriver(
  options: CreateAgentSessionV3PilotPhaseDriverOptions,
): AgentSessionV3PilotEventDriver {
  return (context) => {
    if (context.state.phase === 'done' || context.state.phase === 'failed') {
      return null;
    }

    const handler = options.handlers[context.state.phase] ?? options.onUnhandledPhase ?? null;
    if (!handler) {
      return null;
    }

    return handler(context);
  };
}
