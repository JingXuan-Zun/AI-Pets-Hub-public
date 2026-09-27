import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  assertNumberRecordKeys,
  assertObjectRecord,
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain,
  parseTrailingJsonObject,
} from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

function runCli(args: readonly string[]) {
  return process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/c', 'npx.cmd', 'tsx', ...args], {
      cwd: projectRoot,
      encoding: 'utf8',
    })
    : spawnSync('npx', ['tsx', ...args], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
}

function assertCriterionContract(value: unknown) {
  const criterion = assertObjectRecord(value, 'runbook completion criterion');

  assert.equal(typeof criterion.detail, 'string');
  assert.equal(typeof criterion.id, 'string');
  assert.equal(typeof criterion.status, 'string');
  assert.equal(typeof criterion.title, 'string');
}

function assertIntakeEntryContract(value: unknown) {
  const entry = assertObjectRecord(value, 'runbook completion intake entry');

  assert.ok(Array.isArray(entry.criteria), 'entry.criteria should be an array.');
  assert.equal(typeof entry.intakeDir, 'string');
  assert.match(String(entry.status), /^(blocked|ready-for-manual-review|review-needed)$/u);
  assert.equal(typeof entry.summaryText, 'string');
  for (const criterion of entry.criteria) {
    assertCriterionContract(criterion);
  }
}

function assertRunbookCompletionContract(result: Record<string, unknown>) {
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-runbook-completion-report');
  assert.equal(result.version, 1);
  assert.equal(result.readyForProductionRuntime, false);
  assert.match(String(result.status), /^(blocked|no-intake-dirs|ready-for-manual-review|review-needed)$/u);
  assert.equal(typeof result.guardrail, 'string');
  assert.equal(typeof result.reportText, 'string');
  assert.equal(typeof result.summaryText, 'string');
  assertNumberRecordKeys(
    result,
    [
      'blockedCriteriaCount',
      'criteriaCount',
      'intakeCount',
      'readyCriteriaCount',
      'reviewCriteriaCount',
    ],
    'runbook completion report',
  );
  assertNumberRecordKeys(
    result.statusCounts,
    [
      'blocked',
      'ready-for-manual-review',
      'review-needed',
    ],
    'statusCounts',
  );
  assert.ok(Array.isArray(result.intakeEntries), 'intakeEntries should be an array.');
  for (const entry of result.intakeEntries) {
    assertIntakeEntryContract(entry);
  }
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts CLI JSON contract',
);

const noInputCli = runCli([
  '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts',
  '--pretty',
]);

assert.equal(
  noInputCli.status,
  0,
  noInputCli.stderr || noInputCli.stdout || noInputCli.error?.message,
);
assert.match(noInputCli.stdout, /AgentSessionV3PilotRealCorpusBatchRunbookCompletionReport status=no-intake-dirs/u);
assert.match(noInputCli.stdout, /readyForProductionRuntime=no/u);

const noInputResult = parseTrailingJsonObject(noInputCli.stdout);
assertRunbookCompletionContract(noInputResult);
assert.equal(noInputResult.status, 'no-intake-dirs');
assert.equal(noInputResult.intakeCount, 0);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-runbook-completion-cli-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: tempDir,
    prettyJson: true,
  });
  const cliResult = runCli([
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts',
    '--dir',
    example.intakeDirs.ready,
    '--pretty',
  ]);

  assert.equal(
    cliResult.status,
    0,
    cliResult.stderr || cliResult.stdout || cliResult.error?.message,
  );
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchRunbookCompletionReport status=ready-for-manual-review/u);
  assert.match(cliResult.stdout, /criteria=6/u);
  assert.match(cliResult.stdout, /criterion=runtime-authority status=complete/u);
  assert.match(cliResult.stdout, /readyForProductionRuntime=no/u);

  const result = parseTrailingJsonObject(cliResult.stdout);

  assertRunbookCompletionContract(result);
  assert.equal(result.status, 'ready-for-manual-review');
  assert.equal(result.intakeCount, 1);
  assert.equal(result.criteriaCount, 6);
  assert.equal(result.blockedCriteriaCount, 0);
  assert.equal(result.reviewCriteriaCount, 0);
  assert.equal(result.readyCriteriaCount, 6);
  assert.match(String(result.guardrail), /explicitly supplied --dir/u);
  assert.match(String(result.guardrail), /does not discover directories/u);
  assert.match(String(result.guardrail), /grant runtime authority/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch runbook completion report CLI JSON contract smoke ok');
