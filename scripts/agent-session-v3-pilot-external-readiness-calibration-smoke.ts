import assert from 'node:assert/strict';
import {
  createAgentSessionV3PilotExternalReadinessCalibration,
  createAgentSessionV3PilotExternalSampleIntake,
  createAgentSessionV3PilotShadowAgreementReport,
  createAgentSessionV3PilotShadowAgreementReportExport,
  createAgentSessionV3PilotShadowDebugExport,
  runAgentSessionV3PilotShadowMode,
  type AgentSessionV3PilotExternalSampleIntakeResult,
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
    reason: `${options.status} calibration sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { calibrationSource, indexSource } = readProjectSources({
  calibrationSource: 'src/agent/agentSessionV3PilotExternalReadinessCalibration.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(
  calibrationSource,
  /export function createAgentSessionV3PilotExternalReadinessCalibration/u,
  'v3 pilot external readiness calibration should live in its own module.',
);
assert.match(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotExternalReadinessCalibration'/u,
  'v3 pilot external readiness calibration should be exported through the agent barrel.',
);
assert.doesNotMatch(
  calibrationSource,
  /AgentSessionV2|runAgentSessionV2|executeAgentSessionV2|buildAgentPermissionRoute|execute_desktop|observe_windows_and_apps|locate_screen_elements|toolExecutor/u,
  'v3 pilot external readiness calibration should not know v2 runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  calibrationSource,
  /from 'node:fs'|writeFile|appendFile|createWriteStream|mkdir/u,
  'v3 pilot external readiness calibration should not write logs directly.',
);
assert.doesNotMatch(
  calibrationSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'v3 pilot external readiness calibration should not encode a fixed tool chain.',
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
      reason: 'begin calibration terminal sample',
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

const readyIntake = createAgentSessionV3PilotExternalSampleIntake({
  agreementReports: [readyAgreementReportExport],
  shadowDebugSamples: [terminalExport],
});
assert.equal(readyIntake.status, 'accepted');

const mixedIntake = createAgentSessionV3PilotExternalSampleIntake({
  agreementReports: [
    readyAgreementReportExport,
    readyAgreementReportExport,
  ],
  shadowDebugSamples: [terminalExport],
});
assert.equal(mixedIntake.status, 'partial');
assert.equal(mixedIntake.issueCount, 1);

const notReadyIntake = createAgentSessionV3PilotExternalSampleIntake({
  agreementReports: [mismatchAgreementReportExport],
  shadowDebugSamples: [terminalExport],
});
assert.equal(notReadyIntake.status, 'accepted');

const emptyIntake = createAgentSessionV3PilotExternalSampleIntake({});
assert.equal(emptyIntake.status, 'empty');

const allReady = createAgentSessionV3PilotExternalReadinessCalibration({
  samples: [{
    intake: readyIntake,
    label: 'ready',
  }],
  thresholds: {
    minAgreementSamples: 2,
    minShadowSamples: 1,
  },
});
assert.equal(allReady.kind, 'agent-session-v3-pilot-external-readiness-calibration');
assert.equal(allReady.version, 1);
assert.equal(allReady.status, 'ready');
assert.equal(allReady.counts.total, 1);
assert.equal(allReady.counts.ready, 1);
assert.equal(allReady.entries[0]?.label, 'ready');
assert.equal(allReady.entries[0]?.status, 'ready');
assert.equal(allReady.entries[0]?.readiness.status, 'ready');
assert.match(allReady.summaryText, /status=ready/u);

const mixed = createAgentSessionV3PilotExternalReadinessCalibration({
  samples: [
    {
      intake: readyIntake,
      label: 'ready',
    },
    {
      intake: mixedIntake,
      label: 'mixed',
      thresholds: {
        maxCollectorIssues: 1,
        minAgreementSamples: 2,
        minShadowSamples: 1,
      },
    },
    {
      intake: notReadyIntake,
      label: 'not-ready',
    },
    {
      intake: emptyIntake,
      label: 'empty',
    },
  ],
  thresholds: {
    minAgreementSamples: 1,
    minShadowSamples: 1,
  },
});

assert.equal(mixed.status, 'mixed');
assert.equal(mixed.counts.total, 4);
assert.equal(mixed.counts.ready, 1);
assert.equal(mixed.counts.mixed, 1);
assert.equal(mixed.counts.notReady, 1);
assert.equal(mixed.counts.empty, 1);
assert.deepEqual(
  mixed.entries.map((entry) => entry.status),
  ['ready', 'mixed', 'not-ready', 'empty'],
);
assert.equal(mixed.entries[1]?.intakeIssueCount, 1);
assert.equal(mixed.entries[1]?.readiness.status, 'ready');
assert.equal(mixed.entries[2]?.readiness.status, 'not-ready');
assert.match(mixed.summaryText, /ready=1 mixed=1 notReady=1 empty=1/u);

const allNotReady = createAgentSessionV3PilotExternalReadinessCalibration({
  samples: [{
    intake: notReadyIntake,
    label: 'blocked',
  }],
});
assert.equal(allNotReady.status, 'not-ready');
assert.equal(allNotReady.counts.notReady, 1);
assert.equal(allNotReady.entries[0]?.readiness.checks.find((check) => check.key === 'max-mismatches')?.actual, 1);

const noSamples = createAgentSessionV3PilotExternalReadinessCalibration();
assert.equal(noSamples.status, 'empty');
assert.equal(noSamples.counts.total, 0);
assert.deepEqual(noSamples.entries, []);

const onlyEmpty = createAgentSessionV3PilotExternalReadinessCalibration({
  samples: [{
    intake: emptyIntake,
    label: 'empty-only',
  }],
});
assert.equal(onlyEmpty.status, 'empty');
assert.equal(onlyEmpty.counts.empty, 1);

const typedIntake: AgentSessionV3PilotExternalSampleIntakeResult = readyIntake;
assert.equal(
  createAgentSessionV3PilotExternalReadinessCalibration({
    samples: [{ intake: typedIntake }],
  }).entries.length,
  1,
);

console.log('agent session v3 pilot external readiness calibration smoke ok');
