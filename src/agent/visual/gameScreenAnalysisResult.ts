import { type AgentChatCommandResult } from '../agentChatCommand';
import { createTrustedVisualSnapshotSource } from './visualSnapshotCaptureRecovery';
import { createVisualSnapshotStructuredEvidence } from './visualSnapshotStructuredEvidence';

export function createGameScreenAnalysisResult({
  analysis,
  analysisSource,
  availableSources,
  preparedSource,
  selectedSource,
  sourceLabel,
  captureQualityLine,
  gameHint,
  focus,
  question,
}: {
  analysis: string;
  analysisSource: DesktopPetCaptureSourceLike;
  availableSources: DesktopPetCaptureSourceLike[];
  preparedSource: Awaited<ReturnType<typeof createTrustedVisualSnapshotSource>>;
  selectedSource: DesktopPetCaptureSourceLike;
  sourceLabel: string;
  captureQualityLine: string;
  gameHint: string;
  focus: string;
  question: string;
}): AgentChatCommandResult {
  const structuredEvidence = createVisualSnapshotStructuredEvidence(analysis, 'game', analysisSource, availableSources, '', {
    fallbackLine: preparedSource.captureFallbackLine,
    quality: preparedSource.captureQuality,
    selectedSource,
  });
  const observations = [
    `Selected game source: ${sourceLabel}`,
    `Available capture sources: ${availableSources.length}`,
    preparedSource.cropLine,
    captureQualityLine,
    preparedSource.captureFallbackLine,
    gameHint ? `Game hint: ${gameHint}` : '',
    focus ? `Analysis focus: ${focus}` : '',
    `Game analysis question: ${question}`,
    ...structuredEvidence.evidenceLines,
  ].filter(Boolean);
  const stateSummary = {
    missingEvidence: structuredEvidence.missingEvidence,
    observedState: [
      `Game source: ${sourceLabel}`,
      preparedSource.cropLine,
      captureQualityLine,
      preparedSource.captureFallbackLine,
      ...structuredEvidence.observedState,
    ].filter(Boolean),
    recommendedRecovery: structuredEvidence.recommendedRecovery,
    verificationEvidence: [
      ...structuredEvidence.verificationEvidence,
      preparedSource.cropLine
        ? 'Game snapshot analyzed from one cropped focus/fallback region of a captured screen/window thumbnail.'
        : 'Game snapshot analyzed from one captured screen/window thumbnail.',
    ],
  };
  return {
    observations,
    ok: true,
    receipt: {
      evidenceLines: observations,
      status: 'success',
      stateSummary,
      summaryLines: [
        'Call: analyze_game_screen',
        `Source: ${sourceLabel}`,
        `Analysis: ${structuredEvidence.summaryText}`,
      ],
      title: '执行回执',
      toolName: 'analyze_game_screen',
      verification: 'Captured one game screen/window thumbnail and analyzed it with the configured vision-capable model.',
    },
    responseText: [
      `Game source: ${sourceLabel}`,
      structuredEvidence.responseText,
    ].join('\n'),
    stateSummary,
    verification: 'Game analysis came from one captured screen/window thumbnail. Raw image data was not stored in AgentSessionV2 history.',
  };
}


