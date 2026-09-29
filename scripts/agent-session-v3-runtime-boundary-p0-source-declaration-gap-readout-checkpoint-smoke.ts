import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit } from './agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport } from './agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight } from './agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type P0SourceDeclarationGapReadoutInput =
  | 'field-completeness-audit'
  | 'p0-intake-target-status-report'
  | 'readiness-rollup-example-fixture'
  | 'real-corpus-runbook'
  | 'runbook-completion-report'
  | 'runtime-boundary-contract'
  | 'source-declaration-preflight';

type P0SourceDeclarationGapReadoutSignal =
  | 'source-declaration-contract-distinguishes-sample-source'
  | 'rehearsal-fixture-remains-non-real-exported'
  | 'production-like-source-kind-is-not-real-exported-corpus'
  | 'real-exported-p0-requires-real-exported-evidence'
  | 'p0-status-and-closeout-preserve-source-gap'
  | 'source-gap-readout-remains-non-production';

type P0SourceDeclarationGapReadoutGuard =
  | 'explicit-dir-only'
  | 'source-declaration-readout-only'
  | 'no-sample-collection'
  | 'no-auto-fill'
  | 'no-directory-discovery'
  | 'no-runtime-action-order'
  | 'no-production-readiness'
  | 'no-runtime-authority';

interface P0SourceDeclarationGapReadoutRow {
  guards: readonly P0SourceDeclarationGapReadoutGuard[];
  inputs: readonly P0SourceDeclarationGapReadoutInput[];
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  readoutStatus: 'gap-preserved-and-non-authoritative';
  signal: P0SourceDeclarationGapReadoutSignal;
}

interface P0SourceDeclarationGapReadoutCheckpoint {
  gate: 'p0-source-declaration-gap-readout';
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly P0SourceDeclarationGapReadoutRow[];
  summaryDecision: 'p0-source-declaration-gap-readout-real-exported-still-required';
}

const sharedInputs = [
  'source-declaration-preflight',
  'p0-intake-target-status-report',
  'readiness-rollup-example-fixture',
  'field-completeness-audit',
  'runbook-completion-report',
  'real-corpus-runbook',
  'runtime-boundary-contract',
] as const satisfies readonly P0SourceDeclarationGapReadoutInput[];

const p0SourceDeclarationGapReadoutCheckpoint = {
  gate: 'p0-source-declaration-gap-readout',
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      guards: [
        'explicit-dir-only',
        'source-declaration-readout-only',
        'no-directory-discovery',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      readoutStatus: 'gap-preserved-and-non-authoritative',
      signal: 'source-declaration-contract-distinguishes-sample-source',
    },
    {
      guards: [
        'explicit-dir-only',
        'source-declaration-readout-only',
        'no-sample-collection',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      readoutStatus: 'gap-preserved-and-non-authoritative',
      signal: 'rehearsal-fixture-remains-non-real-exported',
    },
    {
      guards: [
        'source-declaration-readout-only',
        'no-production-readiness',
        'no-runtime-action-order',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      readoutStatus: 'gap-preserved-and-non-authoritative',
      signal: 'production-like-source-kind-is-not-real-exported-corpus',
    },
    {
      guards: [
        'explicit-dir-only',
        'source-declaration-readout-only',
        'no-auto-fill',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      readoutStatus: 'gap-preserved-and-non-authoritative',
      signal: 'real-exported-p0-requires-real-exported-evidence',
    },
    {
      guards: [
        'source-declaration-readout-only',
        'no-production-readiness',
        'no-runtime-authority',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      readoutStatus: 'gap-preserved-and-non-authoritative',
      signal: 'p0-status-and-closeout-preserve-source-gap',
    },
    {
      guards: [
        'no-sample-collection',
        'no-runtime-action-order',
        'no-production-readiness',
        'no-runtime-authority',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      readoutStatus: 'gap-preserved-and-non-authoritative',
      signal: 'source-gap-readout-remains-non-production',
    },
  ],
  summaryDecision: 'p0-source-declaration-gap-readout-real-exported-still-required',
} as const satisfies P0SourceDeclarationGapReadoutCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: P0SourceDeclarationGapReadoutSignal) {
  const row = p0SourceDeclarationGapReadoutCheckpoint.rows.find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the P0 source-declaration gap readout checkpoint.`);
  return row;
}

function rowsForGuard(guard: P0SourceDeclarationGapReadoutGuard) {
  return p0SourceDeclarationGapReadoutCheckpoint.rows.filter((row) => row.guards.includes(guard));
}

function fillSourceDeclarationSampleNote(
  noteText: string,
  options: {
    sampleSource: string;
    sampleSourceStatus: string;
  },
) {
  return noteText
    .replace(
      'replace-with-sample-source-real-exported-rehearsal-or-unknown',
      options.sampleSource,
    )
    .replace('replace-with-sample-source-status', options.sampleSourceStatus);
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const runbookText = readProjectFile('PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md');
const sourceDeclarationSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts',
);
const p0TargetStatusSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts',
);
const explicitDirPostFillSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-explicit-dir-post-fill-interpretation-readiness-consistency-checkpoint-smoke.ts',
);
const p0SourceAlignmentSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-p0-real-evidence-intake-source-alignment-checkpoint-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();

assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(p0SourceDeclarationGapReadoutCheckpoint.productionAuthority, false);
assert.equal(p0SourceDeclarationGapReadoutCheckpoint.productionReady, false);
assert.equal(p0SourceDeclarationGapReadoutCheckpoint.positiveGateAllowed, false);
assert.equal(p0SourceDeclarationGapReadoutCheckpoint.isExecutionOrder, false);
assert.equal(p0SourceDeclarationGapReadoutCheckpoint.isImplementationPlan, false);
assert.equal(p0SourceDeclarationGapReadoutCheckpoint.isProductionWiringPlan, false);
assert.equal(
  p0SourceDeclarationGapReadoutCheckpoint.summaryDecision,
  'p0-source-declaration-gap-readout-real-exported-still-required',
);

assert.deepEqual(
  p0SourceDeclarationGapReadoutCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'p0-status-and-closeout-preserve-source-gap',
    'production-like-source-kind-is-not-real-exported-corpus',
    'real-exported-p0-requires-real-exported-evidence',
    'rehearsal-fixture-remains-non-real-exported',
    'source-declaration-contract-distinguishes-sample-source',
    'source-gap-readout-remains-non-production',
  ],
);

for (const row of p0SourceDeclarationGapReadoutCheckpoint.rows) {
  assert.equal(row.readoutStatus, 'gap-preserved-and-non-authoritative');
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.isProductionWiringPlan, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.deepEqual(row.inputs, sharedInputs);
  assert.ok(row.guards.length > 0);
}

assert.ok(rowsForGuard('explicit-dir-only').length >= 3);
assert.ok(rowsForGuard('source-declaration-readout-only').length >= 5);
assert.ok(rowsForGuard('no-sample-collection').length >= 2);
assert.ok(rowsForGuard('no-auto-fill').length >= 1);
assert.ok(rowsForGuard('no-directory-discovery').length >= 1);
assert.ok(rowsForGuard('no-runtime-action-order').length >= 2);
assert.ok(rowsForGuard('no-production-readiness').length >= 3);
assert.ok(rowsForGuard('no-runtime-authority').length >= 2);

assert.ok(rowForSignal('source-declaration-contract-distinguishes-sample-source').guards.includes('explicit-dir-only'));
assert.ok(rowForSignal('rehearsal-fixture-remains-non-real-exported').guards.includes('no-sample-collection'));
assert.ok(rowForSignal('production-like-source-kind-is-not-real-exported-corpus').guards.includes('no-runtime-action-order'));
assert.ok(rowForSignal('real-exported-p0-requires-real-exported-evidence').guards.includes('no-auto-fill'));
assert.ok(rowForSignal('p0-status-and-closeout-preserve-source-gap').guards.includes('no-runtime-authority'));
assert.ok(rowForSignal('source-gap-readout-remains-non-production').guards.includes('no-production-readiness'));

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-p0-source-declaration-gap-readout-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: path.join(tempDir, 'example'),
    prettyJson: true,
  });
  const readyIntakeDir = example.intakeDirs.ready;

  const [
    rehearsalExpectedRealExported,
    rehearsalExpectedRehearsal,
    p0TargetStatus,
    fieldCompleteness,
    runbookCompletion,
  ] = await Promise.all([
    runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight({
      expectedSampleSource: 'real-exported',
      intakeDir: readyIntakeDir,
      prettyJson: true,
    }),
    runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight({
      expectedSampleSource: 'rehearsal',
      intakeDir: readyIntakeDir,
      prettyJson: true,
    }),
    runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport({
      intakeDirs: [readyIntakeDir],
      prettyJson: true,
      projectRoot,
    }),
    runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit({
      intakeDirs: [readyIntakeDir],
      prettyJson: true,
      projectRoot,
    }),
    runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport({
      intakeDirs: [readyIntakeDir],
      prettyJson: true,
      projectRoot,
    }),
  ]);

  assert.equal(rehearsalExpectedRealExported.status, 'blocked');
  assert.equal(rehearsalExpectedRealExported.readyForProductionRuntime, false);
  assert.equal(rehearsalExpectedRealExported.sampleSource, 'rehearsal');
  assert.equal(rehearsalExpectedRealExported.sampleSourceStatus, 'synthetic-rehearsal');
  assert.ok(
    rehearsalExpectedRealExported.issues.some((issue) => issue.code === 'expected-source-mismatch'),
    'rehearsal source declaration should be blocked when real-exported is expected.',
  );

  assert.equal(rehearsalExpectedRehearsal.status, 'consistent');
  assert.equal(rehearsalExpectedRehearsal.readyForProductionRuntime, false);
  assert.equal(rehearsalExpectedRehearsal.sampleSource, 'rehearsal');
  assert.equal(rehearsalExpectedRehearsal.sampleSourceStatus, 'synthetic-rehearsal');

  assert.equal(fieldCompleteness.status, 'complete');
  assert.equal(fieldCompleteness.readyForProductionRuntime, false);
  assert.equal(fieldCompleteness.openFieldCount, 0);
  assert.equal(fieldCompleteness.missingFieldCount, 0);
  assert.equal(fieldCompleteness.placeholderFieldCount, 0);

  assert.equal(runbookCompletion.status, 'ready-for-manual-review');
  assert.equal(runbookCompletion.readyForProductionRuntime, false);
  assert.equal(runbookCompletion.blockedCriteriaCount, 0);
  assert.equal(runbookCompletion.reviewCriteriaCount, 0);
  assert.equal(runbookCompletion.readyCriteriaCount, 6);

  assert.equal(p0TargetStatus.status, 'blocked');
  assert.equal(p0TargetStatus.readyForProductionRuntime, false);
  assert.equal(p0TargetStatus.entries[0]?.hasProductionLikeSourceKind, true);
  assert.equal(p0TargetStatus.entries[0]?.sourceDeclarationStatus, 'blocked');
  assert.equal(p0TargetStatus.entries[0]?.sourceSampleSource, 'rehearsal');
  assert.equal(p0TargetStatus.entries[0]?.sourceSampleSourceStatus, 'synthetic-rehearsal');
  assert.deepEqual(
    p0TargetStatus.p0TargetSignals.map((signal) => `${signal.gapKind}:${signal.status}`).sort(),
    [
      'real-exported-corpus:missing',
      'real-production-like-sample:blocked',
    ],
  );
  assert.equal(
    p0TargetStatus.p0TargetSignals.find((signal) => signal.gapKind === 'real-exported-corpus')?.missingReason,
    'no supplied intake has real-exported sample source evidence',
  );
  assert.ok(
    p0TargetStatus.p0TargetSignals
      .find((signal) => signal.gapKind === 'real-production-like-sample')
      ?.evidenceReasons.some((reason) => reason.includes('production-like source kind present')),
    'production-like source-kind evidence should be visible but should not satisfy real-exported-corpus.',
  );

  const realExportedIntakeDir = path.join(tempDir, 'real-exported-source-declaration-intake');
  const realExportedTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: realExportedIntakeDir,
    prettyJson: true,
  });

  if (!realExportedTemplate.notePath) {
    throw new Error('Expected real-exported source declaration template note path.');
  }

  await writeFile(
    realExportedTemplate.notePath,
    fillSourceDeclarationSampleNote(realExportedTemplate.noteText, {
      sampleSource: 'real-exported',
      sampleSourceStatus: 'real-exported-evidence',
    }),
    'utf8',
  );

  const realExportedSourceDeclaration = await runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight({
    expectedSampleSource: 'real-exported',
    intakeDir: realExportedIntakeDir,
    prettyJson: true,
  });

  assert.equal(realExportedSourceDeclaration.status, 'consistent');
  assert.equal(realExportedSourceDeclaration.readyForProductionRuntime, false);
  assert.equal(realExportedSourceDeclaration.sampleSource, 'real-exported');
  assert.equal(realExportedSourceDeclaration.sampleSourceStatus, 'real-exported-evidence');
  assert.equal(realExportedSourceDeclaration.issueCount, 0);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

assert.match(sourceDeclarationSource, /sampleSource === 'real-exported'/u);
assert.match(sourceDeclarationSource, /return 'real-exported-evidence'/u);
assert.match(sourceDeclarationSource, /sampleSource === 'rehearsal'/u);
assert.match(sourceDeclarationSource, /return 'synthetic-rehearsal'/u);
assert.match(sourceDeclarationSource, /sampleSource=unknown leaves the real sample declaration unresolved/u);
assert.match(p0TargetStatusSource, /entry\.hasProductionLikeSourceKind/u);
assert.match(p0TargetStatusSource, /entry\.sourceSampleSource === 'real-exported'/u);
assert.match(p0TargetStatusSource, /entry\.sourceSampleSourceStatus === 'real-exported-evidence'/u);
assertContains(explicitDirPostFillSmokeSource, 'p0-real-exported-remains-missing-for-rehearsal-fixture', 'explicit-dir post-fill smoke');
assertContains(p0SourceAlignmentSmokeSource, 'rehearsal-does-not-satisfy-real-exported', 'P0 source alignment smoke');

assertContains(runbookText, 'Use `--expected-source real-exported` only when the intake is meant to point at caller-owned real exported samples.', 'runbook');
assertContains(runbookText, 'Use `--sample-source real-exported` only when the intake directories point at caller-owned real exported samples.', 'runbook');
assertContains(runbookText, 'If you are checking a generated rehearsal bundle instead of caller-owned real exported samples', 'runbook');
assertContains(runbookText, 'manual prioritization aids, not a runtime action order', 'runbook');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');
assertContains(auditText, 'P0 Source-Declaration Gap Readout Checkpoint Status', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary P0 source-declaration gap readout checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-p0-source-declaration-gap-readout-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(p0SourceDeclarationGapReadoutCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'P0 source-declaration gap readout checkpoint must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|isExecutionOrder":true/u,
  'P0 source-declaration gap readout checkpoint must not become an implementation plan or execution order.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /collectSamples|createIntakeDirectory|adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'P0 source-declaration gap readout checkpoint should not collect samples or promote contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'P0 source-declaration gap readout checkpoint should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'P0 source-declaration gap readout checkpoint should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|fallback chain|requiredReportOrder|implementationQueue|orderedSteps|smokeExecutionQueue/iu,
  'P0 source-declaration gap readout checkpoint should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'P0 source-declaration gap readout checkpoint must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'P0 source-declaration gap readout checkpoint must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary P0 source-declaration gap readout checkpoint smoke ok');
