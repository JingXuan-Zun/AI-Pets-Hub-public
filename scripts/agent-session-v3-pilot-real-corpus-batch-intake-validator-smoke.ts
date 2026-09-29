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
import { runAgentSessionV3PilotRealCorpusBatchIntakeValidator } from './agent-session-v3-pilot-real-corpus-batch-intake-validator.ts';
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
    reason: `${options.status} real corpus intake validator sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { validatorSource } = readProjectSources({
  validatorSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-validator.ts',
});

assert.match(
  validatorSource,
  /export async function runAgentSessionV3PilotRealCorpusBatchIntakeValidator/u,
  'real corpus batch intake validator should expose a caller-owned runner.',
);
assert.doesNotMatch(
  validatorSource,
  /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'real corpus batch intake validator should not know runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  validatorSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'real corpus batch intake validator should not encode a fixed desktop tool chain.',
);

const shadowResult = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin real corpus intake validator sample',
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

const missingTempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-intake-validator-missing-'));
try {
  const missingResult = await runAgentSessionV3PilotRealCorpusBatchIntakeValidator({
    includeJsonText: true,
    intakeDir: missingTempDir,
    prettyJson: true,
  });

  assert.equal(missingResult.kind, 'agent-session-v3-pilot-real-corpus-batch-intake-validator');
  assert.equal(missingResult.version, 1);
  assert.equal(missingResult.status, 'missing');
  assert.equal(missingResult.manifestReport, null);
  assert.equal(missingResult.indexReport, null);
  assert.equal(missingResult.missingPaths.length, 2);
  assert.equal(missingResult.notePresent, false);
  assert.equal(missingResult.noteMissing, true);
  assert.equal(missingResult.noteReport.status, 'missing');
  assert.equal(missingResult.noteOpenItemCount, 0);
  assert.equal(missingResult.pathHealthReport.status, 'missing');
  assert.equal(missingResult.pathIssueCount, 2);
  assert.equal(missingResult.schemaShapeReport.status, 'missing');
  assert.equal(missingResult.schemaIssueCount, 2);
  assert.equal(missingResult.consistencyReport.status, 'missing');
  assert.equal(missingResult.consistencyIssueCount, 2);
  assert.equal(missingResult.phaseCoverageCalibration, null);
  assert.deepEqual(missingResult.phaseCoverageSourceKindSummaries, []);
  assert.equal(missingResult.notePath, path.join(missingTempDir, 'sample-note-template.md'));
  assert.match(missingResult.summaryText, /status=missing/u);
  assert.match(missingResult.summaryText, /notePresent=no/u);
  assert.match(missingResult.summaryText, /noteStatus=missing/u);
  assert.match(missingResult.summaryText, /noteOpenItems=0/u);
  assert.match(missingResult.summaryText, /pathHealth=missing/u);
  assert.match(missingResult.summaryText, /pathIssues=2/u);
  assert.match(missingResult.summaryText, /schemaShape=missing/u);
  assert.match(missingResult.summaryText, /schemaIssues=2/u);
  assert.match(missingResult.summaryText, /consistency=missing/u);
  assert.match(missingResult.summaryText, /consistencyIssues=2/u);
  assert.match(missingResult.summaryText, /phaseCoverage=unavailable/u);
  assert.match(missingResult.reportText, /missingPaths:/u);
  assert.match(missingResult.reportText, /AgentSessionV3PilotRealCorpusBatchSchemaShapeReport status=missing/u);
  assert.match(missingResult.reportText, /AgentSessionV3PilotRealCorpusBatchPathHealthReport status=missing/u);
  assert.match(missingResult.reportText, /AgentSessionV3PilotRealCorpusBatchConsistencyReport status=missing/u);
  assert.match(missingResult.reportText, /sampleNote: missing/u);
  assert.match(missingResult.reportText, /AgentSessionV3PilotRealCorpusBatchSampleNoteReport status=missing/u);
  assert.match(missingResult.reportText, /sampleNotePath:/u);
  assert.match(missingResult.reportText, /phaseCoverageCalibration: unavailable/u);
  assert.ok(missingResult.jsonText);
  assert.match(missingResult.jsonText, /agent-session-v3-pilot-real-corpus-batch-intake-validator/u);
} finally {
  await rm(missingTempDir, {
    force: true,
    recursive: true,
  });
}

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-intake-validator-'));
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
        {
          label: 'mismatch-real-batch',
          path: './corpora/mismatch-corpus.json',
        },
      ],
    }, null, 2),
    'utf8',
  );

  const result = await runAgentSessionV3PilotRealCorpusBatchIntakeValidator({
    includeJsonText: true,
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-intake-validator');
  assert.equal(result.version, 1);
  assert.equal(result.status, 'mixed');
  assert.equal(result.missingPaths.length, 0);
  assert.equal(result.notePresent, true);
  assert.equal(result.noteMissing, false);
  assert.equal(result.noteReport.status, 'open-items');
  assert.equal(result.noteOpenItemCount, result.noteReport.openItemCount);
  assert.ok(result.noteOpenItemCount >= 10);
  assert.ok(result.noteReport.openItems.some((item) => item.id === 'sample-count'));
  assert.equal(result.pathHealthReport.status, 'healthy');
  assert.equal(result.pathIssueCount, 0);
  assert.equal(result.schemaShapeReport.status, 'valid');
  assert.equal(result.schemaIssueCount, 0);
  assert.equal(result.consistencyReport.status, 'consistent');
  assert.equal(result.consistencyIssueCount, 0);
  assert.equal(result.notePath, path.join(tempDir, 'sample-note-template.md'));
  assert.equal(result.manifestPath, path.join(tempDir, 'real-corpus-manifest.json'));
  assert.equal(result.indexPath, path.join(tempDir, 'corpus-batch-index.json'));
  assert.equal(result.manifestReport?.status, 'mixed');
  assert.equal(result.manifestReport?.sourceCount, 2);
  assert.equal(result.indexReport?.manifestCount, 2);
  assert.equal(result.indexReport?.multiReport.statusCounts.ready, 1);
  assert.equal(result.indexReport?.multiReport.statusCounts.mixed, 1);
  assert.equal(result.phaseCoverageCalibration?.status, 'clean');
  assert.equal(result.phaseCoverageCalibration?.failedManifestCount, 0);
  assert.ok(result.phaseCoverageSourceKindSummaries.length >= 1);
  assert.match(result.summaryText, /status=mixed/u);
  assert.match(result.summaryText, /notePresent=yes/u);
  assert.match(result.summaryText, /noteStatus=open-items/u);
  assert.match(result.summaryText, /noteOpenItems=\d+/u);
  assert.match(result.summaryText, /pathHealth=healthy/u);
  assert.match(result.summaryText, /pathIssues=0/u);
  assert.match(result.summaryText, /schemaShape=valid/u);
  assert.match(result.summaryText, /schemaIssues=0/u);
  assert.match(result.summaryText, /consistency=consistent/u);
  assert.match(result.summaryText, /consistencyIssues=0/u);
  assert.match(result.summaryText, /manifestSources=2/u);
  assert.match(result.summaryText, /indexManifests=2/u);
  assert.match(result.summaryText, /phaseCoverage=clean/u);
  assert.match(result.reportText, /missingPaths: none/u);
  assert.match(result.reportText, /AgentSessionV3PilotRealCorpusBatchSchemaShapeReport status=valid/u);
  assert.match(result.reportText, /schemaShapeIssues: none/u);
  assert.match(result.reportText, /AgentSessionV3PilotRealCorpusBatchPathHealthReport status=healthy/u);
  assert.match(result.reportText, /pathHealthIssues: none/u);
  assert.match(result.reportText, /AgentSessionV3PilotRealCorpusBatchConsistencyReport status=consistent/u);
  assert.match(result.reportText, /consistencyIssues: none/u);
  assert.match(result.reportText, /sampleNote: present/u);
  assert.match(result.reportText, /AgentSessionV3PilotRealCorpusBatchSampleNoteReport status=open-items/u);
  assert.match(result.reportText, /sampleNoteOpenItems:/u);
  assert.match(result.reportText, /AgentSessionV3PilotExternalSampleCorpusManifestReport/u);
  assert.match(result.reportText, /AgentSessionV3PilotCorpusBatchIndexReport/u);
  assert.match(result.reportText, /phaseCoverageSourceKinds:/u);
  assert.ok(result.jsonText);
  assert.match(result.jsonText, /agent-session-v3-pilot-real-corpus-batch-intake-validator/u);

  await writeFile(
    intakeTemplate.indexPath,
    JSON.stringify({
      ...intakeTemplate.index,
      batches: [
        {
          label: 'baseline-only',
          manifestPath: './baseline/explicit-debug-corpus-manifest.json',
          sourceKind: 'baseline',
        },
      ],
    }, null, 2),
    'utf8',
  );

  const resultWithConsistencyIssue = await runAgentSessionV3PilotRealCorpusBatchIntakeValidator({
    includeJsonText: true,
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(resultWithConsistencyIssue.status, 'not-ready');
  assert.equal(resultWithConsistencyIssue.manifestReport, null);
  assert.equal(resultWithConsistencyIssue.indexReport, null);
  assert.equal(resultWithConsistencyIssue.phaseCoverageCalibration, null);
  assert.deepEqual(resultWithConsistencyIssue.phaseCoverageSourceKindSummaries, []);
  assert.equal(resultWithConsistencyIssue.pathHealthReport.status, 'healthy');
  assert.equal(resultWithConsistencyIssue.schemaShapeReport.status, 'valid');
  assert.equal(resultWithConsistencyIssue.consistencyReport.status, 'issues');
  assert.equal(resultWithConsistencyIssue.consistencyIssueCount, 1);
  assert.ok(resultWithConsistencyIssue.consistencyReport.issues.some((issue) => issue.code === 'missing-real-manifest-entry'));
  assert.match(resultWithConsistencyIssue.summaryText, /status=not-ready/u);
  assert.match(resultWithConsistencyIssue.summaryText, /consistency=issues/u);
  assert.match(resultWithConsistencyIssue.summaryText, /consistencyIssues=1/u);
  assert.match(resultWithConsistencyIssue.reportText, /AgentSessionV3PilotRealCorpusBatchConsistencyReport status=issues/u);
  assert.match(resultWithConsistencyIssue.reportText, /code=missing-real-manifest-entry/u);
  assert.match(resultWithConsistencyIssue.reportText, /manifestReport: unavailable/u);
  assert.match(resultWithConsistencyIssue.reportText, /indexReport: unavailable/u);

  await writeFile(intakeTemplate.indexPath, JSON.stringify(intakeTemplate.index, null, 2), 'utf8');

  assert.ok(intakeTemplate.notePath);
  await rm(intakeTemplate.notePath, {
    force: true,
  });

  const resultWithoutNote = await runAgentSessionV3PilotRealCorpusBatchIntakeValidator({
    includeJsonText: true,
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(resultWithoutNote.status, 'mixed');
  assert.equal(resultWithoutNote.missingPaths.length, 0);
  assert.equal(resultWithoutNote.notePresent, false);
  assert.equal(resultWithoutNote.noteMissing, true);
  assert.equal(resultWithoutNote.noteReport.status, 'missing');
  assert.equal(resultWithoutNote.noteOpenItemCount, 0);
  assert.equal(resultWithoutNote.pathHealthReport.status, 'healthy');
  assert.equal(resultWithoutNote.pathIssueCount, 0);
  assert.equal(resultWithoutNote.schemaShapeReport.status, 'valid');
  assert.equal(resultWithoutNote.schemaIssueCount, 0);
  assert.equal(resultWithoutNote.consistencyReport.status, 'consistent');
  assert.equal(resultWithoutNote.consistencyIssueCount, 0);
  assert.equal(resultWithoutNote.phaseCoverageCalibration?.status, 'clean');
  assert.match(resultWithoutNote.summaryText, /status=mixed/u);
  assert.match(resultWithoutNote.summaryText, /notePresent=no/u);
  assert.match(resultWithoutNote.summaryText, /noteStatus=missing/u);
  assert.match(resultWithoutNote.summaryText, /pathHealth=healthy/u);
  assert.match(resultWithoutNote.summaryText, /schemaShape=valid/u);
  assert.match(resultWithoutNote.summaryText, /consistency=consistent/u);
  assert.match(resultWithoutNote.reportText, /missingPaths: none/u);
  assert.match(resultWithoutNote.reportText, /sampleNote: missing/u);
  assert.match(resultWithoutNote.reportText, /AgentSessionV3PilotRealCorpusBatchSampleNoteReport status=missing/u);

  await writeFile(
    intakeTemplate.manifestPath,
    JSON.stringify({
      ...intakeTemplate.manifest,
      sources: [
        {
          label: 'missing-real-batch',
          path: './corpora/missing-corpus.json',
        },
      ],
    }, null, 2),
    'utf8',
  );

  const resultWithMissingSource = await runAgentSessionV3PilotRealCorpusBatchIntakeValidator({
    includeJsonText: true,
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(resultWithMissingSource.status, 'not-ready');
  assert.equal(resultWithMissingSource.manifestReport, null);
  assert.equal(resultWithMissingSource.indexReport, null);
  assert.equal(resultWithMissingSource.phaseCoverageCalibration, null);
  assert.deepEqual(resultWithMissingSource.phaseCoverageSourceKindSummaries, []);
  assert.equal(resultWithMissingSource.pathHealthReport.status, 'issues');
  assert.equal(resultWithMissingSource.pathIssueCount, 1);
  assert.equal(resultWithMissingSource.schemaShapeReport.status, 'valid');
  assert.equal(resultWithMissingSource.schemaIssueCount, 0);
  assert.equal(resultWithMissingSource.consistencyReport.status, 'consistent');
  assert.equal(resultWithMissingSource.consistencyIssueCount, 0);
  assert.match(resultWithMissingSource.summaryText, /status=not-ready/u);
  assert.match(resultWithMissingSource.summaryText, /schemaShape=valid/u);
  assert.match(resultWithMissingSource.summaryText, /pathHealth=issues/u);
  assert.match(resultWithMissingSource.summaryText, /pathIssues=1/u);
  assert.match(resultWithMissingSource.summaryText, /consistency=consistent/u);
  assert.match(resultWithMissingSource.reportText, /AgentSessionV3PilotRealCorpusBatchPathHealthReport status=issues/u);
  assert.match(resultWithMissingSource.reportText, /scope=manifest-source status=missing/u);
  assert.match(resultWithMissingSource.reportText, /manifestReport: unavailable/u);
  assert.match(resultWithMissingSource.reportText, /indexReport: unavailable/u);

  await writeFile(
    intakeTemplate.manifestPath,
    JSON.stringify({
      ...intakeTemplate.manifest,
      sources: {
        bad: true,
      },
    }, null, 2),
    'utf8',
  );

  const resultWithInvalidShape = await runAgentSessionV3PilotRealCorpusBatchIntakeValidator({
    includeJsonText: true,
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(resultWithInvalidShape.status, 'not-ready');
  assert.equal(resultWithInvalidShape.manifestReport, null);
  assert.equal(resultWithInvalidShape.indexReport, null);
  assert.equal(resultWithInvalidShape.phaseCoverageCalibration, null);
  assert.deepEqual(resultWithInvalidShape.phaseCoverageSourceKindSummaries, []);
  assert.equal(resultWithInvalidShape.schemaShapeReport.status, 'issues');
  assert.equal(resultWithInvalidShape.schemaIssueCount, 1);
  assert.equal(resultWithInvalidShape.pathHealthReport.status, 'healthy');
  assert.equal(resultWithInvalidShape.consistencyReport.status, 'consistent');
  assert.match(resultWithInvalidShape.summaryText, /status=not-ready/u);
  assert.match(resultWithInvalidShape.summaryText, /schemaShape=issues/u);
  assert.match(resultWithInvalidShape.summaryText, /schemaIssues=1/u);
  assert.match(resultWithInvalidShape.summaryText, /consistency=consistent/u);
  assert.match(resultWithInvalidShape.reportText, /AgentSessionV3PilotRealCorpusBatchSchemaShapeReport status=issues/u);
  assert.match(resultWithInvalidShape.reportText, /scope=manifest code=invalid-array/u);
  assert.match(resultWithInvalidShape.reportText, /manifestReport: unavailable/u);
  assert.match(resultWithInvalidShape.reportText, /indexReport: unavailable/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch intake validator smoke ok');
