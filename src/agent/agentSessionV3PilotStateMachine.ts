export type AgentSessionV3PilotPhase =
  | 'init'
  | 'model_decision'
  | 'prepare_command'
  | 'needs_approval'
  | 'execute_transaction'
  | 'evaluate'
  | 'recover'
  | 'done'
  | 'failed';

export type AgentSessionV3PilotTerminalStatus =
  | 'completed'
  | 'needs-user'
  | 'cancelled'
  | 'failed';

export type AgentSessionV3PilotCommandRoute = 'execute' | 'approval';

export interface AgentSessionV3PilotTerminalState {
  reason?: string | null;
  status: AgentSessionV3PilotTerminalStatus;
}

export interface AgentSessionV3PilotState {
  lastEvent?: AgentSessionV3PilotEventType | null;
  phase: AgentSessionV3PilotPhase;
  recoveryCount: number;
  revision: number;
  terminal?: AgentSessionV3PilotTerminalState | null;
}

export type AgentSessionV3PilotEvent =
  | {
      reason?: string | null;
      type: 'start';
    }
  | {
      reason?: string | null;
      route: 'prepare-command' | 'terminal';
      terminalStatus?: Exclude<AgentSessionV3PilotTerminalStatus, 'failed'> | null;
      type: 'model-decision-accepted';
    }
  | {
      reason?: string | null;
      type: 'model-output-invalid';
    }
  | {
      errorText?: string | null;
      reason?: string | null;
      type: 'model-failed';
    }
  | {
      reason?: string | null;
      route: AgentSessionV3PilotCommandRoute;
      type: 'command-prepared';
    }
  | {
      reason?: string | null;
      type: 'command-unavailable';
    }
  | {
      reason?: string | null;
      type: 'approval-granted';
    }
  | {
      reason?: string | null;
      type: 'approval-denied';
    }
  | {
      ok?: boolean | null;
      reason?: string | null;
      type: 'transaction-finished';
    }
  | {
      reason?: string | null;
      type: 'evaluation-completed';
    }
  | {
      reason?: string | null;
      type: 'evaluation-needs-user';
    }
  | {
      reason?: string | null;
      type: 'evaluation-needs-recovery';
    }
  | {
      reason?: string | null;
      type: 'recovery-model-requested';
    }
  | {
      reason?: string | null;
      route: AgentSessionV3PilotCommandRoute;
      type: 'recovery-command-prepared';
    }
  | {
      reason?: string | null;
      type: 'recovery-exhausted';
    }
  | {
      reason?: string | null;
      type: 'cancel';
    }
  | {
      reason?: string | null;
      type: 'fail';
    };

export type AgentSessionV3PilotEventType = AgentSessionV3PilotEvent['type'];

export type AgentSessionV3PilotTransition =
  | {
      accepted: true;
      event: AgentSessionV3PilotEvent;
      from: AgentSessionV3PilotPhase;
      reason?: string | null;
      state: AgentSessionV3PilotState;
      to: AgentSessionV3PilotPhase;
    }
  | {
      accepted: false;
      event: AgentSessionV3PilotEvent;
      from: AgentSessionV3PilotPhase;
      reason: string;
      state: AgentSessionV3PilotState;
    };

export function createAgentSessionV3PilotInitialState(): AgentSessionV3PilotState {
  return {
    lastEvent: null,
    phase: 'init',
    recoveryCount: 0,
    revision: 0,
    terminal: null,
  };
}

export function isAgentSessionV3PilotTerminalPhase(phase: AgentSessionV3PilotPhase) {
  return phase === 'done' || phase === 'failed';
}

function createAgentSessionV3PilotTerminalState(options: {
  reason?: string | null;
  status: AgentSessionV3PilotTerminalStatus;
}): AgentSessionV3PilotTerminalState {
  return {
    reason: options.reason ?? null,
    status: options.status,
  };
}

function acceptAgentSessionV3PilotTransition(options: {
  event: AgentSessionV3PilotEvent;
  fromState: AgentSessionV3PilotState;
  reason?: string | null;
  terminal?: AgentSessionV3PilotTerminalState | null;
  to: AgentSessionV3PilotPhase;
}): AgentSessionV3PilotTransition {
  const enteringRecovery = options.to === 'recover' && options.fromState.phase !== 'recover';
  const state: AgentSessionV3PilotState = {
    ...options.fromState,
    lastEvent: options.event.type,
    phase: options.to,
    recoveryCount: enteringRecovery
      ? options.fromState.recoveryCount + 1
      : options.fromState.recoveryCount,
    revision: options.fromState.revision + 1,
    terminal: options.terminal ?? null,
  };

  return {
    accepted: true,
    event: options.event,
    from: options.fromState.phase,
    reason: options.reason ?? null,
    state,
    to: options.to,
  };
}

function rejectAgentSessionV3PilotTransition(options: {
  event: AgentSessionV3PilotEvent;
  reason: string;
  state: AgentSessionV3PilotState;
}): AgentSessionV3PilotTransition {
  return {
    accepted: false,
    event: options.event,
    from: options.state.phase,
    reason: options.reason,
    state: options.state,
  };
}

function routeAgentSessionV3PilotPreparedCommand(options: {
  event: Extract<AgentSessionV3PilotEvent, {
    route: AgentSessionV3PilotCommandRoute;
  }>;
  state: AgentSessionV3PilotState;
}) {
  return acceptAgentSessionV3PilotTransition({
    event: options.event,
    fromState: options.state,
    reason: options.event.reason,
    to: options.event.route === 'approval' ? 'needs_approval' : 'execute_transaction',
  });
}

export function advanceAgentSessionV3PilotState(
  state: AgentSessionV3PilotState,
  event: AgentSessionV3PilotEvent,
): AgentSessionV3PilotTransition {
  if (isAgentSessionV3PilotTerminalPhase(state.phase)) {
    return rejectAgentSessionV3PilotTransition({
      event,
      reason: `Cannot apply ${event.type} after terminal phase ${state.phase}.`,
      state,
    });
  }

  if (event.type === 'cancel') {
    return acceptAgentSessionV3PilotTransition({
      event,
      fromState: state,
      reason: event.reason,
      terminal: createAgentSessionV3PilotTerminalState({
        reason: event.reason,
        status: 'cancelled',
      }),
      to: 'done',
    });
  }

  if (event.type === 'fail') {
    return acceptAgentSessionV3PilotTransition({
      event,
      fromState: state,
      reason: event.reason,
      terminal: createAgentSessionV3PilotTerminalState({
        reason: event.reason,
        status: 'failed',
      }),
      to: 'failed',
    });
  }

  switch (state.phase) {
    case 'init':
      if (event.type === 'start') {
        return acceptAgentSessionV3PilotTransition({
          event,
          fromState: state,
          reason: event.reason,
          to: 'model_decision',
        });
      }
      break;

    case 'model_decision':
      if (event.type === 'model-decision-accepted') {
        if (event.route === 'terminal') {
          return acceptAgentSessionV3PilotTransition({
            event,
            fromState: state,
            reason: event.reason,
            terminal: createAgentSessionV3PilotTerminalState({
              reason: event.reason,
              status: event.terminalStatus ?? 'completed',
            }),
            to: 'done',
          });
        }

        return acceptAgentSessionV3PilotTransition({
          event,
          fromState: state,
          reason: event.reason,
          to: 'prepare_command',
        });
      }

      if (event.type === 'model-output-invalid') {
        return acceptAgentSessionV3PilotTransition({
          event,
          fromState: state,
          reason: event.reason,
          to: 'recover',
        });
      }

      if (event.type === 'model-failed') {
        return acceptAgentSessionV3PilotTransition({
          event,
          fromState: state,
          reason: event.reason ?? event.errorText,
          terminal: createAgentSessionV3PilotTerminalState({
            reason: event.reason ?? event.errorText,
            status: 'failed',
          }),
          to: 'failed',
        });
      }
      break;

    case 'prepare_command':
      if (event.type === 'command-prepared') {
        return routeAgentSessionV3PilotPreparedCommand({ event, state });
      }

      if (event.type === 'command-unavailable') {
        return acceptAgentSessionV3PilotTransition({
          event,
          fromState: state,
          reason: event.reason,
          to: 'recover',
        });
      }
      break;

    case 'needs_approval':
      if (event.type === 'approval-granted') {
        return acceptAgentSessionV3PilotTransition({
          event,
          fromState: state,
          reason: event.reason,
          to: 'execute_transaction',
        });
      }

      if (event.type === 'approval-denied') {
        return acceptAgentSessionV3PilotTransition({
          event,
          fromState: state,
          reason: event.reason,
          terminal: createAgentSessionV3PilotTerminalState({
            reason: event.reason,
            status: 'needs-user',
          }),
          to: 'done',
        });
      }
      break;

    case 'execute_transaction':
      if (event.type === 'transaction-finished') {
        return acceptAgentSessionV3PilotTransition({
          event,
          fromState: state,
          reason: event.reason,
          to: 'evaluate',
        });
      }
      break;

    case 'evaluate':
      if (event.type === 'evaluation-completed') {
        return acceptAgentSessionV3PilotTransition({
          event,
          fromState: state,
          reason: event.reason,
          terminal: createAgentSessionV3PilotTerminalState({
            reason: event.reason,
            status: 'completed',
          }),
          to: 'done',
        });
      }

      if (event.type === 'evaluation-needs-user') {
        return acceptAgentSessionV3PilotTransition({
          event,
          fromState: state,
          reason: event.reason,
          terminal: createAgentSessionV3PilotTerminalState({
            reason: event.reason,
            status: 'needs-user',
          }),
          to: 'done',
        });
      }

      if (event.type === 'evaluation-needs-recovery') {
        return acceptAgentSessionV3PilotTransition({
          event,
          fromState: state,
          reason: event.reason,
          to: 'recover',
        });
      }
      break;

    case 'recover':
      if (event.type === 'recovery-model-requested') {
        return acceptAgentSessionV3PilotTransition({
          event,
          fromState: state,
          reason: event.reason,
          to: 'model_decision',
        });
      }

      if (event.type === 'recovery-command-prepared') {
        return routeAgentSessionV3PilotPreparedCommand({ event, state });
      }

      if (event.type === 'recovery-exhausted') {
        return acceptAgentSessionV3PilotTransition({
          event,
          fromState: state,
          reason: event.reason,
          terminal: createAgentSessionV3PilotTerminalState({
            reason: event.reason,
            status: 'failed',
          }),
          to: 'failed',
        });
      }
      break;
  }

  return rejectAgentSessionV3PilotTransition({
    event,
    reason: `Event ${event.type} is not valid while v3 pilot phase is ${state.phase}.`,
    state,
  });
}
