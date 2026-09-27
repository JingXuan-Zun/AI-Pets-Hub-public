import assert from 'node:assert/strict';
import {
  createAgentVideoSummarySearchRejection,
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
  /export function createAgentVideoSummarySearchRejection/u,
  'Video summary search rejection signal should be owned by Runtime.',
);
assertSourceMatches(
  runtimeSignalSource,
  /videoSummarySearchRejectionPolicy=This rejection is advisory\/evidence-driven/u,
  'Video summary search rejection signal should explicitly remain advisory and evidence-driven.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentDecisionRejectionSignals'/u,
  'AgentSessionV2 should consume the Runtime-owned decision rejection signals.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /createAgentSessionV2VideoSummarySearchRejection/u,
  'AgentSessionV2 should not own video summary search rejection signal implementation.',
);
assertSourceMatches(
  sessionSource,
  /function shouldRejectAgentSessionV2VideoSummarySearch/u,
  'AgentSessionV2 should still own the video summary search predicate for this slice.',
);

const rejectionText = createAgentVideoSummarySearchRejection();

assert.match(rejectionText, /Rejected video summary search/u);
assert.match(rejectionText, /watch\/summarize a video, not to search for videos/u);
assert.match(
  rejectionText,
  /provided URL, the current browser tab\/page, or the current visible screen\/window/u,
);
assert.match(rejectionText, /ask one short question/u);
assert.match(rejectionText, /videoSummarySearchRejectionPolicy=This rejection is advisory\/evidence-driven/u);
assert.doesNotMatch(
  rejectionText,
  /search_web\s*->\s*open_result\s*->\s*summarize/iu,
  'Video summary search rejection signal should not encode a fixed search workflow.',
);

console.log('agent session v2 video summary search rejection signal smoke ok');
