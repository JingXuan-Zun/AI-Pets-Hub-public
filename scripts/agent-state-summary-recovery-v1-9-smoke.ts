import assert from 'node:assert/strict';
import { type AgentChatCommand } from '../src/agent/index.ts';
import {
  createAgentCorePlan,
  executeAgentCoreRunLoop,
} from '../src/agent/agentLegacy.ts';
import { readProjectFile } from './smokeTestHarness.ts';

const coreSource = readProjectFile('src/agent/agentCore.ts');
const plannerSource = readProjectFile('src/agent/agentPlanner.ts');

assert.match(
  coreSource,
  /export interface AgentCoreReplanRequest[\s\S]*stateSummary: AgentToolStateSummary \| null;/u,
  'replan requests should carry structured state summaries',
);

assert.match(
  coreSource,
  /export interface AgentCoreRecoveryRequest[\s\S]*stateSummary: AgentToolStateSummary \| null;/u,
  'recovery requests should carry structured state summaries',
);

assert.match(
  coreSource,
  /function createAgentCoreStructuredRecoveryCommand\(/u,
  'Agent Core should provide a structured recovery fallback',
);

assert.match(
  coreSource,
  /isAgentPermissionRouteAutoContinuableObservation\(route\)/u,
  'structured recovery fallback should auto-run only auto-continuable observation commands',
);

assert.match(
  coreSource,
  /normalizeAgentCoreReplanDecision\(await onAgentCoreRecovery\(recoveryRequest\)\)[\s\S]*\?\? createAgentCoreStructuredRecoveryCommand\(recoveryRequest\)/u,
  'Agent Core should use structured recovery when planner recovery returns no command',
);

assert.match(
  plannerSource,
  /function createAgentStructuredStateSummaryText\(/u,
  'planner should format structured state summaries explicitly',
);

assert.match(
  plannerSource,
  /Structured tool state:[\s\S]*createAgentStructuredStateSummaryText\(request\.stateSummary\)/u,
  'planner replan/recovery inputs should include structured state summary blocks',
);

assert.match(
  plannerSource,
  /Use missingEvidence to decide what must be observed or verified next/u,
  'recovery prompt should prioritize missing evidence',
);

assert.match(
  plannerSource,
  /Use recommendedRecovery as candidate tools/u,
  'recovery prompt should treat recommended recovery tools as candidates',
);

const command: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: 'open browser',
  kind: 'tool-call',
  sourceText: '/agent open browser',
  toolCall: {
    goal: 'open browser',
    input: {
      query: 'browser',
    },
    name: 'launch_local_app',
  },
};

let recoveryRequestCount = 0;
const executedTools: string[] = [];

const result = await executeAgentCoreRunLoop({
  approved: true,
  command,
  corePlan: createAgentCorePlan(command),
  onAgentChatCommand: async (currentCommand) => {
    const toolName = currentCommand.toolCall?.name ?? currentCommand.kind;
    executedTools.push(toolName);
    if (toolName === 'launch_local_app') {
      return {
        ok: false,
        responseText: 'Launch returned no focused window evidence.',
      };
    }

    return {
      observations: ['display list observed during structured recovery'],
      ok: true,
      responseText: 'display info recovered',
      verification: 'display-list verified',
    };
  },
  onAgentCoreRecovery: async (request) => {
    recoveryRequestCount += 1;
    assert.ok(request.stateSummary?.missingEvidence?.includes('missing:focused-window'));
    assert.ok(request.stateSummary?.recommendedRecovery?.includes('tool:launch_local_app'));
    return null;
  },
});

assert.equal(recoveryRequestCount, 1);
assert.deepEqual(executedTools, ['launch_local_app']);
assert.equal(result.finalCommand.toolCall?.name, 'launch_local_app');
assert.notEqual(result.rounds[0]?.status, 'auto-continued');

const displayRecoveryCommand: AgentChatCommand = {
  capabilityId: 'system-inspector',
  instruction: 'read displays',
  kind: 'tool-call',
  sourceText: '/agent read displays',
  toolCall: {
    goal: 'read displays',
    input: {},
    name: 'get_display_info',
  },
};

const readOnlyRecoveryResult = await executeAgentCoreRunLoop({
  approved: true,
  command: displayRecoveryCommand,
  corePlan: createAgentCorePlan(displayRecoveryCommand),
  onAgentChatCommand: async (currentCommand) => {
    const toolName = currentCommand.toolCall?.name ?? currentCommand.kind;
    if (toolName === 'get_display_info') {
      return {
        ok: false,
        responseText: 'Display observation failed.',
        stateSummary: {
          missingEvidence: ['missing:system-info'],
          recommendedRecovery: ['tool:get_system_info'],
        },
      };
    }

    return {
      observations: ['system info observed during structured recovery'],
      ok: true,
      responseText: 'system info recovered',
      verification: 'system-info verified',
    };
  },
  onAgentCoreRecovery: async () => null,
});

assert.equal(readOnlyRecoveryResult.rounds[0]?.status, 'auto-continued');
assert.equal(readOnlyRecoveryResult.finalCommand.toolCall?.name, 'get_system_info');
assert.equal(readOnlyRecoveryResult.finalResult.assessment?.status, 'completed');

console.log('agent state summary recovery v1.9 smoke ok');
