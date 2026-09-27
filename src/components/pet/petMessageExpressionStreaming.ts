import {
  resolvePetMessageExpressionActions,
  type PetMessageExpressionAction,
} from '../../pet-runtime/interactions/petMessageExpressionSignals';
import { extractCharacterToolInvocations } from '../chat/characterToolProtocol';

export function resolveStreamingMessageExpressionAction(message: string) {
  const explicitActions = extractCharacterToolInvocations(message)
    .filter((invocation) => invocation.kind === 'action')
    .map((invocation) => invocation.action);
  const actions = explicitActions.length > 0
    ? explicitActions
    : resolvePetMessageExpressionActions(message);
  return actions.at(-1) ?? null;
}

export function removePresentedExpressionPrefix(
  actions: PetMessageExpressionAction[],
  presentedActions: PetMessageExpressionAction[],
) {
  if (presentedActions.length === 0) {
    return actions;
  }
  let presentedIndex = 0;
  for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
    if (actions[actionIndex] !== presentedActions[presentedIndex]) {
      continue;
    }
    presentedIndex += 1;
    if (presentedIndex === presentedActions.length) {
      return actions.slice(actionIndex + 1);
    }
  }
  return actions;
}
