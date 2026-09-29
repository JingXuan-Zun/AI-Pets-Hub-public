import assert from 'node:assert/strict';
import {
  buildAgentPermissionRoute,
  isAgentPermissionRouteAutoContinuableObservation,
  isAgentPermissionRouteSilentReadOnly,
  type AgentChatCommand,
} from '../src/agent/index.ts';
import {
  AGENT_CORE_TASK_STEP_MAX_AUTO_RUNS,
  createAgentCorePlan,
  executeAgentCoreRunLoop,
  shouldRequestAgentCoreApproval,
} from '../src/agent/agentLegacy.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  controllerSource,
  coreSource,
} = readProjectSources({
  controllerSource: 'src/components/chat/agentRunController.ts',
  coreSource: 'src/agent/agentCore.ts',
});

assert.match(
  coreSource,
  /export const AGENT_CORE_TASK_STEP_MAX_AUTO_RUNS = 3/u,
  'Agent Core should cap automatic planner step scheduling',
);

assert.match(
  coreSource,
  /function createPlannerStepRoute\([\s\S]*buildAgentPermissionRoute\(command\)[\s\S]*function executeAgentCorePlannerStepSchedule/u,
  'Agent Core should route planner steps through the permission router before scheduling',
);

assert.match(
  coreSource,
  /executeAgentCorePlannerStepSchedule[\s\S]*isAgentPermissionRouteAutoContinuableObservation\(route\.route\)[\s\S]*createPlannerStepApprovalPause/u,
  'Planner scheduler should auto-run non-interactive observation steps and pause at approval steps',
);

assert.match(
  coreSource,
  /approved\?: boolean[\s\S]*corePlan\.requiresApproval && !approved[\s\S]*hasRunnablePlannerStepBeforeApproval/u,
  'Agent run loop should guard unapproved risky commands unless there is a read-only planner step to run first',
);

assert.match(
  controllerSource,
  /runAgentSessionV2\([\s\S]*approvedToolResult/u,
  'Approved AgentSessionV2 requests should resume with the approved tool result',
);

assert.doesNotMatch(
  controllerSource,
  /executeAgentCoreRunLoop|createAgentCorePlan/u,
  'Approved Agent requests should not use the old Agent Core loop in the controller',
);

function createPlannerCommand(steps: NonNullable<AgentChatCommand['plannerSteps']>): AgentChatCommand {
  const selectedStep = steps[steps.length - 1] ?? steps[0];
  assert.ok(selectedStep);
  return {
    capabilityId: selectedStep.tool === 'launch_local_app' ? 'app-launcher' : 'system-inspector',
    instruction: 'planner controlled scheduling smoke',
    kind: 'tool-call',
    plannerSteps: steps,
    sourceText: '/agent planner controlled scheduling smoke',
    toolCall: {
      goal: 'planner controlled scheduling smoke',
      input: selectedStep.args,
      name: selectedStep.tool,
    },
  };
}

const readOnlyCommand = createPlannerCommand([
  {
    args: {},
    index: 1,
    phase: 'observe',
    reason: 'read displays first',
    tool: 'get_display_info',
  },
  {
    args: {
      includeDisplays: false,
    },
    index: 2,
    phase: 'observe',
    reason: 'read system info second',
    tool: 'get_system_info',
  },
]);

const readOnlyCorePlan = createAgentCorePlan(readOnlyCommand);
assert.equal(shouldRequestAgentCoreApproval(readOnlyCorePlan), false);
assert.equal(
  isAgentPermissionRouteSilentReadOnly(buildAgentPermissionRoute({
    capabilityId: 'system-inspector',
    instruction: 'read displays',
    kind: 'tool-call',
    sourceText: 'read displays',
    toolCall: {
      input: {},
      name: 'get_display_info',
    },
  })),
  true,
);

const readOnlyCalls: string[] = [];
const readOnlyResult = await executeAgentCoreRunLoop({
  command: readOnlyCommand,
  corePlan: readOnlyCorePlan,
  onAgentChatCommand: async (command) => {
    const toolName = command.toolCall?.name ?? command.kind;
    readOnlyCalls.push(toolName);
    return {
      observations: [`called ${toolName}`],
      ok: true,
      responseText: `ok ${toolName}`,
      stateSummary: {
        observedState: [`called ${toolName}`],
        structuredEvidence: {
          status: 'success',
          targetMatched: toolName,
        },
        verificationEvidence: [`called ${toolName}`],
      },
      verification: `verified ${toolName}`,
    };
  },
});

assert.deepEqual(readOnlyCalls, ['get_display_info', 'get_system_info']);
assert.equal(readOnlyResult.pause, null);
assert.equal(readOnlyResult.finalCommand.toolCall?.name, 'get_system_info');
assert.equal(readOnlyResult.rounds.length, 2);
assert.equal(readOnlyResult.rounds[0]?.status, 'completed');
assert.equal(readOnlyResult.rounds[1]?.status, 'completed');

const readThenLaunchCommand = createPlannerCommand([
  {
    args: {},
    index: 1,
    phase: 'observe',
    reason: 'read display info before launching app',
    tool: 'get_display_info',
  },
  {
    args: {
      query: 'browser',
    },
    index: 2,
    phase: 'execute',
    reason: 'launch requested app after observation',
    tool: 'launch_local_app',
  },
]);

const readThenLaunchCorePlan = createAgentCorePlan(readThenLaunchCommand);
assert.equal(readThenLaunchCorePlan.requiresApproval, true);
assert.equal(
  shouldRequestAgentCoreApproval(readThenLaunchCorePlan),
  false,
  'Initial approval should not block the preceding read-only planner step',
);
assert.equal(
  isAgentPermissionRouteSilentReadOnly(buildAgentPermissionRoute({
    capabilityId: 'app-launcher',
    instruction: 'launch browser',
    kind: 'tool-call',
    sourceText: 'launch browser',
    toolCall: {
      input: {
        query: 'browser',
      },
      name: 'launch_local_app',
    },
  })),
  false,
);

const readThenLaunchCalls: string[] = [];
const readThenLaunchResult = await executeAgentCoreRunLoop({
  command: readThenLaunchCommand,
  corePlan: readThenLaunchCorePlan,
  onAgentChatCommand: async (command) => {
    const toolName = command.toolCall?.name ?? command.kind;
    readThenLaunchCalls.push(toolName);
    return {
      observations: [`called ${toolName}`],
      ok: true,
      responseText: `ok ${toolName}`,
      stateSummary: {
        observedState: [`called ${toolName}`],
        structuredEvidence: {
          status: 'success',
          targetMatched: toolName,
        },
        verificationEvidence: [`called ${toolName}`],
      },
      verification: `verified ${toolName}`,
    };
  },
});

assert.deepEqual(readThenLaunchCalls, ['get_display_info']);
assert.equal(readThenLaunchResult.pause?.action.command.toolCall?.name, 'launch_local_app');
assert.equal(readThenLaunchResult.rounds.length, 1);
assert.equal(readThenLaunchResult.rounds[0]?.status, 'awaiting-approval');

const observeLocateThenClickCommand = createPlannerCommand([
  {
    args: {
      forceRefresh: true,
      includeActiveWindow: true,
      includeRunningApps: true,
    },
    index: 1,
    phase: 'observe',
    reason: 'observe WeGame before locating login',
    tool: 'observe_windows_and_apps',
  },
  {
    args: {
      action: 'locate_element',
      sourceQuery: 'WeGame',
      sourceType: 'window',
      targetText: '登录',
    },
    index: 2,
    phase: 'observe',
    reason: 'locate the login button without user interruption',
    tool: 'locate_screen_elements',
  },
  {
    args: {
      action: 'click',
      button: 'left',
      clickCount: 1,
      x: 1280,
      y: 831,
    },
    index: 3,
    phase: 'execute',
    reason: 'click the located login button',
    tool: 'execute_desktop_input',
  },
]);
const observeLocateThenClickPlan = createAgentCorePlan(observeLocateThenClickCommand);
const observeLocateThenClickRoutes = observeLocateThenClickCommand.plannerSteps?.map((step) => buildAgentPermissionRoute({
  capabilityId: observeLocateThenClickCommand.capabilityId,
  instruction: step.reason ?? step.tool,
  kind: 'tool-call',
  sourceText: observeLocateThenClickCommand.sourceText,
  toolCall: {
    goal: step.reason,
    input: step.args,
    name: step.tool,
  },
})) ?? [];
assert.equal(isAgentPermissionRouteAutoContinuableObservation(observeLocateThenClickRoutes[0]!), true);
assert.equal(isAgentPermissionRouteAutoContinuableObservation(observeLocateThenClickRoutes[1]!), true);
assert.equal(isAgentPermissionRouteSilentReadOnly(observeLocateThenClickRoutes[1]!), false);
assert.equal(isAgentPermissionRouteAutoContinuableObservation(observeLocateThenClickRoutes[2]!), false);

const observeLocateThenClickCalls: string[] = [];
const observeLocateThenClickResult = await executeAgentCoreRunLoop({
  command: observeLocateThenClickCommand,
  corePlan: observeLocateThenClickPlan,
  onAgentChatCommand: async (command) => {
    const toolName = command.toolCall?.name ?? command.kind;
    observeLocateThenClickCalls.push(toolName);
    return {
      observations: [`called ${toolName}`],
      ok: true,
      responseText: `ok ${toolName}`,
      stateSummary: {
        observedState: [`called ${toolName}`],
        structuredEvidence: {
          confidence: 'high',
          coordinateAuditStatus: toolName === 'locate_screen_elements' ? 'coordinate_ok' : null,
          elementCenter: toolName === 'locate_screen_elements'
            ? { coordinateSpace: 'native-screen', x: 1280, y: 831 }
            : null,
          primaryAction: toolName === 'locate_screen_elements' ? 'click login' : null,
          status: 'success',
          targetMatched: toolName,
          visualActionReadiness: toolName === 'locate_screen_elements' ? 'ready' : null,
        },
        verificationEvidence: [`called ${toolName}`],
      },
      verification: `verified ${toolName}`,
    };
  },
});

assert.deepEqual(observeLocateThenClickCalls, ['observe_windows_and_apps', 'locate_screen_elements']);
assert.equal(observeLocateThenClickResult.pause?.action.command.toolCall?.name, 'execute_desktop_input');
assert.equal(observeLocateThenClickResult.rounds.length, 2);
assert.equal(observeLocateThenClickResult.rounds[0]?.status, 'completed');
assert.equal(observeLocateThenClickResult.rounds[1]?.status, 'awaiting-approval');

const directLaunchCommand: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: 'launch browser directly',
  kind: 'tool-call',
  sourceText: '/agent launch browser directly',
  toolCall: {
    goal: 'launch browser directly',
    input: {
      query: 'browser',
    },
    name: 'launch_local_app',
  },
};

const directLaunchCorePlan = createAgentCorePlan(directLaunchCommand);
assert.equal(shouldRequestAgentCoreApproval(directLaunchCorePlan), true);

let directLaunchCallCount = 0;
const directLaunchPausedResult = await executeAgentCoreRunLoop({
  command: directLaunchCommand,
  corePlan: directLaunchCorePlan,
  onAgentChatCommand: async () => {
    directLaunchCallCount += 1;
    return {
      ok: true,
      responseText: 'should not run without approval',
      verification: 'should not run without approval',
    };
  },
});

assert.equal(directLaunchCallCount, 0);
assert.equal(directLaunchPausedResult.pause?.action.command.toolCall?.name, 'launch_local_app');

const directLaunchApprovedResult = await executeAgentCoreRunLoop({
  approved: true,
  command: directLaunchCommand,
  corePlan: directLaunchCorePlan,
  onAgentChatCommand: async (command) => {
    directLaunchCallCount += 1;
    return {
      observations: [`approved ${command.toolCall?.name}`],
      ok: true,
      responseText: 'approved launch ran',
      verification: 'approved launch verified',
    };
  },
});

assert.equal(directLaunchCallCount, 1);
assert.equal(directLaunchApprovedResult.pause, null);
assert.equal(directLaunchApprovedResult.rounds.length, 1);
assert.equal(AGENT_CORE_TASK_STEP_MAX_AUTO_RUNS, 3);

console.log('agent core v1.2 controlled scheduler smoke ok');
