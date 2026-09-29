import assert from 'node:assert/strict';

import {
  dispatchAgentRuntimeContinuation,
  type AgentRuntimeContinuationAdapterKind,
  type AgentRuntimeContinuationTransition,
  type AgentRuntimeToolResultEntry,
} from '../src/agent/index.ts';

const latestEntry: AgentRuntimeToolResultEntry = {
  command: {
    instruction: 'Verify the current application state',
    kind: 'tool-call',
    sourceText: '/agent verify the current application state',
    toolCall: {
      goal: 'Verify the current application state',
      input: { action: 'summarize_visual_snapshot' },
      name: 'execute_desktop_observation',
    },
  },
  result: {
    ok: true,
    responseText: 'Verification evidence collected.',
  },
};

function createTransition(
  kind: AgentRuntimeContinuationTransition['kind'],
): AgentRuntimeContinuationTransition {
  if (kind === 'verification') {
    return {
      actionDecision: {
        postActionState: '',
        reason: 'insufficient-evidence',
        status: 'uncertain',
        terminalEvaluation: null,
      },
      approval: null,
      kind,
      reason: `Dispatch ${kind}`,
      recoveryDecision: { action: 'no-recovery', reason: 'no-recovery-signal' },
    };
  }
  return {
    actionDecision: {
      postActionState: '',
      reason: 'insufficient-evidence',
      status: 'uncertain',
      terminalEvaluation: null,
    },
    approval: null,
    kind,
    reason: `Dispatch ${kind}`,
    recoveryDecision: null,
  };
}

async function assertDispatch(options: {
  expectedAdapter: AgentRuntimeContinuationAdapterKind;
  transitionKind: AgentRuntimeContinuationTransition['kind'];
}) {
  const calls: AgentRuntimeContinuationAdapterKind[] = [];
  const createAdapter = (adapterKind: AgentRuntimeContinuationAdapterKind) => async () => {
    calls.push(adapterKind);
    return {
      executed: true,
      finalResult: `handled:${adapterKind}`,
    };
  };
  const result = await dispatchAgentRuntimeContinuation({
    adapters: {
      approval: createAdapter('approval'),
      planning: createAdapter('planning'),
      recovery: createAdapter('recovery'),
      refine: createAdapter('refine'),
      targetResolution: createAdapter('targetResolution'),
      terminal: createAdapter('terminal'),
      verification: createAdapter('verification'),
    },
    latestEntry,
    stepIndex: 7,
    transition: createTransition(options.transitionKind),
  });

  assert.deepEqual(calls, [options.expectedAdapter]);
  assert.equal(result.adapterKind, options.expectedAdapter);
  assert.equal(result.executed, true);
  assert.equal(result.finalResult, `handled:${options.expectedAdapter}`);
}

await assertDispatch({ expectedAdapter: 'terminal', transitionKind: 'terminal' });
await assertDispatch({ expectedAdapter: 'approval', transitionKind: 'approval' });
await assertDispatch({ expectedAdapter: 'planning', transitionKind: 'planning' });
await assertDispatch({ expectedAdapter: 'targetResolution', transitionKind: 'target-resolution' });
await assertDispatch({ expectedAdapter: 'recovery', transitionKind: 'recovery' });
await assertDispatch({ expectedAdapter: 'refine', transitionKind: 'refine' });
await assertDispatch({ expectedAdapter: 'verification', transitionKind: 'verification' });
await assertDispatch({ expectedAdapter: 'terminal', transitionKind: 'stop-needs-user' });

console.log('agent runtime continuation dispatcher smoke ok');
