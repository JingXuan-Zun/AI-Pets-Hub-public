import assert from 'node:assert/strict';
import {
  createAgentWorkingMemoryConflictSignalText,
  type AgentChatCommand,
  type AgentSessionV2ToolResultEntry,
  type AgentWorkingMemorySnapshot,
} from '../src/agent/legacy/index.ts';
import { createAgentWorkingMemoryConflictSignalText } from '../src/agent/runtime/agentWorkingMemoryConflict.ts';

function createToolCommand(toolName: string, input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: 'memory conflict smoke',
    kind: 'tool-call',
    sourceText: '/agent memory conflict smoke',
    toolCall: {
      goal: 'memory conflict smoke',
      input,
      name: toolName as AgentChatCommand['toolCall']['name'],
    },
  };
}

const now = Date.now();
const structuredMemory: AgentWorkingMemorySnapshot = {
  entries: [{
    actionLabels: [],
    command: createToolCommand('execute_memory_action', {
      action: 'recall',
      key: 'preferred_browser',
    }),
    context: null,
    createdAt: now,
    resultText: 'Agent memory [browser]: preferred_browser=Edge',
    status: 'completed',
    summary: 'preferred_browser=Edge',
    toolName: 'execute_memory_action',
  }],
  latestEntry: null,
  summaryText: 'preferred_browser=Edge',
};
structuredMemory.latestEntry = structuredMemory.entries[0] ?? null;

const toolResult: AgentSessionV2ToolResultEntry = {
  command: createToolCommand('execute_memory_action', {
    action: 'recall',
    key: 'preferred_browser',
  }),
  result: {
    ok: true,
    observations: ['fresh preference recall: preferred_browser=Firefox'],
    responseText: 'preferred_browser=Firefox',
  },
};

const conflictSignal = createAgentWorkingMemoryConflictSignalText({
  sourceText: '/agent 不要 Edge',
  toolResults: [toolResult],
  userGoal: 'preferred_browser=Chrome',
  workingMemory: structuredMemory,
});

assert.match(conflictSignal, /memoryConflictPrimary=memory_vs_user_goal/u);
assert.match(conflictSignal, /memoryConflictCount=3/u);
assert.match(conflictSignal, /memoryConflict\d=type=memory_vs_user_goal key=preferred_browser memoryValue=Edge currentValue=Chrome/u);
assert.match(conflictSignal, /memoryConflict\d=type=memory_vs_fresh_tool_evidence key=preferred_browser memoryValue=Edge currentValue=Firefox/u);
assert.match(conflictSignal, /memoryConflict\d=type=user_negates_memory_value key=preferred_browser memoryValue=Edge/u);
assert.match(conflictSignal, /memoryKind=semantic/u);
assert.match(conflictSignal, /memoryConflictPolicy=This signal is advisory and evidence-driven/u);
assert.match(conflictSignal, /memoryConflictRequiredReplan=Do not let conflicting memory drive/u);
assert.match(conflictSignal, /memoryConflictNoFixedChainPolicy=This signal does not mandate a fixed recovery tool sequence/u);

const noConflictSignal = createAgentWorkingMemoryConflictSignalText({
  sourceText: '/agent use preferred_browser=Edge',
  toolResults: [],
  userGoal: 'use preferred_browser=Edge',
  workingMemory: structuredMemory,
});

assert.equal(noConflictSignal, '');

const runtimeConflictOptions = {
  sourceText: '/agent preferred_browser=Chrome',
  toolResults: [toolResult],
  userGoal: 'preferred_browser=Chrome',
  workingMemory: structuredMemory,
};
const runtimeConflictSignal = createAgentWorkingMemoryConflictSignalText(runtimeConflictOptions);
assert.match(runtimeConflictSignal, /memoryConflictPrimary=memory_vs_user_goal/u);
assert.equal(
  createAgentWorkingMemoryConflictSignalText(runtimeConflictOptions),
  runtimeConflictSignal,
  'Legacy SessionV2 wrapper should preserve Runtime conflict output exactly.',
);

console.log('agent session v2 memory conflict signal smoke ok');
