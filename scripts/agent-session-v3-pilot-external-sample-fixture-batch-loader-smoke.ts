import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createAgentSessionV3PilotShadowAgreementReport,
  createAgentSessionV3PilotShadowAgreementReportExport,
  createAgentSessionV3PilotShadowDebugExport,
  runAgentSessionV3PilotShadowMode,
  type AgentSessionV3PilotExternalSampleFixtureSet,
  type AgentSessionV3PilotShadowAgreement,
} from '../src/agent/legacy/index.ts';
import { runAgentSessionV3PilotExternalSampleFixtureBatchLoader } from './agent-session-v3-pilot-external-sample-fixture-batch-loader.ts';
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
    reason: `${options.status} fixture loader sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { loaderSource } = readProjectSources({
  loaderSource: 'scripts/agent-session-v3-pilot-external-sample-fixture-batch-loader.ts',
});

assert.match(
  loaderSource,
  /export async function runAgentSessionV3PilotExternalSampleFixtureBatchLoader/u,
  'v3 pilot fixture loader should export a testable function.',
);
assert.match(
  loaderSource,
  /readFile\(options\.fixturePath, 'utf8'\)/u,
  'v3 pilot fixture loader should load a caller-provided JSON file.',
);
assert.doesNotMatch(
  loaderSource,
  /AgentSessionV2|runAgentSessionV2|executeAgentSessionV2|buildAgentPermissionRoute|execute_desktop|observe_windows_and_apps|locate_screen_elements|toolExecutor/u,
  'v3 pilot fixture loader should not know v2 runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  loaderSource,
  /writeFile|appendFile|createWriteStream|mkdir/u,
  'v3 pilot fixture loader should not persist reports directly.',
);
assert.doesNotMatch(
  loaderSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'v3 pilot fixture loader should not encode a fixed tool chain.',
);

const agreementReportExport = createAgentSessionV3PilotShadowAgreementReportExport(
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

const terminalShadow = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin fixture loader terminal sample',
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

const fixture: AgentSessionV3PilotExternalSampleFixtureSet = {
  batches: [
    {
      agreementReports: [{
        label: 'loaded-report',
        report: agreementReportExport,
      }],
      label: 'loaded-ready-batch',
      shadowDebugSamples: [{
        label: 'loaded-shadow',
        shadow: terminalExport,
      }],
    },
    {
      agreementReports: [{
        label: 'loaded-bad-report',
        report: {
          kind: 'not-an-agreement-report',
        },
      } as never],
      label: 'loaded-malformed-batch',
      shadowDebugSamples: [{
        label: 'loaded-bad-shadow',
        shadow: {
          kind: 'not-shadow-debug',
        },
      } as never],
    },
  ],
  thresholds: {
    minAgreementSamples: 2,
    minShadowSamples: 1,
  },
};

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-fixture-loader-'));
const fixturePath = path.join(tempDir, 'fixture.json');

try {
  await writeFile(fixturePath, JSON.stringify(fixture), 'utf8');

  const loaded = await runAgentSessionV3PilotExternalSampleFixtureBatchLoader({
    fixturePath,
    includeJsonText: true,
    prettyJson: true,
  });

  assert.equal(loaded.kind, 'agent-session-v3-pilot-external-sample-fixture-batch-loader');
  assert.equal(loaded.version, 1);
  assert.equal(loaded.fixturePath, fixturePath);
  assert.equal(loaded.result.kind, 'agent-session-v3-pilot-external-sample-fixture-batch');
  assert.equal(loaded.result.intakeCount, 2);
  assert.equal(loaded.result.issueCount, 2);
  assert.equal(loaded.result.calibration.counts.ready, 1);
  assert.equal(loaded.result.calibration.counts.empty, 1);
  assert.equal(loaded.result.calibration.status, 'mixed');
  assert.match(loaded.summaryText, /status=mixed/u);
  assert.ok(loaded.jsonText);
  assert.match(loaded.jsonText, /\n/u);
  assert.equal(JSON.parse(loaded.jsonText).kind, 'agent-session-v3-pilot-external-sample-fixture-batch');

  const summaryOnly = await runAgentSessionV3PilotExternalSampleFixtureBatchLoader({
    fixturePath,
  });
  assert.equal(summaryOnly.jsonText, null);
  assert.equal(summaryOnly.summaryText, loaded.summaryText);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot external sample fixture batch loader smoke ok');
