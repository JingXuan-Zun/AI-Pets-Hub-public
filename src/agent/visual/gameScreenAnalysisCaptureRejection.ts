import { type AgentChatCommandResult, type AgentStructuredToolEvidence } from '../agentChatCommand';
import { createTrustedVisualSnapshotSource } from './visualSnapshotCaptureRecovery';

export function createGameScreenAnalysisCaptureRejection({
  preparedSource,
  sourceLabel,
  captureQualityLine,
  selectedSource,
  analysisSource,
  question,
}: {
  preparedSource: Awaited<ReturnType<typeof createTrustedVisualSnapshotSource>>;
  sourceLabel: string;
  captureQualityLine: string;
  selectedSource: DesktopPetCaptureSourceLike;
  analysisSource: DesktopPetCaptureSourceLike;
  question: string;
}): AgentChatCommandResult {
  const stateSummary = {
    missingEvidence: [
      `Game capture is untrusted: ${preparedSource.captureQuality.status}`,
      preparedSource.captureQuality.reason,
    ],
    observedState: [
      `Game source: ${sourceLabel}`,
      preparedSource.cropLine,
      preparedSource.captureFallbackLine,
      captureQualityLine,
    ].filter(Boolean),
    recommendedRecovery: [
      'Retry game analysis with a visible screen source/window source before summarizing gameplay.',
      'Do not claim what is happening in the game from this untrusted capture.',
    ],
    structuredEvidence: {
      captureFallback: preparedSource.captureFallbackLine
        ? {
          fromSourceId: selectedSource.id,
          fromSourceType: selectedSource.type,
          reason: preparedSource.captureQuality.reason,
          toSourceId: analysisSource.id,
          toSourceType: analysisSource.type,
        }
        : null,
      captureQuality: preparedSource.captureQuality.metrics,
      captureReason: preparedSource.captureQuality.reason,
      captureSourceType: analysisSource.type,
      captureStatus: preparedSource.captureQuality.status,
      captureTrusted: false,
      confidence: 'low',
      status: 'unverified',
      visualActionReadiness: 'not-actionable',
    } satisfies AgentStructuredToolEvidence,
    verificationEvidence: [
      captureQualityLine,
      preparedSource.captureFallbackLine,
    ].filter(Boolean),
  };
  return {
    errorText: `Game capture is untrusted: ${preparedSource.captureQuality.status}.`,
    followUp: '这次游戏画面截图不可信，我不会硬总结。请保持游戏窗口可见，或改用屏幕来源再分析。',
    observations: [
      `Selected game source: ${sourceLabel}`,
      preparedSource.cropLine,
      preparedSource.captureFallbackLine,
      captureQualityLine,
      `Game analysis question: ${question}`,
    ].filter(Boolean),
    ok: false,
    receipt: {
      evidenceLines: stateSummary.observedState,
      status: 'unverified',
      stateSummary,
      summaryLines: [
        'Call: analyze_game_screen',
        `Source: ${sourceLabel}`,
        `Capture status: ${preparedSource.captureQuality.status}`,
      ],
      title: '执行回执',
      toolName: 'analyze_game_screen',
      verification: 'Game capture was rejected before model analysis because the screenshot was black or low-information.',
    },
    responseText: [
      `Game source: ${sourceLabel}`,
      captureQualityLine,
      preparedSource.captureFallbackLine,
      'This game capture is untrusted, so no gameplay summary was produced.',
    ].filter(Boolean).join('\n'),
    stateSummary,
    verification: 'Game capture was rejected before model analysis because the screenshot was black or low-information.',
  };
}


