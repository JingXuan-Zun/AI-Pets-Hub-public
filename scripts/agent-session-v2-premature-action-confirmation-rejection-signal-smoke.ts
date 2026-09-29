import assert from 'node:assert/strict';
import {
  createAgentPrematureActionConfirmationRejection,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentSessionV2ToolResultEntry,
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
  runtimeSignal: 'src/agent/runtime/agentDecisionRejectionSignals.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  signal: 'src/agent/runtime/agentDecisionRejectionSignals.ts',
});

assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentPrematureActionConfirmationRejection/u,
  'Premature action confirmation rejection signal should be owned by Runtime.',
);
assertSourceMatches(
  runtimeSignalSource,
  /prematureActionConfirmationRejectionPolicy=This rejection is advisory\/evidence-driven/u,
  'Premature action confirmation rejection signal should explicitly remain advisory and evidence-driven.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentDecisionRejectionSignals'/u,
  'AgentSessionV2 should consume the Runtime-owned decision rejection signals.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /createAgentSessionV2PrematureActionConfirmationRejection/u,
  'AgentSessionV2 should not own premature action confirmation rejection signal implementation.',
);
assertSourceMatches(
  sessionSource,
  /function shouldRejectAgentSessionV2PrematureActionConfirmation/u,
  'AgentSessionV2 should still own the premature action confirmation predicate for this slice.',
);

const command: AgentChatCommand = {
  capabilityId: 'desktop-input',
  instruction: 'locate launch button',
  kind: 'tool-call',
  sourceText: '/agent open Game inside Launcher',
  toolCall: {
    goal: 'open Game inside Launcher',
    input: {
      action: 'locate_element',
      targetDescription: 'Game launch button',
    },
    name: 'locate_screen_elements',
  },
};

const result: AgentChatCommandResult = {
  observations: [
    'Visual target matched: Game',
    'Visual primary action: Launch button',
  ],
  ok: true,
  responseText: 'Located Game and its Launch button.',
  stateSummary: {
    observedState: [
      'Visual target matched: Game',
      'Visual primary action: Launch button',
    ],
    structuredEvidence: {
      confidence: 'high',
      coordinateConfidence: 'high',
      elementCenter: {
        coordinateSpace: 'native-screen',
        source: 'test',
        x: 1715,
        y: 1050,
      },
      elementCenterRatio: {
        x: 0.893,
        y: 0.729,
      },
      elementRegion: 'bottom right',
      primaryAction: 'Launch button',
      relation: 'Launch button belongs to Game',
      status: 'success',
      targetMatched: 'Game',
      visualActionReadiness: 'ready',
    },
    verificationEvidence: [
      'Game Launch button is visible and actionable.',
    ],
  },
  verification: 'The in-app launch control is visible and actionable.',
};

const entry: AgentSessionV2ToolResultEntry = {
  command,
  result,
};

const rejectionText = createAgentPrematureActionConfirmationRejection(
  entry,
  'The launch button is ready. Do you want me to click it?',
);

assert.match(rejectionText, /The model produced a rejected premature action confirmation/u);
assert.match(rejectionText, /latest observation already identifies a clear next desktop action/u);
assert.match(rejectionText, /tool=locate_screen_elements/u);
assert.match(rejectionText, /target=Game/u);
assert.match(rejectionText, /primaryAction=Launch button/u);
assert.match(rejectionText, /elementRegion=bottom right/u);
assert.match(rejectionText, /elementCenter=1715,1050/u);
assert.match(rejectionText, /elementCenterRatio=0\.893,0\.729/u);
assert.match(rejectionText, /relation=Launch button belongs to Game/u);
assert.match(rejectionText, /confidence=high/u);
assert.match(rejectionText, /visualActionReadiness=ready/u);
assert.match(rejectionText, /prematureActionConfirmationRejectionPolicy=This rejection is advisory\/evidence-driven/u);
assert.match(rejectionText, /The user already requested this action/u);
assert.match(rejectionText, /approval-required desktop input\/sequence tool/u);
assert.match(rejectionText, /rejectedMessage=The launch button is ready/u);
assert.doesNotMatch(
  rejectionText,
  /open_app\s*->\s*wait_ui\s*->\s*locate\s*->\s*click\s*->\s*verify/iu,
  'Premature action confirmation rejection signal should not encode a fixed tool chain.',
);

console.log('agent session v2 premature action confirmation rejection signal smoke ok');
