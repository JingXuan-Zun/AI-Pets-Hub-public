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
import { runAgentSessionV3PilotRealCorpusBatchEvidenceSummary } from './agent-session-v3-pilot-real-corpus-batch-evidence-summary.ts';
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
    reason: `${options.status} real corpus evidence summary sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { evidenceSummarySource } = readProjectSources({
  evidenceSummarySource: 'scripts/agent-session-v3-pilot-real-corpus-batch-evidence-summary.ts',
});

assert.match(
  evidenceSummarySource,
  /export async function runAgentSessionV3PilotRealCorpusBatchEvidenceSummary/u,
  'real corpus batch evidence summary should expose a caller-owned runner.',
);
assert.doesNotMatch(
  evidenceSummarySource,
  /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'real corpus batch evidence summary should not know runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  evidenceSummarySource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'real corpus batch evidence summary should not encode a fixed desktop tool chain.',
);

const missingTempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-evidence-summary-missing-'));
try {
  const missingSummary = await runAgentSessionV3PilotRealCorpusBatchEvidenceSummary({
    includeJsonText: true,
    intakeDir: missingTempDir,
    prettyJson: true,
  });

  assert.equal(missingSummary.kind, 'agent-session-v3-pilot-real-corpus-batch-evidence-summary');
  assert.equal(missingSummary.version, 1);
  assert.equal(missingSummary.status, 'blocked');
  assert.equal(missingSummary.validator.status, 'missing');
  assert.equal(missingSummary.metadataQuality.status, 'review-needed');
  assert.equal(missingSummary.metadataCounts.metadataIssues, 1);
  assert.equal(missingSummary.metadataCounts.metadataReview, 1);
  assert.equal(missingSummary.metadataCounts.metadataBlockers, 0);
  assert.equal(missingSummary.phaseCoverageCounts.status, 'unavailable');
  assert.equal(missingSummary.phaseCoverageCounts.failedManifestCount, 0);
  assert.equal(missingSummary.phaseCoverageCounts.sourceKindCount, 0);
  assert.ok(missingSummary.blockerCount >= 4);
  assert.ok(missingSummary.evidenceGaps.some((gap) => gap.code === 'missing-required-files'));
  assert.ok(missingSummary.evidenceGaps.some((gap) => gap.code === 'schema-issues'));
  assert.ok(missingSummary.evidenceGaps.some((gap) => gap.code === 'path-issues'));
  assert.ok(missingSummary.evidenceGaps.some((gap) => gap.code === 'consistency-issues'));
  assert.ok(missingSummary.evidenceGaps.some((gap) => gap.code === 'note-missing' && gap.severity === 'review'));
  assert.ok(missingSummary.evidenceGaps.some((gap) => gap.code === 'metadata-quality-review' && gap.severity === 'review'));
  assert.match(missingSummary.summaryText, /status=blocked/u);
  assert.match(missingSummary.summaryText, /validator=missing/u);
  assert.match(missingSummary.summaryText, /metadata=review-needed/u);
  assert.match(missingSummary.summaryText, /phaseCoverage=unavailable/u);
  assert.match(missingSummary.reportText, /evidenceGaps:/u);
  assert.match(missingSummary.reportText, /phaseCoverageCalibration status=unavailable/u);
  assert.match(missingSummary.reportText, /AgentSessionV3PilotRealCorpusBatchMetadataQualityReport/u);
  assert.ok(missingSummary.jsonText);
} finally {
  await rm(missingTempDir, {
    force: true,
    recursive: true,
  });
}

const shadowResult = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin real corpus evidence summary sample',
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

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-evidence-summary-'));
try {
  const intakeTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: tempDir,
    prettyJson: true,
  });
  await runAgentSessionV3PilotBaselineCorpusManifestReport({
    maxShadowDebugSamples: 3,
    outDir: path.join(tempDir, 'baseline'),
    prettyJson: true,
  });

  const corpusDir = path.join(tempDir, 'corpora');
  await mkdir(corpusDir, {
    recursive: true,
  });
  await writeFile(
    path.join(corpusDir, 'ready-corpus.json'),
    JSON.stringify(createCorpus('aligned')),
    'utf8',
  );
  await writeFile(
    path.join(corpusDir, 'mismatch-corpus.json'),
    JSON.stringify(createCorpus('mismatch')),
    'utf8',
  );

  assert.ok(intakeTemplate.manifestPath);
  assert.ok(intakeTemplate.indexPath);
  await writeFile(
    intakeTemplate.manifestPath,
    JSON.stringify({
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
    }, null, 2),
    'utf8',
  );

  const mixedSummary = await runAgentSessionV3PilotRealCorpusBatchEvidenceSummary({
    includeJsonText: true,
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(mixedSummary.status, 'manual-review-needed');
  assert.equal(mixedSummary.validator.status, 'mixed');
  assert.equal(mixedSummary.metadataQuality.status, 'review-needed');
  assert.equal(mixedSummary.metadataCounts.metadataBlockers, 0);
  assert.ok(mixedSummary.metadataCounts.metadataReview >= 20);
  assert.equal(mixedSummary.phaseCoverageCounts.status, 'clean');
  assert.equal(mixedSummary.phaseCoverageCounts.failedManifestCount, 0);
  assert.ok(mixedSummary.phaseCoverageCounts.sourceKindCount >= 1);
  assert.equal(mixedSummary.blockerCount, 0);
  assert.ok(mixedSummary.reviewCount >= 3);
  assert.ok(mixedSummary.evidenceGaps.some((gap) => gap.code === 'index-mixed' && gap.severity === 'review'));
  assert.ok(mixedSummary.evidenceGaps.some((gap) => gap.code === 'note-incomplete' && gap.severity === 'review'));
  assert.ok(mixedSummary.evidenceGaps.some((gap) => gap.code === 'metadata-quality-review' && gap.severity === 'review'));
  assert.equal(mixedSummary.readinessCounts.manifestSources, 2);
  assert.equal(mixedSummary.readinessCounts.indexManifests, 2);
  assert.equal(mixedSummary.readinessCounts.indexReady, 1);
  assert.equal(mixedSummary.readinessCounts.indexMixed, 1);
  assert.match(mixedSummary.summaryText, /status=manual-review-needed/u);
  assert.match(mixedSummary.summaryText, /validator=mixed/u);
  assert.match(mixedSummary.summaryText, /metadata=review-needed/u);
  assert.match(mixedSummary.summaryText, /phaseCoverage=clean/u);
  assert.match(mixedSummary.reportText, /code=index-mixed/u);
  assert.match(mixedSummary.reportText, /code=note-incomplete/u);
  assert.match(mixedSummary.reportText, /code=metadata-quality-review/u);
  assert.match(mixedSummary.reportText, /phaseCoverageCalibration status=clean/u);
  assert.ok(mixedSummary.jsonText);

  await writeFile(
    path.join(corpusDir, 'phase-gap-corpus.json'),
    JSON.stringify(createCorpus('aligned', shadowWithoutPhaseCoverage)),
    'utf8',
  );
  await writeFile(
    intakeTemplate.manifestPath,
    JSON.stringify({
      ...intakeTemplate.manifest,
      sources: [
        {
          label: 'phase-gap-real-batch',
          path: './corpora/phase-gap-corpus.json',
          thresholds: {
            minAgreementSamples: 1,
            minShadowSamples: 1,
            minTerminalObservedShadowSamples: 1,
            requireFullPhaseCoverage: true,
            requireNoMissingPhaseCoverage: true,
          },
        },
      ],
    }, null, 2),
    'utf8',
  );

  const phaseCoverageNeedsReviewSummary = await runAgentSessionV3PilotRealCorpusBatchEvidenceSummary({
    includeJsonText: true,
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(phaseCoverageNeedsReviewSummary.phaseCoverageCounts.status, 'needs-review');
  assert.equal(phaseCoverageNeedsReviewSummary.phaseCoverageCounts.failedManifestCount, 1);
  assert.ok(phaseCoverageNeedsReviewSummary.phaseCoverageCounts.failedCheckCount >= 1);
  assert.ok(phaseCoverageNeedsReviewSummary.phaseCoverageCounts.sourceKindNeedsReviewCount >= 1);
  assert.match(phaseCoverageNeedsReviewSummary.summaryText, /phaseCoverage=needs-review/u);
  assert.match(phaseCoverageNeedsReviewSummary.reportText, /phaseCoverageCalibration status=needs-review/u);
  assert.ok(!phaseCoverageNeedsReviewSummary.evidenceGaps.some((gap) => gap.code.includes('phase')));

  await writeFile(
    intakeTemplate.indexPath,
    JSON.stringify({
      ...intakeTemplate.index,
      batches: [
        {
          label: 'baseline-only',
          manifestPath: './baseline/explicit-debug-corpus-manifest.json',
          sourceKind: 'baseline',
        },
      ],
    }, null, 2),
    'utf8',
  );

  const consistencyBlockedSummary = await runAgentSessionV3PilotRealCorpusBatchEvidenceSummary({
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(consistencyBlockedSummary.status, 'blocked');
  assert.equal(consistencyBlockedSummary.validator.status, 'not-ready');
  assert.equal(consistencyBlockedSummary.phaseCoverageCounts.status, 'unavailable');
  assert.ok(consistencyBlockedSummary.evidenceGaps.some((gap) => gap.code === 'consistency-issues' && gap.severity === 'blocker'));
  assert.match(consistencyBlockedSummary.reportText, /code=consistency-issues/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch evidence summary smoke ok');
