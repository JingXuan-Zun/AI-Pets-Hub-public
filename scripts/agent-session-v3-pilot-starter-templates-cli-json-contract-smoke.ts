import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
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

function runJsonCli(args: readonly string[]) {
  const result = runCli(args);

  assert.equal(
    result.status,
    0,
    result.stderr || result.stdout || result.error?.message,
  );

  return parseTrailingJsonObject(result.stdout);
}

function assertStringValue(value: unknown, label: string) {
  assert.equal(typeof value, 'string', `${label} should be a string.`);
}

function assertNullableStringValue(value: unknown, label: string) {
  assert.ok(value === null || typeof value === 'string', `${label} should be a string or null.`);
}

function assertArrayValue(value: unknown, label: string) {
  assert.ok(Array.isArray(value), `${label} should be an array.`);

  return value;
}

function assertThresholdShape(value: unknown, label: string) {
  return assertNumberRecordKeys(value, [
    'maxCollectorIssues',
    'maxInconclusive',
    'maxMismatches',
    'maxUnavailable',
    'minAgreementSamples',
    'minShadowSamples',
  ], label);
}

function assertManifestSourceShape(source: unknown) {
  const sourceRecord = assertObjectRecord(source, 'manifest source');

  assertStringValue(sourceRecord.label, 'manifest source label');
  assertStringValue(sourceRecord.path, 'manifest source path');
}

function assertThresholdProfileShape(profile: unknown) {
  const profileRecord = assertObjectRecord(profile, 'threshold profile');

  assertStringValue(profileRecord.label, 'threshold profile label');
  assertThresholdShape(profileRecord.thresholds, 'threshold profile thresholds');
}

function assertManifestTemplateContract(manifest: Record<string, unknown>) {
  const corpusOptions = assertObjectRecord(manifest.corpusOptions, 'manifest corpusOptions');
  assert.equal(typeof corpusOptions.maxShadowDebugSamples, 'number');

  const sources = assertArrayValue(manifest.sources, 'manifest sources');
  assert.equal(sources.length, 1);
  for (const source of sources) {
    assertManifestSourceShape(source);
  }

  const thresholdProfiles = assertArrayValue(manifest.thresholdProfiles, 'manifest thresholdProfiles');
  assert.equal(thresholdProfiles.length, 3);
  for (const profile of thresholdProfiles) {
    assertThresholdProfileShape(profile);
  }

  assertThresholdShape(manifest.thresholds, 'manifest thresholds');
  assert.equal(typeof manifest.useBatchThresholdOverrides, 'boolean');
}

function assertIndexBatchShape(batch: unknown) {
  const batchRecord = assertObjectRecord(batch, 'index batch');

  assertNullableStringValue(batchRecord.generatedAt, 'index batch generatedAt');
  assertStringValue(batchRecord.label, 'index batch label');
  assertStringValue(batchRecord.manifestPath, 'index batch manifestPath');
  assertNullableStringValue(batchRecord.notes, 'index batch notes');
  assertStringValue(batchRecord.sourceKind, 'index batch sourceKind');
}

function assertIndexTemplateContract(index: Record<string, unknown>) {
  assert.equal(index.version, 1);
  const batches = assertArrayValue(index.batches, 'index batches');
  assert.equal(batches.length, 2);
  for (const batch of batches) {
    assertIndexBatchShape(batch);
  }
}

for (const scriptName of [
  'agent-session-v3-pilot-external-sample-corpus-manifest-template.ts',
  'agent-session-v3-pilot-corpus-batch-index-template.ts',
]) {
  const { scriptSource } = readProjectSources({
    scriptSource: `scripts/${scriptName}`,
  });

  assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
    scriptSource,
    `${scriptName} CLI JSON contract`,
  );
}

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-starter-templates-json-contract-'));
try {
  const manifestPath = path.join(tempDir, 'starter-manifest.json');
  const indexPath = path.join(tempDir, 'starter-index.json');

  const manifest = runJsonCli([
    '.\\scripts\\agent-session-v3-pilot-external-sample-corpus-manifest-template.ts',
    '--out',
    manifestPath,
    '--pretty',
  ]);
  assertManifestTemplateContract(manifest);
  assert.equal(
    (assertObjectRecord((manifest.sources as unknown[])[0], 'manifest source')).label,
    'replace-with-batch-label',
  );
  assert.deepEqual(
    (manifest.thresholdProfiles as unknown[]).map((profile) => (
      assertObjectRecord(profile, 'threshold profile').label
    )),
    ['strict', 'relaxed-budget-and-step-limit', 'relaxed-single-mismatch'],
  );
  assert.deepEqual(JSON.parse(await readFile(manifestPath, 'utf8')), manifest);

  const index = runJsonCli([
    '.\\scripts\\agent-session-v3-pilot-corpus-batch-index-template.ts',
    '--out',
    indexPath,
    '--pretty',
  ]);
  assertIndexTemplateContract(index);
  assert.deepEqual(
    (index.batches as unknown[]).map((batch) => (
      assertObjectRecord(batch, 'index batch').sourceKind
    )),
    ['baseline', 'manual'],
  );
  assert.deepEqual(
    (index.batches as unknown[]).map((batch) => (
      assertObjectRecord(batch, 'index batch').manifestPath
    )),
    ['./replace-with-baseline-manifest.json', './replace-with-manual-manifest.json'],
  );
  assert.deepEqual(JSON.parse(await readFile(indexPath, 'utf8')), index);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot starter templates CLI JSON contract smoke ok');
