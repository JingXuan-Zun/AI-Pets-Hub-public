import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runAgentSessionV3PilotBaselineCorpusManifestReport } from './agent-session-v3-pilot-baseline-corpus-manifest-report.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { baselineReportSource } = readProjectSources({
  baselineReportSource: 'scripts/agent-session-v3-pilot-baseline-corpus-manifest-report.ts',
});

assert.match(
  baselineReportSource,
  /export async function runAgentSessionV3PilotBaselineCorpusManifestReport/u,
  'baseline corpus manifest report should expose a caller-owned runner.',
);
assert.doesNotMatch(
  baselineReportSource,
  /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'baseline corpus manifest report should compose caller-owned evidence scripts without knowing runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  baselineReportSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'baseline corpus manifest report should not encode a fixed desktop tool chain.',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-baseline-corpus-manifest-report-'));
try {
  const result = await runAgentSessionV3PilotBaselineCorpusManifestReport({
    includeJsonText: true,
    maxShadowDebugSamples: 3,
    outDir: tempDir,
    prettyJson: true,
  });

  assert.equal(result.kind, 'agent-session-v3-pilot-baseline-corpus-manifest-report');
  assert.equal(result.version, 1);
  assert.equal(result.corpusPath, path.join(tempDir, 'explicit-debug-corpus.json'));
  assert.equal(result.manifestPath, path.join(tempDir, 'explicit-debug-corpus-manifest.json'));
  assert.equal(result.corpusExport.corpusPath, result.corpusPath);
  assert.equal(result.scenarioCount, 6);
  assert.equal(result.corpusExport.scenarioCount, 6);
  assert.equal(result.corpusExport.diagnosticRun.status, 'collected');
  assert.equal(result.manifestLoader.fixturePath, null);
  assert.equal(result.manifestLoader.sourceCount, 1);
  assert.equal(result.manifestLoader.status, 'ready');
  assert.equal(result.manifestLoader.profileComparison.profileCount, 3);
  assert.equal(result.manifestLoader.profileComparison.entries[0]?.status, 'ready');
  assert.equal(result.status, 'ready');
  assert.match(result.summaryText, /status=ready/u);
  assert.match(result.summaryText, /scenarios=6/u);
  assert.ok(result.reportText);
  assert.match(result.reportText, /AgentSessionV3PilotExternalSampleCorpusManifestReport/u);
  assert.match(result.reportText, /sources=1/u);
  assert.match(result.reportText, /profiles:/u);
  assert.ok(result.jsonText);
  assert.match(result.jsonText, /agent-session-v3-pilot-baseline-corpus-manifest-report/u);

  const corpus = JSON.parse(await readFile(result.corpusPath, 'utf8'));
  assert.equal(corpus.kind, 'agent-session-v3-pilot-debug-sample-corpus');
  assert.equal(corpus.counts.agreementSampleCount, 6);

  const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8'));
  assert.equal(manifest.sources.length, 1);
  assert.equal(manifest.sources[0]?.label, 'explicit-debug-v2-scenarios');
  assert.equal(manifest.sources[0]?.path, 'explicit-debug-corpus.json');
  assert.equal(manifest.thresholdProfiles.length, 3);

  assert.deepEqual(
    (await readdir(tempDir)).sort(),
    [
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

console.log('agent session v3 pilot baseline corpus manifest report smoke ok');
