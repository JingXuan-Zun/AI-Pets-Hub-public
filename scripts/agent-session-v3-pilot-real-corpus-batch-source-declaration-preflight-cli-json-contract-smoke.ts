import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  assertObjectRecord,
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain,
  parseTrailingJsonObject,
} from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
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

  assert.match(String(observation.label), /^(sample-note|handoff-bundle)$/u);
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
  assert.match(String(issue.source), /^(sample-note|handoff-bundle)$/u);
}

function assertSourceDeclarationPreflightContract(result: Record<string, unknown>) {
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight');
  assert.equal(result.version, 1);
  assert.equal(result.readyForProductionRuntime, false);
  assert.match(String(result.status), /^(blocked|consistent|review-needed)$/u);
  assertStringValue(result.intakeDir, 'intakeDir');
  assertStringValue(result.sampleNotePath, 'sampleNotePath');
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
    result.handoffBundleDir === null || typeof result.handoffBundleDir === 'string',
    'handoffBundleDir should be string or null.',
  );
  assert.ok(
    result.handoffConsistencyReport === null || typeof result.handoffConsistencyReport === 'object',
    'handoffConsistencyReport should be object or null.',
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
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts CLI JSON contract',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-source-declaration-preflight-json-'));
try {
  const template = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: tempDir,
    prettyJson: true,
  });
  await writeFile(
    template.notePath ?? path.join(tempDir, 'sample-note-template.md'),
    template.noteText
      .replace('replace-with-sample-source-real-exported-rehearsal-or-unknown', 'real-exported')
      .replace('replace-with-sample-source-status', 'real-exported-evidence'),
    'utf8',
  );

  const cliResult = runCli([
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts',
    '--dir',
    tempDir,
    '--expected-source',
    'real-exported',
    '--pretty',
  ]);

  assert.equal(
    cliResult.status,
    0,
    cliResult.stderr || cliResult.stdout || cliResult.error?.message,
  );
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight status=consistent/u);
  assert.match(cliResult.stdout, /sampleSource=real-exported/u);
  assert.match(cliResult.stdout, /sampleSourceStatus=real-exported-evidence/u);
  assert.match(cliResult.stdout, /sourceDeclarationIssues: none/u);

  const result = parseTrailingJsonObject(cliResult.stdout);
  assertSourceDeclarationPreflightContract(result);
  assert.equal(result.status, 'consistent');
  assert.equal(result.issueCount, 0);
  assert.equal(result.sampleSource, 'real-exported');
  assert.equal(result.sampleSourceStatus, 'real-exported-evidence');
  assert.equal(result.expectedSampleSource, 'real-exported');
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch source declaration preflight CLI JSON contract smoke ok');
