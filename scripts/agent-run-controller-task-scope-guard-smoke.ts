import assert from 'node:assert/strict';
import {
  buildAgentPermissionRoute,
  diagnoseAgentTaskScopedApprovalContinuation,
  type AgentChatCommand,
} from '../src/agent/index.ts';

function launchCommand(options: {
  goal: string;
  query: string;
  sourceText: string;
}): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: options.goal,
    kind: 'tool-call',
    sourceText: options.sourceText,
    toolCall: {
      goal: options.goal,
      input: { query: options.query },
      name: 'launch_local_app',
    },
  };
}

function plan(command: AgentChatCommand) {
  const route = buildAgentPermissionRoute(command);
  assert.ok(route.plan);
  return route.plan;
}

const approvedCommand = launchCommand({
  goal: 'Open Example Launcher and start Example Game',
  query: 'Example Launcher',
  sourceText: '/agent open Example Game inside Example Launcher',
});
const sameTaskCommand = launchCommand({
  goal: 'Open Example Launcher and start Example Game',
  query: 'Example Game',
  sourceText: 'Continue the current launcher task',
});
const approvedPlan = plan(approvedCommand);
const sameTaskPlan = plan(sameTaskCommand);

assert.equal(diagnoseAgentTaskScopedApprovalContinuation({
  approvedCommand,
  approvedPlan,
  pendingCommand: sameTaskCommand,
  pendingPlan: sameTaskPlan,
}).allowed, true);

const placeholderScopeCommand = {
  ...sameTaskCommand,
  instruction: 'Unrelated local instruction',
  sourceText: 'Unrelated local instruction',
  toolCall: {
    ...sameTaskCommand.toolCall,
    goal: '{command.toolCall.goal}',
  },
};
const placeholderDecision = diagnoseAgentTaskScopedApprovalContinuation({
  approvedCommand,
  approvedPlan,
  pendingCommand: placeholderScopeCommand,
  pendingPlan: plan(placeholderScopeCommand),
});
assert.equal(placeholderDecision.allowed, false);
assert.equal(placeholderDecision.reason, 'scope-mismatch');

const newTaskCommand = launchCommand({
  goal: 'Close Example Launcher',
  query: 'Another App',
  sourceText: '/agent close Example Launcher',
});
assert.equal(diagnoseAgentTaskScopedApprovalContinuation({
  approvedCommand,
  approvedPlan,
  pendingCommand: newTaskCommand,
  pendingPlan: plan(newTaskCommand),
}).reason, 'scope-mismatch');

const hardGateCommand = launchCommand({
  goal: 'Enter verification code for Example Game',
  query: 'Example Game verification code',
  sourceText: approvedCommand.sourceText,
});
assert.equal(diagnoseAgentTaskScopedApprovalContinuation({
  approvedCommand,
  approvedPlan,
  pendingCommand: hardGateCommand,
  pendingPlan: plan(hardGateCommand),
}).reason, 'hard-gate');

const escalatedPlan = {
  ...sameTaskPlan,
  steps: sameTaskPlan.steps.map((step) => ({
    ...step,
    action: { ...step.action, risk: 'destructive' as const },
  })),
};
assert.equal(diagnoseAgentTaskScopedApprovalContinuation({
  approvedCommand,
  approvedPlan,
  pendingCommand: sameTaskCommand,
  pendingPlan: escalatedPlan,
}).reason, 'risk-escalation');

assert.equal(diagnoseAgentTaskScopedApprovalContinuation({
  approvedCommand,
  approvedPlan,
  pendingCommand: approvedCommand,
  pendingPlan: approvedPlan,
}).reason, 'duplicate-command');

console.log('agent permission router task scope guard smoke ok');
