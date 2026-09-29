import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { runAgentSessionV3PilotRealCorpusBatchSchemaShapeReport } from './agent-session-v3-pilot-real-corpus-batch-schema-shape-report.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { schemaShapeSource } = readProjectSources({
  schemaShapeSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-schema-shape-report.ts',
});

assert.match(
  schemaShapeSource,
  /export async function runAgentSessionV3PilotRealCorpusBatchSchemaShapeReport/u,
  'real corpus batch schema-shape report should expose a caller-owned runner.',
);
assert.doesNotMatch(
  schemaShapeSource,
  /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'real corpus batch schema-shape report should not know runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  schemaShapeSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'real corpus batch schema-shape report should not encode a fixed desktop tool chain.',
);

const missingTempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-schema-shape-missing-'));
try {
  const missingReport = await runAgentSessionV3PilotRealCorpusBatchSchemaShapeReport({
    includeJsonText: true,
    intakeDir: missingTempDir,
    prettyJson: true,
  });

  assert.equal(missingReport.kind, 'agent-session-v3-pilot-real-corpus-batch-schema-shape-report');
  assert.equal(missingReport.version, 1);
  assert.equal(missingReport.status, 'missing');
  assert.equal(missingReport.issueCount, 2);
  assert.equal(missingReport.manifestSourceCount, 0);
  assert.equal(missingReport.indexBatchCount, 0);
  assert.deepEqual(
    missingReport.issues.map((issue) => `${issue.scope}:${issue.code}:${issue.path}`),
    [
      'manifest:missing-required-file:real-corpus-manifest.json',
      'index:missing-required-file:corpus-batch-index.json',
    ],
  );
  assert.match(missingReport.summaryText, /status=missing/u);
  assert.match(missingReport.reportText, /schemaShapeIssues:/u);
  assert.ok(missingReport.jsonText);
} finally {
  await rm(missingTempDir, {
    force: true,
    recursive: true,
  });
}

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-schema-shape-'));
try {
  const intakeTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: tempDir,
    prettyJson: true,
  });

  const validReport = await runAgentSessionV3PilotRealCorpusBatchSchemaShapeReport({
    includeJsonText: true,
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(validReport.status, 'valid');
  assert.equal(validReport.issueCount, 0);
  assert.equal(validReport.manifestSourceCount, 1);
  assert.equal(validReport.indexBatchCount, 2);
  assert.match(validReport.summaryText, /status=valid/u);
  assert.match(validReport.reportText, /schemaShapeIssues: none/u);
  assert.ok(validReport.jsonText);

  assert.ok(intakeTemplate.manifestPath);
  assert.ok(intakeTemplate.indexPath);

  await writeFile(
    intakeTemplate.manifestPath,
    JSON.stringify({
      ...intakeTemplate.manifest,
      sources: [
        {
          label: 'duplicate-batch',
          path: './corpora/one.json',
        },
        {
          label: 'duplicate-batch',
          path: '',
        },
        'not-an-object',
      ],
    }, null, 2),
    'utf8',
  );
  await writeFile(
    intakeTemplate.indexPath,
    JSON.stringify({
      ...intakeTemplate.index,
      batches: [
        {
          label: '',
          manifestPath: './real-corpus-manifest.json',
          sourceKind: '',
        },
        {
          label: 'duplicate-index',
          manifestPath: './real-corpus-manifest.json',
          sourceKind: 'manual',
        },
        {
          label: 'duplicate-index',
          manifestPath: 123,
          sourceKind: 'manual',
        },
      ],
    }, null, 2),
    'utf8',
  );

  const issuesReport = await runAgentSessionV3PilotRealCorpusBatchSchemaShapeReport({
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(issuesReport.status, 'issues');
  assert.equal(issuesReport.manifestSourceCount, 3);
  assert.equal(issuesReport.indexBatchCount, 3);
  assert.ok(issuesReport.issues.some((issue) => issue.scope === 'manifest-source' && issue.code === 'duplicate-label'));
  assert.ok(issuesReport.issues.some((issue) => issue.scope === 'manifest-source' && issue.code === 'invalid-path-field'));
  assert.ok(issuesReport.issues.some((issue) => issue.scope === 'manifest-source' && issue.code === 'invalid-entry'));
  assert.ok(issuesReport.issues.some((issue) => issue.scope === 'index-batch' && issue.code === 'missing-label'));
  assert.ok(issuesReport.issues.some((issue) => issue.scope === 'index-batch' && issue.code === 'empty-source-kind'));
  assert.ok(issuesReport.issues.some((issue) => issue.scope === 'index-batch' && issue.code === 'duplicate-label'));
  assert.match(issuesReport.reportText, /schemaShapeIssues:/u);
  assert.match(issuesReport.reportText, /code=invalid-path-field/u);

  await writeFile(
    intakeTemplate.manifestPath,
    JSON.stringify({
      ...intakeTemplate.manifest,
      sources: {
        bad: true,
      },
    }, null, 2),
    'utf8',
  );

  const invalidArrayReport = await runAgentSessionV3PilotRealCorpusBatchSchemaShapeReport({
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(invalidArrayReport.status, 'issues');
  assert.ok(invalidArrayReport.issues.some((issue) => issue.scope === 'manifest' && issue.code === 'invalid-array'));

  await writeFile(intakeTemplate.manifestPath, '{bad json', 'utf8');

  const invalidJsonReport = await runAgentSessionV3PilotRealCorpusBatchSchemaShapeReport({
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

console.log('agent session v3 pilot real corpus batch schema shape report smoke ok');
