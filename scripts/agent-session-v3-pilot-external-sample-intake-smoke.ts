import assert from 'node:assert/strict';
import {
  createAgentSessionV3PilotExternalSampleIntake,
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
    reason: `${options.status} external intake sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { intakeSource, indexSource } = readProjectSources({
  intakeSource: 'src/agent/agentSessionV3PilotExternalSampleIntake.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(
  intakeSource,
  /export function createAgentSessionV3PilotExternalSampleIntake/u,
  'v3 pilot external sample intake should live in its own module.',
);
assert.match(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotExternalSampleIntake'/u,
  'v3 pilot external sample intake should be exported through the agent barrel.',
);
assert.doesNotMatch(
  intakeSource,
  /AgentSessionV2|runAgentSessionV2|executeAgentSessionV2|buildAgentPermissionRoute|execute_desktop|observe_windows_and_apps|locate_screen_elements|toolExecutor/u,
  'v3 pilot external sample intake should not know v2 runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  intakeSource,
  /from 'node:fs'|writeFile|appendFile|createWriteStream|mkdir/u,
  'v3 pilot external sample intake should not write logs directly.',
);
assert.doesNotMatch(
  intakeSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'v3 pilot external sample intake should not encode a fixed tool chain.',
);

const agreementReportExport = createAgentSessionV3PilotShadowAgreementReportExport(
  createAgentSessionV3PilotShadowAgreementReport([
    createAgreement({
      status: 'aligned',
      v2Status: 'completed',
    }),
    createAgreement({
      status: 'inconclusive',
      v2Status: 'budget-exceeded',
    }),
  ]),
  {
    includeSamples: true,
  },
);

const terminalShadow = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin external intake terminal sample',
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
const waitingShadow = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [{
    reason: 'begin external intake waiting sample',
    type: 'start',
  }],
});

const terminalExport = createAgentSessionV3PilotShadowDebugExport(terminalShadow);
const waitingExport = createAgentSessionV3PilotShadowDebugExport(waitingShadow);

const accepted = createAgentSessionV3PilotExternalSampleIntake({
  agreementReports: [agreementReportExport],
  corpusOptions: {
    maxShadowDebugSamples: 1,
  },
  shadowDebugSamples: [
    terminalExport,
    {
      label: 'waiting-wrapper',
      shadow: waitingExport,
    },
    null,
  ],
});

assert.equal(accepted.kind, 'agent-session-v3-pilot-external-sample-intake');
assert.equal(accepted.version, 1);
assert.equal(accepted.status, 'accepted');
assert.equal(accepted.issueCount, 0);
assert.deepEqual(accepted.issues, []);
assert.equal(accepted.corpus.counts.agreementSampleCount, 2);
assert.equal(accepted.corpus.counts.shadowDebugSampleCount, 2);
assert.equal(accepted.corpus.counts.shadowAnomalySampleCount, 1);
assert.equal(accepted.corpus.shadowDebugSamples?.length, 1);
assert.equal(accepted.corpus.shadowDebugSamples?.[0]?.label, null);
assert.match(accepted.summaryText, /status=accepted/u);

const duplicateAndMalformed = createAgentSessionV3PilotExternalSampleIntake({
  agreementReports: [
    {
      label: 'primary-report',
      report: agreementReportExport,
    },
    agreementReportExport,
    {
      kind: 'not-a-report',
    } as never,
  ],
  shadowDebugSamples: [
    {
      label: 'bad-shadow-wrapper',
      shadow: {
        kind: 'not-shadow-debug',
      },
    } as never,
    {
      kind: 'unknown-shadow-source',
    } as never,
    {
      label: 'waiting-valid',
      shadow: waitingExport,
    },
  ],
});

assert.equal(duplicateAndMalformed.status, 'partial');
assert.equal(duplicateAndMalformed.issueCount, 4);
assert.equal(duplicateAndMalformed.corpus.counts.agreementSampleCount, 2);
assert.equal(duplicateAndMalformed.corpus.counts.shadowDebugSampleCount, 1);
assert.equal(duplicateAndMalformed.corpus.shadowDebugSamples?.[0]?.label, 'waiting-valid');
assert.equal(duplicateAndMalformed.issues[0]?.source, 'agreement-report');
assert.match(duplicateAndMalformed.issues[0]?.reason ?? '', /Only one aggregate/u);
assert.equal(duplicateAndMalformed.issues[1]?.source, 'agreement-report');
assert.match(duplicateAndMalformed.issues[1]?.reason ?? '', /not a report export/u);
assert.equal(duplicateAndMalformed.issues[2]?.source, 'shadow-debug');
assert.equal(duplicateAndMalformed.issues[2]?.label, 'bad-shadow-wrapper');
assert.match(duplicateAndMalformed.issues[2]?.reason ?? '', /not a v3 pilot shadow debug export/u);
assert.equal(duplicateAndMalformed.issues[3]?.source, 'shadow-debug');
assert.match(duplicateAndMalformed.issues[3]?.reason ?? '', /not a shadow debug export or labelled shadow wrapper/u);

const empty = createAgentSessionV3PilotExternalSampleIntake({});
assert.equal(empty.status, 'empty');
assert.equal(empty.issueCount, 0);
assert.equal(empty.corpus.counts.agreementSampleCount, 0);
assert.equal(empty.corpus.counts.shadowDebugSampleCount, 0);
assert.match(empty.summaryText, /status=empty/u);

const nullOnly = createAgentSessionV3PilotExternalSampleIntake({
  agreementReports: [null],
  shadowDebugSamples: [null],
});
assert.equal(nullOnly.status, 'empty');
assert.equal(nullOnly.issueCount, 0);

console.log('agent session v3 pilot external sample intake smoke ok');
