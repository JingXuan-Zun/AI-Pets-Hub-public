import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentSessionV2ContinuationState,
  type AgentWorkingMemorySnapshot,
} from '../src/agent/legacy/index.ts';
import {
  createAgentModelInput,
  type AgentPlanningContext,
} from '../src/agent/runtime/agentPlanningContextRuntime.ts';
import { createAgentGuardedWorkingMemoryText } from '../src/agent/runtime/agentWorkingMemoryBias.ts';
import { type PetConfig } from '../src/types.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  planningContext: planningContextSource,
  runtime: runtimeSource,
  session: sessionSource,
  taskProgressRuntime: taskProgressRuntimeSource,
  workingMemoryRuntime: workingMemoryRuntimeSource,
} = readProjectSources({
  planningContext: 'src/agent/runtime/agentPlanningContextRuntime.ts',
  runtime: 'src/agent/runtime/agentPlanningContextRuntime.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  taskProgressRuntime: 'src/agent/runtime/agentTaskProgressSignal.ts',
  workingMemoryRuntime: 'src/agent/runtime/agentWorkingMemoryBias.ts',
});
assertSourceMatches(
  runtimeSource,
  /export interface AgentPlanningContext/u,
  'Planning Context Runtime should own the version-neutral context contract.',
);
assertSourceMatches(
  runtimeSource,
  /memoryConflictSignalText/u,
  'Planning context should include a dedicated memory conflict signal.',
);
assertSourceMatches(
  runtimeSource,
  /interface AgentPlanningSignalBlock/u,
  'Planning Context Runtime should centralize planning signals as ordered blocks.',
);
assertSourceMatches(
  runtimeSource,
  /planningSignalPriorityPolicy/u,
  'Planning context should describe signal priority without mandating a fixed tool chain.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentPlanningContextRuntime'/u,
  'AgentSessionV2 should consume Planning Context Runtime directly.',
);
assertSourceMatches(
  workingMemoryRuntimeSource,
  /export function createAgentGuardedWorkingMemoryText/u,
  'Working Memory Bias Runtime should own guarded memory formatting.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentWorkingMemoryBias'/u,
  'AgentSessionV2 should consume Working Memory Bias Runtime directly.',
);
assertSourceMatches(
  taskProgressRuntimeSource,
  /export function createAgentTaskProgressText/u,
  'Task Progress Signal should own progress-board formatting.',
);
assertSourceMatches(
  sessionSource,
  /createTaskProgressText: createAgentTaskProgressText/u,
  'AgentSessionV2 should provide the Runtime-owned task progress formatter directly.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function createAgentSessionV2ModelInput/u,
  'AgentSessionV2 should not own model input assembly.',
);
assertSourceMatches(
  sessionSource,
  /function createAgentSessionV2PlanningContextAdapters/u,
  'AgentSessionV2 should provide compatibility signal adapters in one place.',
);
assertSourceMatches(
  runtimeSource,
  /planningContext: AgentPlanningContext/u,
  'Runtime model-input assembly should consume the version-neutral planning context.',
);
assertSourceMatches(
  sessionSource,
  /const planningContext = createAgentPlanningContext\(\{/u,
  'AgentSessionV2 loop should enter Planning Context Runtime before model input.',
);
assertSourceMatches(
  sessionSource,
  /createTraceStuckSignalText:[\s\S]*createAgentTraceStuckSignalText/u,
  'Legacy adapters should provide trace-stuck evidence to Planning Context Runtime.',
);

const planningContext: AgentPlanningContext = {
  memoryConflictSignalText: 'memory conflict signal',
  postActionRecoveryFollowUpText: 'post-action follow-up',
  recentVisualContextText: 'visual context',
  replanSignalText: 'replan signal',
  resultVerificationText: 'verification signal',
  taskProgressText: 'progress board',
  traceStuckSignalText: 'trace stuck signal',
  visualRecoveryText: 'visual recovery',
  workingMemoryText: 'working memory',
};
const directModelInput = createAgentModelInput({
  formatWorkingMemory: createAgentGuardedWorkingMemoryText,
  historyLines: ['1. prior tool result'],
  planningContext,
  sourceText: '/agent source',
  userGoal: 'agent goal',
});
assert.match(directModelInput, /Planning signal priority:/u);
assert.match(
  directModelInput,
  /planningSignalPriorityPolicy=Use higher-priority evidence first; all planning signals are advisory\/evidence-driven and do not mandate a fixed tool chain/u,
);
assert.match(directModelInput, /1\. Current replanning signal priority=critical/u);
assert.match(directModelInput, /2\. Current memory conflict signal priority=high/u);
assert.match(directModelInput, /3\. Current trace stuck signal priority=high/u);
assert.match(directModelInput, /4\. Current result verification signal priority=high/u);
assert.match(directModelInput, /Working memory from previous chat turns:\nmemoryBiasPolicy=Working memory is advisory planning bias/u);
assert.match(directModelInput, /memoryBiasItem1=weight=.*recency=unknown/u);
assert.match(directModelInput, /memoryKindPolicy=episodic use=resolve references/u);
assert.match(directModelInput, /memoryKindNoFixedChainPolicy=No memoryKind mandates a fixed tool sequence/u);
assert.match(directModelInput, /text=working memory/u);
assert.match(directModelInput, /Current replanning signal:\nreplan signal/u);
assert.match(directModelInput, /Current memory conflict signal:\nmemory conflict signal/u);
assert.match(directModelInput, /Current trace stuck signal:\ntrace stuck signal/u);
assert.match(directModelInput, /Current result verification signal:\nverification signal/u);
assert.match(directModelInput, /Original user request: \/agent source/u);
assert.match(directModelInput, /Current user goal: agent goal/u);
assert.match(directModelInput, /1\. prior tool result/u);

const compressedHistoryInput = createAgentModelInput({
  formatWorkingMemory: createAgentGuardedWorkingMemoryText,
  historyLines: Array.from({ length: 15 }, (_, index) => `history-${index + 1}`),
  planningContext,
  sourceText: '/agent source',
  userGoal: 'agent goal',
});
assert.match(compressedHistoryInput, /history-1/u);
assert.match(compressedHistoryInput, /history-2/u);
assert.doesNotMatch(compressedHistoryInput, /history-3/u);
assert.match(compressedHistoryInput, /3 older loop history entries omitted from model input/u);
assert.match(compressedHistoryInput, /history-15/u);

const replanSectionIndex = directModelInput.indexOf('Current replanning signal:\nreplan signal');
const memoryConflictSectionIndex = directModelInput.indexOf('Current memory conflict signal:\nmemory conflict signal');
const traceStuckSectionIndex = directModelInput.indexOf('Current trace stuck signal:\ntrace stuck signal');
const resultVerificationSectionIndex = directModelInput.indexOf('Current result verification signal:\nverification signal');
const workingMemorySectionIndex = directModelInput.indexOf('Working memory from previous chat turns:');
assert.ok(replanSectionIndex >= 0);
assert.ok(memoryConflictSectionIndex > replanSectionIndex);
assert.ok(traceStuckSectionIndex > memoryConflictSectionIndex);
assert.ok(resultVerificationSectionIndex > traceStuckSectionIndex);
assert.ok(workingMemorySectionIndex > resultVerificationSectionIndex);

const structuredMemory: AgentWorkingMemorySnapshot = {
  entries: [{
    actionLabels: ['Open remembered target'],
    command: createToolCommand('execute_memory_action', {
      action: 'recall',
      key: 'preferred_browser',
    }),
    context: null,
    createdAt: Date.now(),
    resultText: 'preferred_browser=Edge',
    status: 'completed',
    summary: 'preferred_browser=Edge',
    toolName: 'execute_memory_action',
  }],
  latestEntry: null,
  summaryText: 'fallback memory text',
};
structuredMemory.latestEntry = structuredMemory.entries[0] ?? null;
const structuredModelInput = createAgentModelInput({
  formatWorkingMemory: createAgentGuardedWorkingMemoryText,
  historyLines: [],
  planningContext: {
    ...planningContext,
    workingMemory: structuredMemory,
    workingMemoryText: 'raw fallback should not be used',
  },
  sourceText: '/agent source',
  userGoal: 'agent goal',
});
assert.match(structuredModelInput, /source=structured-snapshot/u);
assert.match(structuredModelInput, /memoryKind=semantic/u);
assert.match(structuredModelInput, /allowedUse=preference-or-durable-fact-candidate-only/u);
assert.match(structuredModelInput, /memoryKindPolicy=semantic use=consider remembered preferences/u);
assert.doesNotMatch(structuredModelInput, /raw fallback should not be used/u);

function createToolCommand(toolName: string, input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: 'planning context smoke',
    kind: 'tool-call',
    sourceText: '/agent planning context smoke',
    toolCall: {
      goal: 'planning context smoke',
      input,
      name: toolName as AgentChatCommand['toolCall']['name'],
    },
  };
}

const command = createToolCommand('execute_desktop_input', {
  action: 'click',
  x: 64,
  y: 96,
});
const result: AgentChatCommandResult = {
  ok: true,
  responseText: 'Click sent but unverified.',
  stateSummary: {
    actionEvidence: {
      action: 'click',
      confidence: 0.4,
      diff: {
        changed: false,
        signals: ['screen unchanged'],
        summary: 'No state change was detected.',
      },
      outcome: 'no-op',
      targetRef: {
        confidence: 'medium',
        kind: 'pixel',
        label: 'button',
      },
      timestamp: Date.now(),
      tool: 'execute_desktop_input',
    },
  },
  verification: 'No state change.',
};

let modelCalls = 0;
const sessionResult = await runAgentProductionSession({
  approvedToolResult: {
    command,
    result,
  },
  continuation: {
    historyLines: [],
    sourceText: '/agent preferred_browser=Chrome click the button',
    steps: [],
    traceEvents: [],
    toolResults: [],
    userGoal: 'preferred_browser=Chrome click the button',
  } satisfies AgentSessionV2ContinuationState,
  maxSteps: 3,
  modelCaller: async ({ userInput }) => {
    modelCalls += 1;
    assert.match(userInput, /Planning signal priority:/u);
    assert.match(userInput, /planningSignalPriorityPolicy=Use higher-priority evidence first/u);
    assert.match(userInput, /Current trace stuck signal:/u);
    assert.match(userInput, /reason=recent_action_evidence_not_completed/u);
    assert.match(userInput, /Current result verification signal:/u);
    assert.match(userInput, /actionEvidence=outcome=no-op/u);
    assert.match(userInput, /Working memory from previous chat turns:/u);
    assert.match(userInput, /memoryBiasPolicy=Working memory is advisory planning bias/u);
    assert.match(userInput, /memoryBiasConflictRule=If working memory conflicts/u);
    assert.match(userInput, /memoryKindPolicy=semantic use=consider remembered preferences/u);
    assert.match(userInput, /memoryKindNoFixedChainPolicy=No memoryKind mandates a fixed tool sequence/u);
    assert.match(userInput, /Current memory conflict signal:/u);
    assert.match(userInput, /memoryConflictPrimary=memory_vs_user_goal/u);
    assert.match(userInput, /memoryConflictPolicy=This signal is advisory/u);
    assert.match(userInput, /memoryConflictNoFixedChainPolicy=This signal does not mandate a fixed recovery tool sequence/u);
    return JSON.stringify({
      action: 'final_answer',
      message: 'button click remains unverified',
      understanding: {
        blockedGoals: ['button state did not change'],
        completedGoals: ['click primitive was sent'],
        remainingGoals: [],
        successCriteria: 'button state changes',
        userNeed: 'click the button',
        verificationEvidence: ['actionEvidence outcome=no-op'],
        verificationGaps: ['state change evidence is missing'],
        verificationStatus: 'blocked',
      },
    });
  },
  settings: {} as PetConfig['settings'],
  sourceText: '/agent preferred_browser=Chrome click the button',
  userGoal: 'preferred_browser=Chrome click the button',
  workingMemoryText: '1. tool=execute_memory_action ; status=completed ; summary=preferred_browser=Edge',
});

assert.equal(modelCalls, 1);
assert.equal(sessionResult.status, 'completed');

console.log('agent session v2 planning context smoke ok');
