

export function createVisualSnapshotRecoveryStateSummary(options: {
  availableSourceCount?: number;
  candidateLines?: string[];
  errorText?: string | null;
  mode: 'desktop' | 'game';
  query?: string | null;
  sourceId?: string | null;
  sourceLabel?: string | null;
  sourceType?: string | null;
  thumbnailUnavailable?: boolean;
}) {
  const visualLabel = options.mode === 'game' ? 'Game' : 'Visual';
  const requestedTarget = [
    options.sourceType ? `type=${options.sourceType}` : '',
    options.sourceId ? `sourceId=${options.sourceId}` : '',
    options.query ? `query=${options.query}` : '',
  ].filter(Boolean).join(', ');
  const observedState = [
    requestedTarget ? `${visualLabel} requested source: ${requestedTarget}` : '',
    options.sourceLabel ? `${visualLabel} selected source: ${options.sourceLabel}` : '',
    typeof options.availableSourceCount === 'number'
      ? `${visualLabel} available capture sources: ${options.availableSourceCount}`
      : '',
    ...(options.candidateLines ?? []).slice(0, 8),
  ].filter(Boolean);
  const missingEvidence = [
    options.thumbnailUnavailable
      ? `${visualLabel} thumbnail unavailable for selected source.`
      : options.sourceLabel
        ? ''
        : `${visualLabel} capture source was not identified confidently.`,
    options.errorText ? `${visualLabel} analysis error: ${options.errorText}` : '',
  ].filter(Boolean);
  const recommendedRecovery = [
    options.errorText
      ? 'Do not repeat the same visual model call with identical args. Ask the user to check vision settings/model support, or try a different visible source if that fits the request.'
      : '',
    options.thumbnailUnavailable
      ? 'If the target window is minimized/hidden, ask the user to show it; otherwise retry with sourceType "screen" or another concrete sourceId.'
      : '',
    !options.sourceLabel
      ? 'Use list_capture_sources or get_active_window_info to identify the exact capture source before retrying visual analysis.'
      : '',
    !options.sourceLabel
      ? 'If candidate sources are ambiguous, ask one short question asking which screen/window to inspect.'
      : '',
  ].filter(Boolean);

  return {
    missingEvidence,
    observedState,
    recommendedRecovery,
    verificationEvidence: [
      options.errorText
        ? `${visualLabel} analysis did not produce a reliable visual summary.`
        : '',
    ].filter(Boolean),
  };
}
