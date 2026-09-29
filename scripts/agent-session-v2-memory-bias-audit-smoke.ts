import assert from 'node:assert/strict';
import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentSessionV2ToolResultEntry,
  type AgentWorkingMemorySnapshot,
} from '../src/agent/legacy/index.ts';
import {
  createAgentModelInput,
  type AgentPlanningContext,
} from '../src/agent/runtime/agentPlanningContextRuntime.ts';
import { createAgentGuardedWorkingMemoryText } from '../src/agent/runtime/agentWorkingMemoryBias.ts';
import { createAgentWorkingMemoryConflictSignalText } from '../src/agent/runtime/agentWorkingMemoryConflict.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

function createToolCommand(
  name: NonNullable<AgentChatCommand['toolCall']>['name'],
  input: Record<string, unknown>,
): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: 'memory bias audit smoke',
    kind: 'tool-call',
    sourceText: '/agent memory bias audit smoke',
    toolCall: {
      goal: 'memory bias audit smoke',
      input,
      name,
    },
  };
}

const {
  audit: auditText,
  chatContext: chatContextSource,
  memoryBiasGuard: memoryBiasGuardSource,
  memoryBiasRuntime: memoryBiasRuntimeSource,
  memoryConflict: memoryConflictSource,
  memoryConflictRuntime: memoryConflictRuntimeSource,
  planningContext: planningContextSource,
  planningRuntime: planningRuntimeSource,
  session: sessionSource,
  status: statusText,
} = readProjectSources({
  audit: 'PROJECT_AGENT_MEMORY_BIAS_AUDIT.md',
  chatContext: 'src/agent/agentChatContext.ts',
  memoryBiasGuard: 'src/agent/runtime/agentWorkingMemoryBias.ts',
  memoryBiasRuntime: 'src/agent/runtime/agentWorkingMemoryBias.ts',
  memoryConflict: 'src/agent/runtime/agentWorkingMemoryConflict.ts',
  memoryConflictRuntime: 'src/agent/runtime/agentWorkingMemoryConflict.ts',
  planningContext: 'src/agent/runtime/agentPlanningContextRuntime.ts',
  planningRuntime: 'src/agent/runtime/agentPlanningContextRuntime.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  status: 'PROJECT_AGENT_V2_STATUS.md',
});

assert.match(auditText, /Agent Memory Bias Audit v1/u);
assert.match(auditText, /WorkingMemorySnapshot -> guarded memory text -> memory conflict signal -> planning context/u);
assert.match(auditText, /memory is already injected as guarded planning bias/u);
assert.match(auditText, /must not execute tools/u);
assert.match(auditText, /must not create tool commands/u);
assert.match(auditText, /must not approve, deny, retry, or recover/u);
assert.match(auditText, /must not define fixed tool chains/u);
assert.match(auditText, /Do not use memory to encode a required observe, locate, execute, verify workflow/u);
assert.match(auditText, /Do not introduce a new memory policy engine yet/u);

assertSourceMatches(chatContextSource, /export function createAgentWorkingMemorySnapshot/u);
assertSourceMatches(chatContextSource, /const AGENT_WORKING_MEMORY_MAX_ITEMS/u);
assertSourceMatches(chatContextSource, /createdAt: options\.context\?\.createdAt \?\? Date\.now\(\)/u);
assertSourceMatches(chatContextSource, /actionLabels/u);
assertSourceDoesNotMatch(chatContextSource, /createAgentSessionV2GuardedWorkingMemoryText|createAgentSessionV2MemoryConflictSignalText/u);

assertSourceMatches(memoryBiasRuntimeSource, /type AgentWorkingMemoryBiasRecency/u);
assertSourceMatches(memoryBiasRuntimeSource, /very-recent[\s\S]*recent[\s\S]*current-day[\s\S]*aging[\s\S]*stale[\s\S]*future[\s\S]*unknown/u);
assertSourceMatches(memoryBiasRuntimeSource, /function resolveAgentWorkingMemoryBiasRecency/u);
assertSourceMatches(memoryBiasRuntimeSource, /function resolveAgentWorkingMemoryBiasStatusWeight/u);
assertSourceMatches(memoryBiasRuntimeSource, /function resolveAgentWorkingMemoryBiasConfidence/u);
assertSourceMatches(memoryBiasRuntimeSource, /memoryBiasPolicy=Working memory is advisory planning bias/u);
assertSourceMatches(memoryBiasRuntimeSource, /memoryBiasConflictRule=If working memory conflicts/u);
assertSourceMatches(memoryBiasRuntimeSource, /memoryKindNoFixedChainPolicy=No memoryKind mandates a fixed tool sequence/u);
assertSourceMatches(memoryBiasRuntimeSource, /advisoryOnly=true/u);
assertSourceDoesNotMatch(memoryBiasRuntimeSource, /buildAgentPermissionRoute|evaluateAgentToolAction|executeDesktop|toolExecutor|createAgentToolCommand/u);

assertSourceMatches(memoryConflictRuntimeSource, /memory_vs_fresh_tool_evidence/u);
assertSourceMatches(memoryConflictRuntimeSource, /memory_vs_user_goal/u);
assertSourceMatches(memoryConflictRuntimeSource, /user_negates_memory_value/u);
assertSourceMatches(memoryConflictRuntimeSource, /actionEvidence/u);
assertSourceMatches(memoryConflictRuntimeSource, /Current user intent, fresh tool evidence, actionEvidence, permission policy, and visible UI state take priority/u);
assertSourceMatches(memoryConflictRuntimeSource, /memoryConflictNoFixedChainPolicy=This signal does not mandate a fixed recovery tool sequence/u);
assertSourceDoesNotMatch(memoryConflictRuntimeSource, /buildAgentPermissionRoute|evaluateAgentToolAction|toolExecutor|createAgentToolCommand/u);
assertSourceMatches(planningRuntimeSource, /id: 'working-memory'[\s\S]*policy: 'use-as-low-priority-advisory-planning-bias'[\s\S]*priority: 'low'[\s\S]*rank: 90/u);
assertSourceMatches(planningRuntimeSource, /planningSignalPriorityPolicy=Use higher-priority evidence first/u);
assertSourceMatches(planningRuntimeSource, /do not mandate a fixed tool chain/u);

assertSourceMatches(sessionSource, /workingMemory\?: AgentWorkingMemorySnapshot/u);
assertSourceMatches(sessionSource, /workingMemoryText\?: string/u);
assertSourceMatches(sessionSource, /createMemoryConflictSignalText: createAgentWorkingMemoryConflictSignalText/u);
assertSourceMatches(sessionSource, /from '\.\/runtime\/agentWorkingMemoryConflict'/u);
assertSourceMatches(sessionSource, /from '\.\/runtime\/agentWorkingMemoryBias'/u);
assertSourceMatches(sessionSource, /formatWorkingMemory: createAgentGuardedWorkingMemoryText/u);
assertSourceMatches(planningRuntimeSource, /workingMemory: options\.workingMemory/u);
assertSourceDoesNotMatch(sessionSource, /MemoryPolicyEngine/u);

const now = 1_800_000_000_000;
const structuredMemory: AgentWorkingMemorySnapshot = {
  entries: [
    {
      actionLabels: [],
      command: createToolCommand('execute_memory_action', {
        action: 'recall',
        key: 'preferred_browser',
      }),
      context: null,
      createdAt: now - 2 * 60 * 1000,
      resultText: 'preferred_browser=Edge',
      status: 'completed',
      summary: 'preferred_browser=Edge',
      toolName: 'execute_memory_action',
    },
    {
      actionLabels: ['Open last inspected target'],
      command: createToolCommand('inspect_local_project', {
        path: 'D:\\Project',
      }),
      context: null,
      createdAt: now - 90 * 60 * 1000,
      resultText: 'candidateActions=1',
      status: 'completed',
      summary: 'candidateActions=1',
      toolName: 'inspect_local_project',
    },
  ],
  latestEntry: null,
  summaryText: 'fallback text should not be used',
};
structuredMemory.latestEntry = structuredMemory.entries[structuredMemory.entries.length - 1] ?? null;

const guardedMemory = createAgentGuardedWorkingMemoryText(structuredMemory, {
  now,
});
assert.equal(
  createAgentGuardedWorkingMemoryText(structuredMemory, { now }),
  guardedMemory,
  'Legacy memory-bias API should delegate without changing Runtime output.',
);
assert.match(guardedMemory, /source=structured-snapshot/u);
assert.match(guardedMemory, /memoryBiasItem1=weight=0\.82 confidence=high recency=very-recent/u);
assert.match(guardedMemory, /memoryKind=semantic allowedUse=preference-or-durable-fact-candidate-only/u);
assert.match(guardedMemory, /memoryBiasItem2=weight=0\.64 confidence=medium recency=current-day/u);
assert.match(guardedMemory, /memoryKind=procedural allowedUse=candidate-action-pattern-only/u);
assert.doesNotMatch(guardedMemory, /fallback text should not be used/u);

const toolResult: AgentChatCommandResult = {
  ok: true,
  responseText: 'Fresh observation reports preferred_browser=Chrome',
  stateSummary: {
    actionEvidence: {
      action: 'observe',
      diff: {
        changed: true,
        signals: ['fresh evidence'],
        summary: 'preferred_browser=Chrome',
      },
      outcome: 'changed',
      timestamp: now,
      tool: 'execute_desktop_observation',
    },
    observedState: ['preferred_browser=Chrome'],
  },
  verification: 'preferred_browser=Chrome',
};
const memoryConflictOptions = {
  sourceText: '/agent preferred_browser=Chrome',
  toolResults: [{
    command: createToolCommand('execute_desktop_observation', {
      action: 'get_system_info',
    }),
    result: toolResult,
    step: 1,
  } satisfies AgentSessionV2ToolResultEntry],
  userGoal: 'Use preferred_browser=Chrome for this task',
  workingMemory: structuredMemory,
};
const memoryConflictSignal = createAgentWorkingMemoryConflictSignalText(memoryConflictOptions);
assert.equal(
  createAgentWorkingMemoryConflictSignalText(memoryConflictOptions),
  memoryConflictSignal,
  'Legacy memory-conflict API should delegate without changing Runtime output.',
);
assert.match(memoryConflictSignal, /memoryConflictPrimary=memory_vs_user_goal/u);
assert.match(memoryConflictSignal, /memoryConflictPolicy=This signal is advisory and evidence-driven/u);
assert.match(memoryConflictSignal, /Current user intent, fresh tool evidence, actionEvidence, permission policy, and visible UI state take priority/u);
assert.match(memoryConflictSignal, /memoryConflictNoFixedChainPolicy=This signal does not mandate a fixed recovery tool sequence/u);

const planningContext: AgentPlanningContext = {
  memoryConflictSignalText: memoryConflictSignal,
  postActionRecoveryFollowUpText: '',
  recentVisualContextText: '',
  replanSignalText: 'replan signal',
  resultVerificationText: 'fresh result verification',
  taskProgressText: '',
  traceStuckSignalText: '',
  visualRecoveryText: '',
  workingMemory: structuredMemory,
  workingMemoryText: 'raw fallback should not be used',
};
const modelInput = createAgentModelInput({
  formatWorkingMemory: createAgentGuardedWorkingMemoryText,
  historyLines: [],
  planningContext,
  sourceText: '/agent preferred_browser=Chrome',
  userGoal: 'Use preferred_browser=Chrome for this task',
});
assert.match(modelInput, /1\. Current replanning signal priority=critical/u);
assert.match(modelInput, /2\. Current memory conflict signal priority=high/u);
assert.match(modelInput, /Working memory from previous chat turns:/u);
assert.match(modelInput, /priority=low policy=use-as-low-priority-advisory-planning-bias/u);
assert.match(modelInput, /memoryBiasPolicy=Working memory is advisory planning bias/u);
assert.match(modelInput, /source=structured-snapshot/u);
assert.doesNotMatch(modelInput, /raw fallback should not be used/u);

assert.match(statusText, /Memory-bias audit.*Completed/u);
assert.match(statusText, /PROJECT_AGENT_MEMORY_BIAS_AUDIT\.md/u);
assert.match(statusText, /agent-session-v2-memory-bias-audit-smoke\.ts/u);

console.log('agent session v2 memory bias audit smoke ok');
