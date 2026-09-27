import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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
  AGENT_SESSION_V3_PILOT_REAL_CORPUS_BATCH_SAMPLE_NOTE_OPEN_ITEM_CHECKS,
} from './agent-session-v3-pilot-real-corpus-batch-sample-note-report.ts';
import {
  assertNumberRecordKeys,
  assertObjectRecord,
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain,
  parseTrailingJsonObject,
} from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotExternalSampleCorpusManifestTemplate } from './agent-session-v3-pilot-external-sample-corpus-manifest-template.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
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

function assertBooleanValue(value: unknown, label: string) {
  assert.equal(typeof value, 'boolean', `${label} should be a boolean.`);
}

function assertArrayValue(value: unknown, label: string) {
  assert.ok(Array.isArray(value), `${label} should be an array.`);

  return value;
}

function assertStatusCounts(value: unknown, label: string) {
  return assertNumberRecordKeys(value, ['ready', 'mixed', 'notReady', 'empty'], label);
}

function assertMultiManifestPhaseCoverageReadinessShape(value: unknown, label: string) {
  const phaseCoverageReadiness = assertObjectRecord(value, label);

  assertStringValue(phaseCoverageReadiness.status, `${label}.status`);
  assert.ok(['clean', 'needs-review'].includes(String(phaseCoverageReadiness.status)));
  assert.equal(typeof phaseCoverageReadiness.failedCheckCount, 'number');
  assert.equal(typeof phaseCoverageReadiness.failedManifestCount, 'number');
  assertArrayValue(phaseCoverageReadiness.failedCheckKeys, `${label}.failedCheckKeys`);
  assertArrayValue(phaseCoverageReadiness.manifestLabels, `${label}.manifestLabels`);
  assertStringValue(phaseCoverageReadiness.summaryText, `${label}.summaryText`);
}

function assertMultiManifestEntryShape(entry: unknown) {
  const entryRecord = assertObjectRecord(entry, 'multi manifest entry');

  assertStringValue(entryRecord.diagnosticsStatus, 'multi manifest entry diagnosticsStatus');
  assertStringValue(entryRecord.manifestPath, 'multi manifest entry manifestPath');
  assert.equal(typeof entryRecord.phaseCoverageReadinessFailedCheckCount, 'number');
  assertArrayValue(
    entryRecord.phaseCoverageReadinessFailedCheckKeys,
    'multi manifest entry phaseCoverageReadinessFailedCheckKeys',
  );
  assertStringValue(entryRecord.phaseCoverageReadinessStatus, 'multi manifest entry phaseCoverageReadinessStatus');
  assert.ok(
    ['clean', 'needs-review'].includes(String(entryRecord.phaseCoverageReadinessStatus)),
    'multi manifest entry phaseCoverageReadinessStatus should be a known status.',
  );
  assertArrayValue(entryRecord.profileStatuses, 'multi manifest entry profileStatuses');
  assert.ok(
    entryRecord.reportText === null || typeof entryRecord.reportText === 'string',
    'multi manifest entry reportText should be a string or null.',
  );
  assert.equal(typeof entryRecord.sourceCount, 'number');
  assertStringValue(entryRecord.status, 'multi manifest entry status');
  assertStringValue(entryRecord.summaryText, 'multi manifest entry summaryText');
}

function assertFailedCheckSummaryShape(summary: unknown) {
  const summaryRecord = assertObjectRecord(summary, 'failed check summary');

  assert.equal(typeof summaryRecord.failedCount, 'number');
  assertStringValue(summaryRecord.key, 'failed check summary key');
  assertArrayValue(summaryRecord.manifestLabels, 'failed check summary manifestLabels');
  assert.equal(typeof summaryRecord.maxActual, 'number');
  assert.ok(
    summaryRecord.maxRequired === null || typeof summaryRecord.maxRequired === 'number',
    'failed check summary maxRequired should be a number or null.',
  );
}

function assertProfileSummaryShape(summary: unknown) {
  const summaryRecord = assertObjectRecord(summary, 'profile summary');

  assertStringValue(summaryRecord.label, 'profile summary label');
  assertStatusCounts(summaryRecord.statusCounts, 'profile summary statusCounts');
}

function assertMultiManifestReportContract(report: Record<string, unknown>) {
  assert.equal(report.kind, 'agent-session-v3-pilot-multi-corpus-manifest-report');
  assert.equal(report.version, 1);
  assert.equal(typeof report.manifestCount, 'number');
  assertStringValue(report.summaryText, 'multi report summaryText');
  assertStringValue(report.reportText, 'multi report reportText');
  assertStatusCounts(report.statusCounts, 'multi report statusCounts');
  assertMultiManifestPhaseCoverageReadinessShape(
    report.phaseCoverageReadiness,
    'multi report phaseCoverageReadiness',
  );

  for (const entry of assertArrayValue(report.entries, 'multi report entries')) {
    assertMultiManifestEntryShape(entry);
  }
  for (const summary of assertArrayValue(report.failedCheckSummaries, 'multi report failedCheckSummaries')) {
    assertFailedCheckSummaryShape(summary);
  }
  for (const summary of assertArrayValue(report.profileSummaries, 'multi report profileSummaries')) {
    assertProfileSummaryShape(summary);
  }
}

function assertSampleNoteOpenItemShape(item: unknown) {
  const itemRecord = assertObjectRecord(item, 'sample note open item');

  assertStringValue(itemRecord.id, 'sample note open item id');
  assertStringValue(itemRecord.label, 'sample note open item label');
  assertStringValue(itemRecord.placeholder, 'sample note open item placeholder');
}

function assertSampleNoteReportContract(report: Record<string, unknown>) {
  assert.equal(report.kind, 'agent-session-v3-pilot-real-corpus-batch-sample-note-report');
  assert.equal(report.version, 1);
  assertStringValue(report.notePath, 'sample note report notePath');
  assertBooleanValue(report.notePresent, 'sample note report notePresent');
  assert.equal(typeof report.openItemCount, 'number');
  assertStringValue(report.reportText, 'sample note report reportText');
  assertStringValue(report.status, 'sample note report status');
  assert.ok(['complete', 'missing', 'open-items'].includes(String(report.status)));
  assertStringValue(report.summaryText, 'sample note report summaryText');

  for (const item of assertArrayValue(report.openItems, 'sample note report openItems')) {
    assertSampleNoteOpenItemShape(item);
  }
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
    reason: `${options.status} multi manifest/sample note JSON contract sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

for (const scriptName of [
  'agent-session-v3-pilot-multi-corpus-manifest-report.ts',
  'agent-session-v3-pilot-real-corpus-batch-sample-note-report.ts',
]) {
  const { scriptSource } = readProjectSources({
    scriptSource: `scripts/${scriptName}`,
  });

  assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
    scriptSource,
    `${scriptName} CLI JSON contract`,
  );
}

const shadowResult = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin multi manifest/sample note JSON contract sample',
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

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-multi-manifest-note-json-contract-'));
try {
  const readyCorpusPath = path.join(tempDir, 'ready-corpus.json');
  const mismatchCorpusPath = path.join(tempDir, 'mismatch-corpus.json');
  const readyManifestPath = path.join(tempDir, 'ready-manifest.json');
  const mismatchManifestPath = path.join(tempDir, 'mismatch-manifest.json');
  const missingNotePath = path.join(tempDir, 'missing-sample-note.md');
  const openNotePath = path.join(tempDir, 'open-sample-note.md');
  const completeNotePath = path.join(tempDir, 'complete-sample-note.md');
  const template = await runAgentSessionV3PilotExternalSampleCorpusManifestTemplate();
  const intakeTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate();

  await writeFile(readyCorpusPath, JSON.stringify(createCorpus('aligned')), 'utf8');
  await writeFile(mismatchCorpusPath, JSON.stringify(createCorpus('mismatch')), 'utf8');
  await writeFile(readyManifestPath, JSON.stringify({
    ...template.manifest,
    sources: [
      {
        label: 'ready-batch',
        path: path.basename(readyCorpusPath),
      },
    ],
  }), 'utf8');
  await writeFile(mismatchManifestPath, JSON.stringify({
    ...template.manifest,
    sources: [
      {
        label: 'mismatch-batch',
        path: path.basename(mismatchCorpusPath),
      },
    ],
  }), 'utf8');

  await writeFile(openNotePath, intakeTemplate.noteText, 'utf8');
  let completeNoteText = intakeTemplate.noteText;
  for (const check of AGENT_SESSION_V3_PILOT_REAL_CORPUS_BATCH_SAMPLE_NOTE_OPEN_ITEM_CHECKS) {
    completeNoteText = completeNoteText.replaceAll(check.placeholder, `filled-${check.id}`);
  }
  await writeFile(completeNotePath, completeNoteText, 'utf8');

  const multiReport = runJsonCli([
    '.\\scripts\\agent-session-v3-pilot-multi-corpus-manifest-report.ts',
    readyManifestPath,
    mismatchManifestPath,
    '--pretty',
  ]);
  assertMultiManifestReportContract(multiReport);
  assert.equal(multiReport.manifestCount, 2);
  const statusCounts = assertObjectRecord(multiReport.statusCounts, 'multi report statusCounts');
  assert.equal(statusCounts.ready, 1);
  assert.equal(statusCounts.notReady, 1);
  assert.equal((multiReport.entries as unknown[]).length, 2);
  assert.ok((multiReport.failedCheckSummaries as unknown[]).some((summary) => (
    (summary as Record<string, unknown>).key === 'max-mismatches'
  )));
  assert.ok((multiReport.profileSummaries as unknown[]).some((summary) => (
    (summary as Record<string, unknown>).label === 'strict'
  )));

  const missingNoteReport = runJsonCli([
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-sample-note-report.ts',
    '--path',
    missingNotePath,
    '--pretty',
  ]);
  assertSampleNoteReportContract(missingNoteReport);
  assert.equal(missingNoteReport.status, 'missing');
  assert.equal(missingNoteReport.notePresent, false);
  assert.equal(missingNoteReport.openItemCount, 0);
  assertNullableStringValue(missingNoteReport.jsonText, 'missing sample note jsonText');

  const openNoteReport = runJsonCli([
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-sample-note-report.ts',
    '--path',
    openNotePath,
    '--pretty',
  ]);
  assertSampleNoteReportContract(openNoteReport);
  assert.equal(openNoteReport.status, 'open-items');
  assert.equal(openNoteReport.notePresent, true);
  assert.ok(Number(openNoteReport.openItemCount) >= 10);
  assert.ok((openNoteReport.openItems as unknown[]).some((item) => (
    (item as Record<string, unknown>).id === 'threshold-action'
  )));

  const completeNoteReport = runJsonCli([
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-sample-note-report.ts',
    '--path',
    completeNotePath,
    '--pretty',
  ]);
  assertSampleNoteReportContract(completeNoteReport);
  assert.equal(completeNoteReport.status, 'complete');
  assert.equal(completeNoteReport.notePresent, true);
  assert.equal(completeNoteReport.openItemCount, 0);
  assert.deepEqual(completeNoteReport.openItems, []);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot multi manifest and sample note CLI JSON contract smoke ok');
