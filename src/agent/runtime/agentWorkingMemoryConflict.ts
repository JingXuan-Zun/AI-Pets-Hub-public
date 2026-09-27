import { type AgentChatCommandResult } from '../agentChatCommand';
import { type AgentWorkingMemorySnapshot } from '../agentChatContext';
import { type AgentRuntimeToolResultEntry } from './agentRuntimeContract';
import { type AgentWorkingMemoryInput } from './agentWorkingMemoryBias';

type AgentWorkingMemoryConflictType =
  | 'memory_vs_fresh_tool_evidence'
  | 'memory_vs_user_goal'
  | 'user_negates_memory_value';

interface AgentWorkingMemoryConflictFact {
  key: string;
  memoryKind: 'episodic' | 'procedural' | 'semantic' | 'unknown';
  normalizedKey: string;
  normalizedValue: string;
  source: 'memory' | 'tool-evidence' | 'user-goal';
  sourceLabel: string;
  text: string;
  value: string;
}

interface AgentWorkingMemoryConflict {
  currentFact?: AgentWorkingMemoryConflictFact | null;
  memoryFact: AgentWorkingMemoryConflictFact;
  type: AgentWorkingMemoryConflictType;
}

const AGENT_WORKING_MEMORY_CONFLICT_MAX_ITEMS = 4;

const AGENT_WORKING_MEMORY_CONFLICT_IGNORED_KEYS = new Set([
  'action',
  'actioncount',
  'actions',
  'alloweduse',
  'confidence',
  'createdat',
  'memorykind',
  'recency',
  'result',
  'source',
  'status',
  'summary',
  'text',
  'tool',
  'weight',
]);

const AGENT_WORKING_MEMORY_CONFLICT_NEGATION_RE = /(?:\bnot\b|\bno\b|\bavoid\b|\bwithout\b|\bdon't\b|\bdo not\b|\binstead of\b|不要|不用|不是|别|別|而不是|不要用|不用)/iu;

function compactAgentWorkingMemoryConflictText(value: string, maxLength = 260) {
  const compactText = value.replace(/\s+/gu, ' ').trim();
  if (compactText.length <= maxLength) {
    return compactText;
  }

  return `${compactText.slice(0, Math.max(0, maxLength - 3))}...`;
}

function normalizeAgentWorkingMemoryConflictKey(value: string) {
  return value.trim().toLowerCase().replace(/[-\s]+/gu, '_').replace(/[^a-z0-9_]/gu, '');
}

function normalizeAgentWorkingMemoryConflictValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^["'`]+|["'`]+$/gu, '')
    .replace(/\s+/gu, ' ')
    .replace(/[.。!！?？]+$/gu, '')
    .trim();
}

function cleanAgentWorkingMemoryConflictValue(value: string) {
  return value
    .trim()
    .replace(/^["'`]+|["'`]+$/gu, '')
    .replace(/\s+/gu, ' ')
    .replace(/[.。!！?？]+$/gu, '')
    .trim();
}

function resolveAgentWorkingMemoryConflictKindFromText(text: string): AgentWorkingMemoryConflictFact['memoryKind'] {
  const memoryKind = text.match(/\bmemoryKind=(episodic|procedural|semantic|unknown)\b/iu)?.[1]?.toLowerCase();
  if (
    memoryKind === 'episodic'
    || memoryKind === 'procedural'
    || memoryKind === 'semantic'
    || memoryKind === 'unknown'
  ) {
    return memoryKind;
  }

  if (/\btool=execute_memory_action\b/iu.test(text)) {
    return 'semantic';
  }

  if (/\b(?:actions|availableActions)=/iu.test(text)) {
    return 'procedural';
  }

  if (/^\d+\.\s*tool=/iu.test(text.trim())) {
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

function extractAgentWorkingMemoryConflictFactsFromText(options: {
  memoryKind?: AgentWorkingMemoryConflictFact['memoryKind'];
  source: AgentWorkingMemoryConflictFact['source'];
  sourceLabel: string;
  text: string;
}) {
  const normalizedSourceText = [
    options.text,
    options.text.replace(/\b(?:summary|result|text)=/giu, ' '),
  ].join('\n');
  const facts: AgentWorkingMemoryConflictFact[] = [];
  const seen = new Set<string>();
  const pairPattern = /(?:^|[\s;|,])([a-z][a-z0-9_-]{2,80})\s*=\s*([^;|,\n]+)/giu;
  let match: RegExpExecArray | null;

  while ((match = pairPattern.exec(normalizedSourceText)) !== null) {
    const key = match[1] ?? '';
    const rawValue = match[2] ?? '';
    const normalizedKey = normalizeAgentWorkingMemoryConflictKey(key);
    const value = cleanAgentWorkingMemoryConflictValue(rawValue);
    const normalizedValue = normalizeAgentWorkingMemoryConflictValue(value);

    if (
      !normalizedKey
      || !normalizedValue
      || AGENT_WORKING_MEMORY_CONFLICT_IGNORED_KEYS.has(normalizedKey)
      || normalizedValue.length > 120
    ) {
      continue;
    }

    const signature = `${options.source}:${normalizedKey}:${normalizedValue}`;
    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    facts.push({
      key,
      memoryKind: options.memoryKind ?? resolveAgentWorkingMemoryConflictKindFromText(options.text),
      normalizedKey,
      normalizedValue,
      source: options.source,
      sourceLabel: options.sourceLabel,
      text: options.text,
      value,
    });
  }

  return facts;
}

function getAgentMemoryFacts(workingMemory: AgentWorkingMemoryInput) {
  if (isAgentWorkingMemorySnapshot(workingMemory)) {
    return workingMemory.entries.flatMap((entry, index) => (
      extractAgentWorkingMemoryConflictFactsFromText({
        memoryKind: entry.toolName === 'execute_memory_action'
          ? 'semantic'
          : entry.actionLabels.length
            ? 'procedural'
            : 'episodic',
        source: 'memory',
        sourceLabel: `memoryEntry${index + 1}:${entry.toolName}`,
        text: [
          `tool=${entry.toolName}`,
          `status=${entry.status || 'unknown'}`,
          `createdAt=${entry.createdAt}`,
          `summary=${entry.summary}`,
          entry.resultText ? `result=${entry.resultText}` : '',
          entry.actionLabels.length ? `actions=${entry.actionLabels.join(' | ')}` : '',
        ].filter(Boolean).join(' ; '),
      })
    ));
  }

  const rawText = typeof workingMemory === 'string' ? workingMemory.trim() : '';
  if (!rawText || rawText === 'none') {
    return [];
  }

  return rawText
    .split(/\n+/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line, index) => extractAgentWorkingMemoryConflictFactsFromText({
      source: 'memory',
      sourceLabel: `memoryText${index + 1}`,
      text: line,
    }));
}

function formatAgentToolResultEvidenceText(result: AgentChatCommandResult) {
  return [
    result.responseText,
    result.errorText,
    result.verification,
    ...(result.observations ?? []),
    ...(result.receipt?.evidenceLines ?? []),
    ...(result.receipt?.summaryLines ?? []),
    ...(result.stateSummary?.observedState ?? []),
    ...(result.stateSummary?.changedState ?? []),
    ...(result.stateSummary?.verificationEvidence ?? []),
    ...(result.stateSummary?.missingEvidence ?? []),
    ...(result.stateSummary?.recommendedRecovery ?? []),
    result.stateSummary?.actionEvidence?.targetRef?.label,
    result.stateSummary?.actionEvidence?.diff?.summary,
  ].filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).join(' | ');
}

function getAgentToolEvidenceFacts(toolResults: AgentRuntimeToolResultEntry[]) {
  return toolResults.slice(-6).flatMap((entry, index) => {
    const toolName = entry.command.toolCall?.name ?? entry.command.kind;
    return extractAgentWorkingMemoryConflictFactsFromText({
      source: 'tool-evidence',
      sourceLabel: `toolResult${Math.max(1, toolResults.length - 5 + index)}:${toolName}`,
      text: formatAgentToolResultEvidenceText(entry.result),
    });
  });
}

function getAgentUserGoalFacts(sourceText: string, userGoal: string) {
  return extractAgentWorkingMemoryConflictFactsFromText({
    source: 'user-goal',
    sourceLabel: 'current-user-goal',
    text: [sourceText, userGoal].filter(Boolean).join('\n'),
  });
}

function findAgentNegatedMemoryValue(options: {
  currentText: string;
  memoryFact: AgentWorkingMemoryConflictFact;
}) {
  if (options.memoryFact.normalizedValue.length < 3) {
    return false;
  }

  const currentText = options.currentText.toLowerCase();
  const valueIndex = currentText.indexOf(options.memoryFact.normalizedValue);
  if (valueIndex < 0) {
    return false;
  }

  const windowStart = Math.max(0, valueIndex - 36);
  const windowEnd = Math.min(currentText.length, valueIndex + options.memoryFact.normalizedValue.length + 24);
  return AGENT_WORKING_MEMORY_CONFLICT_NEGATION_RE.test(currentText.slice(windowStart, windowEnd));
}

function rankAgentWorkingMemoryConflict(conflict: AgentWorkingMemoryConflict) {
  if (conflict.type === 'memory_vs_user_goal' || conflict.type === 'user_negates_memory_value') {
    return 3;
  }

  if (conflict.type === 'memory_vs_fresh_tool_evidence') {
    return 2;
  }

  return 1;
}

function formatAgentWorkingMemoryConflict(conflict: AgentWorkingMemoryConflict, index: number) {
  return [
    `memoryConflict${index + 1}=type=${conflict.type}`,
    `key=${conflict.memoryFact.key}`,
    `memoryValue=${compactAgentWorkingMemoryConflictText(conflict.memoryFact.value, 120)}`,
    conflict.currentFact ? `currentValue=${compactAgentWorkingMemoryConflictText(conflict.currentFact.value, 120)}` : '',
    `memoryKind=${conflict.memoryFact.memoryKind}`,
    `memorySource=${conflict.memoryFact.sourceLabel}`,
    conflict.currentFact ? `currentSource=${conflict.currentFact.sourceLabel}` : 'currentSource=current-user-goal',
  ].filter(Boolean).join(' ');
}

export interface AgentWorkingMemoryConflictSignalOptions {
  sourceText: string;
  toolResults: AgentRuntimeToolResultEntry[];
  userGoal: string;
  workingMemory: AgentWorkingMemoryInput;
}

export function createAgentWorkingMemoryConflictSignalText(
  options: AgentWorkingMemoryConflictSignalOptions,
) {
  const memoryFacts = getAgentMemoryFacts(options.workingMemory);
  if (!memoryFacts.length) {
    return '';
  }

  const userFacts = getAgentUserGoalFacts(options.sourceText, options.userGoal);
  const toolEvidenceFacts = getAgentToolEvidenceFacts(options.toolResults);
  const currentText = [options.sourceText, options.userGoal].filter(Boolean).join('\n');
  const conflicts: AgentWorkingMemoryConflict[] = [];
  const seenConflicts = new Set<string>();

  const addConflict = (conflict: AgentWorkingMemoryConflict) => {
    const signature = [
      conflict.type,
      conflict.memoryFact.normalizedKey,
      conflict.memoryFact.normalizedValue,
      conflict.currentFact?.normalizedValue ?? '',
    ].join(':');
    if (seenConflicts.has(signature)) {
      return;
    }

    seenConflicts.add(signature);
    conflicts.push(conflict);
  };

  for (const memoryFact of memoryFacts) {
    for (const userFact of userFacts) {
      if (
        memoryFact.normalizedKey === userFact.normalizedKey
        && memoryFact.normalizedValue !== userFact.normalizedValue
      ) {
        addConflict({
          currentFact: userFact,
          memoryFact,
          type: 'memory_vs_user_goal',
        });
      }
    }

    for (const toolFact of toolEvidenceFacts) {
      if (
        memoryFact.normalizedKey === toolFact.normalizedKey
        && memoryFact.normalizedValue !== toolFact.normalizedValue
      ) {
        addConflict({
          currentFact: toolFact,
          memoryFact,
          type: 'memory_vs_fresh_tool_evidence',
        });
      }
    }

    if (findAgentNegatedMemoryValue({ currentText, memoryFact })) {
      addConflict({
        currentFact: null,
        memoryFact,
        type: 'user_negates_memory_value',
      });
    }
  }

  if (!conflicts.length) {
    return '';
  }

  const visibleConflicts = conflicts
    .sort((a, b) => rankAgentWorkingMemoryConflict(b) - rankAgentWorkingMemoryConflict(a))
    .slice(0, AGENT_WORKING_MEMORY_CONFLICT_MAX_ITEMS);
  const primaryConflict = visibleConflicts[0];

  return [
    `memoryConflictPrimary=${primaryConflict.type}`,
    `memoryConflictCount=${conflicts.length}`,
    `memoryConflictShown=${visibleConflicts.length}`,
    conflicts.length > visibleConflicts.length ? `memoryConflictSuppressed=${conflicts.length - visibleConflicts.length}` : '',
    ...visibleConflicts.map(formatAgentWorkingMemoryConflict),
    'memoryConflictPolicy=This signal is advisory and evidence-driven. Current user intent, fresh tool evidence, actionEvidence, permission policy, and visible UI state take priority over conflicting memory.',
    'memoryConflictRequiredReplan=Do not let conflicting memory drive a final answer or state-changing action. Verify the current fact, use the current evidence, ask one short necessary question, or report the conflict.',
    'memoryConflictNoFixedChainPolicy=This signal does not mandate a fixed recovery tool sequence.',
  ].filter(Boolean).join('\n');
}
