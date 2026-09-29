import { useEffect, useMemo, useState } from 'react';
import { type PetAction } from '../../types';
import {
  getAgentRuntimeWorldController,
  subscribeRuntimeWorldPresentationIntent,
  type RuntimeWorldPresentationIntent,
} from '../../runtime-world';

export function resolveRuntimeWorldExpressionAction(
  intent: RuntimeWorldPresentationIntent | null | undefined,
  nowMs = Date.now(),
): PetAction | null {
  if (!intent || nowMs >= intent.timestampMs + intent.durationMs) {
    return null;
  }

  if (intent.emotion === 'positive') {
    return 'HAPPY';
  }

  if (intent.emotion === 'concerned') {
    return 'SAD';
  }

  return null;
}

export function useRuntimeWorldExpressionAction() {
  const [intent, setIntent] = useState<RuntimeWorldPresentationIntent | null>(null);

  useEffect(() => {
    const controller = getAgentRuntimeWorldController();
    const unsubscribeController = controller.subscribe((result) => {
      if (result.presentationIntent) {
        setIntent(result.presentationIntent);
      }
    });
    const unsubscribeRemotePresentation = subscribeRuntimeWorldPresentationIntent(setIntent);

    return () => {
      unsubscribeController();
      unsubscribeRemotePresentation();
    };
  }, []);

  useEffect(() => {
    if (!intent) {
      return undefined;
    }

    const timeoutMs = Math.max(0, intent.timestampMs + intent.durationMs - Date.now());
    const timeoutId = window.setTimeout(() => {
      setIntent((currentIntent) => currentIntent?.id === intent.id ? null : currentIntent);
    }, timeoutMs);

    return () => window.clearTimeout(timeoutId);
  }, [intent]);

  return useMemo(() => resolveRuntimeWorldExpressionAction(intent), [intent]);
}
