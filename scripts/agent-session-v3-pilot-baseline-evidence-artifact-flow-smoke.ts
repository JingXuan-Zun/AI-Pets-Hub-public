import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runAgentSessionV3PilotBaselineEvidenceArtifactFlow } from './agent-session-v3-pilot-baseline-evidence-artifact-flow.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { artifactFlowSource } = readProjectSources({
  artifactFlowSource: 'scripts/agent-session-v3-pilot-baseline-evidence-artifact-flow.ts',
});

assert.match(
  artifactFlowSource,
  /export async function runAgentSessionV3PilotBaselineEvidenceArtifactFlow/u,
  'baseline evidence artifact flow should expose a caller-owned runner.',
);
assert.doesNotMatch(
  artifactFlowSource,
  /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'baseline evidence artifact flow should compose evidence scripts without knowing runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  artifactFlowSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'baseline evidence artifact flow should not encode a fixed desktop tool chain.',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-baseline-evidence-artifact-flow-'));
try {
  const result = await runAgentSessionV3PilotBaselineEvidenceArtifactFlow({
    includeJsonText: true,
    maxShadowDebugSamples: 3,
    outDir: tempDir,
    prettyJson: true,
  });

  assert.equal(result.kind, 'agent-session-v3-pilot-baseline-evidence-artifact-flow');
  assert.equal(result.version, 1);
  assert.equal(result.corpusPath, path.join(tempDir, 'explicit-debug-corpus.json'));
  assert.equal(result.manifestPath, path.join(tempDir, 'explicit-debug-corpus-manifest.json'));
  assert.equal(result.indexPath, path.join(tempDir, 'corpus-batch-index.json'));
  assert.equal(result.baselineReport.scenarioCount, 6);
  assert.equal(result.baselineReport.status, 'ready');
  assert.equal(result.indexReport.manifestCount, 1);
  assert.equal(result.indexReport.entries.length, 1);
  assert.equal(result.indexReport.entries[0]?.sourceKind, 'baseline');
  assert.equal(result.indexReport.entries[0]?.status, 'ready');
  assert.equal(result.indexReport.entries[0]?.label, 'explicit-debug-baseline');
  assert.equal(result.indexReport.multiReport.statusCounts.ready, 1);
  assert.equal(result.indexReport.multiReport.statusCounts.notReady, 0);
  assert.match(result.summaryText, /status=ready/u);
  assert.match(result.summaryText, /scenarios=6/u);
  assert.match(result.reportText, /AgentSessionV3PilotBaselineEvidenceArtifactFlow/u);
  assert.match(result.reportText, /AgentSessionV3PilotCorpusBatchIndexReport/u);
  assert.match(result.reportText, /sourceKind=baseline manifests=1 ready=1/u);
  assert.ok(result.jsonText);
  assert.match(result.jsonText, /agent-session-v3-pilot-baseline-evidence-artifact-flow/u);

  const corpus = JSON.parse(await readFile(result.corpusPath, 'utf8'));
  assert.equal(corpus.kind, 'agent-session-v3-pilot-debug-sample-corpus');
  assert.equal(corpus.counts.agreementSampleCount, 6);

  const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8'));
  assert.equal(manifest.sources.length, 1);
  assert.equal(manifest.sources[0]?.label, 'explicit-debug-v2-scenarios');
  assert.equal(manifest.sources[0]?.path, 'explicit-debug-corpus.json');
  assert.equal(manifest.thresholdProfiles.length, 3);

  const index = JSON.parse(await readFile(result.indexPath, 'utf8'));
  assert.equal(index.version, 1);
  assert.equal(index.batches.length, 1);
  assert.equal(index.batches[0]?.label, 'explicit-debug-baseline');
  assert.equal(index.batches[0]?.manifestPath, 'explicit-debug-corpus-manifest.json');
  assert.equal(index.batches[0]?.sourceKind, 'baseline');

  assert.deepEqual(
    (await readdir(tempDir)).sort(),
    [
      'corpus-batch-index.json',
      'explicit-debug-corpus-manifest.json',
      'explicit-debug-corpus.json',
    ],
  );
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot baseline evidence artifact flow smoke ok');
