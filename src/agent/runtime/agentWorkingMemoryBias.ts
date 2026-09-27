import { type AgentWorkingMemoryEntry, type AgentWorkingMemorySnapshot } from '../agentChatContext';

type AgentWorkingMemoryBiasRecency =
  | 'very-recent'
  | 'recent'
  | 'current-day'
  | 'aging'
  | 'stale'
  | 'future'
  | 'unknown';

type AgentWorkingMemoryBiasKind = 'episodic' | 'procedural' | 'semantic' | 'unknown';
type AgentWorkingMemoryBiasSource = 'structured-snapshot' | 'working-memory-text';
export type AgentWorkingMemoryInput = AgentWorkingMemorySnapshot | string | null | undefined;

interface AgentWorkingMemoryBiasItem {
  actionCount: number;
  confidence: 'high' | 'medium' | 'low';
  createdAt: number | null;
  line: string;
  memoryKind: AgentWorkingMemoryBiasKind;
  recency: AgentWorkingMemoryBiasRecency;
  source: AgentWorkingMemoryBiasSource;
  status: string;
  tool: string;
  weight: number;
}

const AGENT_WORKING_MEMORY_BIAS_MAX_ITEMS = 4;

const AGENT_WORKING_MEMORY_KIND_POLICY_LINES = [
  'memoryKindPolicy=episodic use=resolve references, compare prior task state, and cite past run evidence; forbidden=do not treat it as proof of the current screen, window, file, app, or UI state.',
  'memoryKindPolicy=procedural use=adapt a prior action pattern or follow-up affordance as a candidate; forbidden=do not replay old args, coordinates, paths, or approvals without fresh evidence.',
  'memoryKindPolicy=semantic use=consider remembered preferences, aliases, and durable user facts as candidates; forbidden=do not override the current user request, permission policy, actionEvidence, or fresh local observation.',
  'memoryKindPolicy=unknown use=low-confidence context only; forbidden=do not rely on it for state-changing actions or final verification.',
  'memoryKindConflictPolicy=Current user intent, fresh tool evidence, actionEvidence, permission policy, and visible UI state take priority over every memoryKind.',
  'memoryKindNoFixedChainPolicy=No memoryKind mandates a fixed tool sequence. Use it only to bias planning, choose what to verify, or decide whether a memory recall/observation is useful.',
] as const;

function compactAgentWorkingMemoryBiasText(value: string, maxLength = 420) {
  const compactText = value.replace(/\s+/gu, ' ').trim();
  if (compactText.length <= maxLength) {
    return compactText;
  }

  return `${compactText.slice(0, Math.max(0, maxLength - 3))}...`;
}

function clampAgentWorkingMemoryBiasWeight(value: number) {
  return Math.min(0.95, Math.max(0.2, value));
}

function parseAgentWorkingMemoryBiasField(line: string, key: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return line.match(new RegExp(`(?:^|[;\\s])${escapedKey}=([^;]+)`, 'u'))?.[1]?.trim() ?? '';
}

function parseAgentWorkingMemoryCreatedAt(line: string) {
  const rawCreatedAt = parseAgentWorkingMemoryBiasField(line, 'createdAt');
  const createdAt = Number(rawCreatedAt);
  return Number.isFinite(createdAt) && createdAt > 0 ? createdAt : null;
}

function parseAgentWorkingMemoryActionCount(line: string) {
  const actionText = parseAgentWorkingMemoryBiasField(line, 'actions')
    || parseAgentWorkingMemoryBiasField(line, 'availableActions');
  return actionText ? actionText.split('|').map((item) => item.trim()).filter(Boolean).length : 0;
}

function resolveAgentWorkingMemoryBiasKind(options: {
  actionCount: number;
  line: string;
  tool: string;
}): AgentWorkingMemoryBiasKind {
  if (options.tool === 'execute_memory_action') {
    return 'semantic';
  }

  if (options.actionCount > 0) {
    return 'procedural';
  }

  if (/^\d+\.\s*tool=/u.test(options.line.trim())) {
    return 'episodic';
  }

  return 'unknown';
}

function isAgentWorkingMemorySnapshot(value: AgentWorkingMemoryInput): value is AgentWorkingMemorySnapshot {
  return Boolean(
    value
    && typeof value === 'object'
    && Array.isArray((value as AgentWorkingMemorySnapshot).entries)
    && typeof (value as AgentWorkingMemorySnapshot).summaryText === 'string'
  );
}

function formatAgentStructuredMemoryEntry(entry: AgentWorkingMemoryEntry) {
  const actionText = entry.actionLabels.length
    ? `actions=${entry.actionLabels.join(' | ')}`
    : '';
  return [
    `tool=${entry.toolName}`,
    `status=${entry.status || 'unknown'}`,
    `createdAt=${entry.createdAt}`,
    `summary=${compactAgentWorkingMemoryBiasText(entry.summary, 520)}`,
    entry.resultText ? `result=${compactAgentWorkingMemoryBiasText(entry.resultText, 240)}` : '',
    actionText,
  ].filter(Boolean).join(' ; ');
}

function resolveAgentWorkingMemoryBiasRecency(createdAt: number | null, now: number) {
  if (!createdAt) {
    return {
      factor: 0.7,
      recency: 'unknown' as const,
    };
  }

  const ageMs = now - createdAt;
  if (ageMs < 0) {
    return {
      factor: 0.5,
      recency: 'future' as const,
    };
  }

  if (ageMs <= 10 * 60 * 1000) {
    return {
      factor: 1,
      recency: 'very-recent' as const,
    };
  }

  if (ageMs <= 60 * 60 * 1000) {
    return {
      factor: 0.92,
      recency: 'recent' as const,
    };
  }

  if (ageMs <= 24 * 60 * 60 * 1000) {
    return {
      factor: 0.78,
      recency: 'current-day' as const,
    };
  }

  if (ageMs <= 7 * 24 * 60 * 60 * 1000) {
    return {
      factor: 0.58,
      recency: 'aging' as const,
    };
  }

  return {
    factor: 0.38,
    recency: 'stale' as const,
  };
}

function resolveAgentWorkingMemoryBiasStatusWeight(status: string) {
  const normalizedStatus = status.toLowerCase();
  if (normalizedStatus === 'completed' || normalizedStatus === 'success') {
    return 0.82;
  }

  if (normalizedStatus === 'awaiting approval' || normalizedStatus === 'pending') {
    return 0.58;
  }

  if (normalizedStatus === 'failed' || normalizedStatus === 'blocked' || normalizedStatus === 'denied') {
    return 0.48;
  }

  return 0.64;
}

function resolveAgentWorkingMemoryBiasConfidence(weight: number): AgentWorkingMemoryBiasItem['confidence'] {
  if (weight >= 0.75) {
    return 'high';
  }

  if (weight >= 0.5) {
    return 'medium';
  }

  return 'low';
}

function resolveAgentWorkingMemoryBiasAllowedUse(memoryKind: AgentWorkingMemoryBiasKind) {
  switch (memoryKind) {
    case 'episodic':
      return 'reference-or-prior-evidence-only';
    case 'procedural':
      return 'candidate-action-pattern-only';
    case 'semantic':
      return 'preference-or-durable-fact-candidate-only';
    case 'unknown':
    default:
      return 'low-confidence-context-only';
  }
}

function createAgentWorkingMemoryBiasItemFromLine(
  line: string,
  now: number,
  source: AgentWorkingMemoryBiasSource,
): AgentWorkingMemoryBiasItem {
  const createdAt = parseAgentWorkingMemoryCreatedAt(line);
  const status = parseAgentWorkingMemoryBiasField(line, 'status') || 'unknown';
  const tool = parseAgentWorkingMemoryBiasField(line, 'tool') || 'unknown';
  const actionCount = parseAgentWorkingMemoryActionCount(line);
  const { factor, recency } = resolveAgentWorkingMemoryBiasRecency(createdAt, now);
  const weight = clampAgentWorkingMemoryBiasWeight(
    resolveAgentWorkingMemoryBiasStatusWeight(status) * factor,
  );

  return {
    actionCount,
    confidence: resolveAgentWorkingMemoryBiasConfidence(weight),
    createdAt,
    line,
    memoryKind: resolveAgentWorkingMemoryBiasKind({
      actionCount,
      line,
      tool,
    }),
    recency,
    source,
    status,
    tool,
    weight,
  };
}

function createAgentWorkingMemoryBiasItemFromEntry(
  entry: AgentWorkingMemoryEntry,
  now: number,
): AgentWorkingMemoryBiasItem {
  return createAgentWorkingMemoryBiasItemFromLine(
    formatAgentStructuredMemoryEntry(entry),
    now,
    'structured-snapshot',
  );
}

function formatAgentWorkingMemoryBiasItem(item: AgentWorkingMemoryBiasItem, index: number) {
  return [
    `memoryBiasItem${index + 1}=weight=${item.weight.toFixed(2)}`,
    `confidence=${item.confidence}`,
    `recency=${item.recency}`,
    `source=${item.source}`,
    `memoryKind=${item.memoryKind}`,
    `allowedUse=${resolveAgentWorkingMemoryBiasAllowedUse(item.memoryKind)}`,
    `tool=${item.tool}`,
    `status=${item.status}`,
    item.createdAt ? `createdAt=${item.createdAt}` : '',
    item.actionCount ? `actionCount=${item.actionCount}` : '',
    `text=${compactAgentWorkingMemoryBiasText(item.line)}`,
  ].filter(Boolean).join(' ');
}

export function createAgentGuardedWorkingMemoryText(
  workingMemory: AgentWorkingMemoryInput,
  options: {
    maxItems?: number;
    now?: number;
  } = {},
) {
  const rawText = typeof workingMemory === 'string' ? workingMemory.trim() : '';
  if (!rawText || rawText === 'none') {
    if (!isAgentWorkingMemorySnapshot(workingMemory)) {
      return '';
    }
  }

  if (/^memoryBiasPolicy=/u.test(rawText)) {
    return rawText;
  }

  const maxItems = Math.max(1, Math.trunc(options.maxItems ?? AGENT_WORKING_MEMORY_BIAS_MAX_ITEMS));
  const now = options.now ?? Date.now();
  const items = isAgentWorkingMemorySnapshot(workingMemory) && workingMemory.entries.length
    ? workingMemory.entries.map((entry) => createAgentWorkingMemoryBiasItemFromEntry(entry, now))
    : rawText
        .split(/\n+/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => createAgentWorkingMemoryBiasItemFromLine(line, now, 'working-memory-text'));
  if (!items.length) {
    return '';
  }

  const visibleItems = items
    .map((item, ordinal) => ({ item, ordinal }))
    .sort((a, b) => b.item.weight - a.item.weight || b.ordinal - a.ordinal)
    .slice(0, maxItems)
    .sort((a, b) => a.ordinal - b.ordinal)
    .map(({ item }) => item);

  return [
    'memoryBiasPolicy=Working memory is advisory planning bias, not proof of the current environment.',
    'memoryBiasConflictRule=If working memory conflicts with the current user request, fresh tool evidence, actionEvidence, permission policy, or visible UI state, prefer the current evidence.',
    'memoryBiasKindRule=memoryKind is a routing hint only: episodic=past run evidence, procedural=available prior action pattern, semantic=remembered preference/fact, unknown=unclassified.',
    ...AGENT_WORKING_MEMORY_KIND_POLICY_LINES,
    'memoryBiasRecencyGuard=Use weight/confidence/recency to decide bias strength. recency=unknown means do not assume freshness.',
    `memoryBiasThresholdGuard=maxItems=${maxItems}; totalItems=${items.length}; shownItems=${visibleItems.length}; scoring=status_recency; source=${isAgentWorkingMemorySnapshot(workingMemory) ? 'structured-snapshot' : 'working-memory-text'}; advisoryOnly=true`,
    items.length > visibleItems.length ? `memoryBiasSuppressedItems=${items.length - visibleItems.length}` : '',
    ...visibleItems.map(formatAgentWorkingMemoryBiasItem),
  ].filter(Boolean).join('\n');
}
