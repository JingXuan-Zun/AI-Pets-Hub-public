import assert from 'node:assert/strict';
import {
  createAgentSessionV3PilotExternalSampleFixtureBatch,
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
    reason: `${options.status} fixture batch sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { fixtureSource, indexSource } = readProjectSources({
  fixtureSource: 'src/agent/agentSessionV3PilotExternalSampleFixtureBatch.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(
  fixtureSource,
  /export function createAgentSessionV3PilotExternalSampleFixtureBatch/u,
  'v3 pilot external sample fixture batch helper should live in its own module.',
);
assert.match(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotExternalSampleFixtureBatch'/u,
  'v3 pilot external sample fixture batch helper should be exported through the agent barrel.',
);
assert.doesNotMatch(
  fixtureSource,
  /AgentSessionV2|runAgentSessionV2|executeAgentSessionV2|buildAgentPermissionRoute|execute_desktop|observe_windows_and_apps|locate_screen_elements|toolExecutor/u,
  'v3 pilot external sample fixture batch should not know v2 runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  fixtureSource,
  /from 'node:fs'|writeFile|appendFile|createWriteStream|mkdir/u,
  'v3 pilot external sample fixture batch should not read or write logs directly.',
);
assert.doesNotMatch(
  fixtureSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'v3 pilot external sample fixture batch should not encode a fixed tool chain.',
);

const readyAgreementReportExport = createAgentSessionV3PilotShadowAgreementReportExport(
  createAgentSessionV3PilotShadowAgreementReport([
    createAgreement({
      status: 'aligned',
      v2Status: 'completed',
    }),
    createAgreement({
      status: 'aligned',
      v2Status: 'needs-user',
    }),
  ]),
  {
    includeSamples: true,
  },
);
const mismatchAgreementReportExport = createAgentSessionV3PilotShadowAgreementReportExport(
  createAgentSessionV3PilotShadowAgreementReport([
    createAgreement({
      status: 'mismatch',
      v2Status: 'failed',
    }),
  ]),
);

const terminalShadow = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin fixture terminal sample',
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
const terminalExport = createAgentSessionV3PilotShadowDebugExport(terminalShadow);

const fixtureBatch = createAgentSessionV3PilotExternalSampleFixtureBatch({
  batches: [
    {
      agreementReports: [{
        label: 'ready-report',
        report: readyAgreementReportExport,
      }],
      label: 'ready-batch',
      shadowDebugSamples: [{
        label: 'ready-shadow',
        shadow: terminalExport,
      }],
    },
    {
      agreementReports: [
        {
          label: 'mixed-primary-report',
          report: readyAgreementReportExport,
        },
        {
          label: 'mixed-duplicate-report',
          report: readyAgreementReportExport,
        },
      ],
      label: 'mixed-batch',
      shadowDebugSamples: [{
        label: 'mixed-shadow',
        shadow: terminalExport,
      }],
      thresholds: {
        maxCollectorIssues: 1,
        minAgreementSamples: 2,
        minShadowSamples: 1,
      },
    },
    {
      agreementReports: [{
        label: 'mismatch-report',
        report: mismatchAgreementReportExport,
      }],
      label: 'not-ready-batch',
      shadowDebugSamples: [{
        label: 'mismatch-shadow',
        shadow: terminalExport,
      }],
    },
    {
      agreementReports: [{
        label: 'bad-report',
        report: {
          kind: 'not-an-agreement-report',
        },
      } as never],
      label: 'malformed-batch',
      shadowDebugSamples: [{
        label: 'bad-shadow',
        shadow: {
          kind: 'not-shadow-debug',
        },
      } as never],
    },
    {
      label: 'empty-batch',
    },
  ],
  thresholds: {
    minAgreementSamples: 1,
    minShadowSamples: 1,
  },
});

assert.equal(fixtureBatch.kind, 'agent-session-v3-pilot-external-sample-fixture-batch');
assert.equal(fixtureBatch.version, 1);
assert.equal(fixtureBatch.status, 'mixed');
assert.equal(fixtureBatch.intakeCount, 5);
assert.equal(fixtureBatch.issueCount, 3);
assert.equal(fixtureBatch.entries.length, 5);
assert.equal(fixtureBatch.calibration.status, 'mixed');
assert.equal(fixtureBatch.calibration.counts.ready, 1);
assert.equal(fixtureBatch.calibration.counts.mixed, 1);
assert.equal(fixtureBatch.calibration.counts.notReady, 1);
assert.equal(fixtureBatch.calibration.counts.empty, 2);
assert.deepEqual(
  fixtureBatch.calibration.entries.map((entry) => entry.label),
  ['ready-batch', 'mixed-batch', 'not-ready-batch', 'malformed-batch', 'empty-batch'],
);
assert.deepEqual(
  fixtureBatch.calibration.entries.map((entry) => entry.status),
  ['ready', 'mixed', 'not-ready', 'empty', 'empty'],
);
assert.equal(fixtureBatch.entries[1]?.intake.issueCount, 1);
assert.equal(fixtureBatch.entries[3]?.intake.issueCount, 2);
assert.equal(fixtureBatch.entries[3]?.intake.issues[0]?.source, 'agreement-report');
assert.equal(fixtureBatch.entries[3]?.intake.issues[1]?.source, 'shadow-debug');
assert.match(fixtureBatch.summaryText, /status=mixed/u);
assert.match(fixtureBatch.summaryText, /batches=5/u);
assert.match(fixtureBatch.summaryText, /issues=3/u);

const compactFixtureBatch = createAgentSessionV3PilotExternalSampleFixtureBatch({
  batches: [{
    agreementReports: [{
      report: readyAgreementReportExport,
    }],
    shadowDebugSamples: [
      {
        label: 'first-shadow',
        shadow: terminalExport,
      },
      {
        label: 'second-shadow',
        shadow: terminalExport,
      },
    ],
  }],
  corpusOptions: {
    maxShadowDebugSamples: 1,
  },
});
assert.equal(compactFixtureBatch.entries[0]?.intake.corpus.counts.shadowDebugSampleCount, 2);
assert.equal(compactFixtureBatch.entries[0]?.intake.corpus.shadowDebugSamples?.length, 1);

const emptyFixtureBatch = createAgentSessionV3PilotExternalSampleFixtureBatch();
assert.equal(emptyFixtureBatch.status, 'empty');
assert.equal(emptyFixtureBatch.intakeCount, 0);
assert.equal(emptyFixtureBatch.issueCount, 0);
assert.deepEqual(emptyFixtureBatch.entries, []);

console.log('agent session v3 pilot external sample fixture batch smoke ok');
