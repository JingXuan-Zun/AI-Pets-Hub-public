import { desktopPetShellBridge } from '../desktopShellBridge';
import type { RuntimeWorldPresentationIntent } from './runtimeWorldPresentationTypes';

function isRuntimeWorldPresentationIntent(
  value: unknown,
): value is RuntimeWorldPresentationIntent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const intent = value as Partial<RuntimeWorldPresentationIntent>;
  return typeof intent.id === 'string'
    && typeof intent.durationMs === 'number'
    && typeof intent.timestampMs === 'number'
    && typeof intent.emotion === 'string'
    && typeof intent.behaviorKind === 'string';
}

export function publishRuntimeWorldPresentationIntent(
  intent: RuntimeWorldPresentationIntent,
) {
  desktopPetShellBridge.publishRuntimeWorldPresentationIntent(intent);
}

export function subscribeRuntimeWorldPresentationIntent(
  listener: (intent: RuntimeWorldPresentationIntent) => void,
) {
  return desktopPetShellBridge.onRuntimeWorldPresentationIntent((intent) => {
    if (isRuntimeWorldPresentationIntent(intent)) {
      listener(intent);
    }
  });
}
