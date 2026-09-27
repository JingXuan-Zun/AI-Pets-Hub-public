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
import {
  runAgentSessionV3PilotMultiCorpusManifestReport,
} from './agent-session-v3-pilot-multi-corpus-manifest-report.ts';
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
    reason: `${options.status} multi corpus manifest sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { multiReportSource } = readProjectSources({
  multiReportSource: 'scripts/agent-session-v3-pilot-multi-corpus-manifest-report.ts',
});

assert.match(
  multiReportSource,
  /export async function runAgentSessionV3PilotMultiCorpusManifestReport/u,
  'multi corpus manifest report should expose a caller-owned runner.',
);
assert.doesNotMatch(
  multiReportSource,
  /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'multi corpus manifest report should aggregate existing manifest evidence without knowing runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  multiReportSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'multi corpus manifest report should not encode a fixed desktop tool chain.',
);

const shadowResult = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin multi corpus manifest sample',
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

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-multi-corpus-manifest-report-'));
try {
  const readyCorpusPath = path.join(tempDir, 'ready-corpus.json');
  const mismatchCorpusPath = path.join(tempDir, 'mismatch-corpus.json');
  const phaseGapCorpusPath = path.join(tempDir, 'phase-gap-corpus.json');
  const readyManifestPath = path.join(tempDir, 'ready-manifest.json');
  const mismatchManifestPath = path.join(tempDir, 'mismatch-manifest.json');
  const phaseGapManifestPath = path.join(tempDir, 'phase-gap-manifest.json');
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

  const result = await runAgentSessionV3PilotMultiCorpusManifestReport({
    includeJsonText: true,
    manifestPaths: [readyManifestPath, mismatchManifestPath, phaseGapManifestPath],
    prettyJson: true,
  });

  assert.equal(result.kind, 'agent-session-v3-pilot-multi-corpus-manifest-report');
  assert.equal(result.version, 1);
  assert.equal(result.manifestCount, 3);
  assert.equal(result.entries.length, 3);
  assert.equal(result.statusCounts.ready, 1);
  assert.equal(result.statusCounts.notReady, 2);
  assert.equal(result.statusCounts.mixed, 0);
  assert.equal(result.statusCounts.empty, 0);
  assert.ok(result.failedCheckSummaries.some((summary) => (
    summary.key === 'max-mismatches'
      && summary.failedCount === 1
      && summary.manifestLabels.includes('mismatch-manifest.json')
  )));
  assert.ok(result.failedCheckSummaries.some((summary) => (
    summary.key === 'no-missing-phase-coverage'
      && summary.failedCount === 1
      && summary.manifestLabels.includes('phase-gap-manifest.json')
  )));
  assert.equal(result.phaseCoverageReadiness.status, 'needs-review');
  assert.equal(result.phaseCoverageReadiness.failedManifestCount, 1);
  assert.equal(result.phaseCoverageReadiness.failedCheckCount, 3);
  assert.deepEqual(result.phaseCoverageReadiness.manifestLabels, ['phase-gap-manifest.json']);
  assert.match(result.summaryText, /manifests=3/u);
  assert.match(result.reportText, /phaseCoverageReadiness status=needs-review/u);
  assert.match(result.reportText, /failedCheck=max-mismatches/u);
  assert.match(result.reportText, /failedCheck=no-missing-phase-coverage/u);
  assert.match(result.reportText, /profile=relaxed-single-mismatch ready=3 mixed=0 notReady=0 empty=0/u);
  assert.match(result.reportText, /profile=strict ready=2 mixed=0 notReady=1 empty=0/u);
  assert.deepEqual(
    result.entries.map((entry) => `${path.basename(entry.manifestPath)}:${entry.status}`),
    ['ready-manifest.json:ready', 'mismatch-manifest.json:not-ready', 'phase-gap-manifest.json:not-ready'],
  );
  assert.deepEqual(
    result.entries.map((entry) => `${path.basename(entry.manifestPath)}:${entry.phaseCoverageReadinessStatus}`),
    ['ready-manifest.json:clean', 'mismatch-manifest.json:clean', 'phase-gap-manifest.json:needs-review'],
  );
  assert.ok(result.entries.every((entry) => entry.reportText));
  assert.ok(result.jsonText);
  assert.match(result.jsonText, /agent-session-v3-pilot-multi-corpus-manifest-report/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot multi corpus manifest report smoke ok');
