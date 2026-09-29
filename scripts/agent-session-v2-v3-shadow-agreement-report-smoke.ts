import assert from 'node:assert/strict';
import {
  createAgentSessionV3PilotShadowAgreementReport,
  type AgentSessionV3PilotShadowAgreement,
} from '../src/agent/legacy/index.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

function createAgreement(
  options: Pick<AgentSessionV3PilotShadowAgreement, 'status' | 'v2Status'> & {
    reason?: string;
  },
): AgentSessionV3PilotShadowAgreement {
  return {
    expectations: [],
    observed: {
      lastEvent: null,
      phase: null,
      runnerStatus: null,
      shadowStatus: null,
      terminalStatus: null,
      transitionCount: null,
    },
    reason: options.reason ?? `${options.status} sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const {
  agreement: agreementSource,
  index: indexSource,
} = readProjectSources({
  agreement: 'src/agent/agentSessionV3PilotShadowAgreement.ts',
  index: 'src/agent/legacy/index.ts',
});

assertSourceMatches(
  agreementSource,
  /export function createAgentSessionV3PilotShadowAgreementReport/u,
  'shadow agreement report helper should live with agreement evaluation.',
);
assertSourceMatches(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotShadowAgreement'/u,
  'shadow agreement report helper should be exported through the agent barrel.',
);
assertSourceDoesNotMatch(
  agreementSource,
  /execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|createAgentSessionV2ToolCommand|toolExecutor/u,
  'shadow agreement report helper should not know concrete tools, permission routing, command creation, or execution.',
);
assertSourceDoesNotMatch(
  agreementSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'shadow agreement report helper should not encode a fixed tool chain.',
);

const alignedCompleted = createAgreement({
  status: 'aligned',
  v2Status: 'completed',
});
const alignedApproval = createAgreement({
  status: 'aligned',
  v2Status: 'needs-approval',
});
const mismatch = createAgreement({
  reason: 'v2 completed but v3 reported needs-user.',
  status: 'mismatch',
  v2Status: 'completed',
});
const inconclusive = createAgreement({
  status: 'inconclusive',
  v2Status: 'budget-exceeded',
});
const unavailable = createAgreement({
  status: 'unavailable',
  v2Status: 'needs-user',
});

const report = createAgentSessionV3PilotShadowAgreementReport([
  {
    agreement: alignedCompleted,
    label: 'final answer',
  },
  alignedApproval,
  {
    agreement: mismatch,
    label: 'contradictory terminal',
  },
  inconclusive,
  unavailable,
]);

assert.equal(report.sampleCount, 5);
assert.equal(report.counts.aligned, 2);
assert.equal(report.counts.mismatch, 1);
assert.equal(report.counts.inconclusive, 1);
assert.equal(report.counts.unavailable, 1);
assert.equal(report.v2StatusCounts.completed, 2);
assert.equal(report.v2StatusCounts['needs-approval'], 1);
assert.equal(report.v2StatusCounts['budget-exceeded'], 1);
assert.equal(report.v2StatusCounts['needs-user'], 1);
assert.equal(report.mismatchSamples.length, 1);
assert.equal(report.mismatchSamples[0]?.label, 'contradictory terminal');
assert.equal(report.samples[0]?.label, 'final answer');
assert.equal(report.samples[1]?.label, null);
assert.match(report.summaryText, /^AgentSessionV3PilotShadowAgreement samples=5 /u);
assert.match(report.summaryText, /aligned=2/u);
assert.match(report.summaryText, /mismatch=1/u);
assert.match(report.summaryText, /inconclusive=1/u);
assert.match(report.summaryText, /unavailable=1/u);
assert.match(report.summaryText, /v2=budget-exceeded=1,completed=2,needs-approval=1,needs-user=1/u);

const emptyReport = createAgentSessionV3PilotShadowAgreementReport([]);
assert.equal(emptyReport.sampleCount, 0);
assert.equal(emptyReport.counts.aligned, 0);
assert.equal(emptyReport.counts.mismatch, 0);
assert.equal(emptyReport.mismatchSamples.length, 0);
assert.match(emptyReport.summaryText, /samples=0/u);
assert.match(emptyReport.summaryText, /v2=none/u);

console.log('agent session v2 v3 shadow agreement report smoke ok');
