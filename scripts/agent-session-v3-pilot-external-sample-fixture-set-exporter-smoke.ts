import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createAgentSessionV3PilotDebugSampleCorpusExport,
  createAgentSessionV3PilotExternalSampleFixtureBatch,
  createAgentSessionV3PilotExternalSampleFixtureSetExport,
  createAgentSessionV3PilotShadowAgreementReport,
  createAgentSessionV3PilotShadowAgreementReportExport,
  createAgentSessionV3PilotShadowDebugExport,
  runAgentSessionV3PilotShadowMode,
  stringifyAgentSessionV3PilotExternalSampleFixtureSet,
  type AgentSessionV3PilotShadowAgreement,
} from '../src/agent/legacy/index.ts';
import { runAgentSessionV3PilotExternalSampleFixtureBatchLoader } from './agent-session-v3-pilot-external-sample-fixture-batch-loader.ts';
import { runAgentSessionV3PilotExternalSampleFixtureSetExporter } from './agent-session-v3-pilot-external-sample-fixture-set-exporter.ts';
import { readProjectSources } from './smokeTestHarness.ts';

function createAgreement(
  options: Pick<AgentSessionV3PilotShadowAgreement, 'status' | 'v2Status'>,
): AgentSessionV3PilotShadowAgreement {
  return {
    expectations: [],
    observed: {
      lastEvent: null,
      phase: null,
      runnerStatus: null,
      shadowStatus: null,
      terminalStatus: null,
      transitionCount: null,
    },
    reason: `${options.status} fixture set export sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { helperSource, exporterSource, indexSource } = readProjectSources({
  helperSource: 'src/agent/agentSessionV3PilotExternalSampleFixtureSetExport.ts',
  exporterSource: 'scripts/agent-session-v3-pilot-external-sample-fixture-set-exporter.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(
  helperSource,
  /export function createAgentSessionV3PilotExternalSampleFixtureSetExport/u,
  'v3 pilot fixture set export helper should live in its own module.',
);
assert.match(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotExternalSampleFixtureSetExport'/u,
  'v3 pilot fixture set export helper should be exported through the agent barrel.',
);
assert.doesNotMatch(
  helperSource,
  /AgentSessionV2|runAgentSessionV2|executeAgentSessionV2|buildAgentPermissionRoute|execute_desktop|observe_windows_and_apps|locate_screen_elements|toolExecutor/u,
  'v3 pilot fixture set export helper should not know v2 runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  helperSource,
  /from 'node:fs'|writeFile|appendFile|createWriteStream|mkdir|readFile/u,
  'v3 pilot fixture set export helper should not read or write files.',
);
assert.doesNotMatch(
  `${helperSource}\n${exporterSource}`,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'v3 pilot fixture set export should not encode a fixed tool chain.',
);

const agreementReport = createAgentSessionV3PilotShadowAgreementReportExport(
  createAgentSessionV3PilotShadowAgreementReport([
    createAgreement({
      status: 'aligned',
      v2Status: 'completed',
    }),
    createAgreement({
      status: 'aligned',
      v2Status: 'needs-user',
    }),
  ]),
  {
    includeSamples: true,
  },
);

const shadowResult = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin fixture set export sample',
      type: 'start',
    },
    {
      reason: 'terminal answer',
      route: 'terminal',
      terminalStatus: 'completed',
      type: 'model-decision-accepted',
    },
  ],
});
const shadowExport = createAgentSessionV3PilotShadowDebugExport(shadowResult);
const corpusExport = createAgentSessionV3PilotDebugSampleCorpusExport({
  agreementReport,
  shadowDebugSamples: [{
    label: 'completed-shadow',
    shadow: shadowExport,
  }],
});

const directExport = createAgentSessionV3PilotExternalSampleFixtureSetExport({
  sources: [
    {
      corpus: corpusExport,
      label: 'direct-corpus',
    },
    null,
    {
      corpus: {
        kind: 'not-a-corpus',
      } as never,
      label: 'bad-corpus',
    },
  ],
  thresholds: {
    minAgreementSamples: 1,
    minShadowSamples: 1,
  },
});

assert.equal(directExport.kind, 'agent-session-v3-pilot-external-sample-fixture-set-export');
assert.equal(directExport.version, 1);
assert.equal(directExport.sourceCount, 3);
assert.equal(directExport.batchCount, 1);
assert.equal(directExport.issueCount, 1);
assert.equal(directExport.status, 'partial');
assert.equal(directExport.issues[0]?.label, 'bad-corpus');
assert.equal(directExport.fixtureSet.batches?.[0]?.label, 'direct-corpus');
assert.equal(directExport.fixtureSet.batches?.[0]?.agreementReports?.[0]?.report?.sampleCount, 2);
assert.equal(directExport.fixtureSet.batches?.[0]?.shadowDebugSamples?.[0]?.label, 'completed-shadow');
assert.match(directExport.summaryText, /status=partial/u);

const readiness = createAgentSessionV3PilotExternalSampleFixtureBatch(directExport.fixtureSet);
assert.equal(readiness.status, 'ready');
assert.equal(readiness.intakeCount, 1);
assert.equal(readiness.issueCount, 0);

const compactJson = stringifyAgentSessionV3PilotExternalSampleFixtureSet(directExport.fixtureSet);
const prettyJson = stringifyAgentSessionV3PilotExternalSampleFixtureSet(directExport.fixtureSet, {
  pretty: true,
});
assert.doesNotMatch(compactJson, /\n/u);
assert.match(prettyJson, /\n/u);
assert.equal(JSON.parse(compactJson).batches.length, 1);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-fixture-set-exporter-'));
try {
  const corpusPath = path.join(tempDir, 'completed-corpus.json');
  const invalidCorpusPath = path.join(tempDir, 'invalid-corpus.json');
  const fixturePath = path.join(tempDir, 'fixture-set.json');
  await writeFile(corpusPath, JSON.stringify(corpusExport), 'utf8');
  await writeFile(invalidCorpusPath, JSON.stringify({ kind: 'not-a-corpus', version: 1 }), 'utf8');

  const exported = await runAgentSessionV3PilotExternalSampleFixtureSetExporter({
    corpusPaths: [corpusPath, invalidCorpusPath],
    includeJsonText: true,
    outPath: fixturePath,
    prettyJson: true,
  });

  assert.equal(exported.kind, 'agent-session-v3-pilot-external-sample-fixture-set-exporter');
  assert.equal(exported.version, 1);
  assert.equal(exported.fixturePath, fixturePath);
  assert.equal(exported.corpusPaths.length, 2);
  assert.equal(exported.result.status, 'partial');
  assert.equal(exported.result.batchCount, 1);
  assert.equal(exported.result.issueCount, 1);
  assert.ok(exported.jsonText);
  assert.match(exported.jsonText, /\n/u);
  assert.match(exported.summaryText, /sources=2/u);

  const writtenFixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  assert.equal(writtenFixture.batches.length, 1);
  assert.equal(writtenFixture.batches[0].label, path.basename(corpusPath));

  const loaded = await runAgentSessionV3PilotExternalSampleFixtureBatchLoader({
    fixturePath,
    includeJsonText: true,
  });
  assert.equal(loaded.kind, 'agent-session-v3-pilot-external-sample-fixture-batch-loader');
  assert.equal(loaded.result.status, 'ready');
  assert.equal(loaded.result.intakeCount, 1);
  assert.ok(loaded.jsonText);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

const emptyExport = createAgentSessionV3PilotExternalSampleFixtureSetExport();
assert.equal(emptyExport.status, 'empty');
assert.equal(emptyExport.sourceCount, 0);
assert.equal(emptyExport.batchCount, 0);
assert.deepEqual(emptyExport.fixtureSet.batches, []);

console.log('agent session v3 pilot external sample fixture set exporter smoke ok');
