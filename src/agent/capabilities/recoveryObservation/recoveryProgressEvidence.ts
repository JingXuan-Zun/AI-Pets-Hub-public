import { type AgentChatCommand } from '../../agentChatCommand';
import { type AgentRuntimeToolResultEntry as AgentDesktopToolResultEntry } from '../../runtime/agentRuntimeContract';
import { getAgentPostActionState as getAgentDesktopPostActionState } from '../../runtime/agentToolEvidence';

type AgentDesktopAutoRecoveryProgressSnapshot = {
  numericSignals: string[];
  phaseSignals: string[];
};

export function getAgentDesktopAutoRecoveryQuestionState(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const explicitState = typeof input.recoveryPostActionState === 'string'
    ? input.recoveryPostActionState.trim().toLowerCase()
    : '';
  if (explicitState) {
    return explicitState;
  }

  const question = typeof input.question === 'string' ? input.question : '';
  const match = question.match(/Post-action state is\s+([a-z_]+)/iu);
  return match?.[1]?.trim().toLowerCase() ?? '';
}

export function collectAgentDesktopAutoRecoveryEvidenceText(
  entry: AgentDesktopToolResultEntry | null | undefined,
) {
  if (!entry) {
    return '';
  }

  return [
    entry.result.responseText,
    entry.result.verification,
    entry.result.errorText,
    ...(entry.result.observations ?? []),
    ...(entry.result.stateSummary?.observedState ?? []),
    ...(entry.result.stateSummary?.verificationEvidence ?? []),
    ...(entry.result.receipt?.evidenceLines ?? []),
    ...(entry.result.receipt?.summaryLines ?? []),
  ].filter(Boolean).join('\n');
}

function normalizeAgentDesktopAutoRecoveryProgressNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(3)).toString() : '';
}

function normalizeAgentDesktopAutoRecoverySizeToMb(value: string, unit: string) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return '';
  }

  const multiplierByUnit: Record<string, number> = {
    gb: 1024,
    kb: 1 / 1024,
    mb: 1,
    tb: 1024 * 1024,
  };
  const multiplier = multiplierByUnit[unit.toLowerCase()] ?? 1;
  return Number((parsed * multiplier).toFixed(3)).toString();
}

function extractAgentDesktopAutoRecoveryPhaseSignals(text: string) {
  const phasePattern = /\b(?:checking|connecting|downloading|extracting|initializing|installing|launching|loading|patching|preparing|queued|starting|updating|verifying|waiting)\b|[\u6b63\u5728\u5df2]?\u4e0b\u8f7d|\u4e0b\u8f7d\u4e2d|[\u6b63\u5728]?\u5b89\u88c5|\u5b89\u88c5\u4e2d|\u4fee\u8865|\u8865\u4e01|\u6821\u9a8c|\u9a8c\u8bc1\u4e2d|\u89e3\u538b|[\u6b63\u5728]?\u51c6\u5907|\u6392\u961f|\u8fde\u63a5|\u542f\u52a8|\u52a0\u8f7d|\u66f4\u65b0/iu;
  const negatedProgressPattern = /(?:\b(?:no|without|missing|absent|unavailable)\b[^\n.]{0,48}\b(?:progress|percentage|percent|progress\s+number|progress\s+bar)\b|\b(?:progress|percentage|percent|progress\s+number|progress\s+bar)\b[^\n.]{0,48}\b(?:not\s+visible|not\s+shown|missing|absent|unavailable)\b|\b(?:cannot|can't|unable\s+to)\s+see[^\n.]{0,48}\b(?:progress|percentage|percent)\b|\u6ca1\u6709[^\n.]{0,24}(?:\u8fdb\u5ea6|\u767e\u5206\u6bd4)|\u65e0[^\n.]{0,24}(?:\u8fdb\u5ea6|\u767e\u5206\u6bd4)|\u770b\u4e0d\u5230[^\n.]{0,24}(?:\u8fdb\u5ea6|\u767e\u5206\u6bd4)|\u672a\u663e\u793a[^\n.]{0,24}(?:\u8fdb\u5ea6|\u767e\u5206\u6bd4))/iu;
  return text
    .split(/[\n\r.!?;\u3002\uff01\uff1f\uff1b]+/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => phasePattern.test(line))
    .filter((line) => !negatedProgressPattern.test(line))
    .filter((line) => !/(?:post-action visual state|structuredevidence|summarylines|call:|state:\s*(?:loading|updating|unknown|launched))/iu.test(line))
    .map((line) => line
      .replace(/\b\d{1,3}(?:\.\d+)?\s*%/giu, ' percent ')
      .replace(/\b\d+(?:\.\d+)?\s*(?:kb|mb|gb|tb)\s*\/\s*\d+(?:\.\d+)?\s*(?:kb|mb|gb|tb)\b/giu, ' size-ratio ')
      .replace(/\s+/gu, ' ')
      .trim())
    .filter(Boolean);
}

export function createAgentDesktopAutoRecoveryProgressSnapshot(
  entry: AgentDesktopToolResultEntry | null | undefined,
): AgentDesktopAutoRecoveryProgressSnapshot {
  const text = collectAgentDesktopAutoRecoveryEvidenceText(entry).normalize('NFKC').toLowerCase();
  if (!text) {
    return { numericSignals: [], phaseSignals: [] };
  }

  const numericSignals = [
    ...Array.from(text.matchAll(/\b(\d{1,3}(?:\.\d+)?)\s*%/giu))
      .map((match) => `percent:${normalizeAgentDesktopAutoRecoveryProgressNumber(match[1] ?? '')}`),
    ...Array.from(text.matchAll(/\b(\d+(?:\.\d+)?)\s*(kb|mb|gb|tb)\s*\/\s*(\d+(?:\.\d+)?)\s*(kb|mb|gb|tb)\b/giu))
      .map((match) => {
        const used = normalizeAgentDesktopAutoRecoverySizeToMb(match[1] ?? '', match[2] ?? 'mb');
        const total = normalizeAgentDesktopAutoRecoverySizeToMb(match[3] ?? '', match[4] ?? 'mb');
        return used && total ? `size:${used}/${total}` : '';
      }),
  ].filter(Boolean);

  return {
    numericSignals,
    phaseSignals: extractAgentDesktopAutoRecoveryPhaseSignals(text),
  };
}

function getLatestAgentDesktopAutoRecoveryComparableProgressSnapshot(options: {
  latestEntry?: AgentDesktopToolResultEntry | null;
  postActionState: string;
  toolResults?: AgentDesktopToolResultEntry[];
}) {
  const normalizedState = options.postActionState.trim();
  const entries = options.toolResults ?? [];
  const latestEntryIndex = options.latestEntry ? entries.lastIndexOf(options.latestEntry) : -1;
  const startIndex = latestEntryIndex >= 0 ? latestEntryIndex - 1 : entries.length - 1;
  for (let index = startIndex; index >= 0; index -= 1) {
    const entry = entries[index];
    const entryState = getAgentDesktopPostActionState(entry)
      || getAgentDesktopAutoRecoveryQuestionState(entry.command);
    if (normalizedState && entryState && entryState !== normalizedState) {
      continue;
    }

    const snapshot = createAgentDesktopAutoRecoveryProgressSnapshot(entry);
    if (snapshot.numericSignals.length || snapshot.phaseSignals.length) {
      return snapshot;
    }
  }

  return null;
}

function getLastAgentDesktopAutoRecoverySignal(signals: string[]) {
  return signals.length ? signals[signals.length - 1] : '';
}

function getLastAgentDesktopAutoRecoverySignalByType(signals: string[], type: string) {
  const prefix = `${type}:`;
  for (let index = signals.length - 1; index >= 0; index -= 1) {
    const signal = signals[index];
    if (signal.startsWith(prefix)) {
      return signal;
    }
  }

  return '';
}

function hasAgentDesktopAutoRecoveryProgressEvidence(entry: AgentDesktopToolResultEntry | null | undefined) {
  const text = collectAgentDesktopAutoRecoveryEvidenceText(entry).normalize('NFKC').toLowerCase();
  if (!text) {
    return false;
  }

  const hasStrongProgressSignal = /(?:\b\d{1,3}\s*%|\b\d+(?:\.\d+)?\s*(?:kb|mb|gb|tb)\s*\/\s*\d+(?:\.\d+)?\s*(?:kb|mb|gb|tb)|\b(?:eta|remaining)\b\s*:?\s*\d+|[\u5269\u4f59\u9884\u8ba1][^\n.]{0,12}\d+)/iu.test(text);
  if (hasStrongProgressSignal) {
    return true;
  }

  const hasProgressVerbSignal = /(?:\b(?:progressing|downloading|downloaded|installing|installed|patching|verifying|extracting|preparing|queued)\b|[\u6b63\u5728\u5df2]?\u4e0b\u8f7d|\u4e0b\u8f7d\u4e2d|[\u6b63\u5728]?\u5b89\u88c5|\u5b89\u88c5\u4e2d|\u4fee\u8865|\u8865\u4e01|\u6821\u9a8c|\u9a8c\u8bc1\u4e2d|\u89e3\u538b|[\u6b63\u5728]?\u51c6\u5907|\u6392\u961f)/iu.test(text);
  if (hasProgressVerbSignal) {
    return true;
  }

  const hasNegatedProgressSignal = /(?:\b(?:no|without|missing|absent|unavailable)\b[^\n.]{0,48}\b(?:progress|percentage|percent|progress\s+number|progress\s+bar)\b|\b(?:progress|percentage|percent|progress\s+number|progress\s+bar)\b[^\n.]{0,48}\b(?:not\s+visible|not\s+shown|missing|absent|unavailable)\b|\b(?:cannot|can't|unable\s+to)\s+see[^\n.]{0,48}\b(?:progress|percentage|percent)\b|\u6ca1\u6709[^\n.]{0,24}(?:\u8fdb\u5ea6|\u767e\u5206\u6bd4)|\u65e0[^\n.]{0,24}(?:\u8fdb\u5ea6|\u767e\u5206\u6bd4)|\u770b\u4e0d\u5230[^\n.]{0,24}(?:\u8fdb\u5ea6|\u767e\u5206\u6bd4)|\u672a\u663e\u793a[^\n.]{0,24}(?:\u8fdb\u5ea6|\u767e\u5206\u6bd4))/iu.test(text);
  if (hasNegatedProgressSignal) {
    return false;
  }

  return /(?:\b(?:progress|percentage|percent|progress\s+bar)\b|\u8fdb\u5ea6|\u767e\u5206\u6bd4)/iu.test(text);
}

export function hasAgentDesktopAutoRecoveryAdvancingProgressEvidence(options: {
  latestEntry?: AgentDesktopToolResultEntry | null;
  postActionState: string;
  toolResults?: AgentDesktopToolResultEntry[];
}) {
  const latestSnapshot = createAgentDesktopAutoRecoveryProgressSnapshot(options.latestEntry);
  const latestNumericSignal = getLastAgentDesktopAutoRecoverySignal(latestSnapshot.numericSignals);
  const latestPhaseSignal = getLastAgentDesktopAutoRecoverySignal(latestSnapshot.phaseSignals);
  if (!latestNumericSignal && !latestPhaseSignal) {
    return hasAgentDesktopAutoRecoveryProgressEvidence(options.latestEntry);
  }

  const previousSnapshot = getLatestAgentDesktopAutoRecoveryComparableProgressSnapshot(options);
  if (!previousSnapshot) {
    return Boolean(latestNumericSignal);
  }

  const latestPercentSignal = getLastAgentDesktopAutoRecoverySignalByType(latestSnapshot.numericSignals, 'percent');
  const previousPercentSignal = getLastAgentDesktopAutoRecoverySignalByType(previousSnapshot.numericSignals, 'percent');
  if (latestPercentSignal && previousPercentSignal) {
    return latestPercentSignal !== previousPercentSignal;
  }

  const latestSizeSignal = getLastAgentDesktopAutoRecoverySignalByType(latestSnapshot.numericSignals, 'size');
  const previousSizeSignal = getLastAgentDesktopAutoRecoverySignalByType(previousSnapshot.numericSignals, 'size');
  if (latestSizeSignal && previousSizeSignal) {
    return latestSizeSignal !== previousSizeSignal;
  }

  if (latestNumericSignal) {
    const previousNumericSignal = getLastAgentDesktopAutoRecoverySignal(previousSnapshot.numericSignals);
    return Boolean(previousNumericSignal && latestNumericSignal !== previousNumericSignal);
  }

  const previousPhaseSignal = getLastAgentDesktopAutoRecoverySignal(previousSnapshot.phaseSignals);
  return Boolean(
    latestPhaseSignal
    && previousPhaseSignal
    && !previousSnapshot.numericSignals.length
    && latestPhaseSignal !== previousPhaseSignal,
  );
}
