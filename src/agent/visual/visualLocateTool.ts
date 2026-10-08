import { type AgentChatCommandResult, type AgentToolCallCommand } from '../agentChatCommand';
import { type AgentRuntimeExecutorContext } from '../agentRuntimeExecutor';
import { normalizeAgentRuntimeVisualLookupText } from './captureSourceFormatting';
import { normalizeVisualSnapshotSourceTypeInput } from './captureSourceMatching';
import { executeSummarizeVisualSnapshot } from './desktopVisualSnapshotTool';
import { enrichLocateScreenElementsMissingPrimaryAction } from './visualLocateRecovery';
import { getToolBooleanInputAny, getToolStringInput } from './visualToolInput';

export async function executeLocateScreenElements(
  runtime: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
  sourceText: string,
): Promise<AgentChatCommandResult> {
  const action = getToolStringInput(toolCall, ['action', 'visionAction', 'operation']) || 'describe_elements';
  const sourceQuery = getToolStringInput(toolCall, ['sourceQuery', 'windowQuery', 'windowTitle', 'sourceName']);
  const targetText = getToolStringInput(toolCall, ['targetText', 'text', 'label']);
  const targetDescription = getToolStringInput(toolCall, ['targetDescription', 'target', 'targetElement', 'element', 'description']);
  const rawQuery = getToolStringInput(toolCall, ['query']);
  const sourceType = normalizeVisualSnapshotSourceTypeInput(
    getToolStringInput(toolCall, ['sourceType', 'captureSourceTypes', 'type']) || 'all',
  );
  const sourceId = getToolStringInput(toolCall, ['sourceId', 'id']);
  const recoveryReadPurpose = getToolStringInput(toolCall, ['recoveryReadPurpose', 'recoveryPurpose']);
  const explicitScreenFallback = getToolBooleanInputAny(toolCall, [
    'allowScreenFallback',
    'fallbackToScreen',
    'allowSourceFallback',
  ]);
  const targetLabel = targetText || targetDescription || (!sourceQuery ? rawQuery : '');
  const queryLooksLikeTarget = Boolean(
    rawQuery
    && targetLabel
    && normalizeAgentRuntimeVisualLookupText(rawQuery) === normalizeAgentRuntimeVisualLookupText(targetLabel),
  );
  const delegatedSourceQuery = sourceQuery || (!queryLooksLikeTarget ? rawQuery : '');
  const hasExplicitSource = Boolean(sourceId || delegatedSourceQuery);
  const allowScreenFallback = explicitScreenFallback === true
    || (
      !hasExplicitSource
      && Boolean(recoveryReadPurpose)
    )
    || (
      !hasExplicitSource
      && (sourceType === 'all' || sourceType === 'window')
      && explicitScreenFallback !== false
    );
  const question = getToolStringInput(toolCall, ['question', 'goal', 'prompt'])
    || [
      `Task: ${action}.`,
      delegatedSourceQuery ? `Outer app/window source to inspect: ${delegatedSourceQuery}.` : '',
      targetLabel ? `Target text or element inside the source: ${targetLabel}.` : '',
      'Read visible text with an OCR-style pass and describe approximate locations of relevant UI/screen elements.',
      'If this is an in-app or launcher task, identify the target item and the primary open/start/play/launch button associated with that target, then state the visual relation between them.',
      'Core action evidence fields: targetMatched, primaryAction, elementRegion, relation, confidence.',
      'Return concise evidence with readableText, visibleTextCandidates, targetMatched, targetCandidates, primaryAction, actionCandidates, elementRegion, elementCenterRatio, relation, confidence, and uncertainty when possible.',
      'For candidate objects, include label/text, confidence, region, centerRatio or bounds when visible. If coordinates are uncertain, say approximate instead of guessing precisely.',
    ].filter(Boolean).join(' ');
  const delegatedInput: Record<string, unknown> = {
    ...toolCall.input,
    question,
    query: delegatedSourceQuery,
    sourceType,
  };
  if (explicitScreenFallback !== undefined || recoveryReadPurpose || sourceType === 'all' || sourceType === 'window') {
    delegatedInput.allowScreenFallback = allowScreenFallback;
  }

  const delegatedToolCall: AgentToolCallCommand = {
    ...toolCall,
    input: delegatedInput,
    name: 'summarize_visual_snapshot',
  };
  const result = await executeSummarizeVisualSnapshot(runtime, delegatedToolCall, sourceText);
  const enrichedResult = enrichLocateScreenElementsMissingPrimaryAction({
    action,
    question,
    result,
    sourceQuery: delegatedSourceQuery,
    targetLabel,
  });
  const observations = [
    `Screen element locate action: ${action}`,
    delegatedSourceQuery ? `Source query: ${delegatedSourceQuery}` : '',
    targetLabel ? `Target element: ${targetLabel}` : '',
    ...(enrichedResult.observations ?? []),
  ].filter(Boolean);

  return {
    ...enrichedResult,
    observations,
    receipt: enrichedResult.receipt
      ? {
        ...enrichedResult.receipt,
        evidenceLines: observations,
        summaryLines: [
          'Call: locate_screen_elements',
          `Action: ${action}`,
          ...(enrichedResult.receipt.summaryLines ?? []).slice(1),
        ],
        toolName: 'locate_screen_elements',
      }
      : enrichedResult.receipt,
    responseText: enrichedResult.ok === false
      ? enrichedResult.responseText
      : [
        `Screen element observation (${action}):`,
        enrichedResult.responseText,
        'Note: v1 visual locations are approximate and should be confirmed before desktop input.',
      ].join('\n'),
    verification: enrichedResult.verification
      ? `${enrichedResult.verification} locate_screen_elements used the configured vision snapshot path.`
      : 'locate_screen_elements used the configured vision snapshot path.',
  };
}
