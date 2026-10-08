import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { analyzeAgentGameSnapshot } from '../../services/agentVisualSnapshotService';
import { formatAgentCaptureQualityLine } from '../agentCaptureQuality';
import { type AgentChatCommandResult, type AgentToolCallCommand } from '../agentChatCommand';
import { type AgentRuntimeExecutorContext } from '../agentRuntimeExecutor';
import { normalizeCaptureSourceTypesInput } from './captureSourceFormatting';
import { normalizeVisualSnapshotSourceTypeInput } from './captureSourceMatching';
import { selectGameScreenSource } from './captureSourceSelection';
import { createGameScreenAnalysisCaptureRejection } from './gameScreenAnalysisCaptureRejection';
import { createGameScreenAnalysisError, createGameScreenAnalysisMissingSource, createGameScreenAnalysisMissingThumbnail } from './gameScreenAnalysisFailures';
import { createGameScreenAnalysisResult } from './gameScreenAnalysisResult';
import { createTrustedVisualSnapshotSource } from './visualSnapshotCaptureRecovery';
import { createVisualSnapshotSourceLabel } from './visualSnapshotSourceGeometry';
import { runCancellableAgentRuntimeTask } from './visualTaskCancellation';
import { getToolBooleanInput, getToolBooleanInputAny, getToolStringInput } from './visualToolInput';

export async function executeAnalyzeGameScreen(
  runtime: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
  sourceText: string,
): Promise<AgentChatCommandResult> {
  const sourceType = normalizeVisualSnapshotSourceTypeInput(
    getToolStringInput(toolCall, ['sourceType', 'captureSourceTypes', 'type']) || 'all',
  );
  const captureSourceTypes = normalizeCaptureSourceTypesInput(sourceType);
  const sourceId = getToolStringInput(toolCall, ['sourceId', 'id']);
  const query = getToolStringInput(toolCall, ['query', 'target', 'sourceName', 'name', 'windowTitle', 'title']);
  const allowScreenFallback = getToolBooleanInputAny(toolCall, [
    'allowScreenFallback',
    'fallbackToScreen',
    'allowSourceFallback',
  ]) !== false;
  const captureRequestSourceTypes = allowScreenFallback && !captureSourceTypes.includes('screen')
    ? Array.from(new Set([...captureSourceTypes, 'screen'])) as Array<'screen' | 'window'>
    : captureSourceTypes;
  const question = getToolStringInput(toolCall, ['question', 'goal', 'prompt'])
    || toolCall.goal
    || sourceText
    || 'Analyze the visible gameplay content in this snapshot.';
  const gameHint = getToolStringInput(toolCall, ['gameHint', 'gameName', 'game']);
  const focus = getToolStringInput(toolCall, ['focus', 'analysisFocus', 'topic']);
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
  const selectedSource = selectGameScreenSource(availableSources, {
    query,
    sourceId,
    sourceType,
  });

  if (!selectedSource) {
    return createGameScreenAnalysisMissingSource({
      availableSources,
      query,
      sourceId,
      sourceType,
    });
  }

  if (!selectedSource.thumbnail) {
    return createGameScreenAnalysisMissingThumbnail({
      selectedSource,
      availableSources,
      query,
      sourceId,
      sourceType,
    });
  }

  try {
    const preparedSource = await createTrustedVisualSnapshotSource({
      allowScreenFallback,
      availableSources,
      selectedSource,
      toolCall,
    });
    const analysisSource = preparedSource.source;
    const sourceLabel = createVisualSnapshotSourceLabel(analysisSource);
    const captureQualityLine = formatAgentCaptureQualityLine(preparedSource.captureQuality, 'Game capture quality');
    if (!preparedSource.captureQuality.trusted) {
      return createGameScreenAnalysisCaptureRejection({
        preparedSource,
        sourceLabel,
        captureQualityLine,
        selectedSource,
        analysisSource,
        question,
      });
    }

    const analysisResult = await runCancellableAgentRuntimeTask(runtime, toolCall, () => analyzeAgentGameSnapshot({
      focus,
      gameHint,
      imageDataUrl: preparedSource.imageDataUrl,
      question,
      settings: runtime.configRef.current.settings,
      sourceLabel,
    }));
    if (analysisResult.cancelled === true) {
      return analysisResult.result;
    }

    const analysis = analysisResult.value;
    return createGameScreenAnalysisResult({
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
    });
  } catch (error) {
    return createGameScreenAnalysisError({
      error,
      selectedSource,
      availableSources,
      query,
      sourceId,
      sourceType,
      question,
    });
  }
}
