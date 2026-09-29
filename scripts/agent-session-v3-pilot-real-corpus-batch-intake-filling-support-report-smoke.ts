import assert from 'node:assert/strict';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport } from './agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts',
});

assert.match(
  source,
  /export function createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport/u,
  'real corpus batch intake filling support report should expose a caller-owned report builder.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts',
);
assert.doesNotMatch(
  source,
  /spawnSync|execSync|npm\.cmd|mkdir|writeFile|readFile|createTaskQueue|enqueue/u,
  'intake filling support report should not execute commands, write files, discover directories, or create task queues.',
);
assert.doesNotMatch(
  source,
  /runAgentSessionV3PilotRealCorpusBatchIntakeTemplate/u,
  'intake filling support report should not create intake template files.',
);

const result = createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport({
  projectRoot,
});

assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report');
assert.equal(result.version, 1);
assert.equal(result.readyForProductionRuntime, false);
assert.equal(result.status, 'needs-intake-filling');
assert.equal(result.finalGapCount, 6);
assert.equal(result.fillingItemCount, 6);
assert.deepEqual(result.priorityCounts, {
  P0: 2,
  P1: 2,
  P2: 2,
  unprioritized: 0,
});
assert.deepEqual(
  result.fillingItems.map((item) => `${item.priority}:${item.gapKind}`),
  [
    'P0:real-exported-corpus',
    'P0:real-production-like-sample',
    'P1:broader-real-corpus',
    'P1:manifest-distribution',
    'P2:real-exported-fixture',
    'P2:real-threshold-profile',
  ],
);

const realExportedCorpus = result.fillingItems.find((item) => item.gapKind === 'real-exported-corpus');
assert.ok(realExportedCorpus);
assert.ok(realExportedCorpus.sampleNoteFields.some((field) => field.id === 'sample-source'));
assert.ok(realExportedCorpus.sampleNoteFields.some((field) => field.id === 'sample-source-status'));
assert.ok(realExportedCorpus.sampleNoteFields.some((field) => field.id === 'corpus-paths'));
assert.ok(realExportedCorpus.sampleNoteFields.some((field) => field.id === 'p0-real-exported-signal'));
assert.ok(realExportedCorpus.manifestFields.includes('sources[].path'));
assert.ok(realExportedCorpus.indexFields.includes('batches[].sourceKind'));
assert.ok(
  result.followUpReportPaths.includes('scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts'),
);

const productionLike = result.fillingItems.find((item) => item.gapKind === 'real-production-like-sample');
assert.ok(productionLike);
assert.ok(productionLike.sampleNoteFields.some((field) => field.id === 'source-environment'));
assert.ok(productionLike.sampleNoteFields.some((field) => field.id === 'scenario-family'));
assert.ok(productionLike.sampleNoteFields.some((field) => field.id === 'p0-production-like-signal'));
assert.ok(productionLike.sampleNoteFields.some((field) => field.id === 'batch-limitations'));

const thresholdProfile = result.fillingItems.find((item) => item.gapKind === 'real-threshold-profile');
assert.ok(thresholdProfile);
assert.ok(thresholdProfile.sampleNoteFields.some((field) => field.id === 'threshold-comparison'));
assert.ok(thresholdProfile.sampleNoteFields.some((field) => field.id === 'threshold-action'));
assert.match(thresholdProfile.boundary, /does not adopt or recommend a threshold/u);

for (const item of result.fillingItems) {
  assert.ok(item.gapCount > 0);
  assert.ok(item.sampleNoteFields.length > 0);
  assert.ok(item.manifestFields.length > 0);
  assert.ok(item.indexFields.length > 0);
  assert.ok(item.sourceReports.includes('scripts/agent-session-v3-pilot-real-corpus-batch-final-gap-report.ts'));
  assert.ok(item.sourceReports.includes('scripts/agent-session-v3-pilot-real-corpus-batch-intake-template.ts'));
  assert.ok(item.sourceReports.includes('scripts/agent-session-v3-pilot-real-corpus-batch-sample-note-report.ts'));
  assert.ok(item.sourceReports.includes('scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts'));
  assert.doesNotMatch(item.boundary, /runtime action order/iu);
  for (const field of item.sampleNoteFields) {
    assert.equal(typeof field.label, 'string');
    assert.equal(typeof field.placeholder, 'string');
    assert.equal(typeof field.reason, 'string');
  }
}

assert.match(result.finalGapSummaryText, /status=missing-real-evidence/u);
assert.match(result.summaryText, /status=needs-intake-filling/u);
assert.match(result.summaryText, /fillingItems=6/u);
assert.match(result.summaryText, /P0=2/u);
assert.match(result.reportText, /manualIntakeFillingItems:/u);
assert.match(result.reportText, /gapKind=real-exported-corpus/u);
assert.match(result.reportText, /sampleNoteFields=.*p0-real-exported-signal/u);
assert.match(result.reportText, /gapKind=real-production-like-sample/u);
assert.match(result.reportText, /sampleNoteFields=.*p0-production-like-signal/u);
assert.match(result.reportText, /gapKind=real-threshold-profile/u);
assert.match(result.reportText, /sampleNoteFields=.*threshold-action/u);
assert.match(result.reportText, /followUpReports:/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit\.ts/u);
assert.match(result.reportText, /sourceReports=.*agent-session-v3-pilot-real-corpus-batch-intake-template\.ts/u);
assert.match(result.reportText, /does not discover directories, create intake directories, collect samples, auto-fill files, write manifests, run smoke tests, create task queues, create handoff bundles, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, or grant runtime authority/u);

console.log('agent session v3 pilot real corpus batch intake filling support report smoke ok');
