export type AgentTraceStuckSignalSeverity = 'critical' | 'high' | 'medium' | 'low';

interface AgentTraceStuckSignalScore {
  confidence: number;
  severity: AgentTraceStuckSignalSeverity;
}

interface AgentTraceStuckSignalBlock extends AgentTraceStuckSignalScore {
  lines: string[];
  ordinal: number;
  reason: string;
}

const AGENT_TRACE_STUCK_SIGNAL_MAX_BLOCKS = 5;

const AGENT_TRACE_STUCK_SIGNAL_REQUIRED_REASONS = new Set([
  'permission_route_blocked',
  'recent_action_evidence_not_completed',
]);

const AGENT_TRACE_STUCK_SIGNAL_SCORES: Record<string, AgentTraceStuckSignalScore> = {
  permission_route_blocked: {
    confidence: 0.95,
    severity: 'critical',
  },
  repeated_action_outcome_window: {
    confidence: 0.88,
    severity: 'high',
  },
  repeated_incomplete_action_primitive: {
    confidence: 0.86,
    severity: 'high',
  },
  repeated_failed_tool_signature: {
    confidence: 0.84,
    severity: 'high',
  },
  recent_trace_rejection: {
    confidence: 0.76,
    severity: 'medium',
  },
  recent_action_evidence_not_completed: {
    confidence: 0.74,
    severity: 'medium',
  },
  tool_started_without_recent_finish: {
    confidence: 0.52,
    severity: 'low',
  },
};

const AGENT_TRACE_STUCK_SIGNAL_SEVERITY_RANK: Record<AgentTraceStuckSignalSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function getAgentTraceStuckSignalScore(reason: string): AgentTraceStuckSignalScore {
  return AGENT_TRACE_STUCK_SIGNAL_SCORES[reason] ?? {
    confidence: 0.6,
    severity: 'medium',
  };
}

function compareAgentTraceStuckSignalPriority(
  a: AgentTraceStuckSignalBlock,
  b: AgentTraceStuckSignalBlock,
) {
  return AGENT_TRACE_STUCK_SIGNAL_SEVERITY_RANK[b.severity]
    - AGENT_TRACE_STUCK_SIGNAL_SEVERITY_RANK[a.severity]
    || b.confidence - a.confidence
    || a.ordinal - b.ordinal;
}

function parseAgentTraceStuckSignalBlocks(lines: string[]) {
  const blocks: AgentTraceStuckSignalBlock[] = [];
  const prefixLines: string[] = [];
  let currentBlock: AgentTraceStuckSignalBlock | null = null;

  for (const line of lines.filter(Boolean)) {
    const reason = line.match(/^reason=([a-z0-9_:-]+)/u)?.[1] ?? '';
    if (reason) {
      const score = getAgentTraceStuckSignalScore(reason);
      currentBlock = {
        ...score,
        lines: [line],
        ordinal: blocks.length,
        reason,
      };
      blocks.push(currentBlock);
      continue;
    }

    if (currentBlock) {
      currentBlock.lines.push(line);
    } else {
      prefixLines.push(line);
    }
  }

  return {
    blocks,
    prefixLines,
  };
}

function selectAgentTraceStuckSignalBlocks(
  blocks: AgentTraceStuckSignalBlock[],
) {
  if (blocks.length <= AGENT_TRACE_STUCK_SIGNAL_MAX_BLOCKS) {
    return blocks;
  }

  const primaryBlock = [...blocks].sort(compareAgentTraceStuckSignalPriority)[0] ?? null;
  const selected = new Map<number, AgentTraceStuckSignalBlock>();

  if (primaryBlock) {
    selected.set(primaryBlock.ordinal, primaryBlock);
  }

  for (const block of blocks) {
    if (AGENT_TRACE_STUCK_SIGNAL_REQUIRED_REASONS.has(block.reason)) {
      selected.set(block.ordinal, block);
    }
  }

  for (const block of [...blocks].sort(compareAgentTraceStuckSignalPriority)) {
    if (selected.size >= AGENT_TRACE_STUCK_SIGNAL_MAX_BLOCKS) {
      break;
    }

    selected.set(block.ordinal, block);
  }

  return [...selected.values()].sort((a, b) => a.ordinal - b.ordinal);
}

export function createAgentGuardedTraceStuckSignalText(lines: string[]) {
  const { blocks, prefixLines } = parseAgentTraceStuckSignalBlocks(lines);
  if (!blocks.length) {
    return lines.filter(Boolean).join('\n');
  }

  const primaryBlock = [...blocks].sort(compareAgentTraceStuckSignalPriority)[0] ?? blocks[0];
  const selectedBlocks = selectAgentTraceStuckSignalBlocks(blocks);
  const selectedOrdinals = new Set(selectedBlocks.map((block) => block.ordinal));
  const suppressedBlocks = blocks.filter((block) => !selectedOrdinals.has(block.ordinal));

  return [
    ...prefixLines,
    `stuckSignalPrimaryReason=${primaryBlock.reason}`,
    `stuckSignalSeverity=${primaryBlock.severity}`,
    `stuckSignalConfidence=${primaryBlock.confidence.toFixed(2)}`,
    `stuckSignalVisibleReasons=${selectedBlocks.map((block) => block.reason).join(',')}`,
    suppressedBlocks.length
      ? `stuckSignalSuppressedReasons=${suppressedBlocks.map((block) => block.reason).join(',')}`
      : '',
    `stuckSignalThresholdGuard=maxSignals=${AGENT_TRACE_STUCK_SIGNAL_MAX_BLOCKS}; totalSignals=${blocks.length}; shownSignals=${selectedBlocks.length}; scoring=severity_confidence; advisoryOnly=true`,
    ...selectedBlocks.flatMap((block) => block.lines),
    'stuckSignalPolicy=This signal is advisory and evidence-driven. It should bias planning away from repeated ineffective patterns, but it does not mandate a fixed tool chain.',
  ].filter(Boolean).join('\n');
}
