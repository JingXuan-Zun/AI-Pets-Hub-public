import assert from 'node:assert/strict';
import {
  buildAgentPermissionRoute,
  canSkipAgentStaleOuterApprovalAfterTaskEvidence,
  diagnoseAgentTaskScopedApprovalContinuation,
  type AgentChatCommand,
  type AgentRuntimeResult,
} from '../src/agent/index.ts';

const outerCommand: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: 'Open Example Launcher',
  kind: 'tool-call',
  sourceText: '/agent open Example Game inside Example Launcher',
  toolCall: {
    goal: 'Open Example Game inside Example Launcher',
    input: { query: 'Example Launcher' },
    name: 'launch_local_app',
  },
};
const outerPlan = buildAgentPermissionRoute(outerCommand).plan!;
const duplicateDecision = diagnoseAgentTaskScopedApprovalContinuation({
  approvedCommand: outerCommand,
  approvedPlan: outerPlan,
  pendingCommand: outerCommand,
  pendingPlan: outerPlan,
});
assert.equal(duplicateDecision.reason, 'duplicate-command');

function result(commands: AgentChatCommand[]): AgentRuntimeResult {
  const continuation = {
    historyLines: [],
    sourceText: outerCommand.sourceText,
    steps: [],
    traceEvents: [],
    toolResults: commands.map((command) => ({
      command,
      result: {
        ok: true,
        receipt: { status: 'success' },
        responseText: 'executed',
      },
    })),
    userGoal: 'Open Example Game inside Example Launcher',
  };
  return {
    continuation,
    finalAnswer: 'approval',
    sourceText: continuation.sourceText,
    status: 'needs-approval',
    steps: [],
    traceEvents: [],
    toolResults: continuation.toolResults,
  };
}

const base = {
  approvedCommand: outerCommand,
  decision: duplicateDecision,
  pendingCommand: outerCommand,
  staleDuplicateSkipCount: 0,
};
assert.equal(canSkipAgentStaleOuterApprovalAfterTaskEvidence({
  ...base,
  continuationCount: 0,
  result: result([outerCommand]),
}), true);
assert.equal(canSkipAgentStaleOuterApprovalAfterTaskEvidence({
  ...base,
  continuationCount: 0,
  result: result([]),
}), false);
assert.equal(canSkipAgentStaleOuterApprovalAfterTaskEvidence({
  ...base,
  continuationCount: 0,
  result: result([outerCommand]),
  staleDuplicateSkipCount: 1,
}), false);

const inputCommand: AgentChatCommand = {
  capabilityId: 'desktop-input',
  instruction: outerCommand.instruction,
  kind: 'tool-call',
  sourceText: outerCommand.sourceText,
  toolCall: {
    input: {
      action: 'click',
      sourceQuery: 'Example Launcher',
      x: 100,
      y: 100,
    },
    name: 'execute_desktop_input',
  },
};
assert.equal(canSkipAgentStaleOuterApprovalAfterTaskEvidence({
  ...base,
  continuationCount: 1,
  result: result([outerCommand, inputCommand]),
}), true);
assert.equal(canSkipAgentStaleOuterApprovalAfterTaskEvidence({
  ...base,
  continuationCount: 1,
  result: result([outerCommand]),
}), false);

console.log('agent stale approval compatibility smoke ok');
