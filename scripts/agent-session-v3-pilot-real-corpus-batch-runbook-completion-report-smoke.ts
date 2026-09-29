import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport } from './agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts',
});

assert.match(
  source,
  /export async function runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport/u,
  'runbook completion report should expose a caller-owned report builder.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts',
);
assert.doesNotMatch(
  source,
  /spawnSync|execSync|npm\.cmd|writeFile|mkdir|mkdtemp|createTaskQueue|enqueue/u,
  'runbook completion report should not execute commands, write files, create directories, or create queues.',
);

const noInput = await runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport({
  projectRoot,
});

assert.equal(noInput.kind, 'agent-session-v3-pilot-real-corpus-batch-runbook-completion-report');
assert.equal(noInput.version, 1);
assert.equal(noInput.readyForProductionRuntime, false);
assert.equal(noInput.status, 'no-intake-dirs');
assert.equal(noInput.intakeCount, 0);
assert.equal(noInput.criteriaCount, 0);
assert.deepEqual(noInput.statusCounts, {
  blocked: 0,
  'ready-for-manual-review': 0,
  'review-needed': 0,
});
assert.match(noInput.summaryText, /status=no-intake-dirs/u);
assert.match(noInput.reportText, /runbookCompletionIntakes: none/u);
assert.match(noInput.reportText, /readyForProductionRuntime=no/u);
assert.match(noInput.guardrail, /explicitly supplied --dir/u);
assert.match(noInput.guardrail, /does not discover directories/u);
assert.match(noInput.guardrail, /grant runtime authority/u);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-runbook-completion-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: tempDir,
    prettyJson: true,
  });

  const allIntakes = await runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport({
    includeJsonText: true,
    intakeDirs: [
      example.intakeDirs.missing,
      example.intakeDirs.mixed,
      example.intakeDirs.ready,
    ],
    prettyJson: true,
    projectRoot,
  });

  assert.equal(allIntakes.status, 'blocked');
  assert.equal(allIntakes.intakeCount, 3);
  assert.equal(allIntakes.statusCounts.blocked, 2);
  assert.equal(allIntakes.statusCounts['review-needed'], 0);
  assert.equal(allIntakes.statusCounts['ready-for-manual-review'], 1);
  assert.equal(allIntakes.criteriaCount, 18);
  assert.ok(allIntakes.blockedCriteriaCount > 0);
  assert.ok(allIntakes.reviewCriteriaCount > 0);
  assert.ok(allIntakes.readyCriteriaCount > 0);
  assert.match(allIntakes.summaryText, /blockedIntakes=2/u);
  assert.match(allIntakes.summaryText, /reviewNeededIntakes=0/u);
  assert.match(allIntakes.summaryText, /readyForManualReviewIntakes=1/u);
  assert.match(allIntakes.reportText, /criterion=field-completeness status=blocked/u);
  assert.match(allIntakes.reportText, /criterion=field-completeness status=complete/u);
  assert.match(allIntakes.reportText, /criterion=operator-checklist status=review-needed/u);
  assert.match(allIntakes.reportText, /criterion=runtime-authority status=complete/u);
  assert.ok(allIntakes.jsonText);
  assert.deepEqual(JSON.parse(allIntakes.jsonText), {
    ...allIntakes,
    jsonText: null,
  });

  const readyOnly = await runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    prettyJson: true,
    projectRoot,
  });

  assert.equal(readyOnly.status, 'ready-for-manual-review');
  assert.equal(readyOnly.intakeCount, 1);
  assert.equal(readyOnly.statusCounts['ready-for-manual-review'], 1);
  assert.equal(readyOnly.blockedCriteriaCount, 0);
  assert.equal(readyOnly.reviewCriteriaCount, 0);
  assert.equal(readyOnly.readyCriteriaCount, 6);
  assert.deepEqual(
    readyOnly.intakeEntries[0]?.criteria.map((criterion) => criterion.id).sort(),
    [
      'batch-index',
      'field-completeness',
      'manifest-sources',
      'operator-checklist',
      'runtime-authority',
      'validator-runnable',
    ],
  );
  assert.ok(
    readyOnly.intakeEntries[0]?.criteria.every((criterion) => criterion.status === 'complete'),
    'ready intake should satisfy every runbook completion criterion.',
  );
  assert.match(readyOnly.summaryText, /status=ready-for-manual-review/u);
  assert.match(readyOnly.reportText, /all .* required field\(s\) are complete/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch runbook completion report smoke ok');
