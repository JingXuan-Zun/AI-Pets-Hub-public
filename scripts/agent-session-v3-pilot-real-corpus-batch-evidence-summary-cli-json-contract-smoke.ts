import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
import {
  assertNestedKind,
  assertNumberRecordKeys,
  assertObjectRecord,
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain,
  parseTrailingJsonObject,
} from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const allowedSummaryStatuses = new Set([
  'blocked',
  'manual-review-needed',
  'manual-review-ready',
]);

function runEvidenceSummaryCli(intakeDir: string) {
  const cliArgs = [
    'tsx',
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-evidence-summary.ts',
    '--dir',
    intakeDir,
    '--pretty',
  ];

  return process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/c', 'npx.cmd', ...cliArgs], {
      cwd: projectRoot,
      encoding: 'utf8',
    })
    : spawnSync('npx', cliArgs, {
      cwd: projectRoot,
      encoding: 'utf8',
    });
}

function assertEvidenceGapShape(summary: Record<string, unknown>) {
  assert.ok(Array.isArray(summary.evidenceGaps), 'evidenceGaps should be an array.');

  for (const gap of summary.evidenceGaps) {
    const gapRecord = assertObjectRecord(gap, 'evidence gap');
    const keys = Object.keys(gapRecord).sort();
    assert.deepEqual(keys, ['code', 'detail', 'severity']);
    assert.equal(typeof gapRecord.code, 'string');
    assert.equal(typeof gapRecord.detail, 'string');
    assert.match(String(gapRecord.severity), /^(blocker|review)$/u);
  }
}

function gapCodes(summary: Record<string, unknown>, severity?: 'blocker' | 'review') {
  assert.ok(Array.isArray(summary.evidenceGaps), 'evidenceGaps should be an array.');

  return new Set(
    summary.evidenceGaps
      .filter((gap) => {
        const gapRecord = gap as Record<string, unknown>;
        return !severity || gapRecord.severity === severity;
      })
      .map((gap) => String((gap as Record<string, unknown>).code)),
  );
}

function assertSummaryJsonContract(summary: Record<string, unknown>) {
  assert.equal(summary.kind, 'agent-session-v3-pilot-real-corpus-batch-evidence-summary');
  assert.equal(summary.version, 1);
  assert.equal(typeof summary.status, 'string');
  assert.ok(allowedSummaryStatuses.has(String(summary.status)));
  assert.equal(typeof summary.blockerCount, 'number');
  assert.equal(typeof summary.reviewCount, 'number');
  assert.equal(typeof summary.summaryText, 'string');
  assert.equal(typeof summary.reportText, 'string');
  assertNumberRecordKeys(
    summary.readinessCounts,
    [
      'manifestSources',
      'indexManifests',
      'indexReady',
      'indexMixed',
      'indexNotReady',
    ],
    'readinessCounts',
  );
  assertNumberRecordKeys(
    summary.metadataCounts,
    [
      'metadataBlockers',
      'metadataIssues',
      'metadataReview',
      'noteOpenItems',
    ],
    'metadataCounts',
  );
  assertNumberRecordKeys(
    summary.phaseCoverageCounts,
    [
      'failedCheckCount',
      'failedManifestCount',
      'sourceKindCleanCount',
      'sourceKindCount',
      'sourceKindNeedsReviewCount',
    ],
    'phaseCoverageCounts',
  );
  const phaseCoverageCounts = assertObjectRecord(summary.phaseCoverageCounts, 'phaseCoverageCounts');
  assert.match(String(phaseCoverageCounts.status), /^(clean|needs-review|unavailable)$/u);
  assertEvidenceGapShape(summary);
  assertNestedKind(
    summary,
    'metadataQuality',
    'agent-session-v3-pilot-real-corpus-batch-metadata-quality-report',
  );
  assertNestedKind(
    summary,
    'validator',
    'agent-session-v3-pilot-real-corpus-batch-intake-validator',
  );
  assertNestedKind(
    summary.validator as Record<string, unknown>,
    'consistencyReport',
    'agent-session-v3-pilot-real-corpus-batch-consistency-report',
  );
}

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
    reason: `${options.status} real corpus evidence summary JSON contract sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { evidenceSummarySource } = readProjectSources({
  evidenceSummarySource: 'scripts/agent-session-v3-pilot-real-corpus-batch-evidence-summary.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  evidenceSummarySource,
  'real corpus batch evidence summary JSON contract',
);

const missingTempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-evidence-summary-json-contract-missing-'));
try {
  const missingCliResult = runEvidenceSummaryCli(missingTempDir);

  assert.equal(
    missingCliResult.status,
    0,
    missingCliResult.stderr || missingCliResult.stdout || missingCliResult.error?.message,
  );

  const missingSummary = parseTrailingJsonObject(missingCliResult.stdout);
  assertSummaryJsonContract(missingSummary);
  assert.equal(missingSummary.status, 'blocked');
  assert.ok(Number(missingSummary.blockerCount) >= 4);
  assert.ok(Number(missingSummary.reviewCount) >= 1);
  assert.equal((missingSummary.validator as Record<string, unknown>).status, 'missing');

  const blockerCodes = gapCodes(missingSummary, 'blocker');
  assert.ok(blockerCodes.has('missing-required-files'));
  assert.ok(blockerCodes.has('schema-issues'));
  assert.ok(blockerCodes.has('path-issues'));
  assert.ok(blockerCodes.has('consistency-issues'));
  assert.ok(gapCodes(missingSummary, 'review').has('note-missing'));
  assert.ok(gapCodes(missingSummary, 'review').has('metadata-quality-review'));
  assert.equal((missingSummary.metadataQuality as Record<string, unknown>).status, 'review-needed');
  const missingMetadataCounts = missingSummary.metadataCounts as Record<string, unknown>;
  assert.equal(missingMetadataCounts.metadataIssues, 1);
  assert.equal(missingMetadataCounts.metadataReview, 1);
  const missingPhaseCoverageCounts = missingSummary.phaseCoverageCounts as Record<string, unknown>;
  assert.equal(missingPhaseCoverageCounts.status, 'unavailable');
  assert.equal(missingPhaseCoverageCounts.failedManifestCount, 0);
  assert.match(String(missingSummary.summaryText), /phaseCoverage=unavailable/u);
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
      reason: 'begin real corpus evidence summary JSON contract sample',
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

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-evidence-summary-json-contract-'));
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

  const mixedCliResult = runEvidenceSummaryCli(tempDir);

  assert.equal(
    mixedCliResult.status,
    0,
    mixedCliResult.stderr || mixedCliResult.stdout || mixedCliResult.error?.message,
  );

  const mixedSummary = parseTrailingJsonObject(mixedCliResult.stdout);
  assertSummaryJsonContract(mixedSummary);
  assert.equal(mixedSummary.status, 'manual-review-needed');
  assert.equal(mixedSummary.blockerCount, 0);
  assert.ok(Number(mixedSummary.reviewCount) >= 2);
  assert.equal((mixedSummary.validator as Record<string, unknown>).status, 'mixed');
  assertNumberRecordKeys(
    mixedSummary.readinessCounts,
    [
      'manifestSources',
      'indexManifests',
      'indexReady',
      'indexMixed',
      'indexNotReady',
    ],
    'mixedSummary.readinessCounts',
  );
  const readinessCounts = mixedSummary.readinessCounts as Record<string, unknown>;
  assert.equal(readinessCounts.manifestSources, 2);
  assert.equal(readinessCounts.indexManifests, 2);
  assert.equal(readinessCounts.indexReady, 1);
  assert.equal(readinessCounts.indexMixed, 1);
  assert.equal(readinessCounts.indexNotReady, 0);
  assert.ok(gapCodes(mixedSummary, 'review').has('index-mixed'));
  assert.ok(gapCodes(mixedSummary, 'review').has('note-incomplete'));
  assert.ok(gapCodes(mixedSummary, 'review').has('metadata-quality-review'));
  assert.equal((mixedSummary.metadataQuality as Record<string, unknown>).status, 'review-needed');
  const metadataCounts = mixedSummary.metadataCounts as Record<string, unknown>;
  assert.equal(metadataCounts.metadataBlockers, 0);
  assert.ok(Number(metadataCounts.metadataReview) >= 20);
  const phaseCoverageCounts = mixedSummary.phaseCoverageCounts as Record<string, unknown>;
  assert.equal(phaseCoverageCounts.status, 'clean');
  assert.equal(phaseCoverageCounts.failedManifestCount, 0);
  assert.ok(Number(phaseCoverageCounts.sourceKindCount) >= 1);
  assert.match(String(mixedSummary.summaryText), /phaseCoverage=clean/u);
  assert.match(String(mixedSummary.reportText), /phaseCoverageCalibration status=clean/u);

  const validator = mixedSummary.validator as Record<string, unknown>;
  assertNestedKind(
    validator,
    'manifestReport',
    'agent-session-v3-pilot-external-sample-corpus-manifest-loader',
  );
  assertNestedKind(
    validator,
    'indexReport',
    'agent-session-v3-pilot-corpus-batch-index-report',
  );
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch evidence summary CLI JSON contract smoke ok');
