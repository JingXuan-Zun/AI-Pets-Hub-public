import { type AgentRuntimeToolResultEntry } from './agentRuntimeContract';
import {
  createAgentActionPrimitiveSignature,
  createAgentToolCallSignature,
  getAgentActionEvidence,
} from './agentPlanningSignalEvidence';

export interface AgentRepeatedToolResultSignatureMetric {
  count: number;
  entry: AgentRuntimeToolResultEntry;
  signature: string;
}

export interface AgentActionOutcomeWindowMetric {
  lastStart: number;
  repeatCount: number;
  signature: string;
  windowSize: number;
}

export function findAgentRepeatedRecentToolResultSignatureMetrics(
  toolResults: AgentRuntimeToolResultEntry[],
  options: {
    minRepeatCount?: number;
    recentWindow?: number;
  } = {},
): AgentRepeatedToolResultSignatureMetric[] {
  const minRepeatCount = options.minRepeatCount ?? 2;
  const recentWindow = options.recentWindow ?? 6;
  const recentResults = toolResults.slice(-recentWindow);
  const counts = new Map<string, AgentRepeatedToolResultSignatureMetric>();

  for (const entry of recentResults) {
    const toolName = entry.command.toolCall?.name;
    if (!toolName) {
      continue;
    }

    const signature = createAgentToolCallSignature(
      toolName,
      entry.command.toolCall?.input ?? {},
    );
    const current = counts.get(signature);
    counts.set(signature, {
      count: (current?.count ?? 0) + 1,
      entry,
      signature,
    });
  }

  return [...counts.values()]
    .filter((item) => item.count >= minRepeatCount)
    .sort((a, b) => b.count - a.count);
}

export function createAgentActionOutcomeWindowItemSignature(item: {
  entry: AgentRuntimeToolResultEntry;
  evidence: NonNullable<ReturnType<typeof getAgentActionEvidence>>;
}) {
  const toolName = item.entry.command.toolCall?.name ?? item.evidence.tool ?? item.entry.command.kind;
  const primitiveSignature = createAgentActionPrimitiveSignature(item.entry.command);
  return [
    `tool=${toolName}`,
    primitiveSignature ? `primitive=${primitiveSignature}` : '',
    item.evidence.action ? `action=${item.evidence.action}` : '',
    `outcome=${item.evidence.outcome}`,
    item.evidence.snapshotProfile ? `snapshotProfile=${item.evidence.snapshotProfile}` : '',
    typeof item.evidence.diff?.changed === 'boolean' ? `changed=${item.evidence.diff.changed}` : '',
  ].filter(Boolean).join('|');
}

export function countAgentNonOverlappingWindowStarts(
  starts: number[],
  windowSize: number,
) {
  let count = 0;
  let nextAllowedStart = -1;

  for (const start of [...starts].sort((a, b) => a - b)) {
    if (start < nextAllowedStart) {
      continue;
    }

    count += 1;
    nextAllowedStart = start + windowSize;
  }

  return count;
}

export function findAgentRepeatedActionOutcomeWindowMetric(
  toolResults: AgentRuntimeToolResultEntry[],
  options: {
    minRepeatCount?: number;
    recentWindow?: number;
    windowSizes?: number[];
  } = {},
): AgentActionOutcomeWindowMetric | null {
  const minRepeatCount = options.minRepeatCount ?? 2;
  const recentWindow = options.recentWindow ?? 12;
  const windowSizes = options.windowSizes ?? [3, 2];
  const recentActionEvidence = toolResults.slice(-recentWindow)
    .map((entry, index) => ({
      entry,
      evidence: getAgentActionEvidence(entry.result),
      index,
    }))
    .filter((item): item is {
      entry: AgentRuntimeToolResultEntry;
      evidence: NonNullable<ReturnType<typeof getAgentActionEvidence>>;
      index: number;
    } => Boolean(item.evidence));
  const repeatedWindows: AgentActionOutcomeWindowMetric[] = [];

  for (const windowSize of windowSizes) {
    if (recentActionEvidence.length < windowSize * minRepeatCount) {
      continue;
    }

    const windows = new Map<string, number[]>();
    for (let start = 0; start <= recentActionEvidence.length - windowSize; start += 1) {
      const windowItems = recentActionEvidence.slice(start, start + windowSize);
      const hasIncompleteOutcome = windowItems.some(({ evidence }) => (
        evidence.outcome === 'no-op'
        || evidence.outcome === 'uncertain'
        || evidence.outcome === 'blocked'
      ));

      if (!hasIncompleteOutcome) {
        continue;
      }

      const signature = windowItems
        .map(createAgentActionOutcomeWindowItemSignature)
        .join(' -> ');
      const starts = windows.get(signature) ?? [];
      starts.push(start);
      windows.set(signature, starts);
    }

    for (const [signature, starts] of windows.entries()) {
      const repeatCount = countAgentNonOverlappingWindowStarts(starts, windowSize);
      if (repeatCount < minRepeatCount) {
        continue;
      }

      repeatedWindows.push({
        lastStart: Math.max(...starts),
        repeatCount,
        signature,
        windowSize,
      });
    }
  }

  return repeatedWindows
    .sort((a, b) => (
      b.repeatCount - a.repeatCount
      || b.windowSize - a.windowSize
      || b.lastStart - a.lastStart
    ))[0] ?? null;
}
