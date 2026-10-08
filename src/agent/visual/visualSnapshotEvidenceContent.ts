import { getVisualSnapshotConfidenceValue } from './visualSnapshotCoordinateValues';
import { formatVisualSnapshotConfidence } from './visualSnapshotEvidenceFormatting';
import { getVisualSnapshotOcrTextCandidates } from './visualSnapshotOcr';
import { getVisualSnapshotStringField, getVisualSnapshotStringListField } from './visualSnapshotParsing';

export function readVisualSnapshotEvidenceContent({
  parsed,
  fallbackSummary,
}: {
  parsed: Record<string, unknown>;
  fallbackSummary: string;
}) {
  const summaryText = getVisualSnapshotStringField(parsed, ['summary', 'description', 'mainContent'])
    || fallbackSummary;
  const confidenceText = formatVisualSnapshotConfidence(parsed.confidence);
  const confidenceValue = getVisualSnapshotConfidenceValue(parsed.confidence);
  const companionCue = getVisualSnapshotStringField(parsed, ['companionCue', 'companionObservation']);
  const uncertainty = getVisualSnapshotStringListField(parsed, ['uncertainty', 'uncertainties', 'unknowns']);
  const readableText = getVisualSnapshotStringListField(parsed, ['readableText', 'visibleText', 'text', 'ocrText', 'ocr']);
  const visibleTextCandidates = getVisualSnapshotStringListField(parsed, [
    'visibleTextCandidates',
    'textCandidates',
    'readableTextCandidates',
    'ocrTextCandidates',
    'ocrCandidates',
    'visibleTexts',
  ]);
  const ocrCandidates = getVisualSnapshotOcrTextCandidates(parsed);
  const explicitTargetMatched = getVisualSnapshotStringField(parsed, ['targetMatched', 'matchedTarget', 'targetItem', 'target']);
  const explicitPrimaryAction = getVisualSnapshotStringField(parsed, ['primaryAction', 'actionButton', 'primaryButton', 'button']);
  const currentSelection = getVisualSnapshotStringField(parsed, [
    'currentSelection',
    'selectedTarget',
    'selectedItem',
    'currentTarget',
    'currentDetailTitle',
    'detailTitle',
    'activeTarget',
  ]);
  return {
    summaryText,
    confidenceText,
    confidenceValue,
    companionCue,
    uncertainty,
    readableText,
    visibleTextCandidates,
    ocrCandidates,
    explicitTargetMatched,
    explicitPrimaryAction,
    currentSelection,
  };
}
