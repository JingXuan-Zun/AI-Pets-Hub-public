import assert from 'node:assert/strict';
import {
  createAgentSessionV3PilotDebugSampleCorpusExport,
  createAgentSessionV3PilotExternalSampleFixtureBatch,
  createAgentSessionV3PilotReadinessFailureDiagnostics,
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
    reason: `${options.status} readiness failure diagnostics sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { diagnosticsSource, indexSource } = readProjectSources({
  diagnosticsSource: 'src/agent/agentSessionV3PilotReadinessFailureDiagnostics.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(
  diagnosticsSource,
  /export function createAgentSessionV3PilotReadinessFailureDiagnostics/u,
  'v3 pilot readiness failure diagnostics should live in its own module.',
);
assert.match(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotReadinessFailureDiagnostics'/u,
  'v3 pilot readiness failure diagnostics should be exported through the agent barrel.',
);
assert.doesNotMatch(
  diagnosticsSource,
  /AgentSessionV2|runAgentSessionV2|executeAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'v3 pilot readiness failure diagnostics should not know runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  diagnosticsSource,
  /from 'node:fs'|writeFile|appendFile|createWriteStream|readFile|mkdir/u,
  'v3 pilot readiness failure diagnostics should not read or write files.',
);
assert.doesNotMatch(
  diagnosticsSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'v3 pilot readiness failure diagnostics should not encode a fixed desktop tool chain.',
);

const shadowResult = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin diagnostics sample',
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
    {
      label: 'empty-batch',
    },
  ],
  thresholds: {
    minAgreementSamples: 1,
    minShadowSamples: 1,
  },
});

const diagnostics = createAgentSessionV3PilotReadinessFailureDiagnostics({
  calibration: fixtureBatch.calibration,
  maxLabelsPerCheck: 1,
});

assert.equal(diagnostics.kind, 'agent-session-v3-pilot-readiness-failure-diagnostics');
assert.equal(diagnostics.version, 1);
assert.equal(diagnostics.calibrationStatus, 'mixed');
assert.equal(diagnostics.status, 'has-failures');
assert.equal(diagnostics.entryCount, 3);
assert.equal(diagnostics.failedEntryCount, 2);
assert.equal(diagnostics.failedEntries[0]?.label, 'mismatch-batch');
assert.equal(diagnostics.failedEntries[0]?.failedCheckKeys[0], 'max-mismatches');
assert.ok(diagnostics.failedEntries[1]?.failedCheckKeys.includes('min-agreement-samples'));
assert.ok(diagnostics.failedEntries[1]?.failedCheckKeys.includes('min-shadow-samples'));
assert.equal(diagnostics.checkSummaries[0]?.key, 'max-mismatches');
assert.equal(diagnostics.checkSummaries[0]?.failedCount, 1);
assert.equal(diagnostics.checkSummaries[0]?.maxActual, 1);
assert.equal(diagnostics.checkSummaries[0]?.maxRequired, 0);
assert.deepEqual(diagnostics.checkSummaries[0]?.sampleLabels, ['mismatch-batch']);
assert.match(diagnostics.summaryText, /status=has-failures/u);
assert.match(diagnostics.summaryText, /failedEntries=2/u);

const cleanFixtureBatch = createAgentSessionV3PilotExternalSampleFixtureBatch({
  batches: [{
    agreementReports: [{
      report: readyReport,
    }],
    shadowDebugSamples: [{
      shadow: shadowExport,
    }],
  }],
});
const cleanDiagnostics = createAgentSessionV3PilotReadinessFailureDiagnostics({
  calibration: cleanFixtureBatch.calibration,
});
assert.equal(cleanDiagnostics.status, 'clean');
assert.equal(cleanDiagnostics.failedEntryCount, 0);
assert.deepEqual(cleanDiagnostics.checkSummaries, []);

const emptyFixtureBatch = createAgentSessionV3PilotExternalSampleFixtureBatch();
const emptyDiagnostics = createAgentSessionV3PilotReadinessFailureDiagnostics({
  calibration: emptyFixtureBatch.calibration,
});
assert.equal(emptyDiagnostics.status, 'empty');
assert.equal(emptyDiagnostics.entryCount, 0);

const compactCorpus = createAgentSessionV3PilotDebugSampleCorpusExport({
  agreementReport: readyReport,
  shadowDebugSamples: [shadowExport],
});
assert.equal(compactCorpus.counts.agreementSampleCount, 1);
assert.equal(compactCorpus.counts.shadowDebugSampleCount, 1);

const shadowWithoutPhaseCoverage = createAgentSessionV3PilotShadowDebugExport(shadowResult, {
  includePhaseCoverage: false,
});
const strictPhaseFixtureBatch = createAgentSessionV3PilotExternalSampleFixtureBatch({
  batches: [{
    agreementReports: [{
      report: readyReport,
    }],
    label: 'phase-gap-batch',
    shadowDebugSamples: [{
      shadow: shadowWithoutPhaseCoverage,
    }],
  }],
  thresholds: {
    minAgreementSamples: 1,
    minShadowSamples: 1,
    minTerminalObservedShadowSamples: 1,
    requireFullPhaseCoverage: true,
    requireNoMissingPhaseCoverage: true,
  },
});
const strictPhaseDiagnostics = createAgentSessionV3PilotReadinessFailureDiagnostics({
  calibration: strictPhaseFixtureBatch.calibration,
});
const strictPhaseFailedKeys = new Set(
  strictPhaseDiagnostics.checkSummaries.map((summary) => summary.key),
);
assert.equal(strictPhaseDiagnostics.status, 'has-failures');
assert.equal(strictPhaseDiagnostics.failedEntryCount, 1);
assert.equal(strictPhaseFailedKeys.has('no-missing-phase-coverage'), true);
assert.equal(strictPhaseFailedKeys.has('full-phase-coverage'), true);
assert.equal(strictPhaseFailedKeys.has('min-terminal-observed-shadow-samples'), true);

console.log('agent session v3 pilot readiness failure diagnostics smoke ok');
