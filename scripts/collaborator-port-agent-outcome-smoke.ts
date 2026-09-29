import assert from 'node:assert/strict';
import {
  transitionAgentVerificationOutcome,
  type AgentRuntimeToolResultEntry,
} from '../src/agent/index.ts';

const command = {
  capabilityId: 'desktop-input',
  instruction: 'click Continue',
  kind: 'tool-call' as const,
  sourceText: '/agent click Continue',
  toolCall: {
    goal: 'click Continue',
    input: { action: 'click', x: 10, y: 10 },
    name: 'execute_desktop_input',
  },
};
const failedEntry: AgentRuntimeToolResultEntry = {
  command,
  result: {
    errorText: 'input backend failed',
    ok: false,
    receipt: { status: 'failed', summaryLines: [], title: 'failed' },
    responseText: '',
  },
};

const transition = transitionAgentVerificationOutcome({
  actionRuntimeDependencies: {
    createAttemptedActionCoverage: () => new Set(['desktop-input']),
    createRequestedActionCoverage: () => new Set(['desktop-input']),
    evaluateTerminal: () => null,
    hasDirectActionIntent: () => true,
    isActionKindCovered: (kind, attemptedCoverage) => attemptedCoverage.has(kind),
    isReadOnlyToolResult: () => false,
    resolvePostActionState: () => '',
  },
  latestEntry: failedEntry,
  resolveVisualApproval: () => null,
  sourceText: command.sourceText,
  toolResults: [failedEntry],
  userGoal: command.instruction,
});

assert.equal(transition.kind, 'stop-needs-user');
assert.equal(transition.recoveryDecision?.action, 'failed-action');
console.log('collaborator portable Agent outcome smoke ok');
