import assert from 'node:assert/strict';
import {
  createAgentGuardedWorkingMemoryText,
  type AgentWorkingMemorySnapshot,
} from '../src/agent/legacy/index.ts';
import { createAgentGuardedWorkingMemoryText } from '../src/agent/runtime/agentWorkingMemoryBias.ts';

const now = 1_800_000_000_000;
const memoryText = [
  `1. tool=execute_memory_action ; status=completed ; createdAt=${now - 5 * 60 * 1000} ; summary=preferred browser is Chrome`,
  `2. tool=observe_windows_and_apps ; status=failed ; createdAt=${now - 8 * 24 * 60 * 60 * 1000} ; summary=old failed window observation`,
  '3. tool=inspect_local_project ; status=completed ; summary=old-format project action memory without timestamp',
].join('\n');
const guardedMemory = createAgentGuardedWorkingMemoryText(memoryText, {
  maxItems: 2,
  now,
});

assert.match(guardedMemory, /memoryBiasPolicy=Working memory is advisory planning bias/u);
assert.match(guardedMemory, /memoryBiasConflictRule=If working memory conflicts/u);
assert.match(guardedMemory, /memoryKindPolicy=episodic use=resolve references/u);
assert.match(guardedMemory, /memoryKindPolicy=procedural use=adapt a prior action pattern/u);
assert.match(guardedMemory, /memoryKindPolicy=semantic use=consider remembered preferences/u);
assert.match(guardedMemory, /memoryKindPolicy=unknown use=low-confidence context only/u);
assert.match(guardedMemory, /memoryKindConflictPolicy=Current user intent, fresh tool evidence/u);
assert.match(guardedMemory, /memoryKindNoFixedChainPolicy=No memoryKind mandates a fixed tool sequence/u);
assert.match(guardedMemory, /memoryBiasRecencyGuard=Use weight\/confidence\/recency/u);
assert.match(guardedMemory, /memoryBiasThresholdGuard=maxItems=2; totalItems=3; shownItems=2/u);
assert.match(guardedMemory, /memoryBiasSuppressedItems=1/u);
assert.match(guardedMemory, /memoryBiasItem1=weight=0\.82 confidence=high recency=very-recent source=working-memory-text memoryKind=semantic allowedUse=preference-or-durable-fact-candidate-only tool=execute_memory_action status=completed/u);
assert.match(guardedMemory, /text=1\. tool=execute_memory_action/u);
assert.match(guardedMemory, /memoryBiasItem2=weight=0\.57 confidence=medium recency=unknown source=working-memory-text memoryKind=episodic allowedUse=reference-or-prior-evidence-only tool=inspect_local_project status=completed/u);
assert.doesNotMatch(guardedMemory, /old failed window observation/u);

assert.equal(createAgentGuardedWorkingMemoryText('none'), '');
assert.equal(createAgentGuardedWorkingMemoryText(''), '');
assert.equal(
  createAgentGuardedWorkingMemoryText(guardedMemory, { now }),
  guardedMemory,
  'Memory bias guard should be idempotent for already guarded text.',
);

const structuredMemory: AgentWorkingMemorySnapshot = {
  entries: [
    {
      actionLabels: ['Run candidate action 1'],
      command: {
        capabilityId: 'local-project',
        instruction: 'inspect project',
        kind: 'tool-call',
        sourceText: '/agent inspect project',
        toolCall: {
          goal: 'inspect project',
          input: {
            path: 'D:\\Project',
          },
          name: 'inspect_local_project',
        },
      },
      context: null,
      createdAt: now - 30 * 60 * 1000,
      resultText: 'project has one runnable action',
      status: 'completed',
      summary: 'candidateActions=1',
      toolName: 'inspect_local_project',
    },
    {
      actionLabels: [],
      command: {
        capabilityId: 'agent-memory',
        instruction: 'recall preferred browser',
        kind: 'tool-call',
        sourceText: '/agent recall browser',
        toolCall: {
          goal: 'recall preferred browser',
          input: {
            action: 'recall',
            key: 'preferred_browser',
          },
          name: 'execute_memory_action',
        },
      },
      context: null,
      createdAt: now - 2 * 60 * 1000,
      resultText: 'Agent memory [browser]: preferred_browser = Edge',
      status: 'completed',
      summary: 'preferred_browser=Edge',
      toolName: 'execute_memory_action',
    },
  ],
  latestEntry: null,
  summaryText: 'fallback text should not be used when entries exist',
};
structuredMemory.latestEntry = structuredMemory.entries[structuredMemory.entries.length - 1] ?? null;

const guardedStructuredMemory = createAgentGuardedWorkingMemoryText(structuredMemory, {
  now,
});

assert.match(guardedStructuredMemory, /memoryBiasThresholdGuard=.*source=structured-snapshot/u);
assert.match(guardedStructuredMemory, /memoryBiasKindRule=memoryKind is a routing hint only/u);
assert.match(guardedStructuredMemory, /memoryKindNoFixedChainPolicy=No memoryKind mandates a fixed tool sequence/u);
assert.match(guardedStructuredMemory, /memoryBiasItem1=.*source=structured-snapshot memoryKind=procedural allowedUse=candidate-action-pattern-only tool=inspect_local_project/u);
assert.match(guardedStructuredMemory, /actionCount=1/u);
assert.match(guardedStructuredMemory, /memoryBiasItem2=.*source=structured-snapshot memoryKind=semantic allowedUse=preference-or-durable-fact-candidate-only tool=execute_memory_action/u);
assert.doesNotMatch(guardedStructuredMemory, /fallback text should not be used/u);
assert.equal(
  createAgentGuardedWorkingMemoryText(memoryText, { maxItems: 2, now }),
  guardedMemory,
  'Legacy SessionV2 wrapper should preserve Runtime formatting exactly.',
);

console.log('agent session v2 memory bias guard smoke ok');
