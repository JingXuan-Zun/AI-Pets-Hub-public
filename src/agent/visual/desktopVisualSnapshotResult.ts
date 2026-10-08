import { type AgentChatCommandResult, type AgentToolCallCommand } from '../agentChatCommand';
import { createTrustedVisualSnapshotSource } from './visualSnapshotCaptureRecovery';
import { createVisualSnapshotStructuredEvidence } from './visualSnapshotStructuredEvidence';
import { getToolStringInput } from './visualToolInput';

export function createDesktopVisualSnapshotResult({
  summary,
  analysisSource,
  availableSources,
  toolCall,
  question,
  focusedSource,
  selectedSource,
  sourceLabel,
  sourceFallbackLine,
  sourceSelectionDiagnostics,
  captureQualityLine,
}: {
  summary: string;
  analysisSource: DesktopPetCaptureSourceLike;
  availableSources: DesktopPetCaptureSourceLike[];
  toolCall: AgentToolCallCommand;
  question: string;
  focusedSource: Awaited<ReturnType<typeof createTrustedVisualSnapshotSource>>;
  selectedSource: DesktopPetCaptureSourceLike;
  sourceLabel: string;
  sourceFallbackLine: string;
  sourceSelectionDiagnostics: string[];
  captureQualityLine: string;
}): AgentChatCommandResult {
  const structuredEvidence = createVisualSnapshotStructuredEvidence(
    summary,
    'desktop',
    analysisSource,
    availableSources,
    getToolStringInput(toolCall, ['targetText', 'targetLabel', 'targetDescription', 'target', 'targetElement', 'element', 'description'])
    || question,
    {
      fallbackLine: focusedSource.captureFallbackLine,
      quality: focusedSource.captureQuality,
      selectedSource,
    },
  );
  const observations = [
    `Selected visual source: ${sourceLabel}`,
    sourceFallbackLine,
    ...sourceSelectionDiagnostics,
    `Available capture sources: ${availableSources.length}`,
    focusedSource.cropLine,
    captureQualityLine,
    focusedSource.captureFallbackLine,
    `Visual question: ${question}`,
    ...structuredEvidence.evidenceLines,
  ].filter(Boolean);
  const stateSummary = {
    missingEvidence: structuredEvidence.missingEvidence,
    observedState: [
      `Visual source: ${sourceLabel}`,
      sourceFallbackLine,
      ...sourceSelectionDiagnostics,
      focusedSource.cropLine,
      captureQualityLine,
      focusedSource.captureFallbackLine,
      ...structuredEvidence.observedState,
    ].filter(Boolean),
    recommendedRecovery: structuredEvidence.recommendedRecovery,
    structuredEvidence: structuredEvidence.structuredEvidence,
    verificationEvidence: [
      ...structuredEvidence.verificationEvidence,
      focusedSource.cropLine
        ? 'Visual snapshot analyzed from one cropped focus region of a captured screen/window thumbnail.'
        : 'Visual snapshot analyzed from one captured screen/window thumbnail.',
    ],
  };
  const receiptStatus = structuredEvidence.structuredEvidence?.status === 'success'
    ? 'success'
    : 'unverified';
  return {
    observations,
    ok: true,
    receipt: {
      evidenceLines: observations,
      status: receiptStatus,
      stateSummary,
      summaryLines: [
        '调用：summarize_visual_snapshot',
        `来源：${sourceLabel}`,
        focusedSource.cropLine,
        `摘要：${structuredEvidence.summaryText}`,
      ].filter(Boolean),
      title: '执行回执',
      toolName: 'summarize_visual_snapshot',
      verification: focusedSource.cropLine
        ? 'Captured one focused crop from a screen/window thumbnail and summarized it with the configured vision-capable model.'
        : 'Captured one screen/window thumbnail and summarized it with the configured vision-capable model.',
    },
    responseText: [
      `视觉来源：${sourceLabel}`,
      focusedSource.cropLine,
      structuredEvidence.responseText,
    ].filter(Boolean).join('\n'),
    stateSummary,
    verification: focusedSource.cropLine
      ? '视觉摘要来自一次屏幕/窗口缩略图的局部裁剪和模型摘要；原始图片没有写入 Agent 循环历史。'
      : '视觉摘要来自一次屏幕/窗口缩略图捕获和模型摘要；原始图片没有写入 Agent 循环历史。',
  };
}


