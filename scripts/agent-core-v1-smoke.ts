import assert from 'node:assert/strict';
import { type AgentChatCommand } from '../src/agent/index.ts';
import {
  AGENT_CORE_PHASES,
  assessAgentCommandResult,
  createAgentCorePlan,
  executeAgentCoreRunLoop,
  resolveAgentAutoContinuationCandidate,
  shouldRequestAgentCoreApproval,
} from '../src/agent/agentLegacy.ts';
import { readProjectFile } from './smokeTestHarness.ts';

const coreSource = readProjectFile('src/agent/agentCore.ts');
const controllerSource = readProjectFile('src/components/chat/agentRunController.ts');

assert.deepEqual(
  AGENT_CORE_PHASES,
  [
    'understand-goal',
    'observe-context',
    'plan-tools',
    'route-permission',
    'execute-tools',
    'verify-result',
    'recover-or-finish',
  ],
  'Agent Core should expose the v1 task loop phases',
);

assert.match(
  coreSource,
  /export function createAgentCorePlan\([\s\S]*buildAgentPermissionRoute\(command\)[\s\S]*observationSteps[\s\S]*status:/u,
  'Agent Core should own plan state, observations, and permission route status',
);

assert.match(
  coreSource,
  /export async function executeAgentCoreRunLoop\([\s\S]*roundIndex <= AGENT_CORE_RUN_LOOP_MAX_ROUNDS[\s\S]*resolveAgentAutoContinuationCandidate/u,
  'Agent Core should own the bounded observe-plan-execute-verify-recover loop',
);

assert.match(
  coreSource,
  /export function resolveAgentAutoContinuationCandidate\([\s\S]*buildAgentPermissionRoute\(action\.command\)[\s\S]*isAgentPermissionRouteAutoContinuableObservation\(route\)/u,
  'Agent Core should only auto-continue through auto-continuable observation routes',
);

assert.match(
  coreSource,
  /export function resolveAgentApprovalPauseCandidate\([\s\S]*shouldRequestAgentPermissionRouteApproval\(route\)/u,
  'Agent Core should pause when a discovered next action needs approval',
);

assert.match(
  controllerSource,
  /runAgentSessionV2\(/u,
  'Chat controller should delegate new Agent requests to AgentSessionV2',
);

assert.doesNotMatch(
  controllerSource,
  /createAgentCorePlan|executeAgentCoreRunLoop|shouldRequestAgentCoreApproval/u,
  'Chat controller should not wire Agent Core as the active entry path',
);

assert.doesNotMatch(
  controllerSource,
  /function createAgentRecoveryFollowUpActions|function createAgentResultAssessment|function resolveAgentAutoContinuationCandidate|async function executeAgentRunLoop/u,
  'Chat controller should no longer own Agent Core recovery and loop policy',
);

const systemInfoCommand: AgentChatCommand = {
  capabilityId: 'system-inspector',
  instruction: 'read system info',
  kind: 'tool-call',
  sourceText: 'read system info',
  toolCall: {
    input: {
      includeDisplays: true,
    },
    name: 'get_system_info',
  },
};
const systemInfoCorePlan = createAgentCorePlan(systemInfoCommand);
assert.equal(systemInfoCorePlan.status, 'ready');
assert.equal(systemInfoCorePlan.requiresApproval, false);
assert.equal(systemInfoCorePlan.observationSteps.length >= 1, true);
assert.equal(shouldRequestAgentCoreApproval(systemInfoCorePlan), false);

const appLaunchCommand: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: 'open browser',
  kind: 'tool-call',
  sourceText: 'open browser',
  toolCall: {
    input: {
      query: 'browser',
    },
    name: 'launch_local_app',
  },
};
const appLaunchCorePlan = createAgentCorePlan(appLaunchCommand);
assert.equal(appLaunchCorePlan.status, 'needs-approval');
assert.equal(shouldRequestAgentCoreApproval(appLaunchCorePlan), true);

const reobserveCommand: AgentChatCommand = {
  capabilityId: 'system-inspector',
  instruction: 'recheck display',
  kind: 'tool-call',
  sourceText: 'recheck display',
  toolCall: {
    input: {},
    name: 'get_display_info',
  },
};
const unverifiedResult = assessAgentCommandResult(systemInfoCommand, {
  assessment: {
    evidence: ['mock missing verification'],
    nextStep: 'Need to re-observe the display.',
    status: 'unverified',
    summary: 'Tool returned but lacks verification evidence.',
  },
  followUpActions: [{
    command: reobserveCommand,
    kind: 'run-command',
    label: 'reobserve display',
  }],
  ok: true,
  responseText: 'read returned but missing verification',
});
const autoContinuation = resolveAgentAutoContinuationCandidate(unverifiedResult);
assert.equal(autoContinuation?.action.command.toolCall?.name, 'get_display_info');

const loopResult = await executeAgentCoreRunLoop({
  command: systemInfoCommand,
  onAgentChatCommand: async () => ({
    observations: ['mock system info'],
    ok: true,
    responseText: 'mock ok',
    verification: 'mock verified',
  }),
});
assert.equal(loopResult.finalResult.assessment?.status, 'completed');
assert.equal(loopResult.rounds.length, 1);

console.log('agent core v1 smoke ok');
