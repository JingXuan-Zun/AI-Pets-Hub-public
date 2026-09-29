import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runAgentSessionV3PilotExternalSampleCorpusManifestTemplate } from './agent-session-v3-pilot-external-sample-corpus-manifest-template.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { manifestTemplateSource } = readProjectSources({
  manifestTemplateSource: 'scripts/agent-session-v3-pilot-external-sample-corpus-manifest-template.ts',
});

assert.match(
  manifestTemplateSource,
  /export async function runAgentSessionV3PilotExternalSampleCorpusManifestTemplate/u,
  'v3 pilot external sample corpus manifest template should expose a caller-owned runner.',
);
assert.doesNotMatch(
  manifestTemplateSource,
  /runAgentSessionV2|executeAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'v3 pilot external sample corpus manifest template should not know runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  manifestTemplateSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'v3 pilot external sample corpus manifest template should not encode a fixed desktop tool chain.',
);

const compactTemplate = await runAgentSessionV3PilotExternalSampleCorpusManifestTemplate();

assert.equal(
  compactTemplate.kind,
  'agent-session-v3-pilot-external-sample-corpus-manifest-template',
);
assert.equal(compactTemplate.version, 1);
assert.equal(compactTemplate.manifestPath, null);
assert.equal(compactTemplate.jsonText, null);
assert.equal(compactTemplate.manifest.sources?.length, 1);
assert.equal(compactTemplate.manifest.sources?.[0]?.label, 'replace-with-batch-label');
assert.equal(compactTemplate.manifest.sources?.[0]?.path, './replace-with-debug-corpus.json');
assert.equal(compactTemplate.manifest.thresholdProfiles?.length, 3);
assert.deepEqual(
  compactTemplate.manifest.thresholdProfiles?.map((profile) => profile.label),
  ['strict', 'relaxed-budget-and-step-limit', 'relaxed-single-mismatch'],
);
assert.equal(compactTemplate.manifest.thresholds?.maxMismatches, 0);
assert.equal(compactTemplate.manifest.thresholds?.minAgreementSamples, 1);
assert.equal(compactTemplate.manifest.thresholds?.minShadowSamples, 1);
assert.equal(compactTemplate.manifest.useBatchThresholdOverrides, false);
assert.match(compactTemplate.summaryText, /sources=1/u);
assert.match(compactTemplate.summaryText, /profiles=3/u);

const jsonTemplate = await runAgentSessionV3PilotExternalSampleCorpusManifestTemplate({
  includeJsonText: true,
  prettyJson: true,
});

assert.ok(jsonTemplate.jsonText);
assert.match(jsonTemplate.jsonText, /\n/u);
assert.deepEqual(JSON.parse(jsonTemplate.jsonText), jsonTemplate.manifest);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-corpus-manifest-template-'));
try {
  const manifestPath = path.join(tempDir, 'corpus-manifest-template.json');
  const writtenTemplate = await runAgentSessionV3PilotExternalSampleCorpusManifestTemplate({
    outPath: manifestPath,
    prettyJson: true,
  });

  assert.equal(writtenTemplate.manifestPath, manifestPath);
  assert.equal(writtenTemplate.jsonText, null);
  assert.match(writtenTemplate.summaryText, /profiles=3/u);

  const writtenManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.deepEqual(writtenManifest, writtenTemplate.manifest);
  assert.equal(writtenManifest.sources.length, 1);
  assert.equal(writtenManifest.thresholdProfiles.length, 3);
  assert.equal(
    writtenManifest.thresholdProfiles[2]?.thresholds?.maxMismatches,
    1,
  );
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot external sample corpus manifest template smoke ok');
