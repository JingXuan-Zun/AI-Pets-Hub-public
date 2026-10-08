import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
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
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

const require = createRequire(import.meta.url);

const expectedTools: AgentToolCallName[] = [
  'get_path_info',
  'list_directory',
  'search_files',
  'read_text_file',
];

const actionKindByTool: Record<(typeof expectedTools)[number], string> = {
  get_path_info: 'get-path-info',
  list_directory: 'list-directory',
  read_text_file: 'read-text-file',
  search_files: 'search-files',
};

const bridgeMethodByTool: Record<(typeof expectedTools)[number], string> = {
  get_path_info: 'getPathInfo',
  list_directory: 'listDirectory',
  read_text_file: 'readTextFile',
  search_files: 'searchFiles',
};

function createToolCommand(
  name: AgentToolCallName,
  input: Record<string, unknown>,
): AgentChatCommand {
  return {
    capabilityId: 'local-file-system',
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

const registeredTools = new Set(listAgentToolNames());
for (const toolName of expectedTools) {
  assert.equal(registeredTools.has(toolName), true, `${toolName} should be registered`);
  assert.equal(isAgentToolAvailableInMode(toolName, 'agent'), true, `${toolName} should be available in Agent mode`);
  assert.equal(isAgentToolAvailableInMode(toolName, 'developer'), true, `${toolName} should be available in Developer mode`);
  assert.equal(getAgentToolLifecycleMetadata(toolName).mutates.length, 0, `${toolName} should be read-only lifecycle`);
  assert.equal(AGENT_TOOL_INPUT_PARAM_SPECS[toolName].some((spec) => spec.key === 'path'), true, `${toolName} should accept a path`);
}

assert.deepEqual(listRegisteredAgentToolNamesOutsideModePolicies(), []);
assert.equal(
  AGENT_TOOL_INPUT_PARAM_SPECS.search_files.some((spec) => spec.key === 'query' && spec.required),
  true,
  'search_files should require a filename query',
);

const routeInputs: Record<(typeof expectedTools)[number], Record<string, unknown>> = {
  get_path_info: {
    path: projectRoot,
  },
  list_directory: {
    path: projectRoot,
  },
  read_text_file: {
    path: path.join(projectRoot, 'package.json'),
  },
  search_files: {
    path: projectRoot,
    query: 'package',
  },
};

for (const toolName of expectedTools) {
  const route = buildAgentPermissionRoute(createToolCommand(toolName, routeInputs[toolName]));
  assert.equal(route.status, 'silent', `${toolName} should run silently as read-only`);
  assert.equal(route.routeMode, 'agent', `${toolName} should route through Agent mode`);
  assert.equal(route.maxRisk, 'read', `${toolName} max risk should be read`);
  assert.equal(isAgentPermissionRouteSilentReadOnly(route), true, `${toolName} should be silent read-only`);
}

const capabilitySource = readProjectFile('src/agent/agentCapabilityTypes.ts');
const actionPolicySource = readProjectFile('src/agent/agentActionPolicy.ts');
const registrySource = readProjectFile('src/agent/agentToolRegistry.ts');
const orchestratorSource = readProjectFile('src/agent/agentOrchestrator.ts');
const sessionV2Source = readProjectFile('src/agent/agentProductionSessionImplementation.ts');
const runtimeSource = readProjectFile('src/agent/agentRuntimeExecutor.ts');
const localFileToolsSource = readProjectFile('src/agent/agentRuntimeLocalFileTools.ts');
const viteEnvSource = readProjectFile('src/vite-env.d.ts');
const desktopBridgeSource = readProjectFile('src/desktopShellBridge.ts');
const desktopRuntimeSource = readProjectFile('src/desktopShellRuntime.ts');
const ipcSource = readProjectFile('electron/ipcHandlers.cjs');
const preloadSource = readProjectFile('electron/preload.cjs');
const mainSource = readProjectFile('electron/main.cjs');
const serviceSource = readProjectFile('electron/localFileSystemService.cjs');

assert.match(registrySource, /capabilityId: 'local-file-system'/u);
assert.match(sessionV2Source, /local path[\s\S]*get_path_info/u);
assert.match(sessionV2Source, /read_text_file/u);
assert.match(runtimeSource, /from '.\/agentRuntimeLocalFileTools'/u);
assert.match(localFileToolsSource, /export async function executeGetPathInfo/u);
assert.match(localFileToolsSource, /export async function executeListDirectory/u);
assert.match(localFileToolsSource, /export async function executeSearchFiles/u);
assert.match(localFileToolsSource, /export async function executeReadTextFile/u);
assert.match(serviceSource, /function createLocalFileSystemService/u);
assert.match(mainSource, /createLocalFileSystemService/u);
assert.match(viteEnvSource, /DesktopPetPathInfoResultLike/u);
assert.match(viteEnvSource, /DesktopPetTextFileReadResultLike/u);

for (const toolName of expectedTools) {
  const actionKind = actionKindByTool[toolName];
  const bridgeMethod = bridgeMethodByTool[toolName];
  assert.match(capabilitySource, new RegExp(`'${actionKind}'`, 'u'), `${actionKind} should be typed`);
  assert.match(actionPolicySource, new RegExp(`'${actionKind}': 'read'`, 'u'), `${actionKind} should be read risk`);
  assert.match(orchestratorSource, new RegExp(`case '${toolName}'`, 'u'), `${toolName} should have a plan`);
  assert.match(runtimeSource, new RegExp(`${toolName}:`, 'u'), `${toolName} should have a runtime handler`);
  assert.match(ipcSource, new RegExp(`desktop-pet:${actionKind}`, 'u'), `${actionKind} should have IPC`);
  assert.match(preloadSource, new RegExp(`${bridgeMethod}:`, 'u'), `${bridgeMethod} should be exposed in preload`);
  assert.match(desktopBridgeSource, new RegExp(`${bridgeMethod}:`, 'u'), `${bridgeMethod} should be bridged`);
  assert.match(desktopRuntimeSource, new RegExp(`${bridgeMethod}: desktopPetShellBridge\\.${bridgeMethod}`, 'u'), `${bridgeMethod} should be in runtime facade`);
}

const { createLocalFileSystemService } = require('../electron/localFileSystemService.cjs') as {
  createLocalFileSystemService: () => {
    getPathInfo: (request: Record<string, unknown>) => DesktopPetPathInfoResultLike;
    listDirectory: (request: Record<string, unknown>) => DesktopPetDirectoryListResultLike;
    readTextFile: (request: Record<string, unknown>) => DesktopPetTextFileReadResultLike;
    searchFiles: (request: Record<string, unknown>) => DesktopPetFileSearchResultLike;
  };
};
const service = createLocalFileSystemService();
const rootInfo = service.getPathInfo({ path: projectRoot });
assert.equal(rootInfo.ok, true);
assert.equal(rootInfo.kind, 'directory');

const directoryList = service.listDirectory({ limit: 10, path: projectRoot });
assert.equal(directoryList.ok, true);
assert.ok((directoryList.entries ?? []).length > 0);

const fileSearch = service.searchFiles({
  maxDepth: 1,
  path: projectRoot,
  query: 'package',
});
assert.equal(fileSearch.ok, true);
assert.ok((fileSearch.matches ?? []).some((match) => match.name === 'package.json'));

const packageRead = service.readTextFile({
  maxBytes: 4096,
  path: path.join(projectRoot, 'package.json'),
});
assert.equal(packageRead.ok, true);
assert.match(packageRead.text ?? '', /"scripts"/u);

let modelCallCount = 0;
const settings = {} as PetConfig['settings'];
const sessionResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async ({ systemInstruction, userInput }) => {
    modelCallCount += 1;
    assert.match(systemInstruction, /get_path_info/u);
    assert.match(systemInstruction, /list_directory/u);
    assert.match(systemInstruction, /search_files/u);
    assert.match(systemInstruction, /read_text_file/u);
    // The final_answer contract must still demand verified, tool-backed evidence.
    assert.match(
      systemInstruction,
      /"action": "final_answer"[^\n]*"verificationStatus": "satisfied\|blocked", "verificationEvidence": \["concrete evidence from tool results"\]/u,
    );

    if (modelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'get_path_info',
          path: projectRoot,
        },
        reason: 'Need to observe the local path before answering.',
        tool: 'execute_local_file_action',
        understanding: {
          neededCapability: 'local file system observation',
          successCriteria: 'path metadata is observed from the local machine',
          userNeed: 'check a local path',
        },
      });
    }

    assert.match(userInput, /tool=execute_local_file_action/u);
    assert.match(userInput, /ok=true/u);
    return JSON.stringify({
      action: 'final_answer',
      message: 'Read-only local path tool evidence observed.',
      understanding: {
        successCriteria: 'tool result was observed',
        userNeed: 'check a local path',
      },
    });
  },
  settings,
  sourceText: `/agent 看看 ${projectRoot}`,
  toolExecutor: async (command) => {
    assert.equal(command.capabilityId, 'local-file-system');
    assert.equal(command.toolCall?.name, 'execute_local_file_action');
    assert.equal(command.toolCall?.input.action, 'get_path_info');
    return {
      ok: true,
      responseText: `路径存在：${projectRoot}`,
      verification: 'smoke verified path metadata',
    };
  },
  userGoal: `看看 ${projectRoot}`,
});

assert.equal(sessionResult.status, 'completed');
assert.equal(sessionResult.toolResults.length, 1);
assert.equal(sessionResult.toolResults[0]?.command.capabilityId, 'local-file-system');

console.log('agent local filesystem tools smoke ok');
