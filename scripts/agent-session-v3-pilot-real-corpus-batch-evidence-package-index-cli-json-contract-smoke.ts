import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  assertNumberRecordKeys,
  assertObjectRecord,
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain,
  parseTrailingJsonObject,
} from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
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

function assertEvidencePackageEntry(value: unknown) {
  const entry = assertObjectRecord(value, 'evidence package entry');

  assert.equal(typeof entry.boundary, 'string');
  assert.equal(typeof entry.kind, 'string');
  assert.equal(typeof entry.present, 'boolean');
  assert.equal(typeof entry.relativePath, 'string');
  assert.equal(typeof entry.role, 'string');
}

function assertP0IntakeTargetStatusLink(value: unknown) {
  const link = assertObjectRecord(value, 'P0 intake target status link');

  assert.match(String(link.status), /^(attention-needed|linked)$/u);
  assert.ok(Array.isArray(link.missingSignals), 'P0 intake target status link missingSignals should be an array.');
  for (const signal of link.missingSignals) {
    assert.equal(typeof signal, 'string');
  }
}

function assertEvidencePackageIndexContract(result: Record<string, unknown>) {
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-evidence-package-index');
  assert.equal(result.version, 1);
  assert.equal(result.readyForProductionRuntime, false);
  assert.match(String(result.status), /^(attention-needed|indexed)$/u);
  assert.equal(typeof result.closeoutStatus, 'string');
  assert.equal(typeof result.closeoutSummaryText, 'string');
  assert.equal(typeof result.guardrail, 'string');
  assert.equal(typeof result.missingEvidenceStatus, 'string');
  assert.equal(typeof result.missingEvidenceSummaryText, 'string');
  assert.equal(typeof result.reportText, 'string');
  assert.equal(typeof result.summaryText, 'string');
  assertNumberRecordKeys(
    result,
    [
      'missingPackageEntryCount',
      'packageEntryCount',
      'realSampleGapCount',
    ],
    'evidence package index',
  );
  assert.ok(Array.isArray(result.entries), 'entries should be an array.');
  assert.ok(Array.isArray(result.missingPackageEntryPaths), 'missingPackageEntryPaths should be an array.');
  assertP0IntakeTargetStatusLink(result.p0IntakeTargetStatusLink);
  for (const entry of result.entries) {
    assertEvidencePackageEntry(entry);
  }
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-evidence-package-index.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-evidence-package-index.ts CLI JSON contract',
);

const cliResult = runCli([
  '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-evidence-package-index.ts',
  '--pretty',
]);

assert.equal(
  cliResult.status,
  0,
  cliResult.stderr || cliResult.stdout || cliResult.error?.message,
);
assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchEvidencePackageIndex status=indexed/u);
assert.match(cliResult.stdout, /entries=28/u);
assert.match(cliResult.stdout, /missingEntries=0/u);
assert.match(cliResult.stdout, /p0IntakeTargetStatusLink=linked/u);
assert.match(cliResult.stdout, /evidencePackageEntries:/u);
assert.match(cliResult.stdout, /readyForProductionRuntime=no/u);

const result = parseTrailingJsonObject(cliResult.stdout);

assertEvidencePackageIndexContract(result);
assert.equal(result.status, 'indexed');
assert.equal(result.packageEntryCount, 28);
assert.equal(result.missingPackageEntryCount, 0);
assert.deepEqual(result.p0IntakeTargetStatusLink, {
  missingSignals: [],
  status: 'linked',
});
assert.equal(result.closeoutStatus, 'aligned');
assert.equal(result.missingEvidenceStatus, 'missing-real-evidence');
assert.ok(Number(result.realSampleGapCount) > 0);
assert.match(String(result.closeoutSummaryText), /status=aligned/u);
assert.match(String(result.missingEvidenceSummaryText), /status=missing-real-evidence/u);
assert.match(String(result.reportText), /missingPackageEntries: none/u);
assert.match(String(result.reportText), /p0IntakeTargetStatusLink status=linked missingSignals=none/u);
assert.match(String(result.reportText), /path=scripts\/agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report\.ts/u);
assert.match(String(result.reportText), /path=scripts\/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report\.ts/u);
assert.match(String(result.reportText), /path=scripts\/agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report\.ts/u);
assert.match(String(result.reportText), /path=scripts\/agent-session-v3-pilot-real-corpus-batch-runbook-completion-report\.ts/u);
assert.match(String(result.reportText), /path=scripts\/agent-session-v3-pilot-real-corpus-batch-final-gap-report\.ts/u);
assert.match(String(result.reportText), /path=scripts\/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit\.ts/u);
assert.match(String(result.reportText), /path=scripts\/agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report\.ts/u);
assert.match(String(result.reportText), /path=scripts\/agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report\.ts/u);
assert.match(String(result.reportText), /path=scripts\/agent-session-v3-pilot-real-corpus-batch-handoff-bundle\.ts/u);
assert.match(String(result.reportText), /path=scripts\/agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit\.ts/u);
assert.match(String(result.reportText), /path=scripts\/agent-session-v3-pilot-real-corpus-batch-readiness-snapshot-consistency-smoke\.ts/u);
assert.match(String(result.reportText), /path=scripts\/agent-session-v3-pilot-real-corpus-batch-next-step-consistency-smoke\.ts/u);
assert.match(String(result.reportText), /path=scripts\/agent-session-v3-pilot-real-corpus-batch-intake-field-requirements-consistency-smoke\.ts/u);
assert.match(String(result.guardrail), /does not run smoke tests/u);
assert.match(String(result.guardrail), /create handoff bundles/u);
assert.match(String(result.guardrail), /grant runtime authority/u);

console.log('agent session v3 pilot real corpus batch evidence package index CLI JSON contract smoke ok');
