import assert from 'node:assert/strict';
import {
  buildAgentPermissionRoute,
  listAgentToolNames,
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentToolCallName,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const expectedTools: AgentToolCallName[] = [
  'get_default_app_for_uri',
  'list_running_apps',
  'focus_window',
  'open_resource',
  'search_web',
];

const registeredTools = new Set(listAgentToolNames());
for (const toolName of expectedTools) {
  assert.equal(registeredTools.has(toolName), true, `${toolName} should be registered`);
}

function createToolCommand(
  name: AgentToolCallName,
  input: Record<string, unknown>,
): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: `test ${name}`,
    kind: 'tool-call',
    sourceText: `/agent test ${name}`,
    toolCall: {
      goal: `test ${name}`,
      input,
      name,
    },
  };
}

assert.equal(
  buildAgentPermissionRoute(createToolCommand('get_default_app_for_uri', { uriScheme: 'https' })).requiresApproval,
  false,
);
assert.equal(
  buildAgentPermissionRoute(createToolCommand('list_running_apps', { query: 'browser' })).requiresApproval,
  false,
);
assert.equal(
  buildAgentPermissionRoute(createToolCommand('focus_window', { query: 'browser' })).requiresApproval,
  true,
);
assert.equal(
  buildAgentPermissionRoute(createToolCommand('open_resource', { resourceType: 'url', target: 'github.com' })).requiresApproval,
  true,
);
assert.equal(
  buildAgentPermissionRoute(createToolCommand('search_web', { query: 'github desktop pet' })).requiresApproval,
  true,
);

const settings = {} as PetConfig['settings'];
const sessionResult = await runAgentProductionSession({
  modelCaller: async ({ systemInstruction }) => {
    assert.match(systemInstruction, /open_resource/u);
    assert.match(systemInstruction, /search_web/u);
    assert.match(systemInstruction, /list_running_apps/u);
    assert.match(systemInstruction, /For a direct URL\/domain/u);

    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'open_resource',
        resourceType: 'url',
        target: 'github.com',
      },
      reason: 'The user asked to open a direct domain, not search for it.',
      tool: 'execute_desktop_action',
      understanding: {
        neededCapability: 'open a URL with the OS default handler',
        successCriteria: 'github.com is opened directly',
        userNeed: 'open github.com',
      },
    });
  },
  settings,
  sourceText: '/agent open github.com',
  toolExecutor: async () => {
    throw new Error('open_resource should require approval before execution');
  },
  userGoal: 'open github.com',
});

assert.equal(sessionResult.status, 'needs-approval');
assert.equal(sessionResult.pendingApproval?.command.toolCall?.name, 'execute_desktop_action');
assert.equal(sessionResult.pendingApproval?.command.capabilityId, 'app-launcher');
assert.equal(sessionResult.pendingApproval?.command.toolCall?.input.action, 'open_resource');
assert.equal(sessionResult.pendingApproval?.command.toolCall?.input.target, 'github.com');

console.log('agent desktop atomic tools smoke ok');
