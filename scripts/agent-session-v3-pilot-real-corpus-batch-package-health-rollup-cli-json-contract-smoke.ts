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

function assertPackageHealthRollupContract(result: Record<string, unknown>) {
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-package-health-rollup');
  assert.equal(result.version, 1);
  assert.equal(result.readyForProductionRuntime, false);
  assert.match(String(result.status), /^(indexed|missing-package-entry|missing-real-evidence|package-attention-needed)$/u);
  assert.equal(typeof result.closeoutStatus, 'string');
  assert.equal(typeof result.evidencePackageSummaryText, 'string');
  assert.equal(typeof result.guardrail, 'string');
  assert.equal(typeof result.markerStatus, 'string');
  assert.equal(typeof result.missingEvidenceSummaryText, 'string');
  assert.equal(typeof result.reportText, 'string');
  assert.equal(typeof result.summaryText, 'string');
  assertNumberRecordKeys(
    result,
    [
      'gapKindEntryCount',
      'missingPackageEntryCount',
      'packageEntryCount',
      'p0IntakeTargetStatusLinkMissingSignalCount',
      'realSampleGapCount',
      'unprioritizedGapCount',
    ],
    'package health rollup',
  );
  assertNumberRecordKeys(
    result.priorityCounts,
    [
      'P0',
      'P1',
      'P2',
    ],
    'priorityCounts',
  );
  assert.ok(Array.isArray(result.missingPackageEntryPaths), 'missingPackageEntryPaths should be an array.');
  assert.equal(typeof result.p0IntakeTargetStatusLinkStatus, 'string');
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts CLI JSON contract',
);

const cliResult = runCli([
  '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts',
  '--pretty',
]);

assert.equal(
  cliResult.status,
  0,
  cliResult.stderr || cliResult.stdout || cliResult.error?.message,
);
assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchPackageHealthRollup status=missing-real-evidence/u);
assert.match(cliResult.stdout, /packageEntries=28/u);
assert.match(cliResult.stdout, /missingPackageEntries=0/u);
assert.match(cliResult.stdout, /p0IntakeTargetStatusLink=linked/u);
assert.match(cliResult.stdout, /p0IntakeTargetStatusLinkMissingSignals=0/u);
assert.match(cliResult.stdout, /priorityCounts:/u);
assert.match(cliResult.stdout, /readyForProductionRuntime=no/u);

const result = parseTrailingJsonObject(cliResult.stdout);
const priorityCounts = assertObjectRecord(result.priorityCounts, 'priorityCounts');

assertPackageHealthRollupContract(result);
assert.equal(result.status, 'missing-real-evidence');
assert.equal(result.packageEntryCount, 28);
assert.equal(result.missingPackageEntryCount, 0);
assert.equal(result.p0IntakeTargetStatusLinkStatus, 'linked');
assert.equal(result.p0IntakeTargetStatusLinkMissingSignalCount, 0);
assert.equal(result.gapKindEntryCount, 6);
assert.equal(result.unprioritizedGapCount, 0);
assert.ok(Number(result.realSampleGapCount) > 0);
assert.equal(result.closeoutStatus, 'aligned');
assert.equal(result.markerStatus, 'explicit-marker-covered');
assert.equal(priorityCounts.P0, 2);
assert.equal(priorityCounts.P1, 2);
assert.equal(priorityCounts.P2, 2);
assert.match(String(result.evidencePackageSummaryText), /status=indexed/u);
assert.match(String(result.missingEvidenceSummaryText), /status=missing-real-evidence/u);
assert.match(String(result.guardrail), /does not run smoke tests/u);
assert.match(String(result.guardrail), /create handoff bundles/u);
assert.match(String(result.guardrail), /grant runtime authority/u);

console.log('agent session v3 pilot real corpus batch package health rollup CLI JSON contract smoke ok');
