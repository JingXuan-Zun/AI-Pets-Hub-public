import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
import {
  assertNestedKind,
  assertNumberRecordKeys,
  assertObjectRecord,
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain,
  parseTrailingJsonObject,
} from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const allowedStatuses = new Set([
  'blocked',
  'ready-for-manual-review',
  'review-needed',
]);

function runOperatorChecklistCli(intakeDir: string) {
  const cliArgs = [
    'tsx',
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-operator-checklist-report.ts',
    '--dir',
    intakeDir,
    '--pretty',
  ];

  return process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/c', 'npx.cmd', ...cliArgs], {
      cwd: projectRoot,
      encoding: 'utf8',
    })
    : spawnSync('npx', cliArgs, {
      cwd: projectRoot,
      encoding: 'utf8',
    });
}

function runOperatorChecklistJson(intakeDir: string) {
  const result = runOperatorChecklistCli(intakeDir);

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

function assertChecklistItemShape(item: unknown) {
  const itemRecord = assertObjectRecord(item, 'operator checklist item');
  const keys = Object.keys(itemRecord).sort();

  assert.deepEqual(keys, ['action', 'detail', 'id', 'severity', 'source', 'title']);
  assertStringValue(itemRecord.action, 'checklist item action');
  assertStringValue(itemRecord.detail, 'checklist item detail');
  assertStringValue(itemRecord.id, 'checklist item id');
  assertStringValue(itemRecord.title, 'checklist item title');
  assert.match(String(itemRecord.severity), /^(blocker|info|review)$/u);
  assert.match(String(itemRecord.source), /^(evidence-summary|metadata-quality|runbook|validator)$/u);
}

function checklistIds(report: Record<string, unknown>) {
  assert.ok(Array.isArray(report.checklistItems), 'checklistItems should be an array.');

  return new Set(
    report.checklistItems.map((item) => String((item as Record<string, unknown>).id)),
  );
}

function assertOperatorChecklistContract(report: Record<string, unknown>) {
  assert.equal(report.kind, 'agent-session-v3-pilot-real-corpus-batch-operator-checklist-report');
  assert.equal(report.version, 1);
  assertStringValue(report.status, 'status');
  assert.ok(allowedStatuses.has(String(report.status)));
  assertStringValue(report.intakeDir, 'intakeDir');
  assertStringValue(report.summaryText, 'summaryText');
  assertStringValue(report.reportText, 'reportText');
  assertNumberRecordKeys(
    report,
    [
      'blockerCount',
      'infoCount',
      'reviewCount',
    ],
    'operator checklist report',
  );
  assert.ok(Array.isArray(report.checklistItems), 'checklistItems should be an array.');
  for (const item of report.checklistItems) {
    assertChecklistItemShape(item);
  }
  assertNestedKind(
    report,
    'evidenceSummary',
    'agent-session-v3-pilot-real-corpus-batch-evidence-summary',
  );
  assertNestedKind(
    report.evidenceSummary as Record<string, unknown>,
    'validator',
    'agent-session-v3-pilot-real-corpus-batch-intake-validator',
  );
  assertNestedKind(
    report.evidenceSummary as Record<string, unknown>,
    'metadataQuality',
    'agent-session-v3-pilot-real-corpus-batch-metadata-quality-report',
  );
}

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
    reason: `${options.status} real corpus operator checklist JSON contract sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

async function writeFilledSampleNote(notePath: string) {
  const noteText = await readFile(notePath, 'utf8');

  await writeFile(
    notePath,
    noteText
      .replaceAll('replace-with-real-batch-label', 'ready-real-batch')
      .replaceAll('replace-with-export-date', '2026-06-23')
      .replaceAll('replace-with-machine-app-mode-or-branch', 'local-dev-agent-session-v2-shadow')
      .replaceAll('replace-with-scenario-family', 'terminal-state-alignment')
      .replaceAll('replace-with-export-command-or-manual-source', 'manual debug corpus export')
      .replaceAll('replace-with-sample-source-real-exported-rehearsal-or-unknown', 'real-exported')
      .replaceAll('replace-with-sample-source-status', 'real-exported-evidence')
      .replaceAll('replace-with-corpus-json-paths', './corpora/ready-corpus.json')
      .replaceAll('replace-with-sample-count', '12')
      .replaceAll('replace-with-intake-dir', 'tmp-agent-v3-real-corpus')
      .replaceAll('replace-with-ready-mixed-not-ready-empty-or-missing', 'ready')
      .replaceAll('replace-with-manifestSources', '1')
      .replaceAll('replace-with-indexManifests', '2')
      .replaceAll('ready=replace mixed=replace notReady=replace empty=replace', 'ready=2 mixed=0 notReady=0 empty=0')
      .replaceAll('yes/no and why', 'no, this batch only confirms local baseline alignment')
      .replaceAll('replace-with-p0-intake-dir', 'tmp-agent-v3-real-corpus')
      .replaceAll('replace-with-real-production-like-sample-signal', 'ready-for-manual-review')
      .replaceAll('replace-with-real-exported-corpus-signal', 'ready-for-manual-review')
      .replaceAll('replace-with-short-assessment', 'sufficient for manual baseline comparison')
      .replaceAll('replace-with-scope', 'v3 mirror alignment for this local sample set')
      .replaceAll('replace-with-limitations', 'no production runtime authority')
      .replaceAll('replace-with-next-samples', 'broader production-like traces')
      .replaceAll('keep-current / compare-profiles / propose-manual-review', 'keep-current'),
    'utf8',
  );
}

const { reportSource } = readProjectSources({
  reportSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-operator-checklist-report.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  reportSource,
  'agent-session-v3-pilot-real-corpus-batch-operator-checklist-report.ts CLI JSON contract',
);

const missingTempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-operator-checklist-json-contract-missing-'));
try {
  const missingChecklist = runOperatorChecklistJson(missingTempDir);

  assertOperatorChecklistContract(missingChecklist);
  assert.equal(missingChecklist.status, 'blocked');
  assert.equal((missingChecklist.evidenceSummary as Record<string, unknown>).status, 'blocked');
  assert.match(String(missingChecklist.summaryText), /phaseCoverage=unavailable/u);
  assert.match(String(missingChecklist.reportText), /phaseCoverageCalibration status=unavailable/u);
  assert.ok(Number(missingChecklist.blockerCount) >= 4);
  assert.ok(Number(missingChecklist.reviewCount) >= 2);
  assert.ok(Number(missingChecklist.infoCount) >= 2);
  const ids = checklistIds(missingChecklist);
  assert.ok(ids.has('gap-missing-required-files'));
  assert.ok(ids.has('gap-schema-issues'));
  assert.ok(ids.has('gap-path-issues'));
  assert.ok(ids.has('gap-consistency-issues'));
  assert.ok(ids.has('gap-note-missing'));
  assert.ok(ids.has('metadata-quality-issue-samples'));
  assert.ok(ids.has('evidence-summary-status'));
  assert.ok(ids.has('runbook-manual-review'));
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
      reason: 'begin real corpus operator checklist JSON contract sample',
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

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-operator-checklist-json-contract-'));
try {
  const intakeTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: tempDir,
    prettyJson: true,
  });
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
  await writeFile(
    path.join(corpusDir, 'mismatch-corpus.json'),
    JSON.stringify(createCorpus('mismatch')),
    'utf8',
  );

  assert.ok(intakeTemplate.indexPath);
  assert.ok(intakeTemplate.manifestPath);
  assert.ok(intakeTemplate.notePath);
  await writeFile(
    intakeTemplate.manifestPath,
    JSON.stringify({
      ...intakeTemplate.manifest,
      sources: [
        {
          label: 'ready-real-batch',
          path: './corpora/ready-corpus.json',
        },
        {
          label: 'mismatch-real-batch',
          path: './corpora/mismatch-corpus.json',
        },
      ],
    }, null, 2),
    'utf8',
  );

  const reviewChecklist = runOperatorChecklistJson(tempDir);

  assertOperatorChecklistContract(reviewChecklist);
  assert.equal(reviewChecklist.status, 'review-needed');
  assert.equal((reviewChecklist.evidenceSummary as Record<string, unknown>).status, 'manual-review-needed');
  assert.match(String(reviewChecklist.summaryText), /phaseCoverage=clean/u);
  assert.match(String(reviewChecklist.reportText), /phaseCoverageCalibration status=clean/u);
  assert.equal(reviewChecklist.blockerCount, 0);
  assert.ok(Number(reviewChecklist.reviewCount) >= 3);
  assert.ok(checklistIds(reviewChecklist).has('gap-index-mixed'));
  assert.ok(checklistIds(reviewChecklist).has('gap-note-incomplete'));
  assert.ok(checklistIds(reviewChecklist).has('gap-metadata-quality-review'));
  assert.ok(checklistIds(reviewChecklist).has('metadata-quality-issue-samples'));

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
  await writeFile(
    intakeTemplate.indexPath,
    JSON.stringify({
      ...intakeTemplate.index,
      batches: [
        {
          generatedAt: '2026-06-23T10:00:00.000Z',
          label: 'baseline-artifact-flow',
          manifestPath: './baseline/explicit-debug-corpus-manifest.json',
          notes: 'baseline bundle generated by the reviewed baseline evidence artifact flow',
          sourceKind: 'baseline',
        },
        {
          generatedAt: '2026-06-23T10:05:00.000Z',
          label: 'ready-real-batch',
          manifestPath: './real-corpus-manifest.json',
          notes: 'caller-owned production-like exported corpus batch for manual review',
          sourceKind: 'production-like',
        },
      ],
    }, null, 2),
    'utf8',
  );
  await writeFilledSampleNote(intakeTemplate.notePath);

  const readyChecklist = runOperatorChecklistJson(tempDir);

  assertOperatorChecklistContract(readyChecklist);
  assert.equal(readyChecklist.status, 'ready-for-manual-review');
  assert.equal((readyChecklist.evidenceSummary as Record<string, unknown>).status, 'manual-review-ready');
  assert.match(String(readyChecklist.summaryText), /phaseCoverage=clean/u);
  assert.equal(readyChecklist.blockerCount, 0);
  assert.equal(readyChecklist.reviewCount, 0);
  assert.equal(readyChecklist.infoCount, 2);
  assert.deepEqual(
    [...checklistIds(readyChecklist)].sort(),
    ['evidence-summary-status', 'runbook-manual-review'],
  );
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch operator checklist CLI JSON contract smoke ok');
