import assert from 'node:assert/strict';
import {
  buildAgentPermissionRoute,
  isAgentPermissionRouteSilentReadOnly,
  shouldRequestAgentPermissionRouteApproval,
  type AgentChatCommand,
} from '../src/agent/index.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const {
  routerSource,
  coreSource,
  controllerSource,
  runtimeSource,
} = readProjectSources({
  routerSource: 'src/agent/agentPermissionRouter.ts',
  coreSource: 'src/agent/agentCore.ts',
  controllerSource: 'src/components/chat/agentRunController.ts',
  runtimeSource: 'src/agent/agentRuntimeExecutor.ts',
});

assert.match(
  routerSource,
  /export function buildAgentPermissionRoute\([\s\S]*buildAgentExecutionPlan\(command\)[\s\S]*requiresApproval/u,
);
assert.match(
  coreSource,
  /const permissionRoute = buildAgentPermissionRoute\(command\)[\s\S]*const requiresApproval = shouldRequestAgentPermissionRouteApproval\(permissionRoute\)/u,
);
assert.match(
  controllerSource,
  /runAgentProductionRuntime\([\s\S]*createAgentApprovalMessage\(\{[\s\S]*agentRuntime: result\.continuation/u,
);
assert.match(
  runtimeSource,
  /const permissionRoute = buildAgentPermissionRoute\(command\)[\s\S]*const blockedStep = permissionRoute\.blockedStep/u,
);

const systemInfoCommand: AgentChatCommand = {
  capabilityId: 'system-inspector',
  instruction: 'read system info',
  kind: 'tool-call',
  sourceText: 'check system info',
  toolCall: {
    input: { includeDisplays: true },
    name: 'get_system_info',
  },
};
const systemInfoRoute = buildAgentPermissionRoute(systemInfoCommand);
assert.equal(systemInfoRoute.status, 'silent');
assert.equal(systemInfoRoute.routeMode, 'agent');
assert.equal(systemInfoRoute.maxRisk, 'read');
assert.equal(isAgentPermissionRouteSilentReadOnly(systemInfoRoute), true);
assert.equal(shouldRequestAgentPermissionRouteApproval(systemInfoRoute), false);

const appLaunchCommand: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: 'open browser',
  kind: 'tool-call',
  sourceText: 'open browser',
  toolCall: {
    input: { query: 'browser' },
    name: 'launch_local_app',
  },
};
const appLaunchRoute = buildAgentPermissionRoute(appLaunchCommand);
assert.equal(appLaunchRoute.status, 'needs-approval');
assert.equal(appLaunchRoute.maxRisk, 'launch');
assert.equal(shouldRequestAgentPermissionRouteApproval(appLaunchRoute), true);

const desktopPreviewCommand: AgentChatCommand = {
  capabilityId: 'desktop-organization',
  desktopOrganization: {
    displayTarget: 'secondary',
    mode: 'preview',
    scope: 'display-icons',
  },
  instruction: 'preview secondary desktop arrangement',
  kind: 'desktop-organization',
  sourceText: 'preview secondary desktop arrangement',
};
const desktopPreviewRoute = buildAgentPermissionRoute(desktopPreviewCommand);
assert.equal(desktopPreviewRoute.status, 'silent');
assert.equal(desktopPreviewRoute.maxRisk, 'read');
assert.equal(isAgentPermissionRouteSilentReadOnly(desktopPreviewRoute), true);

const desktopExecuteCommand: AgentChatCommand = {
  ...desktopPreviewCommand,
  desktopOrganization: {
    ...desktopPreviewCommand.desktopOrganization,
    mode: 'execute',
  },
  instruction: 'execute previous desktop arrangement',
  sourceText: 'execute previous desktop arrangement',
};
const desktopExecuteRoute = buildAgentPermissionRoute(desktopExecuteCommand);
assert.equal(desktopExecuteRoute.status, 'needs-approval');
assert.equal(desktopExecuteRoute.maxRisk, 'reversible-write');
assert.equal(shouldRequestAgentPermissionRouteApproval(desktopExecuteRoute), true);

const projectRunCommand: AgentChatCommand = {
  capabilityId: 'local-project-inspector',
  instruction: 'run project candidate',
  kind: 'tool-call',
  sourceText: 'run second candidate',
  toolCall: {
    input: {
      actionIndex: 2,
      path: projectRoot,
    },
    name: 'run_local_project_action',
  },
};
const projectRunRoute = buildAgentPermissionRoute(projectRunCommand);
assert.equal(projectRunRoute.status, 'needs-approval');
assert.equal(projectRunRoute.routeMode, 'developer');
assert.equal(projectRunRoute.maxRisk, 'launch');

console.log('agent permission router v1 smoke ok');
