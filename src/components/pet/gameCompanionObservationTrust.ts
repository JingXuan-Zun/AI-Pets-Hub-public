export interface GameCompanionObservationEvidence {
  confidence?: number | null;
  hasStructuredOutput: boolean;
  hud?: string | null;
  playerState?: string | null;
  sceneState?: string | null;
  summary?: string | null;
  uncertainty?: string[] | null;
  visibleText?: string[] | null;
}

export const MIN_GAME_COMPANION_OBSERVATION_CONFIDENCE = 0.72;

export function getGameCompanionObservationTrustIssue(
  observation: GameCompanionObservationEvidence,
): string | null {
  if (!observation.hasStructuredOutput) {
    return '视觉模型没有返回可验证的结构化观察结果';
  }

  if (typeof observation.confidence !== 'number') {
    return '视觉模型没有提供置信度';
  }

  if (observation.confidence < MIN_GAME_COMPANION_OBSERVATION_CONFIDENCE) {
    return `画面置信度仅为 ${Math.round(observation.confidence * 100)}%`;
  }

  const uncertainty = observation.uncertainty?.find((item) => item.trim());
  if (uncertainty) {
    return uncertainty;
  }

  const hasVisibleEvidence = Boolean(
    observation.summary?.trim()
    || observation.sceneState?.trim()
    || observation.playerState?.trim()
    || observation.hud?.trim()
    || observation.visibleText?.some((item) => item.trim()),
  );
  return hasVisibleEvidence ? null : '没有识别到可用于陪玩回应的画面证据';
}
