import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  AGENT_TOOL_INPUT_PARAM_SPECS,
  buildAgentPermissionRoute,
  getAgentToolLifecycleMetadata,
  isAgentPermissionRouteSilentReadOnly,
  isAgentToolAvailableInMode,
  listAgentToolNames,
  listRegisteredAgentToolNamesOutsideModePolicies,
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentToolCallName,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const require = createRequire(import.meta.url);
const { createLocalFileSystemService } = require('../electron/localFileSystemService.cjs') as {
  createLocalFileSystemService: () => {
    executeFileManagementAction: (request: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
};

const toolName = 'execute_file_management_action' satisfies AgentToolCallName;

function createToolCommand(input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: 'local-file-system',
    instruction: 'test execute_file_management_action',
    kind: 'tool-call',
    sourceText: '/agent test execute_file_management_action',
    toolCall: {
      goal: 'test execute_file_management_action',
      input,
      name: toolName,
    },
  };
}

const registeredTools = new Set(listAgentToolNames());
assert.equal(registeredTools.has(toolName), true);
assert.equal(isAgentToolAvailableInMode(toolName, 'agent'), true);
assert.equal(isAgentToolAvailableInMode(toolName, 'developer'), false);
assert.deepEqual(listRegisteredAgentToolNamesOutsideModePolicies(), []);

const lifecycle = getAgentToolLifecycleMetadata(toolName);
assert.equal(lifecycle.mutates.includes('local-file-system-paths'), true);
assert.equal(lifecycle.observes.includes('file-management-preview'), true);
assert.equal(lifecycle.verifies.includes('file-management-action-result'), true);

const schema = AGENT_TOOL_INPUT_PARAM_SPECS[toolName];
const actionSpec = schema.find((spec) => spec.key === 'action');
for (const action of ['preview', 'move_path', 'copy_path', 'rename_path', 'create_directory', 'trash_path', 'organize_desktop_files']) {
  assert.equal(actionSpec?.enumValues?.includes(action), true);
}

const sourcePath = path.join(projectRoot, 'tmp-source.txt');
const targetPath = path.join(projectRoot, 'tmp-target.txt');
const previewRoute = buildAgentPermissionRoute(createToolCommand({
  action: 'preview',
  destinationPath: targetPath,
  intendedAction: 'move_path',
  sourcePath,
}));
assert.equal(previewRoute.status, 'silent');
assert.equal(previewRoute.maxRisk, 'read');
assert.equal(previewRoute.requiresApproval, false);
assert.equal(isAgentPermissionRouteSilentReadOnly(previewRoute), true);

const moveRoute = buildAgentPermissionRoute(createToolCommand({
  action: 'move_path',
  destinationPath: targetPath,
  sourcePath,
}));
assert.equal(moveRoute.requiresApproval, true);
assert.equal(moveRoute.maxRisk, 'reversible-write');

const tempRoot = path.join(projectRoot, '.agent-file-management-smoke-temp');
rmSync(tempRoot, { force: true, recursive: true });
mkdirSync(tempRoot, { recursive: true });
try {
  const service = createLocalFileSystemService();
  const file = path.join(tempRoot, 'source.txt');
  const dir = path.join(tempRoot, 'created');
  writeFileSync(file, 'hello', 'utf8');

  const previewResult = await service.executeFileManagementAction({
    action: 'preview',
    destinationPath: path.join(tempRoot, 'target.txt'),
    intendedAction: 'move_path',
    sourcePath: file,
  });
  assert.equal(previewResult.ok, true);
  assert.equal(previewResult.dryRun, true);
  assert.equal(existsSync(file), true);

  const createResult = await service.executeFileManagementAction({
    action: 'create_directory',
    destinationPath: dir,
  });
  assert.equal(createResult.ok, true);
  assert.equal(existsSync(dir), true);
} finally {
  rmSync(tempRoot, { force: true, recursive: true });
}

const {
  localFileToolsSource,
  registrySource,
  runtimeSource,
  sessionSource,
} = readProjectSources({
  localFileToolsSource: 'src/agent/agentRuntimeLocalFileTools.ts',
  registrySource: 'src/agent/agentToolRegistry.ts',
  runtimeSource: 'src/agent/agentRuntimeExecutor.ts',
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
});

assert.match(registrySource, /name: 'execute_file_management_action'/u);
assert.match(runtimeSource, /execute_file_management_action: \(\{ toolCall \}\) => executeFileManagementAction\(toolCall\)/u);
assert.match(localFileToolsSource, /export async function executeFileManagementAction/u);
assert.match(localFileToolsSource, /File management action requested:/u);
assert.match(sessionSource, /execute_file_management_action/u);
assert.match(sessionSource, /organize_desktop_files/u);

const settings = {} as PetConfig['settings'];
let modelCallCount = 0;
const sessionResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async ({ systemInstruction, userInput }) => {
    modelCallCount += 1;
    assert.match(systemInstruction, /execute_file_management_action/u);

    if (modelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'preview',
          destinationPath: targetPath,
          intendedAction: 'move_path',
          sourcePath,
        },
        reason: 'Preview the file move before changing local files.',
        tool: toolName,
      });
    }

    assert.match(userInput, /tool=execute_file_management_action/u);
    assert.match(userInput, /Preview ready/u);
    return JSON.stringify({
      action: 'final_answer',
      message: 'Preview ready; I will wait for approval before moving files.',
    });
  },
  settings,
  sourceText: '/agent preview moving a file',
  toolExecutor: async (command) => {
    assert.equal(command.toolCall?.name, toolName);
    assert.equal(command.toolCall?.input.action, 'preview');
    return {
      observations: ['File management action requested: preview'],
      ok: true,
      responseText: 'Preview ready: move.',
      verification: 'Preview only; no local files were changed.',
    };
  },
  userGoal: 'preview moving a file',
});

assert.equal(sessionResult.status, 'completed');
assert.equal(sessionResult.toolResults.length, 1);

console.log('agent execute file management action tool smoke ok');
