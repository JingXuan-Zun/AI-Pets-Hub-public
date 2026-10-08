import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

const controllerSource = [
  readProjectFile('src/components/chat/agentRunController.ts'),
  readProjectFile('src/components/chat/agentApprovalContinuationExecution.ts'),
  readProjectFile('src/components/chat/agentRuntimeUiStatusProjection.ts'),
].join('\n');
const permissionRouterSource = readProjectFile('src/agent/agentPermissionRouter.ts');
const approvalRuntimeSource = readProjectFile('src/agent/runtime/agentApprovalContinuationRuntime.ts');
const staleApprovalSource = readProjectFile('src/agent/runtime/agentStaleApprovalCompatibility.ts');

assert.match(
  approvalRuntimeSource,
  /AGENT_RUNTIME_DEFAULT_APPROVAL_CONTINUATION_LIMIT = 6/u,
  'Runtime-owned approved task continuation should be bounded',
);
assert.match(
  permissionRouterSource,
  /export function isAgentTaskScopedApprovalContinuationAllowed/u,
  'Permission Router should classify same-task approved continuations',
);
assert.match(
  permissionRouterSource,
  /export function diagnoseAgentTaskScopedApprovalContinuation/u,
  'Permission Router should explain why same-task approval continuation is or is not consumed',
);
assert.match(
  permissionRouterSource,
  /function getAgentTaskScopeTexts/u,
  'same-task approval reuse should derive task scope from command and plan text',
);
assert.match(
  permissionRouterSource,
  /function isValidAgentTaskScopeText/u,
  'same-task approval reuse should filter polluted scope text before comparing tasks',
);
assert.match(
  permissionRouterSource,
  /AGENT_TASK_SCOPE_TEMPLATE_LITERAL_PATTERN/u,
  'same-task approval reuse should ignore literal template placeholders such as {command.toolCall.goal}',
);
assert.match(
  permissionRouterSource,
  /AGENT_TASK_SCOPE_MOJIBAKE_PATTERN/u,
  'same-task approval reuse should ignore mojibake scope text',
);
assert.match(
  permissionRouterSource,
  /command\.sourceText[\s\S]*command\.instruction[\s\S]*command\.toolCall\?\.goal[\s\S]*plan\.goal[\s\S]*plan\.instruction[\s\S]*\.filter\(isValidAgentTaskScopeText\)/u,
  'same-task approval reuse should include sourceText, instruction, and toolCall goal, not only plan goal',
);
assert.match(
  permissionRouterSource,
  /function hasSameAgentTaskScope/u,
  'same-task approval reuse should centralize task-scope matching',
);
assert.match(
  permissionRouterSource,
  /function isAgentPendingApprovalWithinApprovedRiskCeiling/u,
  'same-task approval reuse should reject pending actions that exceed the approved risk ceiling',
);
assert.match(
  permissionRouterSource,
  /AGENT_TASK_APPROVAL_CONTINUATION_TOOLS[\s\S]*'execute_desktop_sequence'[\s\S]*'execute_desktop_action'[\s\S]*'execute_desktop_input'[\s\S]*'launch_local_app'/u,
  'bounded desktop action/input continuations should be eligible for same-task approval reuse',
);
assert.match(
  permissionRouterSource,
  /isAgentCommandHardGate\(pendingCommand, pendingPlan\)/u,
  'hard login/security gates must still require user approval',
);
assert.match(
  permissionRouterSource,
  /const reason:[\s\S]*= duplicate[\s\S]*'duplicate-command'[\s\S]*'ineligible-tool'[\s\S]*'hard-gate'[\s\S]*'scope-mismatch'[\s\S]*'risk-escalation'[\s\S]*'not-desktop-safe'/u,
  'same-task approval diagnostics should distinguish duplicate, tool, hard gate, scope, and desktop safety blockers',
);
assert.match(
  controllerSource,
  /task-scoped approval continuation executing/u,
  'trace should identify automatic same-task approval continuations',
);
assert.match(
  controllerSource,
  /task-scoped approval continuation not consumed/u,
  'trace should identify why automatic same-task approval continuation did not run',
);
for (const field of [
  'approvalContinuationReason',
  'approvalContinuationTool',
  'approvalContinuationCount',
  'approvalContinuationLimit',
]) {
  assert.match(
    approvalRuntimeSource,
    new RegExp(field, 'u'),
    `not-consumed approval continuation should expose ${field} in Runtime diagnosis details`,
  );
}
assert.match(
  permissionRouterSource,
  /hardGate[\s\S]*prohibitionConflict[\s\S]*scopeMatched[\s\S]*withinRiskCeiling/u,
  'Permission Router decision should expose hard-gate, explicit-prohibition, scope-match, and risk-ceiling diagnostics',
);
assert.match(approvalRuntimeSource, /withinRiskCeiling:/u);
assert.match(approvalRuntimeSource, /prohibitionConflict:/u);
assert.match(
  approvalRuntimeSource,
  /continuation-limit/u,
  'same-task approval diagnostics should expose when the bounded continuation limit is reached',
);
assert.match(
  controllerSource,
  /task-scoped read-only follow-up approval continuation executing/u,
  'approval-producing follow-ups after read-only recovery should also reuse same-task approval',
);
assert.match(
  controllerSource,
  /initial task-scoped follow-up approval continuation executing/u,
  'initial read-only follow-up approvals should execute eligible same-task continuations instead of asking for another approval',
);
assert.match(
  controllerSource,
  /approvedScopeCommand[\s\S]*createAgentProductionSessionPlaceholderCommand[\s\S]*approvedScopePlan[\s\S]*createAgentProductionSessionDisplayPlan/u,
  'initial follow-up approval reuse should compare pending actions against the original user task scope',
);
assert.match(
  approvalRuntimeSource,
  /runAgentTaskScopedApprovalContinuations[\s\S]*while \(pendingApproval && count < maxContinuations\)[\s\S]*decision\.allowed/u,
  'AgentRuntime should own the bounded same-task approval continuation loop',
);
assert.match(controllerSource, /runAgentProductionApprovalContinuations\(\{/u);
assert.match(
  controllerSource,
  /function getAgentTaskRuntimeRunStatus[\s\S]*result\.taskState\.state/u,
  'Controller status display should prefer production Task Runtime state.',
);
assert.match(
  controllerSource,
  /if \(!approvalRuntime\)[\s\S]*Legacy Agent approval is no longer supported[\s\S]*status: 'failed'/u,
  'approval handler should fail legacy approval cards instead of completing a single outer action without SessionV2 continuation',
);
assert.match(
  controllerSource,
  /runAgentProductionApprovedAction\(\{[\s\S]*continuation: approvalRuntime[\s\S]*executeApprovedCommand:[\s\S]*toolExecutor/u,
  'approval handler should route approved execution through the production Runtime entry with the guarded executor',
);
assert.match(
  readModuleProjectFunction('src/components/chat/agentRunController.ts', 'runApprovedAgentRuntimeStage'),
  /executeApprovedCommand: \(command\) => executor\s*\? runAgentControllerToolTransactionWithLiveProgress\(\{\s*command,\s*executor: executor,\s*messageId,\s*signal: signal,/u,
  'approval handler must execute the Runtime-resolved command rather than a stale captured approval command',
);
assert.match(
  controllerSource,
  /task-scoped approval continuation executing after read-only follow-up/u,
  'approval-producing read-only follow-up execution should also consume any next same-task approval',
);
assert.match(
  staleApprovalSource,
  /canSkipAgentStaleOuterApprovalAfterTaskEvidence/u,
  'Runtime compatibility policy should detect stale outer desktop approvals after task-scoped evidence has already run',
);
assert.match(
  controllerSource,
  /function createSkippedStaleOuterApprovalResult/u,
  'controller should consume stale outer desktop approvals without re-executing or asking the user again',
);
assert.match(
  controllerSource,
  /task-scoped stale outer approval skipped after in-app dispatch/u,
  'stale outer approval skips should be visible in runtime logs',
);
assert.match(
  approvalRuntimeSource,
  /staleDuplicateOuterApprovalSkipped/u,
  'runtime diagnosis should expose when stale outer approvals were skipped',
);
assert.match(
  staleApprovalSource,
  /isAgentOuterDesktopDispatchCommand[\s\S]*isAgentInAppDispatchCommand/u,
  'stale approval skipping should be limited to outer desktop actions after concrete in-app dispatch',
);
assert.match(
  staleApprovalSource,
  /hasAgentDispatchEvidence/u,
  'stale approval skipping should also cover duplicate outer launch or focus approvals after outer dispatch evidence',
);
assert.match(
  approvalRuntimeSource,
  /status: 'unverified'[\s\S]*follow-up observation should verify the current window state/u,
  'skipped stale approvals should remain unverified so observation/recovery can consume current window evidence',
);
assert.match(
  approvalRuntimeSource,
  /action: 'wait_and_observe'[\s\S]*name: 'execute_desktop_observation'[\s\S]*requiresApproval: false/u,
  'skipped stale approvals should silently wait and observe instead of asking for another approval',
);
assert.doesNotMatch(
  controllerSource,
  /runAgentReadOnlyFollowUpsWithLiveProgress/u,
  'after Runtime continuation, the UI Controller must render the committed result instead of starting a second read-only recovery loop',
);
assert.match(
  readModuleProjectFunction('src/components/chat/agentRunController.ts', 'resolveAgentApprovalRequest'),
  /const taskScopedApprovedContinuation = await consumeTaskScopedApprovedContinuations[\s\S]*sessionResult = taskScopedApprovedContinuation\.result[\s\S]*const \{ displayResult, pendingReadOnlyFollowUpApproval \} = updateApprovedAgentRunPresentation\(\{\s*sessionResult, approval,/u,
  'the approval handler should render the Runtime-owned continuation result directly',
);
assert.match(
  readModuleProjectFunction('src/components/chat/agentRunController.ts', 'updateApprovedAgentRunPresentation'),
  /const displayResult = createAgentProductionSessionDisplayResult\(sessionResult, approval\.command\)/u,
  'the reachable presentation stage should display the same committed Runtime result and approval command',
);
assert.match(
  approvalRuntimeSource,
  /createAgentApprovalContinuationOutcome[\s\S]*kind: 'duplicate-blocked'[\s\S]*kind: 'stale-outer-skipped'/u,
  'Runtime should classify duplicate-blocked and stale-outer-skipped continuation outcomes',
);
assert.doesNotMatch(
  controllerSource,
  /finalContinuationDecision|shouldSkipFinalStaleOuterApproval/u,
  'Controller must not restore final duplicate or stale-approval classification after Runtime returns',
);

console.log('agent run controller task-scoped approval continuation smoke ok');
