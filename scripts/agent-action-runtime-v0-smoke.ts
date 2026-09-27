import assert from 'node:assert/strict';
import {
  createAgentActionInstance,
  evaluateAgentActionRuntime,
  updateAgentActionInstance,
  type AgentActionRuntimeDependencies,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentSessionV2ToolResultEntry,
} from '../src/agent/legacy/index.ts';

function createCommand(name: AgentChatCommand['toolCall']['name']): AgentChatCommand {
  return {
    capabilityId: 'desktop',
    instruction: 'open Example Game inside Example Launcher',
    kind: 'tool-call',
    sourceText: '/agent open Example Game inside Example Launcher',
    toolCall: {
      goal: 'open Example Game inside Example Launcher',
      input: {},
      name,
    },
  };
}

function createEntry(options: {
  command?: AgentChatCommand;
  result?: Partial<AgentChatCommandResult>;
} = {}): AgentSessionV2ToolResultEntry {
  return {
    command: options.command ?? createCommand('observe_windows_and_apps'),
    result: {
      observations: [],
      ok: true,
      responseText: 'ok',
      ...options.result,
    },
  };
}

function createDependencies(options: {
  attemptedCoverage?: string[];
  directIntent?: boolean;
  isReadOnly?: boolean;
  postActionState?: string;
  requestedCoverage?: string[];
} = {}): AgentActionRuntimeDependencies {
  const requestedCoverage = new Set(options.requestedCoverage ?? ['open-or-launch']);
  const attemptedCoverage = new Set(options.attemptedCoverage ?? []);
  return {
    createAttemptedActionCoverage: () => attemptedCoverage,
    createRequestedActionCoverage: () => requestedCoverage,
    evaluateTerminal: () => options.postActionState === 'launched'
      ? {
          finalAnswer: 'Example Game launched.',
          kind: 'launched',
          postActionState: 'launched',
          status: 'completed',
          stepAction: 'final_answer',
          stepReason: 'Verified post-action state: launched.',
        }
      : null,
    hasDirectActionIntent: () => options.directIntent ?? true,
    isActionKindCovered: (kind, attempted) => attempted.has(kind),
    isReadOnlyToolResult: () => options.isReadOnly ?? true,
    resolvePostActionState: () => options.postActionState ?? 'unknown',
  };
}

const loadingDecision = evaluateAgentActionRuntime({
  dependencies: createDependencies({
    attemptedCoverage: ['open-or-launch'],
    postActionState: 'loading',
  }),
  latestEntry: createEntry(),
  sourceText: 'open Example Game',
  toolResults: [createEntry()],
  userGoal: 'open Example Game',
});
assert.equal(loadingDecision.status, 'waiting');
assert.equal(loadingDecision.reason, 'post-action-loading');

const waitingWindowDecision = evaluateAgentActionRuntime({
  dependencies: createDependencies({
    attemptedCoverage: ['open-or-launch'],
    postActionState: 'waiting_window',
  }),
  latestEntry: createEntry({
    command: createCommand('execute_desktop_action'),
    result: {
      receipt: {
        evidenceLines: ['Launch status: launched-unverified'],
        status: 'unverified',
        summaryLines: ['Result: launch request accepted, final visible state unverified'],
        title: 'Execution receipt',
        toolName: 'execute_desktop_action',
        verification: 'Launch request sent, but no focusable window was verified: window-not-detected-after-action.',
      },
      responseText: 'Launch status: launched-unverified',
      verification: 'Launch request sent, but no focusable window was verified: window-not-detected-after-action.',
    },
  }),
  sourceText: 'open Example Game',
  toolResults: [createEntry({ command: createCommand('execute_desktop_action') })],
  userGoal: 'open Example Game',
});
assert.equal(waitingWindowDecision.status, 'waiting');
assert.equal(waitingWindowDecision.reason, 'post-action-waiting-window');
assert.equal(waitingWindowDecision.postActionState, 'waiting_window');

const readOnlyOnlyDecision = evaluateAgentActionRuntime({
  dependencies: createDependencies({
    attemptedCoverage: [],
    isReadOnly: true,
    postActionState: 'unknown',
  }),
  latestEntry: createEntry(),
  sourceText: 'open Example Game',
  toolResults: [createEntry()],
  userGoal: 'open Example Game',
});
assert.equal(readOnlyOnlyDecision.status, 'uncertain');
assert.equal(readOnlyOnlyDecision.reason, 'missing-requested-coverage');
assert.equal(readOnlyOnlyDecision.actionAttempted, false);

const missingInAppDecision = evaluateAgentActionRuntime({
  dependencies: createDependencies({
    attemptedCoverage: ['open-or-launch'],
    postActionState: 'launched',
    requestedCoverage: ['open-or-launch', 'in-app-action'],
  }),
  latestEntry: createEntry({
    command: createCommand('execute_desktop_action'),
    result: {
      responseText: 'Example Launcher is open.',
      verification: 'Launcher window verified.',
    },
  }),
  sourceText: 'open Example Game inside Example Launcher',
  toolResults: [createEntry({ command: createCommand('execute_desktop_action') })],
  userGoal: 'open Example Game inside Example Launcher',
});
assert.equal(missingInAppDecision.status, 'needs-recovery');
assert.equal(missingInAppDecision.reason, 'missing-requested-coverage');
assert.equal(missingInAppDecision.actionAttempted, true);
assert.deepEqual(missingInAppDecision.missingCoverage?.missingCoverage, ['in-app-action']);

const completedDecision = evaluateAgentActionRuntime({
  dependencies: createDependencies({
    attemptedCoverage: ['open-or-launch'],
    isReadOnly: false,
    postActionState: 'launched',
  }),
  latestEntry: createEntry({
    command: createCommand('execute_desktop_action'),
    result: {
      responseText: 'Example Game launched.',
      verification: 'Target app is launched.',
    },
  }),
  sourceText: 'open Example Game',
  toolResults: [createEntry({ command: createCommand('execute_desktop_action') })],
  userGoal: 'open Example Game',
});
assert.equal(completedDecision.status, 'completed');
assert.equal(completedDecision.reason, 'terminal-completed');
assert.equal(completedDecision.terminalEvaluation?.kind, 'launched');

const failedDecision = evaluateAgentActionRuntime({
  dependencies: createDependencies(),
  latestEntry: createEntry({
    result: {
      errorText: 'Tool failed.',
      ok: false,
    },
  }),
  sourceText: 'open Example Game',
  toolResults: [],
  userGoal: 'open Example Game',
});
assert.equal(failedDecision.status, 'failed');
assert.equal(failedDecision.reason, 'tool-failed');

const initialAction = createAgentActionInstance({
  decision: loadingDecision,
  latestEntry: createEntry(),
  now: 1000,
  source: 'approved-tool-result',
});
assert.equal(initialAction.id, 'action-1000');
assert.equal(initialAction.status, 'waiting');
assert.equal(initialAction.latestSource, 'approved-tool-result');
assert.equal(initialAction.entries.length, 1);

const updatedAction = updateAgentActionInstance({
  currentAction: initialAction,
  decision: completedDecision,
  latestEntry: createEntry({ command: createCommand('execute_desktop_action') }),
  now: 2000,
  source: 'post-approval-verification',
});
assert.equal(updatedAction.id, initialAction.id);
assert.equal(updatedAction.status, 'completed');
assert.equal(updatedAction.latestReason, 'terminal-completed');
assert.equal(updatedAction.latestSource, 'post-approval-verification');
assert.equal(updatedAction.entries.length, 2);
assert.equal(updatedAction.entries[1]?.toolName, 'execute_desktop_action');

console.log('agent action runtime v0 smoke ok');
