import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createAgentSessionV3PilotDebugSampleCorpusExport,
  createAgentSessionV3PilotShadowAgreementReport,
  createAgentSessionV3PilotShadowAgreementReportExport,
  createAgentSessionV3PilotShadowDebugExport,
  runAgentSessionV3PilotShadowMode,
  type AgentSessionV3PilotShadowAgreement,
} from '../src/agent/legacy/index.ts';
import { runAgentSessionV3PilotExternalSampleCorpusManifestLoader } from './agent-session-v3-pilot-external-sample-corpus-manifest-loader.ts';
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
    reason: `${options.status} corpus manifest sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { manifestLoaderSource } = readProjectSources({
  manifestLoaderSource: 'scripts/agent-session-v3-pilot-external-sample-corpus-manifest-loader.ts',
});

assert.match(
  manifestLoaderSource,
  /export async function runAgentSessionV3PilotExternalSampleCorpusManifestLoader/u,
  'v3 pilot external sample corpus manifest loader should expose a caller-owned runner.',
);
assert.doesNotMatch(
  manifestLoaderSource,
  /runAgentSessionV2|executeAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'v3 pilot external sample corpus manifest loader should not know runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  manifestLoaderSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'v3 pilot external sample corpus manifest loader should not encode a fixed desktop tool chain.',
);

const shadowResult = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin corpus manifest sample',
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
const shadowWithoutPhaseCoverage = createAgentSessionV3PilotShadowDebugExport(shadowResult, {
  includePhaseCoverage: false,
});

const readyCorpus = createAgentSessionV3PilotDebugSampleCorpusExport({
  agreementReport: createAgentSessionV3PilotShadowAgreementReportExport(
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
  ),
  shadowDebugSamples: [{
    label: 'ready-shadow',
    shadow: shadowExport,
  }],
});

const mismatchCorpus = createAgentSessionV3PilotDebugSampleCorpusExport({
  agreementReport: createAgentSessionV3PilotShadowAgreementReportExport(
    createAgentSessionV3PilotShadowAgreementReport([
      createAgreement({
        status: 'mismatch',
        v2Status: 'failed',
      }),
    ]),
    {
      includeSamples: true,
    },
  ),
  shadowDebugSamples: [{
    label: 'mismatch-shadow',
    shadow: shadowExport,
  }],
});

const phaseGapCorpus = createAgentSessionV3PilotDebugSampleCorpusExport({
  agreementReport: createAgentSessionV3PilotShadowAgreementReportExport(
    createAgentSessionV3PilotShadowAgreementReport([
      createAgreement({
        status: 'aligned',
        v2Status: 'completed',
      }),
    ]),
    {
      includeSamples: true,
    },
  ),
  shadowDebugSamples: [{
    label: 'phase-gap-shadow',
    shadow: shadowWithoutPhaseCoverage,
  }],
});

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-corpus-manifest-'));
try {
  const readyCorpusPath = path.join(tempDir, 'ready-corpus.json');
  const mismatchCorpusPath = path.join(tempDir, 'mismatch-corpus.json');
  const phaseGapCorpusPath = path.join(tempDir, 'phase-gap-corpus.json');
  const malformedCorpusPath = path.join(tempDir, 'malformed-corpus.json');
  const manifestPath = path.join(tempDir, 'corpus-manifest.json');
  const fixturePath = path.join(tempDir, 'manifest-fixture-set.json');

  await writeFile(readyCorpusPath, JSON.stringify(readyCorpus), 'utf8');
  await writeFile(mismatchCorpusPath, JSON.stringify(mismatchCorpus), 'utf8');
  await writeFile(phaseGapCorpusPath, JSON.stringify(phaseGapCorpus), 'utf8');
  await writeFile(malformedCorpusPath, JSON.stringify({ kind: 'not-a-corpus', version: 1 }), 'utf8');
  await writeFile(manifestPath, JSON.stringify({
    sources: [
      {
        label: 'ready-batch',
        path: path.basename(readyCorpusPath),
      },
      {
        label: 'mismatch-batch',
        path: path.basename(mismatchCorpusPath),
      },
      {
        label: 'phase-gap-batch',
        path: path.basename(phaseGapCorpusPath),
        thresholds: {
          minAgreementSamples: 1,
          minShadowSamples: 1,
          minTerminalObservedShadowSamples: 1,
          requireFullPhaseCoverage: true,
          requireNoMissingPhaseCoverage: true,
        },
      },
      {
        label: 'malformed-batch',
        path: path.basename(malformedCorpusPath),
      },
    ],
    thresholdProfiles: [
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
    ],
    thresholds: {
      minAgreementSamples: 1,
      minShadowSamples: 1,
    },
  }), 'utf8');

  const loaded = await runAgentSessionV3PilotExternalSampleCorpusManifestLoader({
    fixtureOutPath: fixturePath,
    includeJsonText: true,
    includeReportText: true,
    manifestPath,
    prettyJson: true,
  });

  assert.equal(loaded.kind, 'agent-session-v3-pilot-external-sample-corpus-manifest-loader');
  assert.equal(loaded.version, 1);
  assert.equal(loaded.manifestPath, manifestPath);
  assert.equal(loaded.fixturePath, fixturePath);
  assert.equal(loaded.sourceCount, 4);
  assert.equal(loaded.fixtureExport.status, 'partial');
  assert.equal(loaded.fixtureExport.batchCount, 3);
  assert.equal(loaded.fixtureExport.issueCount, 1);
  assert.equal(loaded.fixtureExport.issues[0]?.label, 'malformed-batch');
  assert.equal(loaded.fixtureBatch.status, 'mixed');
  assert.equal(loaded.fixtureBatch.calibration.counts.ready, 1);
  assert.equal(loaded.fixtureBatch.calibration.counts.notReady, 2);
  assert.equal(loaded.fixtureBatch.issueCount, 0);
  assert.equal(loaded.diagnostics.status, 'has-failures');
  assert.equal(loaded.diagnostics.failedEntryCount, 2);
  assert.ok(loaded.diagnostics.checkSummaries.some((check) => check.key === 'max-mismatches'));
  assert.ok(loaded.diagnostics.checkSummaries.some((check) => check.key === 'no-missing-phase-coverage'));
  assert.equal(loaded.phaseCoverageReadiness.status, 'needs-review');
  assert.equal(loaded.phaseCoverageReadiness.failedCheckCount, 3);
  assert.deepEqual(loaded.phaseCoverageReadiness.affectedSampleLabels, ['phase-gap-batch']);
  assert.equal(loaded.profileComparison.status, 'compared');
  assert.equal(loaded.profileComparison.profileCount, 2);
  assert.deepEqual(
    loaded.profileComparison.entries.map((entry) => `${entry.label}:${entry.status}`),
    ['strict:mixed', 'relaxed-mismatch:ready'],
  );
  assert.equal(loaded.profileComparison.entries[0]?.diagnostics.status, 'has-failures');
  assert.equal(loaded.profileComparison.entries[1]?.diagnostics.status, 'clean');
  assert.equal(loaded.status, 'mixed');
  assert.match(loaded.summaryText, /status=mixed/u);
  assert.match(loaded.summaryText, /exportIssues=1/u);
  assert.match(loaded.summaryText, /profiles=2/u);
  assert.ok(loaded.reportText);
  assert.match(loaded.reportText, /AgentSessionV3PilotExternalSampleCorpusManifestReport/u);
  assert.match(loaded.reportText, /status=mixed/u);
  assert.match(loaded.reportText, /calibration ready=1 mixed=0 notReady=2 empty=0/u);
  assert.match(loaded.reportText, /diagnostics status=has-failures failedEntries=2 failedChecks=4/u);
  assert.match(loaded.reportText, /phaseCoverageReadiness status=needs-review failedChecks=3/u);
  assert.match(loaded.reportText, /failedCheck=max-mismatches count=1 maxActual=1 maxRequired=0 labels=mismatch-batch/u);
  assert.match(loaded.reportText, /failedCheck=no-missing-phase-coverage count=1 maxActual=1 maxRequired=0 labels=phase-gap-batch/u);
  assert.match(loaded.reportText, /profile=strict status=mixed failedEntries=1 top=max-mismatches:1/u);
  assert.match(loaded.reportText, /profile=relaxed-mismatch status=ready failedEntries=0 top=none phaseCoverage=clean/u);
  assert.ok(loaded.jsonText);
  assert.match(loaded.jsonText, /\n/u);
  assert.match(loaded.jsonText, /AgentSessionV3PilotExternalSampleCorpusManifestReport/u);

  const writtenFixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  assert.equal(writtenFixture.batches.length, 3);
  assert.deepEqual(
    writtenFixture.batches.map((batch: { label: string }) => batch.label),
    ['ready-batch', 'mismatch-batch', 'phase-gap-batch'],
  );

  const reloadedFixture = await runAgentSessionV3PilotExternalSampleFixtureBatchLoader({
    fixturePath,
    includeJsonText: true,
  });
  assert.equal(reloadedFixture.result.status, 'mixed');
  assert.equal(reloadedFixture.result.calibration.counts.ready, 1);
  assert.equal(reloadedFixture.result.calibration.counts.notReady, 2);
  assert.ok(reloadedFixture.jsonText);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot external sample corpus manifest loader smoke ok');
