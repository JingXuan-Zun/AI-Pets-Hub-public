import assert from 'node:assert/strict';
import {
  buildAgentModeRoute,
  buildAgentPermissionRoute,
  isAgentToolAvailableInMode,
  listAgentModePolicies,
  listRegisteredAgentToolNamesOutsideModePolicies,
  type AgentChatCommand,
} from '../src/agent/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  modeRouterSource,
  permissionRouterSource,
  controllerSource,
} = readProjectSources({
  modeRouterSource: 'src/agent/agentModeRouter.ts',
  permissionRouterSource: 'src/agent/agentPermissionRouter.ts',
  controllerSource: 'src/components/chat/agentRunController.ts',
});

assert.match(
  modeRouterSource,
  /export interface AgentModePolicy[\s\S]*toolNames: AgentToolCallName\[\];[\s\S]*const AGENT_MODE_POLICIES/u,
  'Mode Router should expose explicit mode policies and tool availability',
);

assert.match(
  modeRouterSource,
  /export function buildAgentModeRoute\([\s\S]*resolveModeFromCommand\(command, plan\)[\s\S]*availableToolNames/u,
  'Mode Router should build structured mode routes from command and plan',
);

assert.match(
  permissionRouterSource,
  /const modeRoute = buildAgentModeRoute\(command, plan\)[\s\S]*const routeMode = modeRoute\.mode/u,
  'Permission Router should derive routeMode from Agent Mode Router',
);

assert.match(
  controllerSource,
  /runAgentSessionV2\(/u,
  'Agent run controller should route new Agent requests through AgentSessionV2',
);

assert.doesNotMatch(
  controllerSource,
  /executeAgentCoreRunLoop|createAgentCorePlan/u,
  'Agent run controller should not wire the old Agent Core loop as the active entry path',
);

const chatCommand: AgentChatCommand = {
  instruction: 'normal chat',
  kind: 'unsupported',
  sourceText: 'normal chat',
};
const chatRoute = buildAgentModeRoute(chatCommand, null);
assert.equal(chatRoute.mode, 'chat');
assert.deepEqual(chatRoute.availableToolNames, []);

const displayCommand: AgentChatCommand = {
  capabilityId: 'system-inspector',
  instruction: 'read display info',
  kind: 'tool-call',
  sourceText: 'screen info',
  toolCall: {
    input: {},
    name: 'get_display_info',
  },
};
const displayPermissionRoute = buildAgentPermissionRoute(displayCommand);
assert.equal(displayPermissionRoute.routeMode, 'agent');
assert.equal(displayPermissionRoute.modeRoute.mode, 'agent');
assert.equal(displayPermissionRoute.modeRoute.availableToolNames.includes('get_display_info'), true);
assert.equal(isAgentToolAvailableInMode('get_display_info', 'agent'), true);
assert.equal(isAgentToolAvailableInMode('inspect_local_project', 'agent'), false);

const projectCommand: AgentChatCommand = {
  capabilityId: 'local-project-inspector',
  instruction: 'inspect local project',
  kind: 'tool-call',
  sourceText: 'inspect D:\\Project',
  toolCall: {
    input: {
      path: 'D:\\Project',
    },
    name: 'inspect_local_project',
  },
};
const projectPermissionRoute = buildAgentPermissionRoute(projectCommand);
assert.equal(projectPermissionRoute.routeMode, 'developer');
assert.equal(projectPermissionRoute.modeRoute.mode, 'developer');
assert.equal(projectPermissionRoute.modeRoute.availableToolNames.includes('inspect_local_project'), true);
assert.equal(projectPermissionRoute.modeRoute.availableToolNames.includes('launch_local_app'), false);

assert.deepEqual(listRegisteredAgentToolNamesOutsideModePolicies(), []);
assert.equal(listAgentModePolicies().length, 3);

console.log('agent mode router v1 smoke ok');
