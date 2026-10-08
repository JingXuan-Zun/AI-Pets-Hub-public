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

function desktopActionCommand(input: Record<string, string>): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: approvedCommand.instruction,
    kind: 'tool-call',
    sourceText: approvedCommand.sourceText,
    toolCall: {
      goal: approvedCommand.toolCall?.goal,
      input,
      name: 'execute_desktop_action',
    },
  };
}

// Opening a file or URL can run scripts, so it never rides on an earlier approval.
for (const target of ['C:\\Users\\example\\Downloads\\setup.bat', 'https://example.com/']) {
  const openResourceCommand = desktopActionCommand({ action: 'open_resource', target });
  const openResourceDecision = diagnoseAgentTaskScopedApprovalContinuation({
    approvedCommand,
    approvedPlan,
    pendingCommand: openResourceCommand,
    pendingPlan: plan(openResourceCommand),
  });
  assert.equal(openResourceDecision.allowed, false, target);
  assert.equal(openResourceDecision.reason, 'fresh-approval-required', target);
  assert.equal(openResourceDecision.freshApprovalRequired, true, target);
}

for (const query of ['C:\\Users\\example\\Downloads\\setup.exe', '"D:/Tools/run.lnk"', '\\\\server\\share\\tool.exe']) {
  const directPathCommand = launchCommand({
    goal: approvedCommand.toolCall?.goal ?? '',
    query,
    sourceText: approvedCommand.sourceText,
  });
  assert.equal(diagnoseAgentTaskScopedApprovalContinuation({
    approvedCommand,
    approvedPlan,
    pendingCommand: directPathCommand,
    pendingPlan: plan(directPathCommand),
  }).reason, 'fresh-approval-required', query);
}

const focusCommand = desktopActionCommand({ action: 'focus_window', target: 'Example Launcher' });
const focusDecision = diagnoseAgentTaskScopedApprovalContinuation({
  approvedCommand,
  approvedPlan,
  pendingCommand: focusCommand,
  pendingPlan: plan(focusCommand),
});
assert.equal(focusDecision.freshApprovalRequired, false, 'other desktop actions keep same-task approval reuse');
assert.equal(focusDecision.allowed, true, focusDecision.reason);

console.log('agent permission router task scope guard smoke ok');
