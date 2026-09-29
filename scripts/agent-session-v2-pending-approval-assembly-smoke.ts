import assert from 'node:assert/strict';
import {
  createAgentPendingApprovalAssembly,
  type AgentExecutionPlan,
  type AgentSessionV2PendingApproval,
} from '../src/agent/legacy/index.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  assembly: assemblySource,
  index: indexSource,
  runtimeAssembly: runtimeAssemblySource,
  session: sessionSource,
} = readProjectSources({
  assembly: 'src/agent/runtime/agentPendingApprovalAssembly.ts',
  index: 'src/agent/legacy/index.ts',
  runtimeAssembly: 'src/agent/runtime/agentPendingApprovalAssembly.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
});

assertSourceMatches(
  runtimeAssemblySource,
  /export function createAgentPendingApprovalAssembly/u,
  'Pending approval assembly should be Runtime-owned.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentPendingApprovalAssembly'/u,
  'AgentSessionV2 should consume Runtime pending approval assembly directly.',
);

const approval: AgentSessionV2PendingApproval = {
  command: {
    capabilityId: 'app-launcher',
    instruction: 'open example',
    kind: 'tool-call',
    sourceText: '/agent open example',
    toolCall: {
      goal: 'open example',
      input: {
        action: 'launch_local_app',
        target: 'Example',
      },
      name: 'execute_desktop_action',
    },
  },
  plan: {
    command: {
      capabilityId: 'app-launcher',
      instruction: 'open example',
      kind: 'tool-call',
      sourceText: '/agent open example',
    },
    steps: [],
    summary: 'approval plan',
  } as AgentExecutionPlan,
  reason: 'Opening Example needs user approval.',
  routeSummary: 'Requires user approval before 1 planned step.',
};

const assembly = createAgentPendingApprovalAssembly({
  approval,
  label: 'visual-action approval',
  stepIndex: 5,
});

assert.equal(assembly.finalAnswer, approval.reason);
assert.equal(assembly.pendingApproval, approval);
assert.equal(assembly.status, 'needs-approval');
assert.match(assembly.historyLine, /Step 5 prepared visual-action approval:/u);
assert.match(assembly.historyLine, /tool=execute_desktop_action/u);
assert.match(assembly.historyLine, /reason=Opening Example needs user approval\./u);
assert.match(assembly.historyLine, /permission=Requires user approval/u);
assert.equal(assembly.traceEvent.type, 'approval_required');
assert.equal(assembly.traceEvent.status, 'needs-approval');
assert.equal(assembly.traceEvent.stepIndex, 5);
assert.equal(assembly.traceEvent.tool, 'execute_desktop_action');
assert.equal(assembly.traceEvent.details?.label, 'visual-action approval');
assert.equal(assembly.traceEvent.details?.reason, approval.reason);
assert.equal(assembly.traceEvent.details?.routeSummary, approval.routeSummary);
assert.deepEqual(assembly.traceEvent.details?.args, {
  action: 'launch_local_app',
  target: 'Example',
});

console.log('agent session v2 pending approval assembly smoke ok');
