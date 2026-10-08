import assert from 'node:assert/strict';
import {
  prepareAgentParallelToolCommands,
  type AgentChatCommand,
  type AgentDecisionToolInputResult,
  type AgentToolCallName,
} from '../src/agent/legacy/index.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  index: indexSource,
  preparation: preparationSource,
  runtimePreparation: runtimePreparationSource,
  session: sessionEntrySource,
  parallelPreparation: sessionSource,
} = readProjectSources({
  index: 'src/agent/legacy/index.ts',
  preparation: 'src/agent/runtime/agentParallelToolPreparation.ts',
  runtimePreparation: 'src/agent/runtime/agentParallelToolPreparation.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  parallelPreparation: 'src/agent/productionSession/parallelPreparation.ts',
});

assertSourceMatches(sessionEntrySource, /from '\.\/productionSession\/parallelPreparation'/u);
assertSourceMatches(sessionEntrySource, /createAgentProductionParallelPreparation\(\{/u);
assertSourceMatches(sessionEntrySource, /prepareParallelSelection\(decision, stepIndex\)/u);

assertSourceMatches(
  runtimePreparationSource,
  /export function prepareAgentParallelToolCommands/u,
  'Parallel tool preparation should be Runtime-owned.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\.\/runtime\/agentParallelToolPreparation'/u,
  'AgentSessionV2 should consume Runtime parallel preparation directly.',
);
assertSourceDoesNotMatch(
  runtimePreparationSource,
  /buildAgentPermissionRoute|createAgentSessionV2ToolCommand|createAgentSessionV2UnavailableToolRepairText|modelOutputRepairRuns|createAgentSessionV2FinalResult|executeAgentSessionV2ToolCommandWithCache/u,
  'Parallel preparation should not own permission routing implementation, command factory implementation, repair budget, final result policy, or tool execution.',
);

function createCommand(toolName: AgentToolCallName, args: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: 'parallel preparation smoke',
    kind: 'tool-call',
    sourceText: '/agent parallel preparation smoke',
    toolCall: {
      goal: 'parallel preparation smoke',
      input: args,
      name: toolName,
    },
  };
}

const allowedTools = new Set([
  'execute_desktop_observation',
  'execute_desktop_action',
  'locate_screen_elements',
  'legacy_compat_tool',
]);
const primaryTools = new Set([
  'execute_desktop_observation',
  'execute_desktop_action',
  'locate_screen_elements',
]);

const preparation = prepareAgentParallelToolCommands({
  dependencies: {
    buildCommand: ({ args, toolName }) => createCommand(toolName, args),
    isAllowedToolName: (toolName) => allowedTools.has(toolName),
    isPrimaryToolName: (toolName): toolName is AgentToolCallName => primaryTools.has(toolName),
    isSilentReadOnlyCommand: (command) => {
      const action = String(command.toolCall?.input?.action ?? '');
      const ok = action === 'get_active_window_info' || action === 'list_desktop_items';
      const isVisual = command.toolCall?.name === 'locate_screen_elements';
      return {
        ok,
        requiresApproval: !ok && !isVisual,
        routeStatus: isVisual ? 'notify' : ok ? 'silent' : 'needs-approval',
        routeSummary: isVisual ? 'Allowed as notify visual observation.' : ok ? 'Allowed as silent read-only.' : 'Requires approval.',
      };
    },
    prepareToolInput: ({ args, toolName }): AgentDecisionToolInputResult => {
      if (args?.bad === true) {
        return {
          error: 'bad args',
          issue: 'invalid-args',
          ok: false,
          toolName,
        };
      }

      if (!['execute_desktop_observation', 'execute_desktop_action', 'locate_screen_elements'].includes(toolName)) {
        return {
          error: 'unavailable',
          issue: 'unavailable-tool',
          ok: false,
          toolName,
        };
      }

      return {
        args: args ?? {},
        ok: true,
        toolName,
      };
    },
    rejectCompatibilityTool: (toolName) => `compatibility-only tool ${toolName}`,
    rejectPreviousFailure: ({ args }) => (args.previousFailure ? 'previous failure with same args' : null),
    rejectVideoSummarySearch: ({ args }) => (args.video ? 'video summary search is not a parallel observation' : null),
    resolveRedirect: ({ args, toolName }) => (
      toolName === 'execute_desktop_action' && args.action === 'get_display_info'
        ? {
            args: {
              action: 'list_desktop_items',
              redirected: true,
            },
            toolName: 'execute_desktop_observation',
          }
        : null
    ),
  },
  requestedTools: [
    {
      args: {
        action: 'get_active_window_info',
      },
      reason: null,
      tool: 'execute_desktop_observation',
    },
    {
      args: {
        action: 'get_active_window_info',
        bad: true,
      },
      reason: null,
      tool: 'execute_desktop_observation',
    },
    {
      args: {},
      reason: null,
      tool: 'legacy_compat_tool',
    },
    {
      args: {
        action: 'click',
      },
      reason: null,
      tool: 'execute_desktop_action',
    },
    {
      args: {
        action: 'get_display_info',
      },
      reason: null,
      tool: 'execute_desktop_action',
    },
    {
      args: {
        action: 'locate_element',
        sourceType: 'window',
      },
      reason: null,
      tool: 'locate_screen_elements',
    },
  ],
  stepIndex: 7,
});

assert.equal(preparation.runnableCommands.length, 2);
assert.equal(preparation.runnableCommands[0]?.toolCall?.name, 'execute_desktop_observation');
assert.equal(preparation.runnableCommands[0]?.toolCall?.input.action, 'get_active_window_info');
assert.equal(preparation.runnableCommands[1]?.toolCall?.name, 'execute_desktop_observation');
assert.equal(preparation.runnableCommands[1]?.toolCall?.input.action, 'list_desktop_items');
assert.equal(preparation.runnableCommands[1]?.toolCall?.input.redirected, true);
assert.equal(preparation.deferredCommands.length, 1);
assert.equal(preparation.deferredCommands[0]?.toolCall?.name, 'locate_screen_elements');

assert.ok(preparation.rejectedLines.some((line) => line.includes('invalid input (bad args)')));
assert.ok(preparation.rejectedLines.some((line) => line.includes('compatibility-only tool legacy_compat_tool')));
assert.ok(preparation.rejectedLines.some((line) => line.includes('not silent read-only (Requires approval.)')));

const invalidTrace = preparation.traceEvents.find((event) => event.status === 'invalid-tool-input');
assert.equal(invalidTrace?.type, 'decision_rejected');
assert.equal(invalidTrace?.stepIndex, 7);
assert.equal(invalidTrace?.action, 'tool_calls');
assert.equal(invalidTrace?.details?.error, 'bad args');

const permissionTraces = preparation.traceEvents.filter((event) => event.type === 'permission_routed');
assert.equal(permissionTraces.length, 4);
assert.ok(permissionTraces.some((event) => event.status === 'needs-approval'));
assert.ok(permissionTraces.some((event) => event.status === 'notify'));
assert.ok(permissionTraces.every((event) => event.action === 'tool_calls'));

console.log('agent session v2 parallel tool preparation smoke ok');
