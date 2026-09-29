import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffBundle } from './agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight } from './agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts';
import { readProjectSources } from './smokeTestHarness.ts';

function fillSampleSourceNote(
  noteText: string,
  options: {
    sampleSource: string;
    sampleSourceStatus: string;
  },
) {
  return noteText
    .replace(
      'replace-with-sample-source-real-exported-rehearsal-or-unknown',
      options.sampleSource,
    )
    .replace('replace-with-sample-source-status', options.sampleSourceStatus);
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts',
});

assert.match(
  source,
  /export async function runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight/u,
  'real corpus batch source declaration preflight should expose a caller-owned runner.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts',
);
assert.doesNotMatch(
  source,
  /spawnSync|execSync|npm\.cmd/u,
  'source declaration preflight should not execute smoke tests or shell commands.',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-source-declaration-preflight-'));
try {
  const intakeDir = path.join(tempDir, 'intake');
  const template = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: intakeDir,
    prettyJson: true,
  });

  const placeholderReport = await runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight({
    expectedSampleSource: 'real-exported',
    intakeDir,
    prettyJson: true,
  });
  assert.equal(placeholderReport.kind, 'agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight');
  assert.equal(placeholderReport.version, 1);
  assert.equal(placeholderReport.readyForProductionRuntime, false);
  assert.equal(placeholderReport.status, 'blocked');
  assert.equal(placeholderReport.sampleSource, 'replace-with-sample-source-real-exported-rehearsal-or-unknown');
  assert.equal(placeholderReport.sampleSourceStatus, 'replace-with-sample-source-status');
  assert.ok(placeholderReport.issues.some((issue) => issue.code === 'invalid-sample-source'));
  assert.ok(placeholderReport.issues.some((issue) => issue.code === 'invalid-sample-source-status'));
  assert.match(placeholderReport.reportText, /does not infer realness from file content/u);
  assert.match(placeholderReport.reportText, /define workflows/u);

  await writeFile(
    template.notePath ?? path.join(intakeDir, 'sample-note-template.md'),
    fillSampleSourceNote(template.noteText, {
      sampleSource: 'real-exported',
      sampleSourceStatus: 'real-exported-evidence',
    }),
    'utf8',
  );

  const consistentReport = await runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight({
    expectedSampleSource: 'real-exported',
    includeJsonText: true,
    intakeDir,
    prettyJson: true,
  });
  assert.equal(consistentReport.status, 'consistent');
  assert.equal(consistentReport.issueCount, 0);
  assert.equal(consistentReport.blockerCount, 0);
  assert.equal(consistentReport.reviewCount, 0);
  assert.equal(consistentReport.sampleSource, 'real-exported');
  assert.equal(consistentReport.sampleSourceStatus, 'real-exported-evidence');
  assert.equal(consistentReport.expectedSampleSource, 'real-exported');
  assert.equal(consistentReport.observations.length, 1);
  assert.equal(consistentReport.observations[0]?.label, 'sample-note');
  assert.ok(consistentReport.jsonText);
  assert.deepEqual(JSON.parse(consistentReport.jsonText), {
    ...consistentReport,
    jsonText: null,
  });

  await writeFile(
    template.notePath ?? path.join(intakeDir, 'sample-note-template.md'),
    fillSampleSourceNote(template.noteText, {
      sampleSource: 'unknown',
      sampleSourceStatus: 'missing-real-sample-declaration',
    }),
    'utf8',
  );
  const unknownReport = await runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight({
    intakeDir,
    prettyJson: true,
  });
  assert.equal(unknownReport.status, 'review-needed');
  assert.equal(unknownReport.blockerCount, 0);
  assert.equal(unknownReport.reviewCount, 1);
  assert.deepEqual(
    unknownReport.issues.map((issue) => issue.code),
    ['unknown-sample-source'],
  );

  await writeFile(
    template.notePath ?? path.join(intakeDir, 'sample-note-template.md'),
    fillSampleSourceNote(template.noteText, {
      sampleSource: 'real-exported',
      sampleSourceStatus: 'synthetic-rehearsal',
    }),
    'utf8',
  );
  const statusMismatchReport = await runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight({
    intakeDir,
    prettyJson: true,
  });
  assert.equal(statusMismatchReport.status, 'blocked');
  assert.ok(statusMismatchReport.issues.some((issue) => issue.code === 'derived-status-mismatch'));

  await writeFile(
    template.notePath ?? path.join(intakeDir, 'sample-note-template.md'),
    fillSampleSourceNote(template.noteText, {
      sampleSource: 'real-exported',
      sampleSourceStatus: 'real-exported-evidence',
    }),
    'utf8',
  );
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: path.join(tempDir, 'example'),
    prettyJson: true,
  });
  const handoffBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'handoff'),
    prettyJson: true,
    sampleSource: 'rehearsal',
  });
  const handoffMismatchReport = await runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight({
    handoffBundleDir: handoffBundle.outDir,
    intakeDir,
    prettyJson: true,
  });
  assert.equal(handoffMismatchReport.status, 'blocked');
  assert.equal(handoffMismatchReport.handoffBundleDir, handoffBundle.outDir);
  assert.equal(handoffMismatchReport.observations.length, 2);
  assert.ok(handoffMismatchReport.handoffConsistencyReport);
  assert.equal(handoffMismatchReport.handoffConsistencyReport.status, 'consistent');
  assert.ok(handoffMismatchReport.issues.some((issue) => issue.code === 'handoff-source-mismatch'));
  assert.ok(handoffMismatchReport.issues.some((issue) => issue.code === 'handoff-status-mismatch'));
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch source declaration preflight smoke ok');
