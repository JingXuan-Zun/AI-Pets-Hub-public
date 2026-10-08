import { type AgentChatCommandResult } from '../agentChatCommand';
import { formatCaptureSourceCandidateLines } from './captureSourceFormatting';
import { createVisualSnapshotRecoveryStateSummary } from './visualSnapshotRecoverySummary';
import { createVisualSnapshotSourceLabel } from './visualSnapshotSourceGeometry';

export function createDesktopVisualSnapshotMissingSource({
  availableSources,
  query,
  sourceId,
  sourceType,
  sourceSelectionDiagnostics,
}: {
  availableSources: DesktopPetCaptureSourceLike[];
  query: string;
  sourceId: string;
  sourceType: 'all' | 'screen' | 'window';
  sourceSelectionDiagnostics: string[];
}): AgentChatCommandResult {
  const candidateLines = formatCaptureSourceCandidateLines(availableSources);
  const stateSummary = createVisualSnapshotRecoveryStateSummary({
    availableSourceCount: availableSources.length,
    candidateLines,
    mode: 'desktop',
    query,
    sourceId,
    sourceType,
  });
  return {
    errorText: 'No matching screen/window capture source was found.',
    followUp: '没有找到匹配的屏幕或窗口来源。请确认目标窗口没有最小化，或先让我列出可捕获的屏幕/窗口来源再指定。',
    observations: [
      `Requested source type: ${sourceType}`,
      sourceId ? `Requested source id: ${sourceId}` : '',
      query ? `Requested source query: ${query}` : '',
      ...sourceSelectionDiagnostics,
      `Available capture sources: ${availableSources.length}`,
      ...candidateLines,
    ].filter(Boolean),
    ok: false,
    responseText: '没有找到匹配的屏幕或窗口快照来源。',
    stateSummary,
    verification: 'No capture source matched the requested visual snapshot target.',
  };
}

export function createDesktopVisualSnapshotMissingThumbnail({
  selectedSource,
  availableSources,
  query,
  sourceId,
  sourceType,
  sourceFallbackLine,
  sourceSelectionDiagnostics,
}: {
  selectedSource: DesktopPetCaptureSourceLike;
  availableSources: DesktopPetCaptureSourceLike[];
  query: string;
  sourceId: string;
  sourceType: 'all' | 'screen' | 'window';
  sourceFallbackLine: string;
  sourceSelectionDiagnostics: string[];
}): AgentChatCommandResult {
  const sourceLabel = createVisualSnapshotSourceLabel(selectedSource);
  const candidateLines = formatCaptureSourceCandidateLines(availableSources);
  const stateSummary = createVisualSnapshotRecoveryStateSummary({
    availableSourceCount: availableSources.length,
    candidateLines,
    mode: 'desktop',
    query,
    sourceId,
    sourceLabel,
    sourceType,
    thumbnailUnavailable: true,
  });
  return {
    errorText: 'The selected capture source did not return a thumbnail.',
    followUp: '目标来源存在，但没有返回缩略图。请确认窗口可见、没有被最小化，或改为观察整个屏幕。',
    observations: [
      `Selected visual source: ${sourceLabel}`,
      sourceFallbackLine,
      ...sourceSelectionDiagnostics,
      `Available capture sources: ${availableSources.length}`,
      ...candidateLines,
    ].filter(Boolean),
    ok: false,
    responseText: '找到了屏幕/窗口来源，但没有拿到可用于视觉摘要的缩略图。',
    stateSummary,
    verification: 'Capture source exists, but thumbnail data was unavailable.',
  };
}

export function createDesktopVisualSnapshotError({
  error,
  selectedSource,
  availableSources,
  query,
  sourceId,
  sourceType,
  sourceFallbackLine,
  question,
}: {
  error: unknown;
  selectedSource: DesktopPetCaptureSourceLike;
  availableSources: DesktopPetCaptureSourceLike[];
  query: string;
  sourceId: string;
  sourceType: 'all' | 'screen' | 'window';
  sourceFallbackLine: string;
  question: string;
}): AgentChatCommandResult {
  const errorText = error instanceof Error ? error.message : String(error);
  const sourceLabel = createVisualSnapshotSourceLabel(selectedSource);
  const stateSummary = createVisualSnapshotRecoveryStateSummary({
    availableSourceCount: availableSources.length,
    errorText,
    mode: 'desktop',
    query,
    sourceId,
    sourceLabel,
    sourceType,
  });
  return {
    errorText,
    followUp: '视觉模型已经收到截图但摘要失败。请检查视觉模型是否支持图片输入、API 地址/Key/模型名是否正确，或稍后重试。',
    observations: [
      `Selected visual source: ${sourceLabel}`,
      sourceFallbackLine,
      `Visual question: ${question}`,
      `Vision summary error: ${errorText}`,
    ].filter(Boolean),
    ok: false,
    responseText: `视觉快照已经捕获，但模型摘要失败：${errorText}`,
    stateSummary,
    verification: errorText,
  };
}


