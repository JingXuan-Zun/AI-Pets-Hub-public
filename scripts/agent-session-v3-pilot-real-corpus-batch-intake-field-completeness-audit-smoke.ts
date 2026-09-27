import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit } from './agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts',
});

assert.match(
  source,
  /export async function runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit/u,
  'real corpus batch intake field completeness audit should expose a caller-owned report builder.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts',
);
assert.doesNotMatch(
  source,
  /spawnSync|execSync|npm\.cmd|writeFile|mkdir|mkdtemp|createTaskQueue|enqueue/u,
  'intake field completeness audit should not execute commands, write files, create directories, or create queues.',
);

const noInput = await runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit({
  projectRoot,
});

assert.equal(noInput.kind, 'agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit');
assert.equal(noInput.version, 1);
assert.equal(noInput.readyForProductionRuntime, false);
assert.equal(noInput.status, 'no-intake-dirs');
assert.equal(noInput.intakeCount, 0);
assert.equal(noInput.openFieldCount, 0);
assert.deepEqual(noInput.intakeStatusCounts, {
  complete: 0,
  'open-fields': 0,
  unreadable: 0,
});
assert.equal(noInput.fieldStatusCountsByScope['sample-note'].complete, 0);
assert.equal(noInput.fieldStatusCountsByScope.manifest.missing, 0);
assert.equal(noInput.fieldStatusCountsByScope.index.placeholder, 0);
assert.ok(noInput.requiredFieldCount > 0);
assert.ok(noInput.fieldRequirements.some((requirement) => requirement.scope === 'sample-note' && requirement.field === 'sample-source'));
assert.ok(noInput.fieldRequirements.some((requirement) => requirement.scope === 'manifest' && requirement.field === 'sources[].path'));
assert.ok(noInput.fieldRequirements.some((requirement) => requirement.scope === 'index' && requirement.field === 'batches[].sourceKind'));
assert.match(noInput.summaryText, /status=no-intake-dirs/u);
assert.match(noInput.reportText, /fieldRequirements:/u);
assert.match(noInput.reportText, /intakeFieldCompleteness: none/u);
assert.match(noInput.reportText, /does not discover directories, create intake directories, collect samples, auto-fill files, write manifests, run smoke tests, create task queues, create handoff bundles, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, or grant runtime authority/u);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-intake-field-completeness-audit-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: tempDir,
    prettyJson: true,
  });

  const readyOnly = await runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    projectRoot,
    prettyJson: true,
  });

  assert.equal(readyOnly.status, 'complete');
  assert.equal(readyOnly.intakeCount, 1);
  assert.equal(readyOnly.missingFieldCount, 0);
  assert.equal(readyOnly.placeholderFieldCount, 0);
  assert.equal(readyOnly.unreadableFieldCount, 0);
  assert.equal(readyOnly.openFieldCount, 0);
  assert.deepEqual(readyOnly.intakeStatusCounts, {
    complete: 1,
    'open-fields': 0,
    unreadable: 0,
  });
  assert.ok(readyOnly.fieldStatusCountsByScope['sample-note'].complete > 0);
  assert.equal(readyOnly.fieldStatusCountsByScope['sample-note'].placeholder, 0);
  assert.equal(readyOnly.completeFieldCount, readyOnly.requiredFieldCount);
  assert.equal(readyOnly.intakeEntries[0]?.status, 'complete');
  assert.ok(
    readyOnly.intakeEntries[0]?.fieldAudits.every((field) => field.status === 'complete'),
    'ready example intake should satisfy every current filling-support field.',
  );
  assert.match(readyOnly.reportText, /status=complete/u);

  const mixedOnly = await runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit({
    intakeDirs: [
      example.intakeDirs.mixed,
    ],
    projectRoot,
    prettyJson: true,
  });

  assert.equal(mixedOnly.status, 'open-fields');
  assert.equal(mixedOnly.intakeCount, 1);
  assert.ok(mixedOnly.placeholderFieldCount > 0);
  assert.ok(mixedOnly.openFieldCount > 0);
  assert.equal(mixedOnly.unreadableFieldCount, 0);
  assert.deepEqual(mixedOnly.intakeStatusCounts, {
    complete: 0,
    'open-fields': 1,
    unreadable: 0,
  });
  assert.ok(mixedOnly.fieldStatusCountsByScope['sample-note'].placeholder > 0);
  assert.ok(
    mixedOnly.intakeEntries[0]?.fieldAudits.some((field) => field.scope === 'sample-note' && field.status === 'placeholder'),
    'mixed example intake should keep sample-note placeholders visible.',
  );
  assert.match(mixedOnly.reportText, /status=placeholder/u);
  assert.match(mixedOnly.reportText, /sample note still contains placeholder/u);
  assert.match(mixedOnly.reportText, /intakeStatusCounts:/u);
  assert.match(mixedOnly.reportText, /fieldStatusCountsByScope:/u);
  assert.match(mixedOnly.reportText, /scope=sample-note status=placeholder fields=/u);

  const missingOnly = await runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit({
    includeJsonText: true,
    intakeDirs: [
      example.intakeDirs.missing,
    ],
    projectRoot,
    prettyJson: true,
  });

  assert.equal(missingOnly.status, 'open-fields');
  assert.equal(missingOnly.intakeCount, 1);
  assert.ok(missingOnly.missingFieldCount > 0);
  assert.ok(missingOnly.openFieldCount > 0);
  assert.equal(missingOnly.intakeStatusCounts['open-fields'], 1);
  assert.ok(missingOnly.fieldStatusCountsByScope.manifest.missing > 0);
  assert.ok(missingOnly.fieldStatusCountsByScope.index.missing > 0);
  assert.match(missingOnly.reportText, /real-corpus-manifest\.json is missing/u);
  assert.match(missingOnly.reportText, /sample note file is missing/u);
  assert.ok(missingOnly.jsonText);
  assert.match(missingOnly.jsonText, /agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch intake field completeness audit smoke ok');
