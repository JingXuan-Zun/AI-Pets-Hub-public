import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runAgentSessionV3PilotCorpusBatchIndexTemplate } from './agent-session-v3-pilot-corpus-batch-index-template.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { indexTemplateSource } = readProjectSources({
  indexTemplateSource: 'scripts/agent-session-v3-pilot-corpus-batch-index-template.ts',
});

assert.match(
  indexTemplateSource,
  /export async function runAgentSessionV3PilotCorpusBatchIndexTemplate/u,
  'corpus batch index template should expose a caller-owned runner.',
);
assert.doesNotMatch(
  indexTemplateSource,
  /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'corpus batch index template should not know runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  indexTemplateSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'corpus batch index template should not encode a fixed desktop tool chain.',
);

const compactTemplate = await runAgentSessionV3PilotCorpusBatchIndexTemplate();

assert.equal(compactTemplate.kind, 'agent-session-v3-pilot-corpus-batch-index-template');
assert.equal(compactTemplate.version, 1);
assert.equal(compactTemplate.indexPath, null);
assert.equal(compactTemplate.jsonText, null);
assert.equal(compactTemplate.index.version, 1);
assert.equal(compactTemplate.index.batches?.length, 2);
assert.deepEqual(
  compactTemplate.index.batches?.map((batch) => batch.sourceKind),
  ['baseline', 'manual'],
);
assert.deepEqual(
  compactTemplate.index.batches?.map((batch) => batch.manifestPath),
  ['./replace-with-baseline-manifest.json', './replace-with-manual-manifest.json'],
);
assert.match(compactTemplate.summaryText, /batches=2/u);

const jsonTemplate = await runAgentSessionV3PilotCorpusBatchIndexTemplate({
  includeJsonText: true,
  prettyJson: true,
});

assert.ok(jsonTemplate.jsonText);
assert.match(jsonTemplate.jsonText, /\n/u);
assert.deepEqual(JSON.parse(jsonTemplate.jsonText), jsonTemplate.index);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-corpus-batch-index-template-'));
try {
  const indexPath = path.join(tempDir, 'corpus-batch-index-template.json');
  const writtenTemplate = await runAgentSessionV3PilotCorpusBatchIndexTemplate({
    outPath: indexPath,
    prettyJson: true,
  });

  assert.equal(writtenTemplate.indexPath, indexPath);
  assert.equal(writtenTemplate.jsonText, null);

  const writtenIndex = JSON.parse(await readFile(indexPath, 'utf8'));
  assert.deepEqual(writtenIndex, writtenTemplate.index);
  assert.equal(writtenIndex.batches.length, 2);
  assert.equal(writtenIndex.batches[0]?.label, 'replace-with-baseline-label');
  assert.equal(writtenIndex.batches[1]?.sourceKind, 'manual');
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot corpus batch index template smoke ok');
