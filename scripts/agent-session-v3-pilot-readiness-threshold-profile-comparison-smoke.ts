import assert from 'node:assert/strict';
import {
  createAgentSessionV3PilotExternalSampleFixtureBatch,
  createAgentSessionV3PilotReadinessThresholdProfileComparison,
  createAgentSessionV3PilotShadowAgreementReport,
  createAgentSessionV3PilotShadowAgreementReportExport,
  createAgentSessionV3PilotShadowDebugExport,
  runAgentSessionV3PilotShadowMode,
  type AgentSessionV3PilotShadowAgreement,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

function createAgreement(
  options: Pick<AgentSessionV3PilotShadowAgreement, 'status' | 'v2Status'>,
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
    reason: `${options.status} threshold profile comparison sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { comparisonSource, indexSource } = readProjectSources({
  comparisonSource: 'src/agent/agentSessionV3PilotReadinessThresholdProfileComparison.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(
  comparisonSource,
  /export function createAgentSessionV3PilotReadinessThresholdProfileComparison/u,
  'v3 pilot readiness threshold profile comparison should live in its own module.',
);
assert.match(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotReadinessThresholdProfileComparison'/u,
  'v3 pilot readiness threshold profile comparison should be exported through the agent barrel.',
);
assert.doesNotMatch(
  comparisonSource,
  /AgentSessionV2|runAgentSessionV2|executeAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'v3 pilot readiness threshold profile comparison should not know runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  comparisonSource,
  /from 'node:fs'|writeFile|appendFile|createWriteStream|readFile|mkdir/u,
  'v3 pilot readiness threshold profile comparison should not read or write files.',
);
assert.doesNotMatch(
  comparisonSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'v3 pilot readiness threshold profile comparison should not encode a fixed desktop tool chain.',
);

const shadowResult = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin threshold profile comparison sample',
      type: 'start',
    },
    {
      reason: 'terminal answer',
      route: 'terminal',
      terminalStatus: 'completed',
      type: 'model-decision-accepted',
    },
  ],
});
const shadowExport = createAgentSessionV3PilotShadowDebugExport(shadowResult);
const readyReport = createAgentSessionV3PilotShadowAgreementReportExport(
  createAgentSessionV3PilotShadowAgreementReport([
    createAgreement({
      status: 'aligned',
      v2Status: 'completed',
    }),
  ]),
  {
    includeSamples: true,
  },
);
const mismatchReport = createAgentSessionV3PilotShadowAgreementReportExport(
  createAgentSessionV3PilotShadowAgreementReport([
    createAgreement({
      status: 'mismatch',
      v2Status: 'failed',
    }),
  ]),
  {
    includeSamples: true,
  },
);

const fixtureBatch = createAgentSessionV3PilotExternalSampleFixtureBatch({
  batches: [
    {
      agreementReports: [{
        report: readyReport,
      }],
      label: 'ready-batch',
      shadowDebugSamples: [{
        shadow: shadowExport,
      }],
    },
    {
      agreementReports: [{
        report: mismatchReport,
      }],
      label: 'mismatch-batch',
      shadowDebugSamples: [{
        shadow: shadowExport,
      }],
    },
  ],
});

const comparison = createAgentSessionV3PilotReadinessThresholdProfileComparison({
  fixtureBatch,
  profiles: [
    {
      label: 'strict',
      thresholds: {
        maxMismatches: 0,
        minAgreementSamples: 1,
        minShadowSamples: 1,
      },
    },
    {
      label: 'relaxed-mismatch',
      thresholds: {
        maxMismatches: 1,
        minAgreementSamples: 1,
        minShadowSamples: 1,
      },
    },
    {},
  ],
});

assert.equal(comparison.kind, 'agent-session-v3-pilot-readiness-threshold-profile-comparison');
assert.equal(comparison.version, 1);
assert.equal(comparison.status, 'compared');
assert.equal(comparison.profileCount, 3);
assert.equal(comparison.sampleCount, 2);
assert.equal(comparison.useBatchThresholdOverrides, false);
assert.deepEqual(
  comparison.entries.map((entry) => `${entry.label}:${entry.status}`),
  ['strict:mixed', 'relaxed-mismatch:ready', 'profile-3:mixed'],
);
assert.equal(comparison.entries[0]?.diagnostics.status, 'has-failures');
assert.equal(comparison.entries[0]?.diagnostics.checkSummaries[0]?.key, 'max-mismatches');
assert.equal(comparison.entries[1]?.diagnostics.status, 'clean');
assert.equal(comparison.entries[2]?.label, 'profile-3');
assert.match(comparison.summaryText, /profiles=3/u);
assert.match(comparison.summaryText, /strict:mixed/u);

const emptyComparison = createAgentSessionV3PilotReadinessThresholdProfileComparison({
  fixtureBatch,
});
assert.equal(emptyComparison.status, 'empty');
assert.equal(emptyComparison.profileCount, 0);
assert.equal(emptyComparison.sampleCount, 2);
assert.deepEqual(emptyComparison.entries, []);

console.log('agent session v3 pilot readiness threshold profile comparison smoke ok');
