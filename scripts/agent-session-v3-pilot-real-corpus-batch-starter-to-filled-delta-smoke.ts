import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit } from './agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeValidator } from './agent-session-v3-pilot-real-corpus-batch-intake-validator.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport } from './agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

interface IntakeReportSet {
  fieldCompleteness: Awaited<ReturnType<typeof runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit>>;
  p0Status: Awaited<ReturnType<typeof runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport>>;
  runbookCompletion: Awaited<ReturnType<typeof runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport>>;
  validator: Awaited<ReturnType<typeof runAgentSessionV3PilotRealCorpusBatchIntakeValidator>>;
}

async function createReports(intakeDir: string): Promise<IntakeReportSet> {
  const [
    validator,
    p0Status,
    fieldCompleteness,
    runbookCompletion,
  ] = await Promise.all([
    runAgentSessionV3PilotRealCorpusBatchIntakeValidator({
      intakeDir,
      prettyJson: true,
    }),
    runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport({
      intakeDirs: [intakeDir],
      prettyJson: true,
      projectRoot,
    }),
    runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit({
      intakeDirs: [intakeDir],
      prettyJson: true,
      projectRoot,
    }),
    runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport({
      intakeDirs: [intakeDir],
      prettyJson: true,
      projectRoot,
    }),
  ]);

  return {
    fieldCompleteness,
    p0Status,
    runbookCompletion,
    validator,
  };
}

function p0SignalStatuses(reportSet: IntakeReportSet) {
  return reportSet.p0Status.p0TargetSignals
    .map((signal) => `${signal.gapKind}:${signal.status}`)
    .sort();
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-starter-to-filled-delta-smoke.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-starter-to-filled-delta-smoke.ts',
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
  'starter-to-filled delta smoke should not execute shell commands or create task queues.',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-starter-to-filled-delta-'));
try {
  const starterDir = path.join(tempDir, 'starter-intake');
  await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: starterDir,
    prettyJson: true,
  });
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: path.join(tempDir, 'filled-example'),
    prettyJson: true,
  });
  const filledDir = example.intakeDirs.ready;

  const [starter, filled] = await Promise.all([
    createReports(starterDir),
    createReports(filledDir),
  ]);

  assert.equal(starter.validator.status, 'not-ready');
  assert.equal(starter.validator.noteReport.status, 'open-items');
  assert.ok(starter.validator.noteOpenItemCount > 0);
  assert.equal(starter.fieldCompleteness.status, 'open-fields');
  assert.ok(starter.fieldCompleteness.openFieldCount > 0);
  assert.equal(starter.runbookCompletion.status, 'blocked');
  assert.ok(starter.runbookCompletion.blockedCriteriaCount > 0);
  assert.equal(starter.p0Status.status, 'blocked');
  assert.deepEqual(p0SignalStatuses(starter), [
    'real-exported-corpus:missing',
    'real-production-like-sample:missing',
  ]);

  assert.equal(filled.validator.status, 'ready');
  assert.equal(filled.validator.noteReport.status, 'complete');
  assert.equal(filled.validator.noteOpenItemCount, 0);
  assert.equal(filled.fieldCompleteness.status, 'complete');
  assert.equal(filled.fieldCompleteness.openFieldCount, 0);
  assert.equal(filled.runbookCompletion.status, 'ready-for-manual-review');
  assert.equal(filled.runbookCompletion.blockedCriteriaCount, 0);
  assert.equal(filled.p0Status.status, 'blocked');
  assert.deepEqual(p0SignalStatuses(filled), [
    'real-exported-corpus:missing',
    'real-production-like-sample:blocked',
  ]);

  assert.equal(filled.validator.indexReport?.multiReport.statusCounts.ready, 2);
  assert.equal(filled.validator.indexReport?.multiReport.statusCounts.mixed, 0);
  assert.equal(filled.validator.indexReport?.multiReport.statusCounts.notReady, 0);
  assert.ok(
    starter.validator.pathIssueCount > filled.validator.pathIssueCount,
    'starter placeholder paths should carry more path evidence issues than the filled ready intake.',
  );
  assert.equal(filled.validator.pathIssueCount, 0);

  for (const report of [
    starter.p0Status,
    starter.fieldCompleteness,
    starter.runbookCompletion,
    filled.p0Status,
    filled.fieldCompleteness,
    filled.runbookCompletion,
  ]) {
    assert.equal(report.readyForProductionRuntime, false);
    assert.match(report.guardrail, /collect samples/u);
    assert.match(report.guardrail, /execute tools/u);
    assert.match(report.guardrail, /grant runtime authority/u);
  }

  assert.match(starter.validator.summaryText, /status=not-ready/u);
  assert.match(filled.validator.summaryText, /status=ready/u);
  assert.match(starter.runbookCompletion.summaryText, /status=blocked/u);
  assert.match(filled.runbookCompletion.summaryText, /status=ready-for-manual-review/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch starter to filled delta smoke ok');
