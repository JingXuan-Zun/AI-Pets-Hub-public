import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
import { runAgentSessionV3PilotBaselineCorpusManifestReport } from './agent-session-v3-pilot-baseline-corpus-manifest-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { runAgentSessionV3PilotRealCorpusBatchPathHealthReport } from './agent-session-v3-pilot-real-corpus-batch-path-health-report.ts';
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
    reason: `${options.status} real corpus path health sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { pathHealthSource } = readProjectSources({
  pathHealthSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-path-health-report.ts',
});

assert.match(
  pathHealthSource,
  /export async function runAgentSessionV3PilotRealCorpusBatchPathHealthReport/u,
  'real corpus batch path-health report should expose a caller-owned runner.',
);
assert.doesNotMatch(
  pathHealthSource,
  /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'real corpus batch path-health report should not know runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  pathHealthSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'real corpus batch path-health report should not encode a fixed desktop tool chain.',
);

const missingTempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-path-health-missing-'));
try {
  const missingReport = await runAgentSessionV3PilotRealCorpusBatchPathHealthReport({
    includeJsonText: true,
    intakeDir: missingTempDir,
    prettyJson: true,
  });

  assert.equal(missingReport.kind, 'agent-session-v3-pilot-real-corpus-batch-path-health-report');
  assert.equal(missingReport.version, 1);
  assert.equal(missingReport.status, 'missing');
  assert.equal(missingReport.issueCount, 2);
  assert.equal(missingReport.manifestSourceCount, 0);
  assert.equal(missingReport.indexManifestCount, 0);
  assert.deepEqual(
    missingReport.issues.map((issue) => `${issue.scope}:${issue.status}:${issue.label}`),
    ['required:missing:real-corpus-manifest', 'required:missing:corpus-batch-index'],
  );
  assert.match(missingReport.summaryText, /status=missing/u);
  assert.match(missingReport.reportText, /pathHealthIssues:/u);
  assert.ok(missingReport.jsonText);
} finally {
  await rm(missingTempDir, {
    force: true,
    recursive: true,
  });
}

const shadowResult = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin real corpus path health sample',
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

function createCorpus(status: AgentSessionV3PilotShadowAgreement['status']) {
  return createAgentSessionV3PilotDebugSampleCorpusExport({
    agreementReport: createAgentSessionV3PilotShadowAgreementReportExport(
      createAgentSessionV3PilotShadowAgreementReport([
        createAgreement({
          status,
          v2Status: status === 'aligned' ? 'completed' : 'failed',
        }),
      ]),
      {
        includeSamples: true,
      },
    ),
    shadowDebugSamples: [{
      label: `${status}-shadow`,
      shadow: shadowExport,
    }],
  });
}

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-path-health-'));
try {
  const intakeTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: tempDir,
    prettyJson: true,
  });

  const templateReport = await runAgentSessionV3PilotRealCorpusBatchPathHealthReport({
    includeJsonText: true,
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(templateReport.status, 'issues');
  assert.equal(templateReport.manifestSourceCount, 1);
  assert.equal(templateReport.indexManifestCount, 2);
  assert.ok(templateReport.issues.some((issue) => issue.scope === 'manifest-source' && issue.status === 'missing'));
  assert.ok(templateReport.issues.some((issue) => issue.scope === 'index-manifest' && issue.status === 'missing'));
  assert.match(templateReport.summaryText, /status=issues/u);
  assert.match(templateReport.reportText, /pathHealthIssues:/u);
  assert.ok(templateReport.jsonText);

  await runAgentSessionV3PilotBaselineCorpusManifestReport({
    maxShadowDebugSamples: 3,
    outDir: path.join(tempDir, 'baseline'),
    prettyJson: true,
  });

  const corpusDir = path.join(tempDir, 'corpora');
  await mkdir(corpusDir, {
    recursive: true,
  });
  await writeFile(
    path.join(corpusDir, 'ready-corpus.json'),
    JSON.stringify(createCorpus('aligned')),
    'utf8',
  );

  assert.ok(intakeTemplate.manifestPath);
  await writeFile(
    intakeTemplate.manifestPath,
    JSON.stringify({
      ...intakeTemplate.manifest,
      sources: [
        {
          label: 'ready-real-batch',
          path: './corpora/ready-corpus.json',
        },
      ],
    }, null, 2),
    'utf8',
  );

  const healthyReport = await runAgentSessionV3PilotRealCorpusBatchPathHealthReport({
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(healthyReport.status, 'healthy');
  assert.equal(healthyReport.issueCount, 0);
  assert.equal(healthyReport.manifestSourceCount, 1);
  assert.equal(healthyReport.indexManifestCount, 2);
  assert.match(healthyReport.reportText, /pathHealthIssues: none/u);

  await writeFile(path.join(corpusDir, 'invalid-corpus.json'), '{bad json', 'utf8');
  await writeFile(
    intakeTemplate.manifestPath,
    JSON.stringify({
      ...intakeTemplate.manifest,
      sources: [
        {
          label: 'invalid-real-batch',
          path: './corpora/invalid-corpus.json',
        },
      ],
    }, null, 2),
    'utf8',
  );

  const invalidJsonReport = await runAgentSessionV3PilotRealCorpusBatchPathHealthReport({
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(invalidJsonReport.status, 'issues');
  assert.ok(invalidJsonReport.issues.some((issue) => issue.scope === 'manifest-source' && issue.status === 'invalid-json'));
  assert.match(invalidJsonReport.reportText, /status=invalid-json/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch path health report smoke ok');
