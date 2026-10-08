import assert from 'node:assert/strict';
import { readModuleProjectSources as readProjectSources } from './projectModuleSource.mjs';

const { controllerSource, pendingApprovalSource, sessionSource } = readProjectSources({
  controllerSource: 'src/components/chat/agentRunController.ts',
  pendingApprovalSource: 'src/agent/runtime/agentPendingApprovalResolver.ts',
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
});

assert.doesNotMatch(
  controllerSource,
  /AGENT_RUN_CONTROLLER_MAX_READONLY_FOLLOW_UPS/u,
  'UI Controller must not own a separate read-only recovery loop.',
);

assert.doesNotMatch(
  controllerSource,
  /resolveAgentRunControllerReadOnlyFollowUp|runAgentReadOnlyFollowUpsWithLiveProgress/u,
  'UI Controller must display Runtime outcomes instead of selecting and executing recovery follow-ups after Runtime returns.',
);

assert.match(sessionSource, /decideAgentRecoveryTrigger\(/u);
assert.match(sessionSource, /executeAutoRecoveryLoop\(/u);

assert.match(
  controllerSource,
  /pendingReadOnlyFollowUpApproval = resolveAgentRuntimePendingFollowUpApproval[\s\S]*presentAgentPendingApproval\(\{\s*agentRuntime: sessionResult\.continuation, pendingApproval: pendingReadOnlyFollowUpApproval/u,
  'If a read-only follow-up discovers a click/input action, the controller should create an approval message instead of executing it silently',
);

assert.match(
  pendingApprovalSource,
  /resolveAgentVisualExecutionStrategy/u,
  'Agent run controller should delegate visual execution strategy selection to the shared strategy module',
);

assert.match(
  pendingApprovalSource,
  /resolveAgentRuntimePendingFollowUpApproval[\s\S]*resolveAgentVisualExecutionStrategy\(options\)[\s\S]*visualDecision\.kind !== 'none'[\s\S]*buildAgentPermissionRoute\(visualDecision\.command\)/u,
  'Runtime pending-approval resolver should own visual execution strategy promotion',
);

assert.match(
  controllerSource,
  /resolveAgentRuntimePendingFollowUpApproval\(\{/u,
  'Controller should consume the Runtime pending-approval resolver',
);

console.log('agent run controller read-only follow-up smoke ok');
