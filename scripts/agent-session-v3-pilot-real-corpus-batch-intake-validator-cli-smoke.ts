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
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

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
    reason: `${options.status} real corpus intake validator CLI sample`,
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
  'real corpus batch intake validator CLI should expose an intake directory argument.',
);
assert.doesNotMatch(
  validatorSource,
  /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'real corpus batch intake validator CLI should not know runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  validatorSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'real corpus batch intake validator CLI should not encode a fixed desktop tool chain.',
);

const missingTempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-intake-validator-cli-missing-'));
try {
  const missingCliResult = runValidatorCli(missingTempDir);

  assert.equal(
    missingCliResult.status,
    0,
    missingCliResult.stderr || missingCliResult.stdout || missingCliResult.error?.message,
  );
  assert.match(missingCliResult.stdout, /AgentSessionV3PilotRealCorpusBatchIntakeValidator status=missing/u);
  assert.match(missingCliResult.stdout, /missing=2/u);
  assert.match(missingCliResult.stdout, /notePresent=no/u);
  assert.match(missingCliResult.stdout, /noteStatus=missing/u);
  assert.match(missingCliResult.stdout, /noteOpenItems=0/u);
  assert.match(missingCliResult.stdout, /pathHealth=missing/u);
  assert.match(missingCliResult.stdout, /pathIssues=2/u);
  assert.match(missingCliResult.stdout, /schemaShape=missing/u);
  assert.match(missingCliResult.stdout, /schemaIssues=2/u);
  assert.match(missingCliResult.stdout, /consistency=missing/u);
  assert.match(missingCliResult.stdout, /consistencyIssues=2/u);
  assert.match(missingCliResult.stdout, /missingPaths:/u);
  assert.match(missingCliResult.stdout, /AgentSessionV3PilotRealCorpusBatchSchemaShapeReport status=missing/u);
  assert.match(missingCliResult.stdout, /AgentSessionV3PilotRealCorpusBatchPathHealthReport status=missing/u);
  assert.match(missingCliResult.stdout, /AgentSessionV3PilotRealCorpusBatchConsistencyReport status=missing/u);
  assert.match(missingCliResult.stdout, /sampleNote: missing/u);
  assert.match(missingCliResult.stdout, /AgentSessionV3PilotRealCorpusBatchSampleNoteReport status=missing/u);
  assert.match(missingCliResult.stdout, /agent-session-v3-pilot-real-corpus-batch-intake-validator/u);
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
      reason: 'begin real corpus intake validator CLI sample',
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

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-intake-validator-cli-'));
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

  const cliResult = runValidatorCli(tempDir);

  assert.equal(
    cliResult.status,
    0,
    cliResult.stderr || cliResult.stdout || cliResult.error?.message,
  );
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchIntakeValidator status=mixed/u);
  assert.match(cliResult.stdout, /notePresent=yes/u);
  assert.match(cliResult.stdout, /noteStatus=open-items/u);
  assert.match(cliResult.stdout, /noteOpenItems=\d+/u);
  assert.match(cliResult.stdout, /pathHealth=healthy/u);
  assert.match(cliResult.stdout, /pathIssues=0/u);
  assert.match(cliResult.stdout, /schemaShape=valid/u);
  assert.match(cliResult.stdout, /schemaIssues=0/u);
  assert.match(cliResult.stdout, /consistency=consistent/u);
  assert.match(cliResult.stdout, /consistencyIssues=0/u);
  assert.match(cliResult.stdout, /manifestSources=2/u);
  assert.match(cliResult.stdout, /indexManifests=2/u);
  assert.match(cliResult.stdout, /indexReady=1/u);
  assert.match(cliResult.stdout, /indexMixed=1/u);
  assert.match(cliResult.stdout, /missingPaths: none/u);
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchSchemaShapeReport status=valid/u);
  assert.match(cliResult.stdout, /schemaShapeIssues: none/u);
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchPathHealthReport status=healthy/u);
  assert.match(cliResult.stdout, /pathHealthIssues: none/u);
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchConsistencyReport status=consistent/u);
  assert.match(cliResult.stdout, /consistencyIssues: none/u);
  assert.match(cliResult.stdout, /sampleNote: present/u);
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchSampleNoteReport status=open-items/u);
  assert.match(cliResult.stdout, /sampleNoteOpenItems:/u);
  assert.match(cliResult.stdout, /AgentSessionV3PilotExternalSampleCorpusManifestReport/u);
  assert.match(cliResult.stdout, /AgentSessionV3PilotCorpusBatchIndexReport/u);
  assert.match(cliResult.stdout, /agent-session-v3-pilot-real-corpus-batch-intake-validator/u);

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

  const cliResultWithConsistencyIssue = runValidatorCli(tempDir);

  assert.equal(
    cliResultWithConsistencyIssue.status,
    0,
    cliResultWithConsistencyIssue.stderr || cliResultWithConsistencyIssue.stdout || cliResultWithConsistencyIssue.error?.message,
  );
  assert.match(cliResultWithConsistencyIssue.stdout, /AgentSessionV3PilotRealCorpusBatchIntakeValidator status=not-ready/u);
  assert.match(cliResultWithConsistencyIssue.stdout, /pathHealth=healthy/u);
  assert.match(cliResultWithConsistencyIssue.stdout, /schemaShape=valid/u);
  assert.match(cliResultWithConsistencyIssue.stdout, /consistency=issues/u);
  assert.match(cliResultWithConsistencyIssue.stdout, /consistencyIssues=1/u);
  assert.match(cliResultWithConsistencyIssue.stdout, /AgentSessionV3PilotRealCorpusBatchConsistencyReport status=issues/u);
  assert.match(cliResultWithConsistencyIssue.stdout, /code=missing-real-manifest-entry/u);
  assert.match(cliResultWithConsistencyIssue.stdout, /manifestReport: unavailable/u);
  assert.match(cliResultWithConsistencyIssue.stdout, /indexReport: unavailable/u);

  await writeFile(intakeTemplate.indexPath, JSON.stringify(intakeTemplate.index, null, 2), 'utf8');

  assert.ok(intakeTemplate.notePath);
  await rm(intakeTemplate.notePath, {
    force: true,
  });

  const cliResultWithoutNote = runValidatorCli(tempDir);

  assert.equal(
    cliResultWithoutNote.status,
    0,
    cliResultWithoutNote.stderr || cliResultWithoutNote.stdout || cliResultWithoutNote.error?.message,
  );
  assert.match(cliResultWithoutNote.stdout, /AgentSessionV3PilotRealCorpusBatchIntakeValidator status=mixed/u);
  assert.match(cliResultWithoutNote.stdout, /notePresent=no/u);
  assert.match(cliResultWithoutNote.stdout, /noteStatus=missing/u);
  assert.match(cliResultWithoutNote.stdout, /noteOpenItems=0/u);
  assert.match(cliResultWithoutNote.stdout, /pathHealth=healthy/u);
  assert.match(cliResultWithoutNote.stdout, /pathIssues=0/u);
  assert.match(cliResultWithoutNote.stdout, /schemaShape=valid/u);
  assert.match(cliResultWithoutNote.stdout, /schemaIssues=0/u);
  assert.match(cliResultWithoutNote.stdout, /consistency=consistent/u);
  assert.match(cliResultWithoutNote.stdout, /consistencyIssues=0/u);
  assert.match(cliResultWithoutNote.stdout, /missingPaths: none/u);
  assert.match(cliResultWithoutNote.stdout, /sampleNote: missing/u);
  assert.match(cliResultWithoutNote.stdout, /AgentSessionV3PilotRealCorpusBatchSampleNoteReport status=missing/u);
  assert.match(cliResultWithoutNote.stdout, /agent-session-v3-pilot-real-corpus-batch-intake-validator/u);

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

  const cliResultWithMissingSource = runValidatorCli(tempDir);

  assert.equal(
    cliResultWithMissingSource.status,
    0,
    cliResultWithMissingSource.stderr || cliResultWithMissingSource.stdout || cliResultWithMissingSource.error?.message,
  );
  assert.match(cliResultWithMissingSource.stdout, /AgentSessionV3PilotRealCorpusBatchIntakeValidator status=not-ready/u);
  assert.match(cliResultWithMissingSource.stdout, /schemaShape=valid/u);
  assert.match(cliResultWithMissingSource.stdout, /schemaIssues=0/u);
  assert.match(cliResultWithMissingSource.stdout, /pathHealth=issues/u);
  assert.match(cliResultWithMissingSource.stdout, /pathIssues=1/u);
  assert.match(cliResultWithMissingSource.stdout, /consistency=consistent/u);
  assert.match(cliResultWithMissingSource.stdout, /consistencyIssues=0/u);
  assert.match(cliResultWithMissingSource.stdout, /AgentSessionV3PilotRealCorpusBatchPathHealthReport status=issues/u);
  assert.match(cliResultWithMissingSource.stdout, /scope=manifest-source status=missing/u);
  assert.match(cliResultWithMissingSource.stdout, /manifestReport: unavailable/u);
  assert.match(cliResultWithMissingSource.stdout, /indexReport: unavailable/u);

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

  const cliResultWithInvalidShape = runValidatorCli(tempDir);

  assert.equal(
    cliResultWithInvalidShape.status,
    0,
    cliResultWithInvalidShape.stderr || cliResultWithInvalidShape.stdout || cliResultWithInvalidShape.error?.message,
  );
  assert.match(cliResultWithInvalidShape.stdout, /AgentSessionV3PilotRealCorpusBatchIntakeValidator status=not-ready/u);
  assert.match(cliResultWithInvalidShape.stdout, /schemaShape=issues/u);
  assert.match(cliResultWithInvalidShape.stdout, /schemaIssues=1/u);
  assert.match(cliResultWithInvalidShape.stdout, /consistency=consistent/u);
  assert.match(cliResultWithInvalidShape.stdout, /AgentSessionV3PilotRealCorpusBatchSchemaShapeReport status=issues/u);
  assert.match(cliResultWithInvalidShape.stdout, /scope=manifest code=invalid-array/u);
  assert.match(cliResultWithInvalidShape.stdout, /manifestReport: unavailable/u);
  assert.match(cliResultWithInvalidShape.stdout, /indexReport: unavailable/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch intake validator CLI smoke ok');
