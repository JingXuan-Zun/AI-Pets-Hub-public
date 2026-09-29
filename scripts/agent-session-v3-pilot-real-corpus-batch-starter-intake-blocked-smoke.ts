import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit } from './agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeValidator } from './agent-session-v3-pilot-real-corpus-batch-intake-validator.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport } from './agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-starter-intake-blocked-smoke.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-starter-intake-blocked-smoke.ts',
);
const forbiddenCommandTokens = [
  ['spawn', 'Sync'].join(''),
  ['exec', 'Sync'].join(''),
  ['npm', 'cmd'].join('.'),
  ['create', 'TaskQueue'].join(''),
  ['en', 'queue'].join(''),
];
assert.doesNotMatch(
  source,
  new RegExp(forbiddenCommandTokens.join('|'), 'u'),
  'starter intake blocked smoke should not execute shell commands or create task queues.',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-starter-intake-blocked-'));
try {
  await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: tempDir,
    prettyJson: true,
  });

  const [
    validator,
    p0Status,
    fieldCompleteness,
    runbookCompletion,
  ] = await Promise.all([
    runAgentSessionV3PilotRealCorpusBatchIntakeValidator({
      intakeDir: tempDir,
      prettyJson: true,
    }),
    runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport({
      intakeDirs: [tempDir],
      prettyJson: true,
      projectRoot,
    }),
    runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit({
      intakeDirs: [tempDir],
      prettyJson: true,
      projectRoot,
    }),
    runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport({
      intakeDirs: [tempDir],
      prettyJson: true,
      projectRoot,
    }),
  ]);

  assert.equal(validator.status, 'not-ready');
  assert.equal(validator.missingPaths.length, 0);
  assert.equal(validator.pathHealthReport.status, 'issues');
  assert.ok(
    validator.pathHealthReport.issues.some((issue) => (
      issue.scope === 'manifest-source'
      && issue.status === 'missing'
      && issue.declaredPath === './corpora/replace-with-debug-corpus.json'
    )),
    'starter manifest placeholder corpus path should remain missing evidence.',
  );
  assert.ok(
    validator.pathHealthReport.issues.some((issue) => (
      issue.scope === 'index-manifest'
      && issue.status === 'missing'
      && issue.declaredPath === './baseline/explicit-debug-corpus-manifest.json'
    )),
    'starter index baseline placeholder path should remain missing evidence.',
  );
  assert.equal(validator.notePresent, true);
  assert.ok(validator.noteOpenItemCount > 0);
  assert.match(validator.summaryText, /status=not-ready/u);

  assert.equal(p0Status.status, 'blocked');
  assert.equal(p0Status.intakeCount, 1);
  assert.equal(p0Status.blockedCount, 1);
  assert.deepEqual(
    p0Status.p0TargetSignals.map((signal) => `${signal.gapKind}:${signal.status}`).sort(),
    [
      'real-exported-corpus:missing',
      'real-production-like-sample:missing',
    ],
  );
  assert.ok(
    p0Status.entries[0]?.blockerReasons.some((reason) => (
      reason.includes('intake validator reports not-ready evidence')
    )),
    'starter intake should be blocked by not-ready validator evidence.',
  );
  assert.ok(
    p0Status.entries[0]?.reviewReasons.some((reason) => (
      reason.includes('sample note still has open items')
    )),
    'starter sample note placeholders should stay visible as review evidence.',
  );
  assert.equal(p0Status.readyForProductionRuntime, false);

  assert.equal(fieldCompleteness.status, 'open-fields');
  assert.equal(fieldCompleteness.intakeCount, 1);
  assert.equal(fieldCompleteness.intakeStatusCounts['open-fields'], 1);
  assert.ok(fieldCompleteness.placeholderFieldCount > 0);
  assert.ok(fieldCompleteness.openFieldCount > 0);
  assert.equal(fieldCompleteness.readyForProductionRuntime, false);

  assert.equal(runbookCompletion.status, 'blocked');
  assert.equal(runbookCompletion.intakeCount, 1);
  assert.equal(runbookCompletion.statusCounts.blocked, 1);
  assert.ok(runbookCompletion.blockedCriteriaCount > 0);
  assert.ok(
    runbookCompletion.intakeEntries[0]?.criteria.some((criterion) => (
      criterion.id === 'field-completeness'
      && criterion.status === 'blocked'
    )),
    'starter intake should not satisfy field completeness completion criteria.',
  );
  assert.ok(
    runbookCompletion.intakeEntries[0]?.criteria.some((criterion) => (
      criterion.id === 'runtime-authority'
      && criterion.status === 'complete'
    )),
    'starter blocked evidence should still preserve the no-production-authority criterion.',
  );
  assert.equal(runbookCompletion.readyForProductionRuntime, false);

  for (const guardrail of [
    p0Status.guardrail,
    fieldCompleteness.guardrail,
    runbookCompletion.guardrail,
  ]) {
    assert.match(guardrail, /does not discover directories/u);
    assert.match(guardrail, /collect samples/u);
    assert.match(guardrail, /execute tools/u);
    assert.match(guardrail, /grant runtime authority/u);
  }
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch starter intake blocked smoke ok');
