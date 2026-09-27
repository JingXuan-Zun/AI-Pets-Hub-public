import assert from 'node:assert/strict';
import {
  AGENT_TOOL_INPUT_PARAM_SPECS,
  buildAgentPermissionRoute,
  executeAgentChatCommand,
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
import { readProjectFile } from './smokeTestHarness.ts';

const toolName = 'analyze_game_screen' satisfies AgentToolCallName;
const loopToolName = 'manage_game_companion_loop' satisfies AgentToolCallName;

function createGameToolCommand(input: Record<string, unknown> = {}): AgentChatCommand {
  return {
    capabilityId: 'game-companion',
    instruction: 'test game screen analysis',
    kind: 'tool-call',
    sourceText: '/agent analyze my current game screen',
    toolCall: {
      goal: 'test game screen analysis',
      input,
      name: toolName,
    },
  };
}

function createGameLoopToolCommand(input: Record<string, unknown> = {}): AgentChatCommand {
  return {
    capabilityId: 'game-companion',
    instruction: 'test game companion loop',
    kind: 'tool-call',
    sourceText: '/agent keep watching my game and comment sometimes',
    toolCall: {
      goal: 'test game companion loop',
      input,
      name: loopToolName,
    },
  };
}

const registeredTools = new Set(listAgentToolNames());
assert.equal(registeredTools.has(toolName), true, 'analyze_game_screen should be registered');
assert.equal(registeredTools.has(loopToolName), true, 'manage_game_companion_loop should be registered');
assert.equal(isAgentToolAvailableInMode(toolName, 'agent'), true, 'analyze_game_screen should be available in Agent mode');
assert.equal(isAgentToolAvailableInMode(loopToolName, 'agent'), true, 'manage_game_companion_loop should be available in Agent mode');
assert.equal(isAgentToolAvailableInMode(toolName, 'developer'), false, 'analyze_game_screen should stay out of Developer mode');
assert.equal(isAgentToolAvailableInMode(loopToolName, 'developer'), false, 'manage_game_companion_loop should stay out of Developer mode');
assert.deepEqual(listRegisteredAgentToolNamesOutsideModePolicies(), []);

const lifecycle = getAgentToolLifecycleMetadata(toolName);
assert.deepEqual(lifecycle.mutates, []);
assert.equal(lifecycle.observes.includes('game-content-analysis'), true);
assert.equal(lifecycle.observes.includes('game-screen-thumbnail'), true);
assert.equal(lifecycle.verifies.includes('game-content-analysis'), true);

const schema = AGENT_TOOL_INPUT_PARAM_SPECS[toolName];
assert.equal(schema.some((spec) => spec.key === 'sourceType'), true);
assert.equal(schema.some((spec) => spec.key === 'sourceId'), true);
assert.equal(schema.some((spec) => spec.key === 'query'), true);
assert.equal(schema.some((spec) => spec.key === 'question'), true);
assert.equal(schema.some((spec) => spec.key === 'gameHint'), true);
assert.equal(schema.some((spec) => spec.key === 'focus'), true);
assert.equal(schema.some((spec) => spec.key === 'forceRefresh'), true);

const loopSchema = AGENT_TOOL_INPUT_PARAM_SPECS[loopToolName];
assert.equal(loopSchema.some((spec) => spec.key === 'action' && spec.required), true);
assert.equal(loopSchema.some((spec) => spec.key === 'intervalMs'), true);
assert.equal(loopSchema.some((spec) => spec.key === 'minCommentIntervalMs'), true);
assert.equal(loopSchema.some((spec) => spec.key === 'maxSamples'), true);

const route = buildAgentPermissionRoute(createGameToolCommand({
  focus: 'HUD and player situation',
  question: 'What is happening in the game?',
  sourceType: 'window',
}));
assert.equal(route.status, 'notify');
assert.equal(route.routeMode, 'agent');
assert.equal(route.maxRisk, 'visual');
assert.equal(route.requiresApproval, false);
assert.equal(isAgentPermissionRouteSilentReadOnly(route), false);
assert.equal(route.plan?.steps.some((step) => step.action.kind === 'observe-game-window'), true);

const loopRoute = buildAgentPermissionRoute(createGameLoopToolCommand({
  action: 'start',
  intervalMs: 8000,
  sourceType: 'window',
}));
assert.equal(loopRoute.status, 'notify');
assert.equal(loopRoute.routeMode, 'agent');
assert.equal(loopRoute.maxRisk, 'visual');
assert.equal(loopRoute.requiresApproval, false);
assert.equal(isAgentPermissionRouteSilentReadOnly(loopRoute), false);
assert.equal(loopRoute.plan?.steps.some((step) => step.action.kind === 'manage-game-companion-loop'), true);

const chatCommandSource = readProjectFile('src/agent/agentChatCommand.ts');
const registrySource = readProjectFile('src/agent/agentToolRegistry.ts');
const schemaSource = readProjectFile('src/agent/agentToolInputSchema.ts');
const modeSource = readProjectFile('src/agent/agentModeRouter.ts');
const orchestratorSource = readProjectFile('src/agent/agentOrchestrator.ts');
const sessionSource = readProjectFile('src/agent/agentProductionSessionImplementation.ts');
const runtimeSource = readProjectFile('src/agent/agentRuntimeExecutor.ts');
const visualRuntimeSource = readProjectFile('src/agent/agentRuntimeVisualTools.ts');
const serviceSource = readProjectFile('src/services/geminiService.ts');
const visualSnapshotServiceSource = readProjectFile('src/services/agentVisualSnapshotService.ts');
const coreSource = readProjectFile('src/agent/agentCore.ts');

for (const source of [
  chatCommandSource,
  registrySource,
  schemaSource,
  modeSource,
  orchestratorSource,
  sessionSource,
  runtimeSource,
  coreSource,
]) {
  assert.match(source, /analyze_game_screen/u);
  assert.match(source, /manage_game_companion_loop/u);
}

assert.match(registrySource, /observe-game-window/u);
assert.match(runtimeSource, /executeAnalyzeGameScreen/u);
assert.match(runtimeSource, /executeManageGameCompanionLoop/u);
assert.match(visualRuntimeSource, /executeAnalyzeGameScreen/u);
assert.match(visualRuntimeSource, /executeManageGameCompanionLoop/u);
assert.match(visualRuntimeSource, /selectGameScreenSource/u);
assert.match(visualRuntimeSource, /analyzeAgentGameSnapshot/u);
assert.match(serviceSource, /analyzeAgentGameSnapshot/u);
assert.match(visualSnapshotServiceSource, /analyzeAgentGameSnapshot/u);
assert.match(visualSnapshotServiceSource, /visible gameplay content/u);
assert.match(visualSnapshotServiceSource, /HUD/u);
assert.match(sessionSource, /manage_game_companion_loop/u);

const settings = {} as PetConfig['settings'];
const loopStartOptions: unknown[] = [];
const loopStatusResult = await executeAgentChatCommand(createGameLoopToolCommand({
  action: 'status',
}), {
  configRef: { current: { settings } },
  desktopOrganizationRef: { current: null },
  gameCompanionLoopControllerRef: {
    current: {
      start: (options) => {
        loopStartOptions.push(options);
        return {
          ok: true,
          responseText: 'loop started',
          verification: 'started',
        };
      },
      status: () => ({
        ok: true,
        responseText: 'loop stopped',
        verification: 'status',
      }),
      stop: () => ({
        ok: true,
        responseText: 'loop stopped',
        verification: 'stopped',
      }),
    },
  },
  lastDesktopOrganizationPlanRef: { current: null },
  lastLocalProjectInspectionRef: { current: null },
  onUpdateConfig: () => undefined,
  startDesktopIconPlacementRef: { current: null },
} as any);
assert.equal(loopStatusResult.responseText, 'loop stopped');

const loopStartResult = await executeAgentChatCommand(createGameLoopToolCommand({
  action: 'start',
  intervalMs: 9000,
  maxSamples: 12,
  query: 'Example Game',
  sourceType: 'window',
}), {
  configRef: { current: { settings } },
  desktopOrganizationRef: { current: null },
  gameCompanionLoopControllerRef: {
    current: {
      start: (options) => {
        loopStartOptions.push(options);
        return {
          ok: true,
          responseText: 'loop started',
          verification: 'started',
        };
      },
      status: () => ({
        ok: true,
        responseText: 'loop status',
        verification: 'status',
      }),
      stop: () => ({
        ok: true,
        responseText: 'loop stopped',
        verification: 'stopped',
      }),
    },
  },
  lastDesktopOrganizationPlanRef: { current: null },
  lastLocalProjectInspectionRef: { current: null },
  onUpdateConfig: () => undefined,
  startDesktopIconPlacementRef: { current: null },
} as any);
assert.equal(loopStartResult.responseText, 'loop started');
assert.deepEqual(loopStartOptions[0], {
  focus: '',
  gameHint: '',
  intervalMs: 9000,
  maxSamples: 12,
  minCommentIntervalMs: undefined,
  query: 'Example Game',
  sourceId: '',
  sourceType: 'window',
});

let modelCallCount = 0;
const sessionResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async ({ systemInstruction, userInput }) => {
    modelCallCount += 1;
    assert.match(systemInstruction, /analyze_game_screen/u);
    assert.match(systemInstruction, /gameplay/u);

    if (modelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          focus: 'HUD and player situation',
          question: 'What is happening in the game?',
          sourceType: 'window',
        },
        reason: 'Need visual game-screen evidence before describing gameplay.',
        tool: toolName,
        understanding: {
          neededCapability: 'game screen visual analysis',
          successCriteria: 'visible game content is analyzed as evidence',
          userNeed: 'understand what is happening in the current game',
        },
      });
    }

    assert.match(userInput, /tool=analyze_game_screen/u);
    assert.match(userInput, /Game content analysis: likely action game/u);
    return JSON.stringify({
      action: 'final_answer',
      message: 'Game screen analysis observed and ready for companion response.',
      understanding: {
        successCriteria: 'game screen analysis was observed',
        userNeed: 'understand current gameplay content',
      },
    });
  },
  settings,
  sourceText: '/agent analyze my current game screen',
  toolExecutor: async (command) => {
    assert.equal(command.capabilityId, 'game-companion');
    assert.equal(command.toolCall?.name, toolName);
    assert.equal(command.toolCall?.input.sourceType, 'window');
    return {
      observations: [
        'Selected game source: [window] Example Game 1920x1080',
        'Game content analysis: likely action game; visible HUD and player in combat',
      ],
      ok: true,
      responseText: 'Game source: [window] Example Game 1920x1080\nlikely action game; visible HUD and player in combat',
      verification: 'game analysis smoke',
    };
  },
  userGoal: 'analyze my current game screen',
});

assert.equal(sessionResult.status, 'completed');
assert.equal(sessionResult.toolResults.length, 1);
assert.equal(sessionResult.toolResults[0]?.command.toolCall?.name, toolName);
assert.equal(modelCallCount, 2);

console.log('agent game screen analysis tool smoke ok');
