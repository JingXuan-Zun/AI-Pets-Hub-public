import {
  type RuntimeWorldBehaviorKind,
  type RuntimeWorldBehaviorRequest,
  type RuntimeWorldEvent,
  type RuntimeWorldMainState,
  type RuntimeWorldOverlayState,
  type RuntimeWorldSystem,
} from './runtimeWorldTypes';

export function createStateEventSystem(): RuntimeWorldSystem {
  return {
    id: 'runtime-world.state-events',
    update: ({ events, state, timestampMs }) => {
      let mainState: RuntimeWorldMainState = state.mainState;
      const overlayStates = new Set<RuntimeWorldOverlayState>(state.overlayStates);
      let conversationActive = state.context.conversationActive;
      let userActivity = state.context.userActivity;

      for (const event of events) {
        if (event.kind === 'agent.task-started') {
          conversationActive = true;
          mainState = 'thinking';
          overlayStates.delete('tool-running');
        }

        if (event.kind === 'agent.task-progressed') {
          conversationActive = true;
          const progressType = event.payload?.progressType;
          mainState = progressType === 'model-thinking' || progressType === 'model-decision'
            ? 'thinking'
            : 'working';
          if (progressType === 'tools-running') {
            overlayStates.add('tool-running');
          }
        }

        if (event.kind === 'agent.approval-required') {
          conversationActive = true;
          mainState = 'listening';
          overlayStates.delete('tool-running');
        }

        if (
          event.kind === 'agent.task-succeeded'
          || event.kind === 'agent.task-blocked'
          || event.kind === 'agent.task-cancelled'
          || event.kind === 'agent.task-failed'
        ) {
          conversationActive = false;
          mainState = 'idle';
          overlayStates.delete('tool-running');
        }

        if (event.kind === 'agent.conversation-started') {
          conversationActive = true;
          mainState = 'listening';
        }

        if (event.kind === 'agent.reply-generated') {
          conversationActive = true;
          mainState = 'speaking';
        }

        if (event.kind === 'agent.conversation-ended') {
          conversationActive = false;
          mainState = 'idle';
        }

        if (event.kind === 'input.mouse-move') {
          userActivity = 'mouse';
          overlayStates.add('curious');
        }

        if (event.kind === 'system.app-switch') {
          userActivity = 'app-switch';
        }
      }

      return {
        state: {
          context: {
            conversationActive,
            nowMs: timestampMs,
            userActivity,
          },
          mainState,
          memory: mainState === state.mainState
            ? state.memory
            : {
              ...state.memory,
              currentStateStartedAtMs: timestampMs,
            },
          overlayStates: [...overlayStates],
        },
      };
    },
  };
}

export function createBehaviorRequestSystem(): RuntimeWorldSystem {
  return {
    id: 'runtime-world.behavior-requests',
    update: ({ events, state, timestampMs }) => {
      const behaviorRequests: RuntimeWorldBehaviorRequest[] = [];

      for (const event of events) {
        const kind = resolveBehaviorKindForEvent(event.kind, state.mainState);
        if (!kind) {
          continue;
        }

        behaviorRequests.push({
          id: `${event.id}:behavior`,
          kind,
          priority: event.priority ?? 0,
          reasonEventId: event.id,
          timestampMs,
        });
      }

      return { behaviorRequests };
    },
  };
}

function resolveBehaviorKindForEvent(
  eventKind: RuntimeWorldEvent['kind'],
  mainState: RuntimeWorldMainState,
): RuntimeWorldBehaviorKind | null {
  if (eventKind === 'agent.conversation-started') {
    return 'look-at-user';
  }

  if (eventKind === 'agent.task-started' || eventKind === 'agent.task-progressed') {
    return 'idle-think';
  }

  if (eventKind === 'agent.approval-required') {
    return 'look-at-user';
  }

  if (eventKind === 'agent.task-succeeded') {
    return 'express-emotion';
  }

  if (
    eventKind === 'agent.task-blocked'
    || eventKind === 'agent.task-cancelled'
    || eventKind === 'agent.task-failed'
  ) {
    return 'react';
  }

  if (eventKind === 'agent.reply-generated') {
    return 'express-emotion';
  }

  if (eventKind === 'input.mouse-move' && mainState !== 'speaking') {
    return 'follow-mouse';
  }

  if (eventKind === 'input.mouse-click') {
    return 'react';
  }

  return null;
}
