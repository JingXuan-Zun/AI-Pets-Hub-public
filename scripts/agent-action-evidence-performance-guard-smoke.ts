import assert from 'node:assert/strict';
import { type AgentToolCallName } from '../src/agent/index.ts';
import { executeDesktopInput } from '../src/agent/agentRuntimeDesktopTools.ts';
import { executeDesktopSequence } from '../src/agent/agentRuntimeDesktopSequenceTools.ts';
import { desktopPetShellRuntime } from '../src/desktopShellRuntime.ts';
import { readProjectSources } from './smokeTestHarness.ts';

function createToolCall(name: AgentToolCallName, input: Record<string, unknown>) {
  return {
    goal: `test ${name}`,
    input,
    name,
  };
}

const {
  chatCommandSource,
  desktopToolsSource,
  sequenceToolsSource,
  planningSignalEvidenceSource,
  sessionSource,
} = readProjectSources({
  chatCommandSource: 'src/agent/agentChatCommand.ts',
  desktopToolsSource: 'src/agent/agentRuntimeDesktopTools.ts',
  sequenceToolsSource: 'src/agent/agentRuntimeDesktopSequenceTools.ts',
  planningSignalEvidenceSource: 'src/agent/runtime/agentPlanningSignalEvidence.ts',
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
});

assert.match(
  chatCommandSource,
  /export type AgentDesktopActionSnapshotProfile =[\s\S]*'heavy'[\s\S]*'light'[\s\S]*'replay'/u,
  'Action evidence should expose a snapshot cost profile.',
);
assert.match(
  chatCommandSource,
  /Reserved for a future grounding graph/u,
  'fallbackChain should be documented as reserved, not active v1.5 behavior.',
);
assert.match(
  desktopToolsSource,
  /snapshotProfile: 'light'/u,
  'Generic desktop action evidence should default to light snapshots.',
);
assert.match(
  desktopToolsSource,
  /snapshotProfile: options\.preview \? 'replay' : 'light'/u,
  'Desktop input evidence should only mark replay when replay evidence exists.',
);
assert.match(
  sequenceToolsSource,
  /getAgentRuntimeDesktopSequenceSnapshotProfile/u,
  'Desktop sequence evidence should aggregate snapshot profile from child evidence and verification.',
);
assert.match(
  planningSignalEvidenceSource,
  /snapshotProfile=\$\{actionEvidence\.snapshotProfile\}/u,
  'Planning signals should expose snapshotProfile for policy decisions.',
);
assert.match(
  sessionSource,
  /do not require heavy evidence as a fixed chain step/u,
  'Agent instructions should prevent heavy verification from becoming a fixed tool chain.',
);
assert.doesNotMatch(
  desktopToolsSource,
  /fallbackChain\s*:/u,
  'Desktop action evidence producers should not synthesize fallback chains in v1.5.',
);
assert.doesNotMatch(
  sequenceToolsSource,
  /fallbackChain\s*:/u,
  'Desktop sequence evidence producers should not synthesize fallback chains in v1.5.',
);

const originalExecuteDesktopInput = desktopPetShellRuntime.executeDesktopInput;
try {
  desktopPetShellRuntime.executeDesktopInput = async (payload?: unknown) => ({
    action: (payload as { action?: string } | null)?.action ?? 'send_keys',
    keys: 'Enter',
    ok: true,
  });

  const inputResult = await executeDesktopInput(createToolCall('execute_desktop_input', {
    action: 'send_keys',
    keys: 'Enter',
  }));
  assert.equal(inputResult.stateSummary?.actionEvidence?.snapshotProfile, 'light');
  assert.equal(inputResult.stateSummary?.actionEvidence?.targetRef?.fallbackChain, undefined);

  const sequenceResult = await executeDesktopSequence({} as any, createToolCall('execute_desktop_sequence', {
    postVerify: false,
    stepsJson: JSON.stringify([
      {
        args: {
          action: 'send_keys',
          keys: 'Enter',
        },
        tool: 'execute_desktop_input',
      },
    ]),
  }));
  assert.equal(sequenceResult.stateSummary?.actionEvidence?.snapshotProfile, 'light');
  assert.equal(sequenceResult.stateSummary?.actionEvidence?.targetRef?.fallbackChain, undefined);
} finally {
  desktopPetShellRuntime.executeDesktopInput = originalExecuteDesktopInput;
}

console.log('agent action evidence performance guard smoke ok');
