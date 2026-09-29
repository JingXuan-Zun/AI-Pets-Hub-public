import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { runAgentSessionV3PilotRealCorpusBatchMetadataQualityReport } from './agent-session-v3-pilot-real-corpus-batch-metadata-quality-report.ts';
import { readProjectSources } from './smokeTestHarness.ts';

async function writeFilledSampleNote(notePath: string) {
  await writeFile(
    notePath,
    [
      '# Agent Runtime v3 Pilot Real Corpus Batch Sample Note',
      '',
      '## Batch Identity',
      '',
      '- Batch label: desktop-smoke-real-batch',
      '- Export date: 2026-06-23',
      '- Source environment: local-dev-agent-session-v2-shadow',
      '- Scenario family: desktop-readonly-and-approval-boundary',
      '- Export command or source: manual debug corpus export from reviewed traces',
      '- Corpus file paths: ./corpora/desktop-smoke-corpus.json',
      '- Approximate sample count: 24',
      '- Known unusual cases: approval-required and budget-exceeded remain waiting-for-event',
      '',
      '## Validator Result',
      '',
      '- Validator command: `npx.cmd tsx .\\scripts\\agent-session-v3-pilot-real-corpus-batch-intake-validator.ts --dir .\\real-batch --pretty`',
      '- Validator status: mixed',
      '- Manifest sources: 1',
      '- Index manifests: 2',
      '- Readiness counts: ready=1 mixed=1 notReady=0 empty=0',
      '- Failed readiness checks: none recorded',
      '- Threshold profile comparison needed: yes, compare strict and relaxed profiles before changing defaults',
      '',
      '## Manual Interpretation',
      '',
      '- Evidence quality: enough for local calibration review only',
      '- What this batch proves: v3 mirror preserves terminal-state evidence for selected v2 traces',
      '- What this batch does not prove: production runtime authority or tool graph execution',
      '- Follow-up samples needed: broader production-like desktop traces',
      '- Threshold action: compare-profiles',
      '',
      '## Guardrails',
      '',
      '- This note does not make v3 production-ready.',
      '- Do not use this note to choose tools, route permissions, execute tools, decide recovery, or replace `AgentSessionV2`.',
      '- Keep threshold changes manual and based on multiple reviewed batches.',
    ].join('\n'),
    'utf8',
  );
}

const { metadataQualitySource } = readProjectSources({
  metadataQualitySource: 'scripts/agent-session-v3-pilot-real-corpus-batch-metadata-quality-report.ts',
});

assert.match(
  metadataQualitySource,
  /export async function runAgentSessionV3PilotRealCorpusBatchMetadataQualityReport/u,
  'metadata quality report should expose a caller-owned runner.',
);
assert.doesNotMatch(
  metadataQualitySource,
  /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'metadata quality report should not know runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  metadataQualitySource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'metadata quality report should not encode a fixed desktop tool chain.',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-metadata-quality-'));
try {
  const template = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: tempDir,
    prettyJson: true,
  });

  const placeholderReport = await runAgentSessionV3PilotRealCorpusBatchMetadataQualityReport({
    includeJsonText: true,
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(placeholderReport.kind, 'agent-session-v3-pilot-real-corpus-batch-metadata-quality-report');
  assert.equal(placeholderReport.version, 1);
  assert.equal(placeholderReport.status, 'blocked');
  assert.equal(placeholderReport.manifestSourceCount, 1);
  assert.equal(placeholderReport.indexBatchCount, 2);
  assert.equal(placeholderReport.notePresent, true);
  assert.equal(placeholderReport.noteOpenItemCount, 23);
  assert.equal(placeholderReport.blockerCount, 1);
  assert.ok(placeholderReport.reviewCount >= 20);
  assert.ok(placeholderReport.issues.some((issue) => issue.code === 'placeholder-path'));
  assert.ok(placeholderReport.issues.some((issue) => issue.code === 'open-sample-note-item'));
  assert.match(placeholderReport.summaryText, /status=blocked/u);
  assert.match(placeholderReport.reportText, /metadataQualityIssues:/u);
  assert.ok(placeholderReport.jsonText);
  assert.match(placeholderReport.jsonText, /agent-session-v3-pilot-real-corpus-batch-metadata-quality-report/u);

  assert.ok(template.manifestPath);
  assert.ok(template.indexPath);
  assert.ok(template.notePath);
  const manifest = JSON.parse(await readFile(template.manifestPath, 'utf8'));
  manifest.sources = [
    {
      label: 'desktop-smoke-real-batch',
      path: './corpora/desktop-smoke-corpus.json',
    },
  ];
  await writeFile(template.manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  const index = JSON.parse(await readFile(template.indexPath, 'utf8'));
  index.batches = [
    {
      generatedAt: '2026-06-23T10:00:00.000Z',
      label: 'baseline-artifact-flow',
      manifestPath: './baseline/explicit-debug-corpus-manifest.json',
      notes: 'baseline bundle generated by the reviewed baseline evidence artifact flow',
      sourceKind: 'baseline',
    },
    {
      generatedAt: '2026-06-23T10:05:00.000Z',
      label: 'desktop-smoke-real-batch',
      manifestPath: './real-corpus-manifest.json',
      notes: 'production-like desktop traces exported by caller-owned debug tooling',
      sourceKind: 'production-like',
    },
  ];
  await writeFile(template.indexPath, JSON.stringify(index, null, 2), 'utf8');

  const noteOpenReport = await runAgentSessionV3PilotRealCorpusBatchMetadataQualityReport({
    intakeDir: tempDir,
    prettyJson: true,
  });
  assert.equal(noteOpenReport.status, 'review-needed');
  assert.equal(noteOpenReport.blockerCount, 0);
  assert.equal(noteOpenReport.noteOpenItemCount, 23);
  assert.ok(noteOpenReport.issues.every((issue) => issue.scope === 'sample-note'));
  assert.match(noteOpenReport.summaryText, /status=review-needed/u);

  await writeFilledSampleNote(template.notePath);

  const readyReport = await runAgentSessionV3PilotRealCorpusBatchMetadataQualityReport({
    includeJsonText: true,
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(readyReport.status, 'review-ready');
  assert.equal(readyReport.issueCount, 0);
  assert.equal(readyReport.blockerCount, 0);
  assert.equal(readyReport.reviewCount, 0);
  assert.equal(readyReport.noteOpenItemCount, 0);
  assert.equal(readyReport.notePresent, true);
  assert.match(readyReport.reportText, /metadataQualityIssues: none/u);
  assert.ok(readyReport.jsonText);
  assert.deepEqual(JSON.parse(readyReport.jsonText), {
    ...readyReport,
    jsonText: null,
  });
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch metadata quality report smoke ok');
