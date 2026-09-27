import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  assertNumberRecordKeys,
  assertObjectRecord,
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain,
  parseTrailingJsonObject,
} from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const allowedStatuses = new Set(['blocked', 'review-needed', 'review-ready']);

function runMetadataQualityCli(intakeDir: string) {
  const cliArgs = [
    'tsx',
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-metadata-quality-report.ts',
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

function runMetadataQualityJson(intakeDir: string) {
  const result = runMetadataQualityCli(intakeDir);

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

function assertArrayValue(value: unknown, label: string) {
  assert.ok(Array.isArray(value), `${label} should be an array.`);

  return value;
}

function assertIssueShape(issue: unknown) {
  const issueRecord = assertObjectRecord(issue, 'metadata quality issue');
  const keys = Object.keys(issueRecord).sort();

  assert.deepEqual(keys, ['code', 'label', 'message', 'path', 'scope', 'severity']);
  assertStringValue(issueRecord.code, 'issue code');
  assertStringValue(issueRecord.label, 'issue label');
  assertStringValue(issueRecord.message, 'issue message');
  assertStringValue(issueRecord.path, 'issue path');
  assert.match(String(issueRecord.scope), /^(index-batch|manifest-source|sample-note)$/u);
  assert.match(String(issueRecord.severity), /^(blocker|review)$/u);
}

function assertMetadataQualityContract(report: Record<string, unknown>) {
  assert.equal(report.kind, 'agent-session-v3-pilot-real-corpus-batch-metadata-quality-report');
  assert.equal(report.version, 1);
  assertStringValue(report.status, 'status');
  assert.ok(allowedStatuses.has(String(report.status)));
  assertStringValue(report.intakeDir, 'intakeDir');
  assertStringValue(report.summaryText, 'summaryText');
  assertStringValue(report.reportText, 'reportText');
  assert.equal(typeof report.notePresent, 'boolean');
  assertNumberRecordKeys(
    report,
    [
      'blockerCount',
      'indexBatchCount',
      'issueCount',
      'manifestSourceCount',
      'noteOpenItemCount',
      'reviewCount',
    ],
    'metadata quality report',
  );

  for (const issue of assertArrayValue(report.issues, 'metadata quality issues')) {
    assertIssueShape(issue);
  }
}

const { reportSource } = readProjectSources({
  reportSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-metadata-quality-report.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  reportSource,
  'agent-session-v3-pilot-real-corpus-batch-metadata-quality-report.ts CLI JSON contract',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-metadata-quality-json-contract-'));
try {
  const template = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: tempDir,
    prettyJson: true,
  });
  const blockedReport = runMetadataQualityJson(tempDir);

  assertMetadataQualityContract(blockedReport);
  assert.equal(blockedReport.status, 'blocked');
  assert.equal(blockedReport.manifestSourceCount, 1);
  assert.equal(blockedReport.indexBatchCount, 2);
  assert.equal(blockedReport.notePresent, true);
  assert.equal(blockedReport.noteOpenItemCount, 23);
  assert.equal(blockedReport.blockerCount, 1);
  assert.ok(Number(blockedReport.reviewCount) >= 20);
  assert.ok(
    (blockedReport.issues as unknown[])
      .some((issue) => (issue as Record<string, unknown>).code === 'placeholder-path'),
  );
  assert.ok(
    (blockedReport.issues as unknown[])
      .some((issue) => (issue as Record<string, unknown>).code === 'open-sample-note-item'),
  );

  assert.ok(template.manifestPath);
  assert.ok(template.indexPath);
  assert.ok(template.notePath);

  await writeFile(
    template.manifestPath,
    JSON.stringify({
      ...template.manifest,
      sources: [{
        label: 'desktop-smoke-real-batch',
        path: './corpora/desktop-smoke-corpus.json',
      }],
    }, null, 2),
    'utf8',
  );
  await writeFile(
    template.indexPath,
    JSON.stringify({
      ...template.index,
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
          label: 'desktop-smoke-real-batch',
          manifestPath: './real-corpus-manifest.json',
          notes: 'production-like desktop traces exported by caller-owned debug tooling',
          sourceKind: 'production-like',
        },
      ],
    }, null, 2),
    'utf8',
  );
  const reviewReport = runMetadataQualityJson(tempDir);

  assertMetadataQualityContract(reviewReport);
  assert.equal(reviewReport.status, 'review-needed');
  assert.equal(reviewReport.blockerCount, 0);
  assert.equal(reviewReport.noteOpenItemCount, 23);
  assert.ok(
    (reviewReport.issues as unknown[])
      .every((issue) => (issue as Record<string, unknown>).scope === 'sample-note'),
  );

  await writeFile(
    template.notePath,
    (await readFile(template.notePath, 'utf8'))
      .replaceAll('replace-with-real-batch-label', 'desktop-smoke-real-batch')
      .replaceAll('replace-with-export-date', '2026-06-23')
      .replaceAll('replace-with-machine-app-mode-or-branch', 'local-dev-agent-session-v2-shadow')
      .replaceAll('replace-with-scenario-family', 'desktop-readonly-and-approval-boundary')
      .replaceAll('replace-with-export-command-or-manual-source', 'manual debug corpus export')
      .replaceAll('replace-with-sample-source-real-exported-rehearsal-or-unknown', 'real-exported')
      .replaceAll('replace-with-sample-source-status', 'real-exported-evidence')
      .replaceAll('replace-with-corpus-json-paths', './corpora/desktop-smoke-corpus.json')
      .replaceAll('replace-with-sample-count', '24')
      .replaceAll('replace-with-intake-dir', 'real-batch')
      .replaceAll('replace-with-ready-mixed-not-ready-empty-or-missing', 'mixed')
      .replaceAll('replace-with-manifestSources', '1')
      .replaceAll('replace-with-indexManifests', '2')
      .replaceAll('ready=replace mixed=replace notReady=replace empty=replace', 'ready=1 mixed=1 notReady=0 empty=0')
      .replaceAll('yes/no and why', 'yes, compare strict and relaxed profiles')
      .replaceAll('replace-with-p0-intake-dir', 'real-batch')
      .replaceAll('replace-with-real-production-like-sample-signal', 'review-needed')
      .replaceAll('replace-with-real-exported-corpus-signal', 'review-needed')
      .replaceAll('replace-with-short-assessment', 'sufficient for local review')
      .replaceAll('replace-with-scope', 'terminal-state evidence preservation')
      .replaceAll('replace-with-limitations', 'no production authority')
      .replaceAll('replace-with-next-samples', 'broader production-like traces')
      .replaceAll('keep-current / compare-profiles / propose-manual-review', 'compare-profiles'),
    'utf8',
  );
  const readyReport = runMetadataQualityJson(tempDir);

  assertMetadataQualityContract(readyReport);
  assert.equal(readyReport.status, 'review-ready');
  assert.equal(readyReport.issueCount, 0);
  assert.equal((readyReport.issues as unknown[]).length, 0);
  assert.match(String(readyReport.reportText), /metadataQualityIssues: none/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch metadata quality CLI JSON contract smoke ok');
