import assert from 'node:assert/strict';
import {
  createAgentSessionV3PilotShadowAgreementReport,
  createAgentSessionV3PilotShadowAgreementReportExport,
  stringifyAgentSessionV3PilotShadowAgreementReportExport,
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
  /export function createAgentSessionV3PilotShadowAgreementReportExport/u,
  'shadow agreement report export helper should live with agreement reporting.',
);
assertSourceMatches(
  agreementSource,
  /export function stringifyAgentSessionV3PilotShadowAgreementReportExport/u,
  'shadow agreement report export stringifier should live with agreement reporting.',
);
assertSourceMatches(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotShadowAgreement'/u,
  'shadow agreement export helpers should be exported through the agent barrel.',
);
assertSourceDoesNotMatch(
  agreementSource,
  /execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|createAgentSessionV2ToolCommand|toolExecutor/u,
  'shadow agreement export should not know concrete tools, permission routing, command creation, or execution.',
);
assertSourceDoesNotMatch(
  agreementSource,
  /from 'node:fs'|writeFile|appendFile|createWriteStream|mkdir/u,
  'shadow agreement export should stay pure and should not write sample logs directly.',
);
assertSourceDoesNotMatch(
  agreementSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'shadow agreement export should not encode a fixed tool chain.',
);

const report = createAgentSessionV3PilotShadowAgreementReport([
  {
    agreement: createAgreement({
      status: 'aligned',
      v2Status: 'completed',
    }),
    label: 'aligned completed',
  },
  {
    agreement: createAgreement({
      reason: 'v2 completed but v3 reported needs-user.',
      status: 'mismatch',
      v2Status: 'completed',
    }),
    label: 'mismatch completed',
  },
  {
    agreement: createAgreement({
      reason: 'v2 failed but v3 reported completed.',
      status: 'mismatch',
      v2Status: 'failed',
    }),
    label: 'mismatch failed',
  },
  {
    agreement: createAgreement({
      status: 'inconclusive',
      v2Status: 'budget-exceeded',
    }),
    label: 'budget stop',
  },
]);

const defaultExport = createAgentSessionV3PilotShadowAgreementReportExport(report);
assert.equal(defaultExport.kind, 'agent-session-v3-pilot-shadow-agreement-report');
assert.equal(defaultExport.version, 1);
assert.equal(defaultExport.sampleCount, 4);
assert.equal(defaultExport.counts.aligned, 1);
assert.equal(defaultExport.counts.mismatch, 2);
assert.equal(defaultExport.v2StatusCounts.completed, 2);
assert.equal(defaultExport.v2StatusCounts.failed, 1);
assert.equal(defaultExport.mismatchSamples?.length, 2);
assert.equal(defaultExport.mismatchSamples?.[0]?.label, 'mismatch completed');
assert.equal(defaultExport.samples, undefined);
assert.match(defaultExport.summaryText, /samples=4/u);

const compactExport = createAgentSessionV3PilotShadowAgreementReportExport(report, {
  includeMismatchSamples: false,
});
assert.equal(compactExport.mismatchSamples, undefined);
assert.equal(compactExport.samples, undefined);

const limitedMismatchExport = createAgentSessionV3PilotShadowAgreementReportExport(report, {
  maxMismatchSamples: 1,
});
assert.equal(limitedMismatchExport.mismatchSamples?.length, 1);
assert.equal(limitedMismatchExport.mismatchSamples?.[0]?.reason, 'v2 completed but v3 reported needs-user.');

const sampleExport = createAgentSessionV3PilotShadowAgreementReportExport(report, {
  includeSamples: true,
  maxSamples: 2,
});
assert.equal(sampleExport.samples?.length, 2);
assert.equal(sampleExport.samples?.[0]?.label, 'aligned completed');
assert.equal(sampleExport.samples?.[1]?.status, 'mismatch');

const noSampleExport = createAgentSessionV3PilotShadowAgreementReportExport(report, {
  includeSamples: true,
  maxSamples: -1,
});
assert.equal(noSampleExport.samples?.length, 0);

const compactJson = stringifyAgentSessionV3PilotShadowAgreementReportExport(defaultExport);
assert.deepEqual(JSON.parse(compactJson), defaultExport);
assert.doesNotMatch(compactJson, /\n/u);

const prettyJson = stringifyAgentSessionV3PilotShadowAgreementReportExport(defaultExport, {
  pretty: true,
});
assert.deepEqual(JSON.parse(prettyJson), defaultExport);
assert.match(prettyJson, /\n/u);

console.log('agent session v2 v3 shadow agreement export smoke ok');
