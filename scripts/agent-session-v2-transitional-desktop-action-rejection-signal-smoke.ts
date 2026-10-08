import assert from 'node:assert/strict';
import {
  createAgentTransitionalDesktopActionRejection,
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
  evidence: evidenceSource,
  signal: signalSource,
} = readProjectSources({
  index: 'src/agent/legacy/index.ts',
  runtimeSignal: 'src/agent/runtime/agentDecisionRejectionSignals.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  evidence: 'src/agent/productionSession/desktopActionEvidence.ts',
  signal: 'src/agent/runtime/agentDecisionRejectionSignals.ts',
});

assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentTransitionalDesktopActionRejection/u,
  'Transitional desktop action rejection signal should be owned by Runtime.',
);
assertSourceMatches(
  runtimeSignalSource,
  /transitionalDesktopActionRejectionPolicy=This rejection is advisory\/evidence-driven/u,
  'Transitional desktop action rejection signal should explicitly remain advisory and evidence-driven.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentDecisionRejectionSignals'/u,
  'AgentSessionV2 should consume the Runtime-owned decision rejection signals.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /createAgentSessionV2TransitionalDesktopActionRejection/u,
  'AgentSessionV2 should not own transitional desktop action rejection signal implementation.',
);
assertSourceMatches(
  sessionSource,
  /shouldRejectAgentProductionTransitionalDesktopAction: shouldRejectAgentSessionV2TransitionalDesktopAction/u,
  'Production session must bind the existing desktop action evidence predicate.',
);

assertSourceMatches(sessionSource, /from '\.\/productionSession\/desktopActionEvidence'/u, 'The root must import the checked evidence module.');
assertSourceMatches(sessionSource, /createAgentProductionDesktopActionEvidence\(\{/u, 'The root must instantiate the desktop evidence module.');
assertSourceMatches(evidenceSource, /function shouldRejectAgentProductionTransitionalDesktopAction/u, 'The original predicate must remain in the bound evidence module.');

const rejectionText = createAgentTransitionalDesktopActionRejection({
  action: 'open_or_focus_then_control_window',
  target: 'Chrome',
  windowState: 'maximized',
});

assert.match(
  rejectionText,
  /Transitional desktop action "open_or_focus_then_control_window" is kept only for old compatibility/u,
);
assert.match(rejectionText, /rejectedArgs=.*open_or_focus_then_control_window/u);
assert.match(rejectionText, /target.*Chrome/u);
assert.match(rejectionText, /transitionalDesktopActionRejectionPolicy=This rejection is advisory\/evidence-driven/u);
assert.match(rejectionText, /Re-plan with current desktop evidence/u);
assert.match(rejectionText, /Do not repeat the compatibility-only compound action unchanged/u);
assert.doesNotMatch(
  rejectionText,
  /Example shape/iu,
  'Transitional desktop action rejection signal should not encode the old fixed example template.',
);
assert.doesNotMatch(
  rejectionText,
  /open_app\s*->\s*wait_ui\s*->\s*locate\s*->\s*click\s*->\s*verify/iu,
  'Transitional desktop action rejection signal should not encode a fixed tool chain.',
);

const unknownActionText = createAgentTransitionalDesktopActionRejection(undefined);
assert.match(unknownActionText, /Transitional desktop action "unknown"/u);
assert.doesNotMatch(unknownActionText, /rejectedArgs=/u);

console.log('agent session v2 transitional desktop action rejection signal smoke ok');
