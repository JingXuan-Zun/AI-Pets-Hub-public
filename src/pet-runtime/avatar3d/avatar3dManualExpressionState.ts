import { type AvatarRuntimeManualExpressionSelection } from '../avatar-runtime/avatarRuntimeTypes';

export function createManualAvatar3DExpressionCue(
  selection: AvatarRuntimeManualExpressionSelection | null | undefined,
) {
  if (!selection?.candidateExpressionNames.length) {
    return null;
  }

  return {
    action: null,
    affectsPresentation: false,
    candidateExpressionNames: selection.candidateExpressionNames,
    durationMs: 0,
    expressionKey: selection.expressionKey,
    id: `manual-expression-${selection.expressionKey}`,
    index: 0,
    source: 'manual' as const,
    weightMultiplier: selection.weightMultiplier ?? 1,
  };
}
