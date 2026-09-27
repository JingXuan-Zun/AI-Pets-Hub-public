import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  assertNumberRecordKeys,
  assertObjectRecord,
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain,
  parseTrailingJsonObject,
} from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const allowedStatuses = new Set(['blocked', 'empty', 'ready-for-manual-review', 'review-needed']);

function runRollupCli(intakeDirs: readonly string[]) {
  const cliArgs = [
    'tsx',
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report.ts',
    ...intakeDirs.flatMap((intakeDir) => ['--dir', intakeDir]),
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

function runRollupJson(intakeDirs: readonly string[]) {
  const result = runRollupCli(intakeDirs);

  assert.equal(
    result.status,
    0,
    result.stderr || result.stdout || result.error?.message,
  );

  return parseTrailingJsonObject(result.stdout);
}

function assertStringValue(value: unknown, label: string) {
  assert.equal(typeof value, 'string', `${label} should be a string.`);
}

function assertStringArray(value: unknown, label: string) {
  assert.ok(Array.isArray(value), `${label} should be an array.`);
  for (const entry of value) {
    assert.equal(typeof entry, 'string', `${label} entries should be strings.`);
  }
}

function assertPhaseCoverageCountsShape(value: unknown, label: string) {
  const record = assertObjectRecord(value, label);
  assert.match(String(record.status), /^(clean|needs-review|unavailable)$/u);
  assertNumberRecordKeys(
    record,
    [
      'failedCheckCount',
      'failedManifestCount',
      'sourceKindCleanCount',
      'sourceKindCount',
      'sourceKindNeedsReviewCount',
    ],
    label,
  );
}

function assertRollupEntryShape(entry: unknown) {
  const entryRecord = assertObjectRecord(entry, 'rollup entry');
  const keys = Object.keys(entryRecord).sort();

  assert.deepEqual(keys, [
    'blockerCount',
    'blockerItemIds',
    'checklistItemIds',
    'evidenceSummaryStatus',
    'infoCount',
    'intakeDir',
    'metadataCounts',
    'metadataStatus',
    'phaseCoverageCounts',
    'readinessCounts',
    'reviewCount',
    'reviewItemIds',
    'status',
    'summaryText',
    'validatorStatus',
  ]);
  assertStringValue(entryRecord.intakeDir, 'entry.intakeDir');
  assertStringValue(entryRecord.status, 'entry.status');
  assert.match(String(entryRecord.status), /^(blocked|ready-for-manual-review|review-needed)$/u);
  assertStringValue(entryRecord.evidenceSummaryStatus, 'entry.evidenceSummaryStatus');
  assertStringValue(entryRecord.validatorStatus, 'entry.validatorStatus');
  assertStringValue(entryRecord.metadataStatus, 'entry.metadataStatus');
  assertStringValue(entryRecord.summaryText, 'entry.summaryText');
  assertNumberRecordKeys(
    entryRecord,
    [
      'blockerCount',
      'infoCount',
      'reviewCount',
    ],
    'rollup entry',
  );
  assertStringArray(entryRecord.blockerItemIds, 'entry.blockerItemIds');
  assertStringArray(entryRecord.checklistItemIds, 'entry.checklistItemIds');
  assertStringArray(entryRecord.reviewItemIds, 'entry.reviewItemIds');
  assertPhaseCoverageCountsShape(entryRecord.phaseCoverageCounts, 'entry.phaseCoverageCounts');
  assertNumberRecordKeys(
    entryRecord.readinessCounts,
    [
      'manifestSources',
      'indexManifests',
      'indexReady',
      'indexMixed',
      'indexNotReady',
    ],
    'entry.readinessCounts',
  );
  assertNumberRecordKeys(
    entryRecord.metadataCounts,
    [
      'metadataBlockers',
      'metadataIssues',
      'metadataReview',
      'noteOpenItems',
    ],
    'entry.metadataCounts',
  );
}

function assertChecklistItemSummaryShape(summary: unknown) {
  const summaryRecord = assertObjectRecord(summary, 'checklist item summary');
  const keys = Object.keys(summaryRecord).sort();

  assert.deepEqual(keys, ['count', 'id', 'intakeDirs', 'severity', 'source', 'title']);
  assert.equal(typeof summaryRecord.count, 'number');
  assertStringValue(summaryRecord.id, 'summary.id');
  assertStringValue(summaryRecord.title, 'summary.title');
  assert.match(String(summaryRecord.severity), /^(blocker|info|review)$/u);
  assert.match(String(summaryRecord.source), /^(evidence-summary|metadata-quality|runbook|validator)$/u);
  assertStringArray(summaryRecord.intakeDirs, 'summary.intakeDirs');
}

function assertRollupContract(report: Record<string, unknown>) {
  assert.equal(report.kind, 'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report');
  assert.equal(report.version, 1);
  assertStringValue(report.status, 'status');
  assert.ok(allowedStatuses.has(String(report.status)));
  assertStringValue(report.summaryText, 'summaryText');
  assertStringValue(report.reportText, 'reportText');
  assertNumberRecordKeys(
    report,
    [
      'intakeCount',
      'totalBlockerItems',
      'totalInfoItems',
      'totalReviewItems',
    ],
    'readiness rollup report',
  );
  assertNumberRecordKeys(
    report.statusCounts,
    [
      'blocked',
      'readyForManualReview',
      'reviewNeeded',
    ],
    'statusCounts',
  );
  assert.ok(Array.isArray(report.entries), 'entries should be an array.');
  assert.ok(Array.isArray(report.checklistItemSummaries), 'checklistItemSummaries should be an array.');

  for (const entry of report.entries) {
    assertRollupEntryShape(entry);
  }
  for (const summary of report.checklistItemSummaries) {
    assertChecklistItemSummaryShape(summary);
  }
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
    reason: `${options.status} real corpus readiness rollup JSON contract sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

function createCorpus(
  status: AgentSessionV3PilotShadowAgreement['status'],
  shadowExport: ReturnType<typeof createAgentSessionV3PilotShadowDebugExport>,
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
      shadow: shadowExport,
    }],
  });
}

async function createReadyIntake(
  intakeDir: string,
  shadowExport: ReturnType<typeof createAgentSessionV3PilotShadowDebugExport>,
) {
  const intakeTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: intakeDir,
    prettyJson: true,
  });
  await runAgentSessionV3PilotBaselineCorpusManifestReport({
    maxShadowDebugSamples: 3,
    outDir: path.join(intakeDir, 'baseline'),
    prettyJson: true,
  });

  const corpusDir = path.join(intakeDir, 'corpora');
  await mkdir(corpusDir, {
    recursive: true,
  });
  await writeFile(
    path.join(corpusDir, 'ready-corpus.json'),
    JSON.stringify(createCorpus('aligned', shadowExport)),
    'utf8',
  );

  assert.ok(intakeTemplate.indexPath);
  assert.ok(intakeTemplate.manifestPath);
  assert.ok(intakeTemplate.notePath);
  await writeFile(
    intakeTemplate.manifestPath,
    JSON.stringify({
      ...intakeTemplate.manifest,
      sources: [{
        label: 'ready-real-batch',
        path: './corpora/ready-corpus.json',
      }],
    }, null, 2),
    'utf8',
  );
  await writeFile(
    intakeTemplate.indexPath,
    JSON.stringify({
      ...intakeTemplate.index,
      batches: [
        {
          generatedAt: '2026-06-23T10:00:00.000Z',
          label: 'baseline-artifact-flow',
          manifestPath: './baseline/explicit-debug-corpus-manifest.json',
          notes: 'baseline bundle generated by reviewed artifact flow',
          sourceKind: 'baseline',
        },
        {
          generatedAt: '2026-06-23T10:05:00.000Z',
          label: 'ready-real-batch',
          manifestPath: './real-corpus-manifest.json',
          notes: 'caller-owned production-like exported corpus batch for manual review',
          sourceKind: 'production-like',
        },
      ],
    }, null, 2),
    'utf8',
  );
  await writeFile(
    intakeTemplate.notePath,
    (await readFile(intakeTemplate.notePath, 'utf8'))
      .replaceAll('replace-with-real-batch-label', 'ready-real-batch')
      .replaceAll('replace-with-export-date', '2026-06-23')
      .replaceAll('replace-with-machine-app-mode-or-branch', 'local-dev-agent-session-v2-shadow')
      .replaceAll('replace-with-scenario-family', 'terminal-state-alignment')
      .replaceAll('replace-with-export-command-or-manual-source', 'manual debug corpus export')
      .replaceAll('replace-with-sample-source-real-exported-rehearsal-or-unknown', 'real-exported')
      .replaceAll('replace-with-sample-source-status', 'real-exported-evidence')
      .replaceAll('replace-with-corpus-json-paths', './corpora/ready-corpus.json')
      .replaceAll('replace-with-sample-count', '12')
      .replaceAll('replace-with-intake-dir', 'tmp-agent-v3-real-corpus')
      .replaceAll('replace-with-ready-mixed-not-ready-empty-or-missing', 'ready')
      .replaceAll('replace-with-manifestSources', '1')
      .replaceAll('replace-with-indexManifests', '2')
      .replaceAll('ready=replace mixed=replace notReady=replace empty=replace', 'ready=2 mixed=0 notReady=0 empty=0')
      .replaceAll('yes/no and why', 'no, this batch only confirms local baseline alignment')
      .replaceAll('replace-with-p0-intake-dir', 'tmp-agent-v3-real-corpus')
      .replaceAll('replace-with-real-production-like-sample-signal', 'ready-for-manual-review')
      .replaceAll('replace-with-real-exported-corpus-signal', 'ready-for-manual-review')
      .replaceAll('replace-with-short-assessment', 'sufficient for manual baseline comparison')
      .replaceAll('replace-with-scope', 'v3 mirror alignment for this local sample set')
      .replaceAll('replace-with-limitations', 'no production runtime authority')
      .replaceAll('replace-with-next-samples', 'broader production-like traces')
      .replaceAll('keep-current / compare-profiles / propose-manual-review', 'keep-current'),
    'utf8',
  );
}

async function createMixedIntake(
  intakeDir: string,
  shadowExport: ReturnType<typeof createAgentSessionV3PilotShadowDebugExport>,
) {
  const intakeTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: intakeDir,
    prettyJson: true,
  });
  await runAgentSessionV3PilotBaselineCorpusManifestReport({
    maxShadowDebugSamples: 3,
    outDir: path.join(intakeDir, 'baseline'),
    prettyJson: true,
  });

  const corpusDir = path.join(intakeDir, 'corpora');
  await mkdir(corpusDir, {
    recursive: true,
  });
  await writeFile(
    path.join(corpusDir, 'ready-corpus.json'),
    JSON.stringify(createCorpus('aligned', shadowExport)),
    'utf8',
  );
  await writeFile(
    path.join(corpusDir, 'mismatch-corpus.json'),
    JSON.stringify(createCorpus('mismatch', shadowExport)),
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
}

const { rollupSource } = readProjectSources({
  rollupSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  rollupSource,
  'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report.ts CLI JSON contract',
);

const rootTempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-readiness-rollup-json-contract-'));
try {
  const shadowResult = await runAgentSessionV3PilotShadowMode({
    enabled: true,
    events: [
      {
        reason: 'begin real corpus readiness rollup JSON contract sample',
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
  const missingIntakeDir = path.join(rootTempDir, 'missing-intake');
  const mixedIntakeDir = path.join(rootTempDir, 'mixed-intake');
  const readyIntakeDir = path.join(rootTempDir, 'ready-intake');

  await mkdir(missingIntakeDir, {
    recursive: true,
  });
  await createMixedIntake(mixedIntakeDir, shadowExport);
  await createReadyIntake(readyIntakeDir, shadowExport);

  const rollup = runRollupJson([
    missingIntakeDir,
    mixedIntakeDir,
    readyIntakeDir,
  ]);

  assertRollupContract(rollup);
  assert.equal(rollup.status, 'blocked');
  assert.equal(rollup.intakeCount, 3);
  assert.deepEqual(rollup.statusCounts, {
    blocked: 1,
    readyForManualReview: 1,
    reviewNeeded: 1,
  });
  assert.ok(Number(rollup.totalBlockerItems) >= 4);
  assert.ok(Number(rollup.totalReviewItems) >= 4);
  assert.equal(rollup.totalInfoItems, 6);
  assert.ok(
    (rollup.checklistItemSummaries as Record<string, unknown>[])
      .some((summary) => summary.id === 'gap-missing-required-files'),
  );
  assert.ok(
    (rollup.checklistItemSummaries as Record<string, unknown>[])
      .some((summary) => summary.id === 'gap-index-mixed'),
  );
  assert.ok(
    (rollup.entries as Record<string, unknown>[])
      .some((entry) => entry.status === 'ready-for-manual-review'),
  );
  assert.ok(
    (rollup.entries as Record<string, unknown>[])
      .some((entry) => (
        entry.validatorStatus === 'missing'
          && (entry.phaseCoverageCounts as Record<string, unknown>).status === 'unavailable'
      )),
  );
  assert.ok(
    (rollup.entries as Record<string, unknown>[])
      .some((entry) => (
        entry.status === 'ready-for-manual-review'
          && (entry.phaseCoverageCounts as Record<string, unknown>).status === 'clean'
      )),
  );
  assert.match(String(rollup.reportText), /phaseCoverage=unavailable/u);
  assert.match(String(rollup.reportText), /phaseCoverage=clean/u);
  assert.match(String(rollup.reportText), /checklistItemSummaries:/u);

  const readyRollup = runRollupJson([readyIntakeDir]);

  assertRollupContract(readyRollup);
  assert.equal(readyRollup.status, 'ready-for-manual-review');
  assert.deepEqual(readyRollup.statusCounts, {
    blocked: 0,
    readyForManualReview: 1,
    reviewNeeded: 0,
  });
  assert.equal(readyRollup.totalBlockerItems, 0);
  assert.equal(readyRollup.totalReviewItems, 0);
  assert.equal(readyRollup.totalInfoItems, 2);
} finally {
  await rm(rootTempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch readiness rollup CLI JSON contract smoke ok');
