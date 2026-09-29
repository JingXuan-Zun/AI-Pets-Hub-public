import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createAgentSessionV3PilotDebugSampleCorpusExport,
  createAgentSessionV3PilotShadowAgreementReport,
  createAgentSessionV3PilotShadowAgreementReportExport,
  createAgentSessionV3PilotShadowDebugExport,
  runAgentSessionV3PilotShadowMode,
  type AgentSessionV3PilotShadowAgreement,
} from '../src/agent/legacy/index.ts';
import {
  runAgentSessionV3PilotExternalSampleCorpusManifestLoader,
  type AgentSessionV3PilotExternalSampleCorpusManifest,
} from './agent-session-v3-pilot-external-sample-corpus-manifest-loader.ts';
import { runAgentSessionV3PilotExternalSampleCorpusManifestTemplate } from './agent-session-v3-pilot-external-sample-corpus-manifest-template.ts';

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
    reason: `${options.status} corpus manifest dry-run sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const shadowResult = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin corpus manifest dry-run sample',
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

const readyCorpus = createAgentSessionV3PilotDebugSampleCorpusExport({
  agreementReport: createAgentSessionV3PilotShadowAgreementReportExport(
    createAgentSessionV3PilotShadowAgreementReport([
      createAgreement({
        status: 'aligned',
        v2Status: 'completed',
      }),
    ]),
    {
      includeSamples: true,
    },
  ),
  shadowDebugSamples: [{
    label: 'dry-run-ready-shadow',
    shadow: shadowExport,
  }],
});

const mismatchCorpus = createAgentSessionV3PilotDebugSampleCorpusExport({
  agreementReport: createAgentSessionV3PilotShadowAgreementReportExport(
    createAgentSessionV3PilotShadowAgreementReport([
      createAgreement({
        status: 'mismatch',
        v2Status: 'failed',
      }),
    ]),
    {
      includeSamples: true,
    },
  ),
  shadowDebugSamples: [{
    label: 'dry-run-mismatch-shadow',
    shadow: shadowExport,
  }],
});

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-corpus-manifest-dry-run-'));
try {
  const manifestPath = path.join(tempDir, 'corpus-manifest.json');
  const readyCorpusPath = path.join(tempDir, 'ready-corpus.json');
  const mismatchCorpusPath = path.join(tempDir, 'mismatch-corpus.json');

  const template = await runAgentSessionV3PilotExternalSampleCorpusManifestTemplate({
    outPath: manifestPath,
    prettyJson: true,
  });
  assert.equal(template.manifestPath, manifestPath);
  assert.equal(template.manifest.sources?.[0]?.label, 'replace-with-batch-label');
  assert.match(await readFile(manifestPath, 'utf8'), /replace-with-debug-corpus\.json/u);

  await writeFile(readyCorpusPath, JSON.stringify(readyCorpus), 'utf8');
  await writeFile(mismatchCorpusPath, JSON.stringify(mismatchCorpus), 'utf8');

  const manifest: AgentSessionV3PilotExternalSampleCorpusManifest = {
    ...template.manifest,
    sources: [
      {
        label: 'dry-run-ready-batch',
        path: path.basename(readyCorpusPath),
      },
      {
        label: 'dry-run-mismatch-batch',
        path: path.basename(mismatchCorpusPath),
      },
    ],
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  const loaded = await runAgentSessionV3PilotExternalSampleCorpusManifestLoader({
    includeJsonText: true,
    includeReportText: true,
    manifestPath,
    prettyJson: true,
  });

  assert.equal(loaded.fixturePath, null);
  assert.equal(loaded.sourceCount, 2);
  assert.equal(loaded.fixtureExport.batchCount, 2);
  assert.equal(loaded.status, 'mixed');
  assert.equal(loaded.fixtureBatch.calibration.counts.ready, 1);
  assert.equal(loaded.fixtureBatch.calibration.counts.notReady, 1);
  assert.equal(loaded.diagnostics.status, 'has-failures');
  assert.equal(loaded.profileComparison.profileCount, 3);
  assert.deepEqual(
    loaded.profileComparison.entries.map((entry) => `${entry.label}:${entry.status}`),
    [
      'strict:mixed',
      'relaxed-budget-and-step-limit:mixed',
      'relaxed-single-mismatch:ready',
    ],
  );
  assert.ok(loaded.reportText);
  assert.match(loaded.reportText, /AgentSessionV3PilotExternalSampleCorpusManifestReport/u);
  assert.match(loaded.reportText, /sources=2/u);
  assert.match(loaded.reportText, /batches=2/u);
  assert.match(loaded.reportText, /failedCheck=max-mismatches/u);
  assert.match(loaded.reportText, /profile=relaxed-single-mismatch status=ready/u);
  assert.ok(loaded.jsonText);
  assert.match(loaded.jsonText, /AgentSessionV3PilotExternalSampleCorpusManifestReport/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot external sample corpus manifest dry-run smoke ok');
