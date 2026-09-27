import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { runAgentSessionV3PilotRealCorpusBatchConsistencyReport } from './agent-session-v3-pilot-real-corpus-batch-consistency-report.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { consistencySource } = readProjectSources({
  consistencySource: 'scripts/agent-session-v3-pilot-real-corpus-batch-consistency-report.ts',
});

assert.match(
  consistencySource,
  /export async function runAgentSessionV3PilotRealCorpusBatchConsistencyReport/u,
  'real corpus batch consistency report should expose a caller-owned runner.',
);
assert.doesNotMatch(
  consistencySource,
  /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'real corpus batch consistency report should not know runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  consistencySource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'real corpus batch consistency report should not encode a fixed desktop tool chain.',
);

const missingTempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-consistency-missing-'));
try {
  const missingReport = await runAgentSessionV3PilotRealCorpusBatchConsistencyReport({
    includeJsonText: true,
    intakeDir: missingTempDir,
    prettyJson: true,
  });

  assert.equal(missingReport.kind, 'agent-session-v3-pilot-real-corpus-batch-consistency-report');
  assert.equal(missingReport.version, 1);
  assert.equal(missingReport.status, 'missing');
  assert.equal(missingReport.issueCount, 2);
  assert.equal(missingReport.baselineEntryPresent, false);
  assert.equal(missingReport.currentManifestReferenced, false);
  assert.deepEqual(
    missingReport.issues.map((issue) => `${issue.scope}:${issue.code}:${issue.label}`),
    [
      'manifest:missing-required-file:real-corpus-manifest',
      'index:missing-required-file:corpus-batch-index',
    ],
  );
  assert.match(missingReport.summaryText, /status=missing/u);
  assert.match(missingReport.summaryText, /issues=2/u);
  assert.match(missingReport.reportText, /consistencyIssues:/u);
  assert.ok(missingReport.jsonText);
} finally {
  await rm(missingTempDir, {
    force: true,
    recursive: true,
  });
}

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-consistency-'));
try {
  const intakeTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: tempDir,
    prettyJson: true,
  });

  const templateReport = await runAgentSessionV3PilotRealCorpusBatchConsistencyReport({
    includeJsonText: true,
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(templateReport.status, 'consistent');
  assert.equal(templateReport.issueCount, 0);
  assert.equal(templateReport.baselineEntryPresent, true);
  assert.equal(templateReport.currentManifestReferenced, true);
  assert.equal(templateReport.manifestSourceCount, 1);
  assert.equal(templateReport.indexBatchCount, 2);
  assert.ok(templateReport.sourceKindSummaries.some((summary) => summary.sourceKind === 'baseline' && summary.count === 1));
  assert.ok(templateReport.sourceKindSummaries.some((summary) => summary.sourceKind === 'production-like' && summary.count === 1));
  assert.match(templateReport.summaryText, /status=consistent/u);
  assert.match(templateReport.summaryText, /sourceKinds=baseline:1,production-like:1/u);
  assert.match(templateReport.reportText, /consistencyIssues: none/u);
  assert.ok(templateReport.jsonText);

  assert.ok(intakeTemplate.indexPath);
  await writeFile(
    intakeTemplate.indexPath,
    JSON.stringify({
      ...intakeTemplate.index,
      batches: [
        {
          label: 'real-only',
          manifestPath: './real-corpus-manifest.json',
          sourceKind: 'production-like',
        },
      ],
    }, null, 2),
    'utf8',
  );

  const missingBaselineReport = await runAgentSessionV3PilotRealCorpusBatchConsistencyReport({
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(missingBaselineReport.status, 'issues');
  assert.equal(missingBaselineReport.baselineEntryPresent, false);
  assert.equal(missingBaselineReport.currentManifestReferenced, true);
  assert.ok(missingBaselineReport.issues.some((issue) => issue.code === 'missing-baseline-entry'));
  assert.match(missingBaselineReport.reportText, /code=missing-baseline-entry/u);

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

  const missingRealManifestReport = await runAgentSessionV3PilotRealCorpusBatchConsistencyReport({
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(missingRealManifestReport.status, 'issues');
  assert.equal(missingRealManifestReport.baselineEntryPresent, true);
  assert.equal(missingRealManifestReport.currentManifestReferenced, false);
  assert.ok(missingRealManifestReport.issues.some((issue) => issue.code === 'missing-real-manifest-entry'));
  assert.match(missingRealManifestReport.reportText, /code=missing-real-manifest-entry/u);

  await writeFile(
    intakeTemplate.indexPath,
    JSON.stringify({
      ...intakeTemplate.index,
      batches: [
        {
          label: 'baseline-a',
          manifestPath: './baseline/explicit-debug-corpus-manifest.json',
          sourceKind: 'baseline',
        },
        {
          label: 'baseline-a-copy',
          manifestPath: './baseline/explicit-debug-corpus-manifest.json',
          sourceKind: 'synthetic',
        },
        {
          label: 'real-batch',
          manifestPath: './real-corpus-manifest.json',
          sourceKind: 'production-like',
        },
      ],
    }, null, 2),
    'utf8',
  );

  const duplicateManifestPathReport = await runAgentSessionV3PilotRealCorpusBatchConsistencyReport({
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(duplicateManifestPathReport.status, 'issues');
  assert.ok(duplicateManifestPathReport.issues.some((issue) => issue.code === 'duplicate-manifest-path'));
  assert.match(duplicateManifestPathReport.reportText, /code=duplicate-manifest-path/u);

  await writeFile(
    intakeTemplate.indexPath,
    JSON.stringify({
      ...intakeTemplate.index,
      batches: [
        {
          label: 'baseline-wrong-target',
          manifestPath: './real-corpus-manifest.json',
          sourceKind: 'baseline',
        },
      ],
    }, null, 2),
    'utf8',
  );

  const baselinePointsToRealReport = await runAgentSessionV3PilotRealCorpusBatchConsistencyReport({
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(baselinePointsToRealReport.status, 'issues');
  assert.equal(baselinePointsToRealReport.baselineEntryPresent, true);
  assert.equal(baselinePointsToRealReport.currentManifestReferenced, true);
  assert.ok(baselinePointsToRealReport.issues.some((issue) => issue.code === 'baseline-points-to-real-manifest'));
  assert.match(baselinePointsToRealReport.reportText, /code=baseline-points-to-real-manifest/u);

  assert.ok(intakeTemplate.manifestPath);
  await writeFile(intakeTemplate.manifestPath, '{bad json', 'utf8');

  const invalidJsonReport = await runAgentSessionV3PilotRealCorpusBatchConsistencyReport({
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(invalidJsonReport.status, 'issues');
  assert.ok(invalidJsonReport.issues.some((issue) => issue.scope === 'manifest' && issue.code === 'invalid-json'));
  assert.match(invalidJsonReport.reportText, /code=invalid-json/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch consistency report smoke ok');
