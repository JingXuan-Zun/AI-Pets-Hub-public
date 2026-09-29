import { createAgentSkillInstructionContext } from './agentSkillInstructionContext';
import {
  type AgentWorkingMemorySnapshot,
} from '../agentChatContext';
import {
  type AgentRuntimeStep,
  type AgentRuntimeToolResultEntry,
  type AgentRuntimeTraceEvent,
} from './agentRuntimeContract';

export interface AgentPlanningContext {
  skillInstructionsText?: string;
  memoryConflictSignalText: string;
  postActionRecoveryFollowUpText: string;
  recentVisualContextText: string;
  replanSignalText: string;
  resultVerificationText: string;
  taskProgressText: string;
  traceStuckSignalText: string;
  visualRecoveryText: string;
  workingMemory?: AgentWorkingMemorySnapshot | null;
  workingMemoryText: string;
}

export interface AgentPlanningContextAdapters<RequestedActionCoverage> {
  createMemoryConflictSignalText: (options: {
    sourceText: string;
    toolResults: AgentRuntimeToolResultEntry[];
    userGoal: string;
    workingMemory: AgentWorkingMemorySnapshot | string;
  }) => string;
  createPostActionRecoveryFollowUpText: (
    toolResults: AgentRuntimeToolResultEntry[],
  ) => string;
  createRecentVisualContextText: (toolResults: AgentRuntimeToolResultEntry[]) => string;
  createReplanSignalText: (options: {
    requestedActionCoverage: RequestedActionCoverage;
    steps: AgentRuntimeStep[];
    toolResults: AgentRuntimeToolResultEntry[];
  }) => string;
  createRequestedActionCoverage: (options: {
    sourceText: string;
    userGoal: string;
  }) => RequestedActionCoverage;
  createResultVerificationText: (options: {
    sourceText: string;
    toolResults: AgentRuntimeToolResultEntry[];
    userGoal: string;
  }) => string;
  createTaskProgressText: (steps: AgentRuntimeStep[]) => string;
  createTraceStuckSignalText: (options: {
    toolResults: AgentRuntimeToolResultEntry[];
    traceEvents: AgentRuntimeTraceEvent[];
  }) => string;
  createVisualRecoveryText: (toolResults: AgentRuntimeToolResultEntry[]) => string;
}

export interface CreateAgentPlanningContextOptions<RequestedActionCoverage> {
  adapters: AgentPlanningContextAdapters<RequestedActionCoverage>;
  sourceText: string;
  steps: AgentRuntimeStep[];
  toolResults: AgentRuntimeToolResultEntry[];
  traceEvents: AgentRuntimeTraceEvent[];
  userGoal: string;
  workingMemory?: AgentWorkingMemorySnapshot | null;
  workingMemoryText?: string | null;
}

type AgentPlanningSignalPriority =
  | 'critical'
  | 'high'
  | 'medium-high'
  | 'medium'
  | 'low';

interface AgentPlanningSignalBlock {
  id: string;
  policy: string;
  priority: AgentPlanningSignalPriority;
  rank: number;
  text: string;
  title: string;
}

export function createAgentPlanningContext<RequestedActionCoverage>(
  options: CreateAgentPlanningContextOptions<RequestedActionCoverage>,
): AgentPlanningContext {
  const requestedActionCoverage = options.adapters.createRequestedActionCoverage({
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  });

  return {
    skillInstructionsText: createAgentSkillInstructionContext(options.toolResults),
    memoryConflictSignalText: options.adapters.createMemoryConflictSignalText({
      sourceText: options.sourceText,
      toolResults: options.toolResults,
      userGoal: options.userGoal,
      workingMemory: options.workingMemory ?? options.workingMemoryText ?? '',
    }),
    postActionRecoveryFollowUpText: options.adapters.createPostActionRecoveryFollowUpText(
      options.toolResults,
    ),
    recentVisualContextText: options.adapters.createRecentVisualContextText(options.toolResults),
    replanSignalText: options.adapters.createReplanSignalText({
      requestedActionCoverage,
      steps: options.steps,
      toolResults: options.toolResults,
    }),
    resultVerificationText: options.adapters.createResultVerificationText({
      sourceText: options.sourceText,
      toolResults: options.toolResults,
      userGoal: options.userGoal,
    }),
    taskProgressText: options.adapters.createTaskProgressText(options.steps),
    traceStuckSignalText: options.adapters.createTraceStuckSignalText({
      toolResults: options.toolResults,
      traceEvents: options.traceEvents,
    }),
    visualRecoveryText: options.adapters.createVisualRecoveryText(options.toolResults),
    workingMemory: options.workingMemory ?? null,
    workingMemoryText: options.workingMemoryText ?? '',
  };
}

export function createAgentModelInput(options: {
  formatWorkingMemory: (
    input: AgentWorkingMemorySnapshot | string | null | undefined,
  ) => string;
  historyLines: string[];
  planningContext: AgentPlanningContext;
  sourceText: string;
  userGoal: string;
}) {
  const { planningContext } = options;
  const workingMemoryText = options.formatWorkingMemory(
    planningContext.workingMemory ?? planningContext.workingMemoryText,
  );
  const planningSignalBlocks = createAgentPlanningSignalBlocks(
    planningContext,
    workingMemoryText,
  );
  return [
    formatAgentPlanningSignalBlocks(planningSignalBlocks),
    `Original user request: ${options.sourceText}`,
    `Current user goal: ${options.userGoal}`,
    '',
    'Loop history:',
    formatAgentLoopHistoryForModel(options.historyLines),
    '',
    planningContext.skillInstructionsText ?? '',
    'Return the next JSON action now.',
  ].filter(Boolean).join('\n');
}

function formatAgentLoopHistoryForModel(historyLines: string[]) {
  if (!historyLines.length) {
    return 'none';
  }

  const maxHistoryLines = 12;
  if (historyLines.length <= maxHistoryLines) {
    return historyLines.join('\n\n');
  }

  const headCount = 2;
  const tailCount = 10;
  const omittedCount = Math.max(0, historyLines.length - headCount - tailCount);
  return [
    ...historyLines.slice(0, headCount),
    `[${omittedCount} older loop history entries omitted from model input; planning signals above retain current evidence and recovery state.]`,
    ...historyLines.slice(-tailCount),
  ].join('\n\n');
}

function createAgentPlanningSignalBlocks(
  planningContext: AgentPlanningContext,
  workingMemoryText: string,
): AgentPlanningSignalBlock[] {
  const blocks: AgentPlanningSignalBlock[] = [
    { id: 'replan', policy: 'respond-to-loop-feedback-before-lower-priority-context', priority: 'critical', rank: 10, text: planningContext.replanSignalText, title: 'Current replanning signal' },
    { id: 'memory-conflict', policy: 'prefer-explicit-user-goal-and-current-evidence-over-conflicting-memory', priority: 'high', rank: 20, text: planningContext.memoryConflictSignalText, title: 'Current memory conflict signal' },
    { id: 'trace-stuck', policy: 'avoid-repeating-unchanged-incomplete-actions', priority: 'high', rank: 30, text: planningContext.traceStuckSignalText, title: 'Current trace stuck signal' },
    { id: 'result-verification', policy: 'use-observed-outcome-before-assuming-success', priority: 'high', rank: 40, text: planningContext.resultVerificationText, title: 'Current result verification signal' },
    { id: 'post-action-recovery-follow-up', policy: 'use-when-current-evidence-still-supports-recovery', priority: 'medium-high', rank: 50, text: planningContext.postActionRecoveryFollowUpText, title: 'Current post-action recovery follow-up signal' },
    { id: 'visual-recovery', policy: 'use-as-perception-support-not-a-mandatory-tool-route', priority: 'medium-high', rank: 60, text: planningContext.visualRecoveryText, title: 'Current visual recovery signal' },
    { id: 'task-progress', policy: 'use-to-avoid-redoing-completed-work', priority: 'medium', rank: 70, text: planningContext.taskProgressText, title: 'Current task progress board' },
    { id: 'recent-visual-context', policy: 'use-current-visual-facts-as-supporting-context', priority: 'medium', rank: 80, text: planningContext.recentVisualContextText, title: 'Recent visual context from this Agent session' },
    { id: 'working-memory', policy: 'use-as-low-priority-advisory-planning-bias', priority: 'low', rank: 90, text: workingMemoryText, title: 'Working memory from previous chat turns' },
  ];

  return blocks
    .map((block) => ({ ...block, text: block.text.trim() }))
    .filter((block) => block.text.length > 0)
    .sort((left, right) => left.rank - right.rank);
}

function formatAgentPlanningSignalBlocks(blocks: AgentPlanningSignalBlock[]): string {
  if (!blocks.length) {
    return '';
  }

  return [
    'Planning signal priority:',
    ...blocks.map((block, index) => (
      `${index + 1}. ${block.title} priority=${block.priority} policy=${block.policy}`
    )),
    'planningSignalPriorityPolicy=Use higher-priority evidence first; all planning signals are advisory/evidence-driven and do not mandate a fixed tool chain.',
    '',
    ...blocks.map((block) => [block.title + ':', block.text, ''].join('\n')),
  ].join('\n');
}
