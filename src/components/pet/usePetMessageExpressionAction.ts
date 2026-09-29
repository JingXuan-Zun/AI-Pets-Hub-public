import { useEffect, useRef, useState } from 'react';
import { useDesktopPetChatStore } from '../../chatStore';
import { extractCharacterToolInvocations } from '../chat/characterToolProtocol';
import {
  resolvePetMessageExpressionAction,
  resolvePetMessageExpressionActions,
  type PetMessageExpressionAction,
} from '../../pet-runtime/interactions/petMessageExpressionSignals';
import {
  removePresentedExpressionPrefix,
  resolveStreamingMessageExpressionAction,
} from './petMessageExpressionStreaming';

const EXPRESSION_DURATION_MS = 3200;
const MULTI_EXPRESSION_DURATION_MS = 2800;
const MIN_MULTI_EXPRESSION_DURATION_MS = 2400;
const EXPRESSION_ACTION_MIN_DURATION_MS: Record<PetMessageExpressionAction, number> = {
  EATING: 3000,
  HAPPY: 2600,
  SAD: 3000,
  SLEEPING: 3400,
};

export function resolveExpressionPlaybackDurationMs(
  actionCount: number,
  defaultDurationMs: number,
) {
  if (actionCount <= 1) {
    return defaultDurationMs;
  }

  return Math.max(MIN_MULTI_EXPRESSION_DURATION_MS, Math.min(defaultDurationMs, MULTI_EXPRESSION_DURATION_MS));
}

export function resolveExpressionActionPlaybackDurationMs(
  action: PetMessageExpressionAction,
  actionCount: number,
  defaultDurationMs: number,
) {
  return Math.max(
    resolveExpressionPlaybackDurationMs(actionCount, defaultDurationMs),
    EXPRESSION_ACTION_MIN_DURATION_MS[action] ?? 0,
  );
}

export function resolveExplicitToolActions(latestMessage: string) {
  return extractCharacterToolInvocations(latestMessage)
    .filter((invocation) => invocation.kind === 'action')
    .map((invocation) => invocation.action);
}

export function dedupeSequentialExpressionActions(actions: PetMessageExpressionAction[]) {
  return actions.filter((action, index) => index === 0 || actions[index - 1] !== action);
}

export function resolveMessageExpressionActionQueue(
  latestMessage: string,
  queuedExplicitToolActions: PetMessageExpressionAction[] = [],
) {
  const explicitActions = queuedExplicitToolActions.length > 0
    ? queuedExplicitToolActions
    : resolveExplicitToolActions(latestMessage);

  return dedupeSequentialExpressionActions(
    explicitActions.length > 0
      ? explicitActions
      : resolvePetMessageExpressionActions(latestMessage),
  );
}

export { resolvePetMessageExpressionAction, resolvePetMessageExpressionActions };
export type { PetMessageExpressionAction };

export function usePetMessageExpressionAction(
  latestMessage: string,
  isTyping = false,
  durationMs = EXPRESSION_DURATION_MS,
  petId = 'primary',
  streamExpressionsWhileTyping = false,
) {
  const speechExpressionAction = useDesktopPetChatStore()
    .speechExpressionActionByPetId[petId] ?? null;
  const [expressionAction, setExpressionAction] = useState<PetMessageExpressionAction | null>(null);
  const timerRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const activeActionRef = useRef<PetMessageExpressionAction | null>(null);
  const activeActionStartedAtMsRef = useRef(0);
  const queuedStreamingToolActionsRef = useRef<PetMessageExpressionAction[]>([]);
  const streamingPresentedActionsRef = useRef<PetMessageExpressionAction[]>([]);
  const lastProcessedMessageRef = useRef('');
  const wasTypingRef = useRef(false);

  const clearScheduledPlayback = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  useEffect(() => () => {
    clearScheduledPlayback();
  }, []);

  useEffect(() => {
    const normalizedMessage = latestMessage.trim();
    const wasTyping = wasTypingRef.current;
    wasTypingRef.current = isTyping;

    if (isTyping) {
      if (!wasTyping) {
        queuedStreamingToolActionsRef.current = [];
        clearScheduledPlayback();
        activeActionRef.current = null;
        activeActionStartedAtMsRef.current = 0;
        lastProcessedMessageRef.current = '';
        streamingPresentedActionsRef.current = [];
        setExpressionAction(null);
      }

      const explicitToolActions = resolveExplicitToolActions(normalizedMessage);
      if (explicitToolActions.length > 0) {
        queuedStreamingToolActionsRef.current = explicitToolActions;
      }
      if (!streamExpressionsWhileTyping) {
        return;
      }
      const streamingAction = resolveStreamingMessageExpressionAction(normalizedMessage);
      if (streamingAction && activeActionRef.current !== streamingAction) {
        clearScheduledPlayback();
        activeActionRef.current = streamingAction;
        activeActionStartedAtMsRef.current = window.performance?.now?.() ?? Date.now();
        const presentedActions = streamingPresentedActionsRef.current;
        if (presentedActions.at(-1) !== streamingAction) {
          presentedActions.push(streamingAction);
        }
        setExpressionAction(streamingAction);
      }
      return;
    }

    const queuedExplicitActions = wasTyping ? queuedStreamingToolActionsRef.current : [];
    if (!normalizedMessage && queuedExplicitActions.length === 0) {
      return;
    }

    if (lastProcessedMessageRef.current === normalizedMessage && queuedExplicitActions.length === 0) {
      return;
    }

    const nextActions = removePresentedExpressionPrefix(
      resolveMessageExpressionActionQueue(normalizedMessage, queuedExplicitActions),
      wasTyping ? streamingPresentedActionsRef.current : [],
    );
    queuedStreamingToolActionsRef.current = [];
    streamingPresentedActionsRef.current = [];
    lastProcessedMessageRef.current = normalizedMessage;
    if (nextActions.length === 0) {
      const activeAction = activeActionRef.current;
      if (activeAction) {
        clearScheduledPlayback();
        const nowMs = window.performance?.now?.() ?? Date.now();
        const minimumDurationMs = resolveExpressionActionPlaybackDurationMs(activeAction, 1, durationMs);
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          activeActionRef.current = null;
          activeActionStartedAtMsRef.current = 0;
          setExpressionAction(null);
        }, Math.max(0, minimumDurationMs - (nowMs - activeActionStartedAtMsRef.current)));
      }
      return;
    }

    clearScheduledPlayback();

    const playActionAtIndex = (actionIndex: number) => {
      const nextAction = nextActions[actionIndex];
      if (!nextAction) {
        activeActionRef.current = null;
        activeActionStartedAtMsRef.current = 0;
        setExpressionAction(null);
        return;
      }

      const applyAction = () => {
        activeActionRef.current = nextAction;
        activeActionStartedAtMsRef.current = window.performance?.now?.() ?? Date.now();
        setExpressionAction(nextAction);
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          const nextActionIndex = actionIndex + 1;
          if (nextActionIndex >= nextActions.length) {
            activeActionRef.current = null;
            activeActionStartedAtMsRef.current = 0;
            setExpressionAction(null);
            return;
          }

          playActionAtIndex(nextActionIndex);
        }, resolveExpressionActionPlaybackDurationMs(nextAction, nextActions.length, durationMs));
      };

      applyAction();
    };

    playActionAtIndex(0);
  }, [durationMs, isTyping, latestMessage, streamExpressionsWhileTyping]);

  return speechExpressionAction ?? expressionAction;
}
