import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
import { runAgentSessionV3PilotBaselineCorpusManifestReport } from './agent-session-v3-pilot-baseline-corpus-manifest-report.ts';
import { runAgentSessionV3PilotCorpusBatchIndexReport } from './agent-session-v3-pilot-corpus-batch-index-report.ts';
import { runAgentSessionV3PilotExternalSampleCorpusManifestLoader } from './agent-session-v3-pilot-external-sample-corpus-manifest-loader.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
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
    reason: `${options.status} real corpus intake dry-run sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { intakeTemplateSource } = readProjectSources({
  intakeTemplateSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-template.ts',
});

assert.doesNotMatch(
  intakeTemplateSource,
  /execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'real corpus batch intake template should not know concrete desktop tools, permission routing, or tool execution.',
);
assert.doesNotMatch(
  intakeTemplateSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'real corpus batch intake template should not encode a fixed desktop tool chain.',
);

const shadowResult = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin real corpus intake dry-run sample',
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

function createCorpus(status: AgentSessionV3PilotShadowAgreement['status']) {
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
      shadow: shadowExport,
    }],
  });
}

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-intake-dry-run-'));
try {
  const intakeTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: tempDir,
    prettyJson: true,
  });
  const baselineReport = await runAgentSessionV3PilotBaselineCorpusManifestReport({
    maxShadowDebugSamples: 3,
    outDir: path.join(tempDir, 'baseline'),
    prettyJson: true,
  });
  const corpusDir = path.join(tempDir, 'corpora');
  const readyCorpusPath = path.join(corpusDir, 'ready-corpus.json');
  const mismatchCorpusPath = path.join(corpusDir, 'mismatch-corpus.json');

  await mkdir(corpusDir, {
    recursive: true,
  });
  await writeFile(readyCorpusPath, JSON.stringify(createCorpus('aligned')), 'utf8');
  await writeFile(mismatchCorpusPath, JSON.stringify(createCorpus('mismatch')), 'utf8');

  const realManifest = {
    ...intakeTemplate.manifest,
    sources: [
      {
        label: 'ready-real-batch',
        path: './corpora/ready-corpus.json',
      },
      {
        label: 'mismatch-real-batch',
        path: './corpora/mismatch-corpus.json',
      },
    ],
  };

  assert.ok(intakeTemplate.manifestPath);
  assert.ok(intakeTemplate.indexPath);
  assert.equal(baselineReport.manifestPath, path.join(tempDir, 'baseline', 'explicit-debug-corpus-manifest.json'));

  await writeFile(
    intakeTemplate.manifestPath,
    JSON.stringify(realManifest, null, 2),
    'utf8',
  );

  const realManifestReport = await runAgentSessionV3PilotExternalSampleCorpusManifestLoader({
    includeReportText: true,
    manifestPath: intakeTemplate.manifestPath,
    prettyJson: true,
  });

  assert.equal(realManifestReport.kind, 'agent-session-v3-pilot-external-sample-corpus-manifest-loader');
  assert.equal(realManifestReport.fixturePath, null);
  assert.equal(realManifestReport.sourceCount, 2);
  assert.equal(realManifestReport.status, 'mixed');
  assert.equal(realManifestReport.fixtureBatch.calibration.counts.ready, 1);
  assert.equal(realManifestReport.fixtureBatch.calibration.counts.notReady, 1);
  assert.equal(realManifestReport.diagnostics.failedEntryCount, 1);
  assert.match(realManifestReport.reportText ?? '', /status=mixed/u);
  assert.match(realManifestReport.reportText ?? '', /failedCheck=max-mismatches/u);

  const indexReport = await runAgentSessionV3PilotCorpusBatchIndexReport({
    includeJsonText: true,
    indexPath: intakeTemplate.indexPath,
    prettyJson: true,
  });

  assert.equal(indexReport.kind, 'agent-session-v3-pilot-corpus-batch-index-report');
  assert.equal(indexReport.manifestCount, 2);
  assert.deepEqual(
    indexReport.entries.map((entry) => `${entry.sourceKind}:${entry.status}`),
    ['baseline:ready', 'production-like:mixed'],
  );
  assert.deepEqual(
    indexReport.sourceKindSummaries.map((summary) => `${summary.sourceKind}:${summary.statusCounts.ready}:${summary.statusCounts.mixed}:${summary.statusCounts.notReady}`),
    ['baseline:1:0:0', 'production-like:0:1:0'],
  );
  assert.equal(indexReport.multiReport.statusCounts.ready, 1);
  assert.equal(indexReport.multiReport.statusCounts.mixed, 1);
  assert.equal(indexReport.multiReport.statusCounts.notReady, 0);
  assert.equal(indexReport.phaseCoverageCalibration.status, 'clean');
  assert.equal(indexReport.phaseCoverageCalibration.failedManifestCount, 0);
  assert.ok(indexReport.sourceKindSummaries.every((summary) => (
    summary.phaseCoverageReadinessCounts.needsReview === 0
  )));
  assert.match(indexReport.reportText, /sourceKind=baseline manifests=1 ready=1/u);
  assert.match(indexReport.reportText, /sourceKind=production-like manifests=1 ready=0 mixed=1/u);
  assert.match(indexReport.reportText, /phaseCoverageReadiness status=clean/u);
  assert.ok(indexReport.jsonText);
  assert.match(indexReport.jsonText, /agent-session-v3-pilot-corpus-batch-index-report/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch intake dry-run smoke ok');
