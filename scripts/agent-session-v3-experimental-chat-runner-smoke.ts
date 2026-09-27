import assert from 'node:assert/strict';
import {
  runAgentSessionV3ExperimentalChatRunner,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentSessionV2ProgressEvent,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { runnerSource, agentSessionV2Source, indexSource } = readProjectSources({
  runnerSource: 'src/agent/agentSessionV3ExperimentalChatRunner.ts',
  agentSessionV2Source: 'src/agent/agentProductionSessionImplementation.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(runnerSource, /export async function runAgentSessionV3ExperimentalChatRunner/u);
assert.match(runnerSource, /createAgentSessionV3ExperimentalV2Adapters/u);
assert.match(runnerSource, /runAgentSessionV3ExperimentalSession/u);
assert.match(runnerSource, /createAgentSessionV2ModelInput/u);
assert.match(runnerSource, /AGENT_SESSION_V2_SYSTEM_INSTRUCTION/u);
assert.match(agentSessionV2Source, /export const AGENT_SESSION_V2_SYSTEM_INSTRUCTION/u);
assert.match(agentSessionV2Source, /export function createAgentSessionV2PlanningContext/u);
assert.match(indexSource, /export \* from '\.\.\/agentSessionV3ExperimentalChatRunner';/u);

const executedCommands: AgentChatCommand[] = [];
const progressEvents: AgentSessionV2ProgressEvent[] = [];
const readOnlyResult = await runAgentSessionV3ExperimentalChatRunner({
  modelCaller: async (request) => {
    assert.match(request.systemInstruction, /You are AgentSessionV2/u);
    assert.match(request.userInput, /Original user request/u);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'get_cursor_position',
      },
      reason: 'Need cursor position through v3 chat runner.',
      tool: 'execute_desktop_observation',
    });
  },
  onProgress: (event) => {
    progressEvents.push(event);
  },
  settings: {},
  sourceText: '/agent v3 chat runner smoke',
  toolExecutor: async (command): Promise<AgentChatCommandResult> => {
    executedCommands.push(command);
    return {
      ok: true,
      responseText: 'Cursor position observed by v3 chat runner.',
      verification: 'v3 chat runner tool execution verified.',
    };
  },
  userGoal: 'Observe cursor position',
});

assert.equal(readOnlyResult.status, 'needs-user');
assert.equal(readOnlyResult.pendingApproval, null);
assert.equal(readOnlyResult.sourceText, '/agent v3 chat runner smoke');
assert.match(readOnlyResult.finalAnswer, /could not safely prepare|Switch back to v2 fallback/u);
assert.equal(readOnlyResult.steps.some((step) => step.action === 'tool_call'), true);
assert.equal(readOnlyResult.steps.some((step) => step.action === 'tool_result'), true);
assert.equal(readOnlyResult.toolResults.length, 1);
assert.equal(readOnlyResult.toolResults[0]?.command.toolCall?.name, 'execute_desktop_observation');
assert.equal(readOnlyResult.continuation.toolResults.length, 1);
assert.equal(readOnlyResult.timing?.modelCallCount, 1);
assert.equal(readOnlyResult.timing?.toolCallCount, 1);
assert.equal(executedCommands.length, 1);
assert.equal(progressEvents.length > 0, true);

let approvalExecutorCalled = false;
const approvalResult = await runAgentSessionV3ExperimentalChatRunner({
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'click',
      x: 10,
      y: 20,
    },
    reason: 'Need approval before desktop click.',
    tool: 'execute_desktop_input',
  }),
  settings: {},
  sourceText: '/agent v3 chat approval smoke',
  toolExecutor: async () => {
    approvalExecutorCalled = true;
    throw new Error('approval-required command should not execute before user approval');
  },
  userGoal: 'Click something',
});

assert.equal(approvalResult.status, 'needs-approval');
assert.equal(approvalResult.pendingApproval?.command.toolCall?.name, 'execute_desktop_input');
assert.equal(approvalResult.pendingApproval?.plan.steps.length, 1);
assert.equal(approvalResult.toolResults.length, 0);
assert.equal(approvalExecutorCalled, false);
assert.equal(approvalResult.traceEvents.some((event) => event.type === 'approval_required'), true);

for (const [label, source] of [
  ['v3 chat runner', runnerSource],
  ['agent session v2', agentSessionV2Source],
] as const) {
  assert.doesNotMatch(
    source,
    /observe_windows_and_apps\s*->\s*locate_screen_elements|locate_screen_elements\s*->\s*execute_desktop|execute_desktop_sequence\s*->\s*observe_windows_and_apps/iu,
    `${label} must not encode a fixed desktop workflow.`,
  );
  assert.doesNotMatch(
    source,
    /implementationQueue|orderedSteps|requiredReportOrder|recoveryAction/u,
    `${label} must not define fixed tool queues, report order, or recovery actions.`,
  );
}

assert.doesNotMatch(
  runnerSource,
  /runAgentSessionV2\(/u,
  'v3 chat runner must not call the full v2 session loop.',
);

console.log('agent session v3 experimental chat runner smoke ok');
