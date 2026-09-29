import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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
import { runAgentSessionV3PilotExternalSampleCorpusManifestTemplate } from './agent-session-v3-pilot-external-sample-corpus-manifest-template.ts';
import { runAgentSessionV3PilotCorpusBatchIndexReport } from './agent-session-v3-pilot-corpus-batch-index-report.ts';
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
    reason: `${options.status} corpus batch index sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { indexReportSource } = readProjectSources({
  indexReportSource: 'scripts/agent-session-v3-pilot-corpus-batch-index-report.ts',
});

assert.match(
  indexReportSource,
  /export async function runAgentSessionV3PilotCorpusBatchIndexReport/u,
  'corpus batch index report should expose a caller-owned runner.',
);
assert.doesNotMatch(
  indexReportSource,
  /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'corpus batch index report should group manifest evidence without knowing runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  indexReportSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'corpus batch index report should not encode a fixed desktop tool chain.',
);

const shadowResult = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin corpus batch index sample',
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

function createCorpus(
  status: AgentSessionV3PilotShadowAgreement['status'],
  shadow = shadowExport,
) {
  return createAgentSessionV3PilotDebugSampleCorpusExport({
    agreementReport: createAgentSessionV3PilotShadowAgreementReportExport(
      createAgentSessionV3PilotShadowAgreementReport([
        createAgreement({
          status,
          v2Status: status === 'aligned' ? 'completed' : 'failed',
        }),
      ]),
      {
        includeSamples: true,
      },
    ),
    shadowDebugSamples: [{
      label: `${status}-shadow`,
      shadow,
    }],
  });
}

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-corpus-batch-index-report-'));
try {
  const readyCorpusPath = path.join(tempDir, 'ready-corpus.json');
  const mismatchCorpusPath = path.join(tempDir, 'mismatch-corpus.json');
  const phaseGapCorpusPath = path.join(tempDir, 'phase-gap-corpus.json');
  const readyManifestPath = path.join(tempDir, 'ready-manifest.json');
  const mismatchManifestPath = path.join(tempDir, 'mismatch-manifest.json');
  const phaseGapManifestPath = path.join(tempDir, 'phase-gap-manifest.json');
  const indexPath = path.join(tempDir, 'corpus-batch-index.json');
  const template = await runAgentSessionV3PilotExternalSampleCorpusManifestTemplate();

  await writeFile(readyCorpusPath, JSON.stringify(createCorpus('aligned')), 'utf8');
  await writeFile(mismatchCorpusPath, JSON.stringify(createCorpus('mismatch')), 'utf8');
  await writeFile(phaseGapCorpusPath, JSON.stringify(createCorpus('aligned', shadowWithoutPhaseCoverage)), 'utf8');
  await writeFile(readyManifestPath, JSON.stringify({
    ...template.manifest,
    sources: [
      {
        label: 'ready-batch',
        path: path.basename(readyCorpusPath),
      },
    ],
  }), 'utf8');
  await writeFile(mismatchManifestPath, JSON.stringify({
    ...template.manifest,
    sources: [
      {
        label: 'mismatch-batch',
        path: path.basename(mismatchCorpusPath),
      },
    ],
  }), 'utf8');
  await writeFile(phaseGapManifestPath, JSON.stringify({
    ...template.manifest,
    sources: [
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
    ],
  }), 'utf8');
  await writeFile(indexPath, JSON.stringify({
    batches: [
      {
        generatedAt: '2026-06-22T00:00:00.000Z',
        label: 'baseline-ready',
        manifestPath: path.basename(readyManifestPath),
        notes: 'baseline synthetic ready batch',
        sourceKind: 'baseline',
      },
      {
        generatedAt: '2026-06-22T00:05:00.000Z',
        label: 'manual-mismatch',
        manifestPath: path.basename(mismatchManifestPath),
        sourceKind: 'manual',
      },
      {
        generatedAt: '2026-06-22T00:10:00.000Z',
        label: 'production-like-phase-gap',
        manifestPath: path.basename(phaseGapManifestPath),
        notes: 'phase coverage calibration gap batch',
        sourceKind: 'production-like',
      },
    ],
    version: 1,
  }), 'utf8');

  const result = await runAgentSessionV3PilotCorpusBatchIndexReport({
    includeJsonText: true,
    indexPath,
    prettyJson: true,
  });

  assert.equal(result.kind, 'agent-session-v3-pilot-corpus-batch-index-report');
  assert.equal(result.version, 1);
  assert.equal(result.indexPath, indexPath);
  assert.equal(result.manifestCount, 3);
  assert.equal(result.entries.length, 3);
  assert.deepEqual(
    result.entries.map((entry) => `${entry.label}:${entry.sourceKind}:${entry.status}:${entry.phaseCoverageReadinessStatus}`),
    [
      'baseline-ready:baseline:ready:clean',
      'manual-mismatch:manual:not-ready:clean',
      'production-like-phase-gap:production-like:not-ready:needs-review',
    ],
  );
  assert.equal(result.sourceKindSummaries.length, 3);
  assert.deepEqual(
    result.sourceKindSummaries.map((summary) => [
      summary.sourceKind,
      summary.statusCounts.ready,
      summary.statusCounts.notReady,
      summary.phaseCoverageReadinessCounts.clean,
      summary.phaseCoverageReadinessCounts.needsReview,
      summary.phaseCoverageFailedCheckCount,
    ].join(':')),
    [
      'baseline:1:0:1:0:0',
      'manual:0:1:1:0:0',
      'production-like:0:1:0:1:3',
    ],
  );
  assert.equal(result.phaseCoverageCalibration.status, 'needs-review');
  assert.equal(result.phaseCoverageCalibration.failedManifestCount, 1);
  assert.deepEqual(result.phaseCoverageCalibration.manifestLabels, ['phase-gap-manifest.json']);
  assert.equal(result.multiReport.statusCounts.ready, 1);
  assert.equal(result.multiReport.statusCounts.notReady, 2);
  assert.ok(result.multiReport.failedCheckSummaries.some((summary) => summary.key === 'max-mismatches'));
  assert.ok(result.multiReport.failedCheckSummaries.some((summary) => summary.key === 'no-missing-phase-coverage'));
  assert.match(result.summaryText, /sourceKinds=3/u);
  assert.match(result.summaryText, /phaseCoverage=needs-review/u);
  assert.match(result.reportText, /phaseCoverageReadiness status=needs-review/u);
  assert.match(result.reportText, /sourceKind=baseline manifests=1 ready=1 mixed=0 notReady=0 empty=0 phaseCoverageClean=1 phaseCoverageNeedsReview=0/u);
  assert.match(result.reportText, /sourceKind=manual manifests=1 ready=0 mixed=0 notReady=1 empty=0 phaseCoverageClean=1 phaseCoverageNeedsReview=0/u);
  assert.match(result.reportText, /sourceKind=production-like manifests=1 ready=0 mixed=0 notReady=1 empty=0 phaseCoverageClean=0 phaseCoverageNeedsReview=1 phaseCoverageFailedChecks=3/u);
  assert.match(result.reportText, /failedCheck=max-mismatches/u);
  assert.match(result.reportText, /failedCheck=no-missing-phase-coverage/u);
  assert.ok(result.jsonText);
  assert.match(result.jsonText, /agent-session-v3-pilot-corpus-batch-index-report/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot corpus batch index report smoke ok');
