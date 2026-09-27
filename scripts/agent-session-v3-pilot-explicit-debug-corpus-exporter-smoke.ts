import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runAgentSessionV3PilotExternalSampleFixtureBatchLoader } from './agent-session-v3-pilot-external-sample-fixture-batch-loader.ts';
import { runAgentSessionV3PilotExternalSampleFixtureSetExporter } from './agent-session-v3-pilot-external-sample-fixture-set-exporter.ts';
import { runAgentSessionV3PilotExplicitDebugCorpusExporter } from './agent-session-v3-pilot-explicit-debug-corpus-exporter.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  exporterSource,
  fixtureSetExporterSource,
  sessionSource,
} = readProjectSources({
  exporterSource: 'scripts/agent-session-v3-pilot-explicit-debug-corpus-exporter.ts',
  fixtureSetExporterSource: 'scripts/agent-session-v3-pilot-external-sample-fixture-set-exporter.ts',
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
});

assert.match(
  exporterSource,
  /export async function runAgentSessionV3PilotExplicitDebugCorpusExporter/u,
  'explicit debug corpus exporter should expose a caller-owned runner.',
);
assert.doesNotMatch(
  `${exporterSource}\n${fixtureSetExporterSource}`,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'explicit debug corpus export path should not encode a fixed desktop tool chain.',
);
assert.doesNotMatch(
  sessionSource,
  /historyLines\.push\([^)]*v3PilotShadow|createAgentSessionV2ModelInput\([^)]*v3PilotShadow/isu,
  'v3 pilot shadow output should stay out of history and model input.',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-explicit-debug-corpus-'));
try {
  const corpusPath = path.join(tempDir, 'explicit-debug-corpus.json');
  const fixturePath = path.join(tempDir, 'explicit-debug-fixture-set.json');

  const corpusExport = await runAgentSessionV3PilotExplicitDebugCorpusExporter({
    includeJsonText: true,
    maxShadowDebugSamples: 3,
    outPath: corpusPath,
    prettyJson: true,
  });

  assert.equal(corpusExport.kind, 'agent-session-v3-pilot-explicit-debug-corpus-exporter');
  assert.equal(corpusExport.version, 1);
  assert.equal(corpusExport.corpusPath, corpusPath);
  assert.equal(corpusExport.scenarioCount, 6);
  assert.equal(corpusExport.diagnosticRun.status, 'collected');
  assert.equal(corpusExport.diagnosticRun.issueCount, 0);
  assert.equal(corpusExport.diagnosticRun.collection.corpus.counts.agreementSampleCount, 6);
  assert.equal(corpusExport.diagnosticRun.collection.corpus.counts.shadowDebugSampleCount, 6);
  assert.equal(corpusExport.diagnosticRun.collection.corpus.agreementReport?.counts.aligned, 5);
  assert.equal(corpusExport.diagnosticRun.collection.corpus.agreementReport?.counts.inconclusive, 1);
  assert.equal(corpusExport.diagnosticRun.collection.corpus.agreementReport?.counts.mismatch, 0);
  assert.ok(corpusExport.jsonText);
  assert.match(corpusExport.jsonText, /\n/u);
  assert.match(corpusExport.summaryText, /agreementSamples=6/u);

  const writtenCorpus = JSON.parse(await readFile(corpusPath, 'utf8'));
  assert.equal(writtenCorpus.kind, 'agent-session-v3-pilot-debug-sample-corpus');
  assert.equal(writtenCorpus.counts.agreementSampleCount, 6);
  assert.equal(writtenCorpus.counts.shadowDebugSampleCount, 6);
  assert.equal(writtenCorpus.shadowDebugSamples.length, 3);

  const fixtureExport = await runAgentSessionV3PilotExternalSampleFixtureSetExporter({
    corpusPaths: [corpusPath],
    includeJsonText: true,
    outPath: fixturePath,
    prettyJson: true,
  });

  assert.equal(fixtureExport.kind, 'agent-session-v3-pilot-external-sample-fixture-set-exporter');
  assert.equal(fixtureExport.result.status, 'exported');
  assert.equal(fixtureExport.result.batchCount, 1);
  assert.equal(fixtureExport.result.issueCount, 0);
  assert.ok(fixtureExport.jsonText);

  const loadedFixture = await runAgentSessionV3PilotExternalSampleFixtureBatchLoader({
    fixturePath,
    includeJsonText: true,
  });
  assert.equal(loadedFixture.kind, 'agent-session-v3-pilot-external-sample-fixture-batch-loader');
  assert.equal(loadedFixture.result.status, 'ready');
  assert.equal(loadedFixture.result.intakeCount, 1);
  assert.equal(loadedFixture.result.issueCount, 0);
  assert.ok(loadedFixture.jsonText);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot explicit debug corpus exporter smoke ok');
