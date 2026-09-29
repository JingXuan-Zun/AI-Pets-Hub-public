import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  assertNumberRecordKeys,
  assertObjectRecord,
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain,
  parseTrailingJsonObject,
} from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { createAgentSessionV3PilotRealCorpusBatchSmokeIndex } from './agent-session-v3-pilot-real-corpus-batch-smoke-index.ts';
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

function assertDocCoverageEntry(value: unknown) {
  const entry = assertObjectRecord(value, 'doc coverage entry');

  assert.equal(typeof entry.docPath, 'string');
  assert.equal(typeof entry.mentionedSmokeCount, 'number');
}

function assertCloseoutAuditContract(result: Record<string, unknown>) {
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-closeout-audit');
  assert.equal(result.version, 1);
  assert.equal(result.readyForProductionRuntime, false);
  assert.match(String(result.status), /^(aligned|attention-needed)$/u);
  assert.equal(typeof result.summaryText, 'string');
  assert.equal(typeof result.reportText, 'string');
  assert.equal(typeof result.guardrail, 'string');
  assert.equal(typeof result.statusDashboardSummaryText, 'string');
  assertNumberRecordKeys(
    result,
    [
      'cliContractAuditMentionCount',
      'cliContractSmokeCount',
      'indexedSmokeDocMentionCount',
      'missingCliContractAuditMentionCount',
      'missingDocMentionCount',
      'realSampleGapCount',
      'smokeIndexEntryCount',
      'smokeIndexMissingCount',
      'smokeIndexUnindexedCount',
    ],
    'closeout audit',
  );
  assertNumberRecordKeys(
    result.smokeGroupCounts,
    [
      'cli-contract',
      'coverage-index',
      'final-gap-report',
      'gap-action-checklist',
      'handoff',
      'intake-template',
      'missing-evidence-rollup',
      'p0-real-evidence-closeout',
      'status-dashboard',
    ],
    'smokeGroupCounts',
  );
  assert.ok(Array.isArray(result.docsChecked), 'docsChecked should be an array.');
  assert.ok(Array.isArray(result.docCoverage), 'docCoverage should be an array.');
  assert.ok(Array.isArray(result.missingDocMentionNames), 'missingDocMentionNames should be an array.');
  assert.ok(
    Array.isArray(result.missingCliContractAuditMentionNames),
    'missingCliContractAuditMentionNames should be an array.',
  );
  for (const entry of result.docCoverage) {
    assertDocCoverageEntry(entry);
  }
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-closeout-audit.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-closeout-audit.ts CLI JSON contract',
);

const cliResult = runCli([
  '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-closeout-audit.ts',
  '--pretty',
]);

assert.equal(
  cliResult.status,
  0,
  cliResult.stderr || cliResult.stdout || cliResult.error?.message,
);
assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchCloseoutAudit status=aligned/u);
assert.match(cliResult.stdout, /smokes=91/u);
assert.match(cliResult.stdout, /missingDocMentions=0/u);
assert.match(cliResult.stdout, /missingCliContractAuditMentions=0/u);
assert.match(cliResult.stdout, /docCoverage:/u);
assert.match(cliResult.stdout, /readyForProductionRuntime=no/u);

const result = parseTrailingJsonObject(cliResult.stdout);
const smokeIndex = createAgentSessionV3PilotRealCorpusBatchSmokeIndex({
  projectRoot,
});
const smokeGroupCounts = assertObjectRecord(result.smokeGroupCounts, 'smokeGroupCounts');

assertCloseoutAuditContract(result);
assert.equal(result.status, 'aligned');
assert.equal(result.smokeIndexEntryCount, smokeIndex.entryCount);
assert.equal(result.smokeIndexMissingCount, 0);
assert.equal(result.smokeIndexUnindexedCount, 0);
assert.equal(result.indexedSmokeDocMentionCount, smokeIndex.entryCount);
assert.equal(result.missingDocMentionCount, 0);
assert.equal(result.cliContractSmokeCount, smokeIndex.groupCounts['cli-contract']);
assert.equal(result.cliContractAuditMentionCount, smokeIndex.groupCounts['cli-contract']);
assert.equal(result.missingCliContractAuditMentionCount, 0);
assert.equal(smokeGroupCounts.handoff, smokeIndex.groupCounts.handoff);
assert.equal(smokeGroupCounts['p0-real-evidence-closeout'], smokeIndex.groupCounts['p0-real-evidence-closeout']);
assert.equal(smokeGroupCounts['final-gap-report'], smokeIndex.groupCounts['final-gap-report']);
assert.equal(smokeGroupCounts['intake-field-completeness'], smokeIndex.groupCounts['intake-field-completeness']);
assert.equal(smokeGroupCounts['intake-filling-support'], smokeIndex.groupCounts['intake-filling-support']);
assert.equal(smokeGroupCounts['intake-readiness-gate'], smokeIndex.groupCounts['intake-readiness-gate']);
assert.equal(smokeGroupCounts['intake-template'], smokeIndex.groupCounts['intake-template']);
assert.equal(smokeGroupCounts['runbook-completion'], smokeIndex.groupCounts['runbook-completion']);
assert.ok(Number(result.realSampleGapCount) > 0);
assert.match(String(result.guardrail), /does not run smoke tests/u);
assert.match(String(result.guardrail), /collect samples/u);
assert.match(String(result.guardrail), /grant runtime authority/u);

console.log('agent session v3 pilot real corpus batch closeout audit CLI JSON contract smoke ok');
