import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  assertObjectRecord,
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain,
  parseTrailingJsonObject,
} from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffBundle } from './agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts';
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

function assertStringValue(value: unknown, label: string) {
  assert.equal(typeof value, 'string', `${label} should be a string.`);
}

function assertNumberValue(value: unknown, label: string) {
  assert.equal(typeof value, 'number', `${label} should be a number.`);
}

function assertObservationShape(value: unknown) {
  const observation = assertObjectRecord(value, 'observation');

  assert.match(String(observation.label), /^(handoff-index|handoff-manifest|readme)$/u);
  assertStringValue(observation.path, 'observation.path');
  assert.equal(typeof observation.present, 'boolean');
  assert.ok(
    observation.sampleSource === null || typeof observation.sampleSource === 'string',
    'observation.sampleSource should be string or null.',
  );
  assert.ok(
    observation.sampleSourceStatus === null || typeof observation.sampleSourceStatus === 'string',
    'observation.sampleSourceStatus should be string or null.',
  );
}

function assertIssueShape(value: unknown) {
  const issue = assertObjectRecord(value, 'issue');

  assertStringValue(issue.code, 'issue.code');
  assertStringValue(issue.detail, 'issue.detail');
  assertStringValue(issue.path, 'issue.path');
  assert.match(String(issue.severity), /^(blocker|review)$/u);
  assert.match(String(issue.source), /^(handoff-index|handoff-manifest|readme)$/u);
}

function assertConsistencyContract(result: Record<string, unknown>) {
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report');
  assert.equal(result.version, 1);
  assert.match(String(result.status), /^(blocked|consistent|review-needed)$/u);
  assertStringValue(result.bundleDir, 'bundleDir');
  assertStringValue(result.handoffIndexPath, 'handoffIndexPath');
  assertStringValue(result.handoffManifestPath, 'handoffManifestPath');
  assertStringValue(result.readmePath, 'readmePath');
  assertNumberValue(result.issueCount, 'issueCount');
  assertNumberValue(result.blockerCount, 'blockerCount');
  assertNumberValue(result.reviewCount, 'reviewCount');
  assertStringValue(result.reportText, 'reportText');
  assertStringValue(result.summaryText, 'summaryText');
  assert.ok(
    result.expectedSampleSource === null || typeof result.expectedSampleSource === 'string',
    'expectedSampleSource should be string or null.',
  );
  assert.ok(
    result.sampleSource === null || typeof result.sampleSource === 'string',
    'sampleSource should be string or null.',
  );
  assert.ok(
    result.sampleSourceStatus === null || typeof result.sampleSourceStatus === 'string',
    'sampleSourceStatus should be string or null.',
  );
  assert.ok(Array.isArray(result.observations), 'observations should be an array.');
  for (const observation of result.observations) {
    assertObservationShape(observation);
  }
  assert.ok(Array.isArray(result.issues), 'issues should be an array.');
  for (const issue of result.issues) {
    assertIssueShape(issue);
  }
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts CLI JSON contract',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-handoff-source-consistency-json-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: path.join(tempDir, 'example'),
    prettyJson: true,
  });
  const bundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'handoff'),
    prettyJson: true,
    sampleSource: 'rehearsal',
  });
  const cliResult = runCli([
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts',
    '--dir',
    bundle.outDir,
    '--expected-source',
    'rehearsal',
    '--pretty',
  ]);

  assert.equal(
    cliResult.status,
    0,
    cliResult.stderr || cliResult.stdout || cliResult.error?.message,
  );
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport status=consistent/u);
  assert.match(cliResult.stdout, /sampleSource=rehearsal/u);
  assert.match(cliResult.stdout, /sampleSourceStatus=synthetic-rehearsal/u);
  assert.match(cliResult.stdout, /sampleSourceConsistencyIssues: none/u);

  const result = parseTrailingJsonObject(cliResult.stdout);
  assertConsistencyContract(result);
  assert.equal(result.status, 'consistent');
  assert.equal(result.issueCount, 0);
  assert.equal(result.sampleSource, 'rehearsal');
  assert.equal(result.sampleSourceStatus, 'synthetic-rehearsal');
  assert.equal(result.expectedSampleSource, 'rehearsal');
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch handoff sample-source consistency CLI JSON contract smoke ok');
