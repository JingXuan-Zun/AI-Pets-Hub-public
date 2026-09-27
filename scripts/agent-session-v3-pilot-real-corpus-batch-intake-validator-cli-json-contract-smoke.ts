import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
import {
  assertNestedKind,
  assertNumberRecordKeys,
  assertObjectRecord,
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain,
  parseTrailingJsonObject,
} from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const allowedValidatorStatuses = new Set([
  'empty',
  'missing',
  'mixed',
  'not-ready',
  'ready',
]);

function runValidatorCli(intakeDir: string) {
  const cliArgs = [
    'tsx',
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-intake-validator.ts',
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

function assertStringArray(value: unknown, label: string) {
  assert.ok(Array.isArray(value), `${label} should be an array.`);

  for (const entry of value) {
    assert.equal(typeof entry, 'string', `${label} entries should be strings.`);
  }
}

function assertNullableNestedKind(
  container: Record<string, unknown>,
  key: string,
  kind: string,
) {
  if (container[key] === null) {
    return null;
  }

  return assertNestedKind(container, key, kind);
}

function assertPhaseCoverageCalibrationShape(value: unknown, label: string) {
  if (value === null) {
    return;
  }

  const record = assertObjectRecord(value, label);
  assert.match(String(record.status), /^(clean|needs-review)$/u);
  assert.equal(typeof record.summaryText, 'string', `${label}.summaryText should be a string.`);
  assertNumberRecordKeys(
    record,
    [
      'failedCheckCount',
      'failedManifestCount',
    ],
    label,
  );
  assertStringArray(record.failedCheckKeys, `${label}.failedCheckKeys`);
  assertStringArray(record.manifestLabels, `${label}.manifestLabels`);
}

function assertPhaseCoverageSourceKindSummaries(value: unknown, label: string) {
  assert.ok(Array.isArray(value), `${label} should be an array.`);

  for (const entry of value) {
    const record = assertObjectRecord(entry, `${label} entry`);
    assert.equal(typeof record.sourceKind, 'string');
    assertNumberRecordKeys(
      record,
      [
        'manifestCount',
        'phaseCoverageClean',
        'phaseCoverageFailedCheckCount',
        'phaseCoverageNeedsReview',
      ],
      `${label} entry`,
    );
    assertStringArray(record.phaseCoverageFailedCheckKeys, `${label}.phaseCoverageFailedCheckKeys`);
    assertStringArray(record.phaseCoverageManifestLabels, `${label}.phaseCoverageManifestLabels`);
  }
}

function assertValidatorJsonContract(validator: Record<string, unknown>) {
  assert.equal(validator.kind, 'agent-session-v3-pilot-real-corpus-batch-intake-validator');
  assert.equal(validator.version, 1);
  assert.equal(typeof validator.status, 'string');
  assert.ok(allowedValidatorStatuses.has(String(validator.status)));
  assert.equal(typeof validator.intakeDir, 'string');
  assert.equal(typeof validator.manifestPath, 'string');
  assert.equal(typeof validator.indexPath, 'string');
  assert.equal(typeof validator.notePath, 'string');
  assert.equal(typeof validator.notePresent, 'boolean');
  assert.equal(typeof validator.noteMissing, 'boolean');
  assert.equal(typeof validator.summaryText, 'string');
  assert.equal(typeof validator.reportText, 'string');
  assertStringArray(validator.missingPaths, 'missingPaths');
  assertNumberRecordKeys(
    validator,
    [
      'noteOpenItemCount',
      'schemaIssueCount',
      'pathIssueCount',
      'consistencyIssueCount',
    ],
    'validator',
  );
  assert.ok(
    Object.hasOwn(validator, 'phaseCoverageCalibration'),
    'validator should expose nullable phaseCoverageCalibration.',
  );
  assertPhaseCoverageCalibrationShape(validator.phaseCoverageCalibration, 'validator.phaseCoverageCalibration');
  assertPhaseCoverageSourceKindSummaries(
    validator.phaseCoverageSourceKindSummaries,
    'validator.phaseCoverageSourceKindSummaries',
  );
  assertNestedKind(
    validator,
    'noteReport',
    'agent-session-v3-pilot-real-corpus-batch-sample-note-report',
  );
  assertNestedKind(
    validator,
    'schemaShapeReport',
    'agent-session-v3-pilot-real-corpus-batch-schema-shape-report',
  );
  assertNestedKind(
    validator,
    'pathHealthReport',
    'agent-session-v3-pilot-real-corpus-batch-path-health-report',
  );
  assertNestedKind(
    validator,
    'consistencyReport',
    'agent-session-v3-pilot-real-corpus-batch-consistency-report',
  );
  assertNullableNestedKind(
    validator,
    'manifestReport',
    'agent-session-v3-pilot-external-sample-corpus-manifest-loader',
  );
  assertNullableNestedKind(
    validator,
    'indexReport',
    'agent-session-v3-pilot-corpus-batch-index-report',
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
    reason: `${options.status} real corpus intake validator JSON contract sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { validatorSource } = readProjectSources({
  validatorSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-validator.ts',
});

assert.match(
  validatorSource,
  /--dir/u,
  'real corpus batch intake validator JSON contract should expose an intake directory argument.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  validatorSource,
  'real corpus batch intake validator JSON contract',
);

const missingTempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-intake-validator-json-contract-missing-'));
try {
  const missingCliResult = runValidatorCli(missingTempDir);

  assert.equal(
    missingCliResult.status,
    0,
    missingCliResult.stderr || missingCliResult.stdout || missingCliResult.error?.message,
  );

  const missingValidator = parseTrailingJsonObject(missingCliResult.stdout);
  assertValidatorJsonContract(missingValidator);
  assert.equal(missingValidator.status, 'missing');
  assert.equal((missingValidator.missingPaths as unknown[]).length, 2);
  assert.equal(missingValidator.notePresent, false);
  assert.equal(missingValidator.noteMissing, true);
  assert.equal(missingValidator.noteOpenItemCount, 0);
  assert.equal(missingValidator.schemaIssueCount, 2);
  assert.equal(missingValidator.pathIssueCount, 2);
  assert.equal(missingValidator.consistencyIssueCount, 2);
  assert.equal(missingValidator.manifestReport, null);
  assert.equal(missingValidator.indexReport, null);
  assert.equal(missingValidator.phaseCoverageCalibration, null);
  assert.deepEqual(missingValidator.phaseCoverageSourceKindSummaries, []);

  const noteReport = assertObjectRecord(missingValidator.noteReport, 'noteReport');
  assert.equal(noteReport.status, 'missing');
  const schemaShapeReport = assertObjectRecord(missingValidator.schemaShapeReport, 'schemaShapeReport');
  assert.equal(schemaShapeReport.status, 'missing');
  const pathHealthReport = assertObjectRecord(missingValidator.pathHealthReport, 'pathHealthReport');
  assert.equal(pathHealthReport.status, 'missing');
  const consistencyReport = assertObjectRecord(missingValidator.consistencyReport, 'consistencyReport');
  assert.equal(consistencyReport.status, 'missing');
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
      reason: 'begin real corpus intake validator JSON contract sample',
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

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-intake-validator-json-contract-'));
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

  const mixedCliResult = runValidatorCli(tempDir);

  assert.equal(
    mixedCliResult.status,
    0,
    mixedCliResult.stderr || mixedCliResult.stdout || mixedCliResult.error?.message,
  );

  const mixedValidator = parseTrailingJsonObject(mixedCliResult.stdout);
  assertValidatorJsonContract(mixedValidator);
  assert.equal(mixedValidator.status, 'mixed');
  assert.deepEqual(mixedValidator.missingPaths, []);
  assert.equal(mixedValidator.notePresent, true);
  assert.equal(mixedValidator.noteMissing, false);
  assert.ok(Number(mixedValidator.noteOpenItemCount) > 0);
  assert.equal(mixedValidator.schemaIssueCount, 0);
  assert.equal(mixedValidator.pathIssueCount, 0);
  assert.equal(mixedValidator.consistencyIssueCount, 0);

  const noteReport = assertObjectRecord(mixedValidator.noteReport, 'mixed noteReport');
  assert.equal(noteReport.status, 'open-items');
  const schemaShapeReport = assertObjectRecord(mixedValidator.schemaShapeReport, 'mixed schemaShapeReport');
  assert.equal(schemaShapeReport.status, 'valid');
  const pathHealthReport = assertObjectRecord(mixedValidator.pathHealthReport, 'mixed pathHealthReport');
  assert.equal(pathHealthReport.status, 'healthy');
  const consistencyReport = assertObjectRecord(mixedValidator.consistencyReport, 'mixed consistencyReport');
  assert.equal(consistencyReport.status, 'consistent');

  const manifestReport = assertObjectRecord(mixedValidator.manifestReport, 'mixed manifestReport');
  assert.equal(manifestReport.sourceCount, 2);
  assert.equal(manifestReport.status, 'mixed');

  const indexReport = assertObjectRecord(mixedValidator.indexReport, 'mixed indexReport');
  assert.equal(indexReport.manifestCount, 2);
  const phaseCoverageCalibration = assertObjectRecord(
    mixedValidator.phaseCoverageCalibration,
    'mixed phaseCoverageCalibration',
  );
  assert.equal(phaseCoverageCalibration.status, 'clean');
  assert.equal(phaseCoverageCalibration.failedManifestCount, 0);
  assert.ok((mixedValidator.phaseCoverageSourceKindSummaries as unknown[]).length >= 1);
  assert.match(String(mixedValidator.summaryText), /phaseCoverage=clean/u);
  assert.match(String(mixedValidator.reportText), /phaseCoverageSourceKinds:/u);
  const multiReport = assertObjectRecord(indexReport.multiReport, 'mixed indexReport.multiReport');
  const statusCounts = assertObjectRecord(multiReport.statusCounts, 'mixed indexReport.multiReport.statusCounts');
  assert.equal(statusCounts.ready, 1);
  assert.equal(statusCounts.mixed, 1);
  assert.equal(statusCounts.notReady, 0);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch intake validator CLI JSON contract smoke ok');
