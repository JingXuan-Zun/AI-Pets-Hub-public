import { type AgentChatCommandResult } from '../agentChatCommand';
import { formatCaptureSourceCandidateLines } from './captureSourceFormatting';
import { createVisualSnapshotRecoveryStateSummary } from './visualSnapshotRecoverySummary';
import { createVisualSnapshotSourceLabel } from './visualSnapshotSourceGeometry';

export function createGameScreenAnalysisMissingSource({
  availableSources,
  query,
  sourceId,
  sourceType,
}: {
  availableSources: DesktopPetCaptureSourceLike[];
  query: string;
  sourceId: string;
  sourceType: 'all' | 'screen' | 'window';
}): AgentChatCommandResult {
  const candidateLines = formatCaptureSourceCandidateLines(availableSources);
  const stateSummary = createVisualSnapshotRecoveryStateSummary({
    availableSourceCount: availableSources.length,
    candidateLines,
    mode: 'game',
    query,
    sourceId,
    sourceType,
  });
  return {
    errorText: 'No matching game screen/window capture source was found.',
    followUp: '没有找到匹配的游戏屏幕或窗口来源。请确认游戏窗口没有最小化，或先让我列出可捕获来源再选择。',
    observations: [
      `Requested game source type: ${sourceType}`,
      sourceId ? `Requested source id: ${sourceId}` : '',
      query ? `Requested source query: ${query}` : '',
      `Available capture sources: ${availableSources.length}`,
      ...candidateLines,
    ].filter(Boolean),
    ok: false,
    responseText: 'No matching game screen/window capture source was found.',
    stateSummary,
    verification: 'No capture source matched the requested game screen target.',
  };
}

export function createGameScreenAnalysisMissingThumbnail({
  selectedSource,
  availableSources,
  query,
  sourceId,
  sourceType,
}: {
  selectedSource: DesktopPetCaptureSourceLike;
  availableSources: DesktopPetCaptureSourceLike[];
  query: string;
  sourceId: string;
  sourceType: 'all' | 'screen' | 'window';
}): AgentChatCommandResult {
  const sourceLabel = createVisualSnapshotSourceLabel(selectedSource);
  const candidateLines = formatCaptureSourceCandidateLines(availableSources);
  const stateSummary = createVisualSnapshotRecoveryStateSummary({
    availableSourceCount: availableSources.length,
    candidateLines,
    mode: 'game',
    query,
    sourceId,
    sourceLabel,
    sourceType,
    thumbnailUnavailable: true,
  });
  return {
    errorText: 'The selected game capture source did not return a thumbnail.',
    followUp: '游戏来源存在，但没有返回缩略图。请确认游戏窗口可见、没有被最小化，或改为观察整个屏幕。',
    observations: [
      `Selected game source: ${sourceLabel}`,
      `Available capture sources: ${availableSources.length}`,
      ...candidateLines,
    ],
    ok: false,
    responseText: 'The game source was found, but no thumbnail was available for visual analysis.',
    stateSummary,
    verification: 'Capture source exists, but thumbnail data was unavailable.',
  };
}

export function createGameScreenAnalysisError({
  error,
  selectedSource,
  availableSources,
  query,
  sourceId,
  sourceType,
  question,
}: {
  error: unknown;
  selectedSource: DesktopPetCaptureSourceLike;
  availableSources: DesktopPetCaptureSourceLike[];
  query: string;
  sourceId: string;
  sourceType: 'all' | 'screen' | 'window';
  question: string;
}): AgentChatCommandResult {
  const errorText = error instanceof Error ? error.message : String(error);
  const sourceLabel = createVisualSnapshotSourceLabel(selectedSource);
  const stateSummary = createVisualSnapshotRecoveryStateSummary({
    availableSourceCount: availableSources.length,
    errorText,
    mode: 'game',
    query,
    sourceId,
    sourceLabel,
    sourceType,
  });
  return {
    errorText,
    followUp: '游戏截图已经捕获，但视觉模型分析失败。请检查视觉模型是否支持图片输入、API 地址/Key/模型名是否正确，或稍后重试。',
    observations: [
      `Selected game source: ${sourceLabel}`,
      `Game analysis question: ${question}`,
      `Game analysis error: ${errorText}`,
    ],
    ok: false,
    responseText: `The game snapshot was captured, but model analysis failed: ${errorText}`,
    stateSummary,
    verification: errorText,
  };
}


