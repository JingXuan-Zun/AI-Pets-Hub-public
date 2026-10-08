import { type AgentChatCommandResult, type AgentStructuredToolEvidence } from '../agentChatCommand';
import { createTrustedVisualSnapshotSource } from './visualSnapshotCaptureRecovery';

export function createDesktopVisualSnapshotCaptureRejection({
  focusedSource,
  sourceLabel,
  sourceFallbackLine,
  sourceSelectionDiagnostics,
  captureQualityLine,
  selectedSource,
  analysisSource,
  question,
}: {
  focusedSource: Awaited<ReturnType<typeof createTrustedVisualSnapshotSource>>;
  sourceLabel: string;
  sourceFallbackLine: string;
  sourceSelectionDiagnostics: string[];
  captureQualityLine: string;
  selectedSource: DesktopPetCaptureSourceLike;
  analysisSource: DesktopPetCaptureSourceLike;
  question: string;
}): AgentChatCommandResult {
  const stateSummary = {
    missingEvidence: [
      `Visual capture is untrusted: ${focusedSource.captureQuality.status}`,
      focusedSource.captureQuality.reason,
    ],
    observedState: [
      `Visual source: ${sourceLabel}`,
      sourceFallbackLine,
      ...sourceSelectionDiagnostics,
      focusedSource.cropLine,
      focusedSource.captureFallbackLine,
      captureQualityLine,
    ].filter(Boolean),
    recommendedRecovery: [
      'Retry visual observation with a screen source, a different concrete sourceId, or ask the user to bring the target window fully visible.',
      'Do not click or claim the target is selected/current from this untrusted capture.',
    ],
    structuredEvidence: {
      captureFallback: focusedSource.captureFallbackLine
        ? {
          fromSourceId: selectedSource.id,
          fromSourceType: selectedSource.type,
          reason: focusedSource.captureQuality.reason,
          toSourceId: analysisSource.id,
          toSourceType: analysisSource.type,
        }
        : null,
      captureQuality: focusedSource.captureQuality.metrics,
      captureReason: focusedSource.captureQuality.reason,
      captureSourceType: analysisSource.type,
      captureStatus: focusedSource.captureQuality.status,
      captureTrusted: false,
      confidence: 'low',
      status: 'unverified',
      visualActionReadiness: 'not-actionable',
    } satisfies AgentStructuredToolEvidence,
    verificationEvidence: [
      captureQualityLine,
      focusedSource.captureFallbackLine,
    ].filter(Boolean),
  };
  return {
    errorText: `Visual capture is untrusted: ${focusedSource.captureQuality.status}.`,
    followUp: '这次截图证据不可信，我不会按它继续点击或判断。请让目标窗口保持可见，或改用屏幕来源再观察。',
    observations: [
      `Selected visual source: ${sourceLabel}`,
      sourceFallbackLine,
      focusedSource.cropLine,
      focusedSource.captureFallbackLine,
      captureQualityLine,
      `Visual question: ${question}`,
    ].filter(Boolean),
    ok: false,
    receipt: {
      evidenceLines: stateSummary.observedState,
      status: 'unverified',
      stateSummary,
      summaryLines: [
        '调用：summarize_visual_snapshot',
        `来源：${sourceLabel}`,
        `捕获状态：${focusedSource.captureQuality.status}`,
      ],
      title: '执行回执',
      toolName: 'summarize_visual_snapshot',
      verification: 'Visual capture was rejected before model analysis because the screenshot was black or low-information.',
    },
    responseText: [
      `视觉来源：${sourceLabel}`,
      captureQualityLine,
      focusedSource.captureFallbackLine,
      '这次截图不可信，已停止视觉判断。',
    ].filter(Boolean).join('\n'),
    stateSummary,
    verification: 'Visual capture was rejected before model analysis because the screenshot was black or low-information.',
  };
}


