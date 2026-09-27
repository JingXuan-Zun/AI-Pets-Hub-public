import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport } from './agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts',
});

assert.match(
  source,
  /export async function runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport/u,
  'intake readiness gate report should expose a caller-owned report builder.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts',
);
assert.doesNotMatch(
  source,
  /spawnSync|execSync|npm\.cmd|writeFile|mkdir|mkdtemp|createTaskQueue|enqueue/u,
  'intake readiness gate report should not execute commands, write files, create directories, or create queues.',
);

const noInput = await runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport({
  projectRoot,
});

assert.equal(noInput.kind, 'agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report');
assert.equal(noInput.version, 1);
assert.equal(noInput.status, 'no-intake-dirs');
assert.equal(noInput.intakeCount, 0);
assert.deepEqual(noInput.statusCounts, {
  blocked: 0,
  'ready-for-manual-review': 0,
  'review-needed': 0,
});
assert.equal(noInput.readyForProductionRuntime, false);
assert.deepEqual(noInput.issueCodeRollup, []);
assert.deepEqual(noInput.unblockItems, []);
assert.deepEqual(noInput.unblockRollup, []);
assert.match(noInput.reportText, /intakeReadinessGateEntries: none/u);
assert.match(noInput.reportText, /issueCodeRollup: none/u);
assert.match(noInput.reportText, /unblockRollup: none/u);
assert.match(noInput.reportText, /unblockItems: none/u);
assert.match(noInput.guardrail, /explicitly supplied --dir/u);
assert.match(noInput.guardrail, /block runtime execution/u);
assert.match(noInput.guardrail, /grant runtime authority/u);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-intake-readiness-gate-'));
try {
  const starterDir = path.join(tempDir, 'starter-intake');
  await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: starterDir,
    prettyJson: true,
  });
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: path.join(tempDir, 'example'),
    prettyJson: true,
  });
  const readyDir = example.intakeDirs.ready;

  const starterOnly = await runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport({
    intakeDirs: [starterDir],
    prettyJson: true,
    projectRoot,
  });

  assert.equal(starterOnly.status, 'blocked');
  assert.equal(starterOnly.intakeCount, 1);
  assert.equal(starterOnly.blockedCount, 1);
  assert.equal(starterOnly.reviewNeededCount, 0);
  assert.equal(starterOnly.readyForManualReviewCount, 0);
  assert.equal(starterOnly.entries[0]?.validatorStatus, 'not-ready');
  assert.equal(starterOnly.entries[0]?.fieldCompletenessStatus, 'open-fields');
  assert.equal(starterOnly.entries[0]?.p0EntryStatus, 'blocked');
  assert.equal(starterOnly.entries[0]?.runbookStatus, 'blocked');
  assert.equal(starterOnly.entries[0]?.p0SignalAttributions.length, 2);
  assert.deepEqual(
    starterOnly.entries[0]?.blockerItems.map((item) => item.issueCode).sort(),
    [
      'field-completeness-open-fields',
      'p0-entry-blocked',
      'runbook-blocked',
      'validator-not-ready',
    ],
  );
  assert.deepEqual(
    starterOnly.entries[0]?.reviewItems.map((item) => item.issueCode).sort(),
    [
      'p0-target-missing',
      'p0-target-missing',
    ],
  );
  assert.deepEqual(
    starterOnly.entries[0]?.blockerItems.map((item) => [item.issueCode, item.sourceReports]).sort(),
    [
      [
        'field-completeness-open-fields',
        ['scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts'],
      ],
      [
        'p0-entry-blocked',
        ['scripts/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts'],
      ],
      [
        'runbook-blocked',
        ['scripts/agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts'],
      ],
      [
        'validator-not-ready',
        ['scripts/agent-session-v3-pilot-real-corpus-batch-intake-validator.ts'],
      ],
    ].sort(),
  );
  assert.ok(
    starterOnly.entries[0]?.reviewItems.every((item) => item.sourceReports.includes('scripts/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts')),
    'starter gate review items should preserve P0 target source-report references.',
  );
  assert.deepEqual(
    starterOnly.issueCodeRollup.map((entry) => [
      entry.severity,
      entry.kind,
      entry.issueCode,
      entry.itemCount,
      entry.affectedIntakeCount,
    ]),
    [
      ['blocked', 'field-completeness', 'field-completeness-open-fields', 1, 1],
      ['blocked', 'p0-target', 'p0-entry-blocked', 1, 1],
      ['blocked', 'runbook-completion', 'runbook-blocked', 1, 1],
      ['blocked', 'validator', 'validator-not-ready', 1, 1],
      ['review-needed', 'p0-target', 'p0-target-missing', 2, 1],
    ],
  );
  assert.deepEqual(
    starterOnly.unblockRollup.map((entry) => [
      entry.severity,
      entry.category,
      entry.itemCount,
      entry.affectedIntakeCount,
    ]),
    [
      ['blocked', 'fill-intake-fields', 2, 1],
      ['blocked', 'review-p0-targets', 1, 1],
      ['blocked', 'run-validator', 1, 1],
      ['review-needed', 'review-p0-targets', 2, 1],
    ],
  );
  assert.deepEqual(
    starterOnly.unblockItems.map((item) => `${item.severity}:${item.category}:${item.issueCodes.join(',')}`).sort(),
    [
      'blocked:fill-intake-fields:field-completeness-open-fields',
      'blocked:fill-intake-fields:runbook-blocked',
      'blocked:review-p0-targets:p0-entry-blocked',
      'blocked:run-validator:validator-not-ready',
      'review-needed:review-p0-targets:p0-target-missing',
      'review-needed:review-p0-targets:p0-target-missing',
    ].sort(),
  );
  assert.ok(
    starterOnly.unblockItems.every((item) => item.sourceReports.length > 0 && item.evidence.length > 0),
    'unblock items should keep source-report and evidence references.',
  );
  assert.ok(
    starterOnly.issueCodeRollup.every((entry) => entry.intakeDirs.length === entry.affectedIntakeCount),
    'issueCode rollup should report affected intake counts from unique intake directories.',
  );
  assert.deepEqual(
    starterOnly.entries[0]?.p0SignalAttributions.map((attribution) => `${attribution.gapKind}:${attribution.status}:${attribution.supportsTarget ? 'yes' : 'no'}`),
    [
      'real-production-like-sample:missing:no',
      'real-exported-corpus:missing:no',
    ],
  );
  assert.ok(
    starterOnly.entries[0]?.blockerItems.some((item) => item.kind === 'validator'),
    'starter gate should surface validator blocker evidence.',
  );
  assert.ok(
    starterOnly.entries[0]?.blockerItems.some((item) => item.kind === 'field-completeness'),
    'starter gate should surface field completeness blocker evidence.',
  );
  assert.ok(
    starterOnly.entries[0]?.blockerItems.some((item) => item.kind === 'p0-target'),
    'starter gate should surface P0 blocker evidence.',
  );
  assert.ok(
    starterOnly.entries[0]?.blockerItems.some((item) => item.kind === 'runbook-completion'),
    'starter gate should surface runbook blocker evidence.',
  );
  assert.match(starterOnly.reportText, /status=blocked/u);
  assert.match(starterOnly.reportText, /issueCodeRollup:/u);
  assert.match(starterOnly.reportText, /unblockRollup:/u);
  assert.match(starterOnly.reportText, /unblockItems:/u);
  assert.match(starterOnly.reportText, /category=fill-intake-fields/u);
  assert.match(starterOnly.reportText, /category=run-validator/u);
  assert.match(starterOnly.reportText, /category=review-p0-targets/u);
  assert.match(starterOnly.reportText, /issueCode=p0-target-missing items=2 intakes=1/u);
  assert.match(starterOnly.reportText, /issueCode=validator-not-ready/u);
  assert.match(starterOnly.reportText, /issueCode=p0-target-missing/u);
  assert.match(starterOnly.reportText, /sourceReports=scripts\/agent-session-v3-pilot-real-corpus-batch-intake-validator\.ts/u);
  assert.match(starterOnly.reportText, /sourceReports=scripts\/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report\.ts/u);
  assert.match(starterOnly.reportText, /p0Attribution gapKind=real-exported-corpus perIntakeStatus=missing/u);
  assert.match(starterOnly.reportText, /P0 target real-exported-corpus per-intake status=missing/u);
  assert.match(starterOnly.reportText, /readyForProductionRuntime=no/u);

  const readyOnly = await runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport({
    includeJsonText: true,
    intakeDirs: [readyDir],
    prettyJson: true,
    projectRoot,
  });

  assert.equal(readyOnly.status, 'blocked');
  assert.equal(readyOnly.intakeCount, 1);
  assert.equal(readyOnly.blockedCount, 1);
  assert.equal(readyOnly.reviewNeededCount, 0);
  assert.equal(readyOnly.readyForManualReviewCount, 0);
  assert.equal(readyOnly.entries[0]?.validatorStatus, 'ready');
  assert.equal(readyOnly.entries[0]?.fieldCompletenessStatus, 'complete');
  assert.equal(readyOnly.entries[0]?.p0EntryStatus, 'blocked');
  assert.equal(readyOnly.entries[0]?.runbookStatus, 'ready-for-manual-review');
  assert.deepEqual(
    readyOnly.entries[0]?.blockerItems.map((item) => item.issueCode).sort(),
    [
      'p0-entry-blocked',
      'p0-target-blocked',
    ],
  );
  assert.deepEqual(
    readyOnly.entries[0]?.reviewItems.map((item) => item.issueCode),
    ['p0-target-missing'],
  );
  assert.deepEqual(
    readyOnly.issueCodeRollup.map((entry) => [
      entry.severity,
      entry.kind,
      entry.issueCode,
      entry.itemCount,
      entry.affectedIntakeCount,
    ]),
    [
      ['blocked', 'p0-target', 'p0-entry-blocked', 1, 1],
      ['blocked', 'p0-target', 'p0-target-blocked', 1, 1],
      ['review-needed', 'p0-target', 'p0-target-missing', 1, 1],
    ],
  );
  assert.deepEqual(
    readyOnly.unblockRollup.map((entry) => [
      entry.severity,
      entry.category,
      entry.itemCount,
      entry.affectedIntakeCount,
    ]),
    [
      ['blocked', 'review-p0-targets', 2, 1],
      ['review-needed', 'review-p0-targets', 1, 1],
    ],
  );
  assert.deepEqual(
    readyOnly.unblockItems.map((item) => `${item.severity}:${item.category}:${item.issueCodes.join(',')}`).sort(),
    [
      'blocked:review-p0-targets:p0-entry-blocked',
      'blocked:review-p0-targets:p0-target-blocked',
      'review-needed:review-p0-targets:p0-target-missing',
    ].sort(),
  );
  assert.deepEqual(
    readyOnly.entries[0]?.p0SignalAttributions.map((attribution) => `${attribution.gapKind}:${attribution.status}:${attribution.supportsTarget ? 'yes' : 'no'}`),
    [
      'real-production-like-sample:blocked:yes',
      'real-exported-corpus:missing:no',
    ],
  );
  assert.equal(
    readyOnly.p0TargetSignals.find((signal) => signal.gapKind === 'real-production-like-sample')?.status,
    'blocked',
  );
  assert.equal(
    readyOnly.p0TargetSignals.find((signal) => signal.gapKind === 'real-exported-corpus')?.status,
    'missing',
  );
  assert.ok(readyOnly.jsonText);
  assert.deepEqual(JSON.parse(readyOnly.jsonText), {
    ...readyOnly,
    jsonText: null,
  });

  const mixedInputs = await runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport({
    intakeDirs: [
      starterDir,
      readyDir,
    ],
    prettyJson: true,
    projectRoot,
  });

  assert.equal(mixedInputs.status, 'blocked');
  assert.equal(mixedInputs.intakeCount, 2);
  assert.equal(mixedInputs.blockedCount, 2);
  assert.equal(mixedInputs.readyForManualReviewCount, 0);
  assert.equal(mixedInputs.entries[0]?.p0SignalAttributions.length, 2);
  assert.equal(mixedInputs.entries[1]?.p0SignalAttributions.length, 2);
  assert.ok(
    mixedInputs.entries[0]?.blockerItems.every((item) => typeof item.issueCode === 'string' && item.issueCode.length > 0),
    'blocked mixed entry should expose stable blocker issue codes.',
  );
  assert.ok(
    mixedInputs.entries[0]?.blockerItems.every((item) => item.sourceReports.length > 0),
    'blocked mixed entry should expose source-report references for every blocker.',
  );
  assert.deepEqual(mixedInputs.statusCounts, {
    blocked: 2,
    'ready-for-manual-review': 0,
    'review-needed': 0,
  });
  assert.deepEqual(
    mixedInputs.issueCodeRollup.find((entry) => entry.issueCode === 'p0-target-missing'),
    {
      affectedIntakeCount: 2,
      intakeDirs: [readyDir, starterDir].sort(),
      issueCode: 'p0-target-missing',
      itemCount: 3,
      kind: 'p0-target',
      severity: 'review-needed',
    },
  );
  assert.ok(
    mixedInputs.unblockRollup.some((entry) => entry.category === 'fill-intake-fields' && entry.severity === 'blocked'),
    'mixed gate should preserve field-filling unblock rollup.',
  );
  assert.ok(
    mixedInputs.unblockRollup.some((entry) => entry.category === 'review-p0-targets'),
    'mixed gate should preserve P0 unblock rollup.',
  );
  assert.match(mixedInputs.summaryText, /blocked=2/u);
  assert.match(mixedInputs.summaryText, /readyForManualReview=0/u);
  assert.match(mixedInputs.reportText, /gateStatusCounts:/u);
  assert.match(mixedInputs.reportText, /intakeReadinessGateEntries:/u);
  assert.match(mixedInputs.guardrail, /does not discover directories/u);
  assert.match(mixedInputs.guardrail, /execute tools/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch intake readiness gate report smoke ok');
