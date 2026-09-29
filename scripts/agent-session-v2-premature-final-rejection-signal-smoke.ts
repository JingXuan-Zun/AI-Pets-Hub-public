import assert from 'node:assert/strict';
import {
  createAgentPrematureDesktopOrganizationFinalRejection,
  createAgentPrematureWindowMoveFinalRejection,
} from '../src/agent/legacy/index.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  index: indexSource,
  runtimeSignal: runtimeSignalSource,
  session: sessionSource,
  signal: signalSource,
} = readProjectSources({
  index: 'src/agent/legacy/index.ts',
  runtimeSignal: 'src/agent/runtime/agentFinalAnswerRejectionSignals.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  signal: 'src/agent/runtime/agentFinalAnswerRejectionSignals.ts',
});

assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentPrematureDesktopOrganizationFinalRejection/u,
  'Premature desktop organization final rejection signal should be Runtime-owned.',
);
assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentPrematureWindowMoveFinalRejection/u,
  'Premature window move final rejection signal should be Runtime-owned.',
);
assertSourceMatches(
  runtimeSignalSource,
  /prematureFinalRejectionPolicy=This rejection is evidence-driven/u,
  'Premature final rejection signals should explicitly remain evidence-driven.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentFinalAnswerRejectionSignals'/u,
  'AgentSessionV2 should consume Runtime-owned final answer rejection signals.',
);
assertSourceMatches(sessionSource, /createAgentPrematureDesktopOrganizationFinalRejection\(/u);
assertSourceMatches(sessionSource, /createAgentPrematureWindowMoveFinalRejection\(/u);
assertSourceMatches(
  sessionSource,
  /function shouldRejectAgentSessionV2PrematureDesktopOrganizationFinal/u,
  'AgentSessionV2 should still own the premature desktop organization predicate for this slice.',
);
assertSourceMatches(
  sessionSource,
  /function shouldRejectAgentSessionV2PrematureWindowMoveFinal/u,
  'AgentSessionV2 should still own the premature window move predicate for this slice.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /The original request asks for desktop organization, but only desktop inventory has been observed/u,
  'AgentSessionV2 should not own premature desktop organization final rejection copy.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /The original request asks to move a window\/app to a display/u,
  'AgentSessionV2 should not own premature window move final rejection copy.',
);

const desktopOrganizationText = createAgentPrematureDesktopOrganizationFinalRejection({
  decisionMessage: 'Already checked the desktop.',
});
assert.match(desktopOrganizationText, /desktop organization/u);
assert.match(desktopOrganizationText, /only desktop inventory has been observed/u);
assert.match(desktopOrganizationText, /organize_desktop_icons with mode=preview/u);
assert.match(desktopOrganizationText, /rejectedMessage=Already checked the desktop/u);
assert.match(desktopOrganizationText, /prematureFinalRejectionPolicy=This rejection is evidence-driven/u);

const windowMoveText = createAgentPrematureWindowMoveFinalRejection({
  decisionMessage: 'Chrome is open.',
});
assert.match(windowMoveText, /move a window\/app to a display/u);
assert.match(windowMoveText, /no move_window_to_display action has been attempted/u);
assert.match(windowMoveText, /observe windows\/displays if needed/u);
assert.match(windowMoveText, /execute_desktop_action action=move_window_to_display/u);
assert.match(windowMoveText, /rejectedMessage=Chrome is open/u);
assert.match(windowMoveText, /prematureFinalRejectionPolicy=This rejection is evidence-driven/u);

for (const text of [desktopOrganizationText, windowMoveText]) {
  assert.doesNotMatch(
    text,
    /open_app\s*->\s*wait_ui\s*->\s*locate\s*->\s*click\s*->\s*verify/iu,
    'Premature final rejection signals should not encode a fixed recovery chain.',
  );
}

console.log('agent session v2 premature final rejection signal smoke ok');
