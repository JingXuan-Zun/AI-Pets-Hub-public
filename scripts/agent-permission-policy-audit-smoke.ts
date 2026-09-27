import assert from 'node:assert/strict';
import {
  buildAgentPermissionRoute,
  createAgentActionRequest,
  evaluateAgentToolAction,
  isAgentPermissionRouteSilentReadOnly,
  shouldRequestAgentPermissionRouteApproval,
  type AgentChatCommand,
  type AgentToolActionRequest,
} from '../src/agent/index.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

function createToolCommand(
  name: NonNullable<AgentChatCommand['toolCall']>['name'],
  input: Record<string, unknown>,
  capabilityId: AgentChatCommand['capabilityId'] = 'desktop-observation',
): AgentChatCommand {
  return {
    capabilityId,
    instruction: 'permission policy audit smoke',
    kind: 'tool-call',
    sourceText: '/agent permission policy audit smoke',
    toolCall: {
      goal: 'permission policy audit smoke',
      input,
      name,
    },
  };
}

const {
  auditText,
  actionPolicySource,
  orchestratorSource,
  permissionRouterSource,
  runtimeSource,
  sessionSource,
  coreSource,
  statusText,
} = readProjectSources({
  auditText: 'PROJECT_AGENT_PERMISSION_POLICY_AUDIT.md',
  actionPolicySource: 'src/agent/agentActionPolicy.ts',
  orchestratorSource: 'src/agent/agentOrchestrator.ts',
  permissionRouterSource: 'src/agent/agentPermissionRouter.ts',
  runtimeSource: 'src/agent/agentRuntimeExecutor.ts',
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
  coreSource: 'src/agent/agentCore.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

assert.match(auditText, /Agent Permission Policy Audit v1/u);
assert.match(auditText, /AgentToolActionRequest -> AgentToolActionDecision -> AgentPermissionRoute/u);
assert.match(auditText, /Do not replace `agentPermissionRouter\.ts` yet/u);
assert.match(auditText, /must not create tool commands/u);
assert.match(auditText, /must not decide recovery/u);
assert.match(auditText, /must not define fixed tool chains/u);
assert.match(auditText, /Do not use permission policy to encode a required observe, locate, execute, verify workflow/u);

assert.match(actionPolicySource, /const ACTION_RISK_BY_KIND/u);
assert.match(actionPolicySource, /export function evaluateAgentToolAction/u);
assert.doesNotMatch(actionPolicySource, /buildAgentPermissionRoute|buildAgentExecutionPlan|toolExecutor/u);

assert.match(
  orchestratorSource,
  /function createPlanStep\([\s\S]*createAgentActionRequest\([\s\S]*decision: evaluateAgentToolAction\(action\)/u,
  'Plan construction should translate commands to action requests and evaluate action policy once per step.',
);
assert.match(orchestratorSource, /export function buildAgentExecutionPlan/u);

assert.match(permissionRouterSource, /const plan = buildAgentExecutionPlan\(command\)/u);
assert.match(permissionRouterSource, /const blockedStep = resolveBlockedStep\(plan\)/u);
assert.match(permissionRouterSource, /const dominantApprovalMode = resolveDominantApprovalMode\(plan\)/u);
assert.match(permissionRouterSource, /const maxRisk = resolveMaxRisk\(plan\)/u);
assert.match(permissionRouterSource, /buildAgentModeRoute\(command, plan\)/u);
assert.doesNotMatch(permissionRouterSource, /evaluateAgentToolAction|executeDesktop|toolExecutor/u);

assert.match(
  runtimeSource,
  /const permissionRoute = buildAgentPermissionRoute\(command\)[\s\S]*const blockedStep = permissionRoute\.blockedStep/u,
  'Runtime executor should keep a final blocked-step guard before execution.',
);
assert.match(sessionSource, /const permissionRoute = buildAgentPermissionRoute\(command\)/u);
assert.match(coreSource, /const permissionRoute = buildAgentPermissionRoute\(command\)/u);

const userReadAction = createAgentActionRequest('read-system-info', {
  label: 'read system info',
  requiresDesktopMode: true,
  userInitiated: true,
});
assert.equal(evaluateAgentToolAction(userReadAction).mode, 'silent');

const backgroundReadAction = createAgentActionRequest('read-system-info', {
  label: 'background read system info',
  requiresDesktopMode: true,
  userInitiated: false,
});
assert.equal(evaluateAgentToolAction(backgroundReadAction).mode, 'notify');

const userVisualAction = createAgentActionRequest('capture-screen-context', {
  label: 'capture screen',
  requiresDesktopMode: true,
  userInitiated: true,
});
assert.equal(evaluateAgentToolAction(userVisualAction).mode, 'notify');

const backgroundVisualAction = createAgentActionRequest('capture-screen-context', {
  label: 'background capture screen',
  requiresDesktopMode: true,
  userInitiated: false,
});
assert.equal(evaluateAgentToolAction(backgroundVisualAction).mode, 'confirm');

const reversibleWriteAction = createAgentActionRequest('execute-desktop-input', {
  label: 'click target',
  requiresDesktopMode: true,
  reversible: true,
  userInitiated: true,
});
assert.equal(evaluateAgentToolAction(reversibleWriteAction).mode, 'confirm');

const blockedDesktopModeDecision = evaluateAgentToolAction(userReadAction, { desktopMode: false });
assert.equal(blockedDesktopModeDecision.allowed, false);
assert.equal(blockedDesktopModeDecision.mode, 'blocked');

const destructiveAction: AgentToolActionRequest = {
  kind: 'trash-local-path',
  label: 'synthetic destructive policy check',
  risk: 'destructive',
  userInitiated: true,
};
const destructiveDecision = evaluateAgentToolAction(destructiveAction);
assert.equal(destructiveDecision.allowed, false);
assert.equal(destructiveDecision.mode, 'blocked');

const readRoute = buildAgentPermissionRoute(createToolCommand('execute_desktop_observation', {
  action: 'get_system_info',
}));
assert.equal(readRoute.status, 'silent');
assert.equal(readRoute.maxRisk, 'read');
assert.equal(shouldRequestAgentPermissionRouteApproval(readRoute), false);
assert.equal(isAgentPermissionRouteSilentReadOnly(readRoute), true);

const visualRoute = buildAgentPermissionRoute(createToolCommand('execute_desktop_observation', {
  action: 'summarize_visual_snapshot',
}));
assert.equal(visualRoute.status, 'notify');
assert.equal(visualRoute.maxRisk, 'visual');
assert.equal(visualRoute.requiresApproval, false);
assert.equal(isAgentPermissionRouteSilentReadOnly(visualRoute), false);

const desktopInputRoute = buildAgentPermissionRoute(createToolCommand('execute_desktop_input', {
  action: 'click',
  x: 120,
  y: 240,
}));
assert.equal(desktopInputRoute.status, 'needs-approval');
assert.equal(desktopInputRoute.maxRisk, 'reversible-write');
assert.equal(shouldRequestAgentPermissionRouteApproval(desktopInputRoute), true);

const projectRunRoute = buildAgentPermissionRoute(createToolCommand('run_local_project_action', {
  actionIndex: 0,
  path: projectRoot,
}, 'local-project-inspector'));
assert.equal(projectRunRoute.routeMode, 'developer');
assert.equal(projectRunRoute.status, 'needs-approval');
assert.equal(projectRunRoute.maxRisk, 'launch');

assert.match(statusText, /Permission-policy audit.*Completed/u);
assert.match(statusText, /PROJECT_AGENT_PERMISSION_POLICY_AUDIT\.md/u);

console.log('agent permission policy audit smoke ok');
