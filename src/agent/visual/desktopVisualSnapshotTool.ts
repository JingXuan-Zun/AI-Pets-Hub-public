import { refineVisualSnapshotSummaryWithOcr } from './visualSnapshotOcrRefinement';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { summarizeAgentVisualSnapshot } from '../../services/agentVisualSnapshotService';
import { formatAgentCaptureQualityLine } from '../agentCaptureQuality';
import { type AgentChatCommandResult, type AgentToolCallCommand } from '../agentChatCommand';
import { type AgentRuntimeExecutorContext } from '../agentRuntimeExecutor';
import { normalizeCaptureSourceTypesInput } from './captureSourceFormatting';
import { createVisualSnapshotSourceSelectionDiagnostics, normalizeVisualSnapshotSourceTypeInput, scoreVisualSnapshotSourceMatch } from './captureSourceMatching';
import { selectVisualSnapshotSource } from './captureSourceSelection';
import { createDesktopVisualSnapshotCaptureRejection } from './desktopVisualSnapshotCaptureRejection';
import { createDesktopVisualSnapshotError, createDesktopVisualSnapshotMissingSource, createDesktopVisualSnapshotMissingThumbnail } from './desktopVisualSnapshotFailures';
import { createDesktopVisualSnapshotResult } from './desktopVisualSnapshotResult';
import { createActiveWindowCaptureRecoverySource, createTrustedVisualSnapshotSource } from './visualSnapshotCaptureRecovery';
import { createVisualSnapshotSourceLabel } from './visualSnapshotSourceGeometry';
import { runCancellableAgentRuntimeTask } from './visualTaskCancellation';
import { getToolBooleanInput, getToolBooleanInputAny, getToolRawInputValue, getToolStringInput } from './visualToolInput';

export async function executeSummarizeVisualSnapshot(
  runtime: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
  sourceText: string,
): Promise<AgentChatCommandResult> {
  const sourceType = normalizeVisualSnapshotSourceTypeInput(
    getToolStringInput(toolCall, ['sourceType', 'captureSourceTypes', 'type']) || 'all',
  );
  const captureSourceTypes = normalizeCaptureSourceTypesInput(sourceType);
  // A known window handle beats a text query: callers sometimes pass the in-app target
  // (e.g. 快捷安全登录) as the query, which never matches a window title.
  const hwndInput = Math.round(Number(getToolRawInputValue(toolCall, 'hwnd')));
  const sourceId = getToolStringInput(toolCall, ['sourceId', 'id'])
    || (hwndInput > 0 ? `window:${hwndInput}:` : '');
  const rawSourceId = getToolRawInputValue(toolCall, 'sourceId') ?? getToolRawInputValue(toolCall, 'id');
  const query = getToolStringInput(toolCall, ['query', 'target', 'sourceName', 'name']);
  const explicitScreenFallback = getToolBooleanInputAny(toolCall, [
    'allowScreenFallback',
    'fallbackToScreen',
    'allowSourceFallback',
  ]);
  const allowScreenFallback = explicitScreenFallback === true;
  const allowWindowCaptureFallback = explicitScreenFallback !== false && sourceType !== 'screen';
  const captureRequestSourceTypes = (allowScreenFallback || allowWindowCaptureFallback) && !captureSourceTypes.includes('screen')
    ? Array.from(new Set([...captureSourceTypes, 'screen'])) as Array<'screen' | 'window'>
    : captureSourceTypes;
  const question = getToolStringInput(toolCall, ['question', 'goal', 'prompt'])
    || toolCall.goal
    || sourceText
    || 'Summarize the visible content in this desktop snapshot.';
  const captureResult = await runCancellableAgentRuntimeTask(runtime, toolCall, () => desktopPetShellRuntime.listCaptureSources({
    captureSourceTypes: captureRequestSourceTypes,
    forceRefresh: getToolBooleanInput(toolCall, 'forceRefresh') === true,
    includeCaptureThumbnails: true,
  }) as Promise<DesktopPetCaptureSourceLike[]>);
  if (captureResult.cancelled === true) {
    return captureResult.result;
  }

  const sources = captureResult.value;
  const availableSources = Array.isArray(sources) ? sources : [];
  let selectedSource = selectVisualSnapshotSource(availableSources, {
    allowScreenFallback,
    query,
    sourceId,
    sourceType,
  });
  const sourceSelectionDiagnostics = createVisualSnapshotSourceSelectionDiagnostics(availableSources, {
    allowScreenFallback,
    query,
    rawSourceId,
    selectedSource,
    sourceId,
    sourceType,
  });

  const activeWindowRecoverySource = sourceType !== 'screen'
    && Boolean(query || sourceId)
    && (!selectedSource || selectedSource.type !== 'window')
    ? await createActiveWindowCaptureRecoverySource({
      availableSources,
      query: query || sourceId,
    })
    : null;
  if (activeWindowRecoverySource) {
    selectedSource = activeWindowRecoverySource.source;
  }

  if (!selectedSource) {
    return createDesktopVisualSnapshotMissingSource({
      availableSources,
      query,
      sourceId,
      sourceType,
      sourceSelectionDiagnostics,
    });
  }

  const sourceFallbackLine = allowScreenFallback
    && selectedSource.type === 'screen'
    && (sourceId || query)
    && !scoreVisualSnapshotSourceMatch(selectedSource, sourceId || query)
    ? 'Visual source query did not match a window; fell back to a screen source for recovery verification.'
    : '';

  if (!selectedSource.thumbnail) {
    return createDesktopVisualSnapshotMissingThumbnail({
      selectedSource,
      availableSources,
      query,
      sourceId,
      sourceType,
      sourceFallbackLine,
      sourceSelectionDiagnostics,
    });
  }

  try {
    const focusedSource = await createTrustedVisualSnapshotSource({
      allowScreenFallback: allowWindowCaptureFallback,
      availableSources,
      selectedSource,
      toolCall,
    });
    const analysisSource = focusedSource.source;
    const sourceLabel = createVisualSnapshotSourceLabel(analysisSource);
    const captureQualityLine = formatAgentCaptureQualityLine(focusedSource.captureQuality, 'Visual capture quality');
    if (!focusedSource.captureQuality.trusted) {
      return createDesktopVisualSnapshotCaptureRejection({
        focusedSource,
        sourceLabel,
        sourceFallbackLine,
        sourceSelectionDiagnostics,
        captureQualityLine,
        selectedSource,
        analysisSource,
        question,
      });
    }

    const summaryResult = await runCancellableAgentRuntimeTask(runtime, toolCall, () => summarizeAgentVisualSnapshot({
      imageDataUrl: focusedSource.imageDataUrl,
      question,
      settings: runtime.configRef.current.settings,
      sourceLabel,
    }));
    if (summaryResult.cancelled === true) {
      return summaryResult.result;
    }

    // Snap the model's approximate element point onto the matching text found by local OCR.
    const summary = await refineVisualSnapshotSummaryWithOcr({
      imageDataUrl: focusedSource.imageDataUrl,
      summary: summaryResult.value,
      targetHints: [getToolStringInput(toolCall, ['targetText', 'text', 'label']), getToolStringInput(toolCall, ['targetDescription', 'target'])],
    });
    return createDesktopVisualSnapshotResult({
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
    });
  } catch (error) {
    return createDesktopVisualSnapshotError({
      error,
      selectedSource,
      availableSources,
      query,
      sourceId,
      sourceType,
      sourceFallbackLine,
      question,
    });
  }
}
