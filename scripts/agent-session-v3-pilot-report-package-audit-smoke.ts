import assert from 'node:assert/strict';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { createAgentSessionV3PilotRealCorpusBatchCloseoutAudit } from './agent-session-v3-pilot-real-corpus-batch-closeout-audit.ts';
import { createAgentSessionV3PilotRealCorpusBatchEvidencePackageIndex } from './agent-session-v3-pilot-real-corpus-batch-evidence-package-index.ts';
import { createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport } from './agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts';
import { createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup } from './agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts';
import { createAgentSessionV3PilotRealCorpusBatchSmokeIndex } from './agent-session-v3-pilot-real-corpus-batch-smoke-index.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

function assertIncludes(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function assertInOrder(text: string, first: string, second: string, label: string) {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);

  assert.notEqual(firstIndex, -1, `${label} should include first marker: ${first}`);
  assert.notEqual(secondIndex, -1, `${label} should include second marker: ${second}`);
  assert.ok(firstIndex < secondIndex, `${label} should present ${first} before ${second}`);
}

function assertNoAuthority(text: string, label: string) {
  const observeTool = ['observe', 'windows', 'and', 'apps'].join('_');
  const locateTool = ['locate', 'screen', 'elements'].join('_');
  const executeTool = ['execute', 'desktop', 'sequence'].join('_');
  const fixedDesktopChain = new RegExp(`${observeTool}\\s*->\\s*${locateTool}\\s*->\\s*${executeTool}`, 'iu');

  assert.ok(
    /readyForProductionRuntime=(?:no|false)|production runtime readiness: `no`/u.test(text)
      || /not (?:give|grant|prove).*production (?:authority|readiness)|does not .*grant .*runtime authority/iu.test(text),
    `${label} should keep production readiness false or state a no-authority guardrail.`,
  );
  assert.doesNotMatch(
    text,
    /readyForProductionRuntime=(?:yes|true)|production runtime readiness: `yes`/iu,
    `${label} should not claim production readiness.`,
  );
  assert.doesNotMatch(
    text,
    fixedDesktopChain,
    `${label} should not encode a fixed desktop tool chain.`,
  );
}

function assertNoProductionAuthorityDrift(text: string, label: string) {
  const observeTool = ['observe', 'windows', 'and', 'apps'].join('_');
  const locateTool = ['locate', 'screen', 'elements'].join('_');
  const executeTool = ['execute', 'desktop', 'sequence'].join('_');
  const concreteDesktopToolPattern = new RegExp(
    `\\b(?:${observeTool}|${locateTool}|${executeTool})\\b`,
    'iu',
  );
  const forbiddenPatterns: Array<[RegExp, string]> = [
    [
      /readyForProductionRuntime\s*[:=]\s*`?(?:yes|true)`?/iu,
      'readyForProductionRuntime should not be positive.',
    ],
    [
      /production runtime readiness\s*:\s*`?(?:yes|true)`?/iu,
      'production runtime readiness should not be positive.',
    ],
    [
      /\bproductionReady\s*[:=]\s*`?(?:yes|true)`?/iu,
      'productionReady should not be positive.',
    ],
    [
      /\breadyForRuntime\s*[:=]\s*`?(?:yes|true)`?/iu,
      'readyForRuntime should not be positive.',
    ],
    [
      /\b(?:should|may|can|must)\s+(?:wire|connect)\s+v3\s+into\s+production\b/iu,
      'v3 should not be described as wireable into production.',
    ],
    [
      /\bv3\s+(?:should|may|can|must)\s+replace\s+`?AgentSessionV2`?\b/iu,
      'v3 should not be described as replacing AgentSessionV2.',
    ],
    [
      concreteDesktopToolPattern,
      'docs and reports should not mention concrete desktop tools as an implicit chain.',
    ],
  ];

  for (const [pattern, reason] of forbiddenPatterns) {
    assert.doesNotMatch(text, pattern, `${label}: ${reason}`);
  }
}

function assertGuardrailIncludes(text: string, label: string, fragments: readonly string[]) {
  for (const fragment of fragments) {
    assertIncludes(text, fragment, label);
  }
}

function assertReadinessGateCloseoutText(text: string, label: string) {
  assertIncludes(text, 'intake readiness gate', label);
  assert.ok(
    text.includes('issueCode') || text.includes('issue-code'),
    `${label} should mention readiness gate issue-code contract.`,
  );
  assert.ok(
    text.includes('issueCodeRollup') || text.includes('issue-code rollup'),
    `${label} should mention readiness gate issue-code rollup contract.`,
  );
  assert.ok(
    text.includes('sourceReports') || text.includes('source-report references'),
    `${label} should mention readiness gate source-report references.`,
  );
  assert.ok(
    text.includes('unblockItems') || text.includes('unblock item') || text.includes('manual unblock'),
    `${label} should mention readiness gate manual unblock evidence view.`,
  );
}

function assertFinalFreezeCheckpoint(options: {
  closeout: ReturnType<typeof createAgentSessionV3PilotRealCorpusBatchCloseoutAudit>;
  evidencePackage: ReturnType<typeof createAgentSessionV3PilotRealCorpusBatchEvidencePackageIndex>;
  nextTarget: ReturnType<typeof createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport>;
  packageHealth: ReturnType<typeof createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup>;
  smokeIndex: ReturnType<typeof createAgentSessionV3PilotRealCorpusBatchSmokeIndex>;
}) {
  const {
    closeout,
    evidencePackage,
    nextTarget,
    packageHealth,
    smokeIndex,
  } = options;
  const indexedSmokeNames = new Set(smokeIndex.entries.map((entry) => entry.name));
  const readinessGatePackageEntry = evidencePackage.entries.find((entry) => (
    entry.relativePath === 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts'
  ));

  assert.equal(smokeIndex.entryCount, 91, 'final freeze should keep the current indexed real-corpus-batch smoke count.');
  assert.equal(smokeIndex.missingCount, 0, 'final freeze should have no missing indexed smokes.');
  assert.equal(smokeIndex.unindexedCount, 0, 'final freeze should have no unindexed real-corpus-batch smokes.');
  assert.equal(smokeIndex.groupCounts['cli-contract'], 29, 'final freeze should keep the current CLI contract smoke coverage count.');
  assert.ok(
    indexedSmokeNames.has('agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report-smoke.ts'),
    'final freeze should keep the intake readiness gate smoke indexed.',
  );
  assert.ok(
    indexedSmokeNames.has('agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report-cli-json-contract-smoke.ts'),
    'final freeze should keep the intake readiness gate CLI JSON contract smoke indexed.',
  );

  assert.equal(evidencePackage.status, 'indexed', 'final freeze should keep the evidence package indexed.');
  assert.equal(evidencePackage.packageEntryCount, 28, 'final freeze should keep the current evidence package entry count.');
  assert.equal(evidencePackage.missingPackageEntryCount, 0, 'final freeze should have no missing evidence package entries.');
  assert.equal(evidencePackage.p0IntakeTargetStatusLink.status, 'linked', 'final freeze should keep P0 intake target status linkage linked.');
  assert.deepEqual(evidencePackage.p0IntakeTargetStatusLink.missingSignals, []);
  assert.ok(readinessGatePackageEntry?.present, 'final freeze should keep the intake readiness gate package entry present.');
  assert.ok(
    readinessGatePackageEntry?.boundary.includes('no runtime blocking'),
    'final freeze should keep the intake readiness gate package entry non-blocking.',
  );
  assert.ok(
    readinessGatePackageEntry?.role.includes('validator, field completeness, P0 target, and runbook evidence'),
    'final freeze should keep the intake readiness gate package role tied to evidence sources.',
  );

  assert.equal(closeout.status, 'aligned', 'final freeze should keep closeout aligned.');
  assert.equal(closeout.readyForProductionRuntime, false, 'final freeze should not grant production runtime authority.');
  assert.equal(closeout.smokeIndexEntryCount, smokeIndex.entryCount);
  assert.equal(closeout.cliContractSmokeCount, smokeIndex.groupCounts['cli-contract']);
  assert.equal(closeout.realSampleGapCount, 47, 'final freeze should preserve the current real-sample gap count.');

  assert.equal(packageHealth.status, 'missing-real-evidence', 'final freeze should keep package health blocked on real evidence.');
  assert.equal(packageHealth.packageEntryCount, evidencePackage.packageEntryCount);
  assert.equal(packageHealth.missingPackageEntryCount, 0);
  assert.equal(packageHealth.p0IntakeTargetStatusLinkStatus, 'linked');
  assert.equal(packageHealth.readyForProductionRuntime, false);

  assert.equal(nextTarget.status, 'target-needed');
  assert.equal(nextTarget.nextPriority, 'P0');
  assert.equal(nextTarget.readyForProductionRuntime, false);
}

const {
  planText,
  readinessText,
  runbookText,
  source,
  statusText,
} = readProjectSources({
  planText: 'PROJECT_AGENT_V3_PILOT_PLAN.md',
  readinessText: 'PROJECT_AGENT_V3_PILOT_READINESS_CHECKLIST.md',
  runbookText: 'PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md',
  source: 'scripts/agent-session-v3-pilot-report-package-audit-smoke.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-report-package-audit-smoke.ts',
);
const forbiddenCommandTokens = [
  ['spawn', 'Sync'].join(''),
  ['exec', 'Sync'].join(''),
  ['npm', 'cmd'].join('.'),
  ['create', 'TaskQueue'].join(''),
  ['en', 'queue'].join(''),
];
assert.doesNotMatch(
  source,
  new RegExp(forbiddenCommandTokens.join('|'), 'u'),
  'report package audit smoke should not execute commands or create task queues.',
);

const smokeIndex = createAgentSessionV3PilotRealCorpusBatchSmokeIndex({ projectRoot });
const closeout = createAgentSessionV3PilotRealCorpusBatchCloseoutAudit({ projectRoot });
const evidencePackage = createAgentSessionV3PilotRealCorpusBatchEvidencePackageIndex({ projectRoot });
const packageHealth = createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup({ projectRoot });
const nextTarget = createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport({ projectRoot });

assertFinalFreezeCheckpoint({
  closeout,
  evidencePackage,
  nextTarget,
  packageHealth,
  smokeIndex,
});

assert.equal(smokeIndex.entryCount, 91);
assert.equal(smokeIndex.missingCount, 0);
assert.equal(smokeIndex.unindexedCount, 0);
assert.equal(smokeIndex.groupCounts['cli-contract'], 29);
assert.equal(smokeIndex.groupCounts['intake-readiness-gate'], 1);
assert.equal(closeout.status, 'aligned');
assert.equal(closeout.readyForProductionRuntime, false);
assert.equal(closeout.smokeIndexEntryCount, smokeIndex.entryCount);
assert.equal(closeout.cliContractSmokeCount, smokeIndex.groupCounts['cli-contract']);
assert.equal(closeout.realSampleGapCount, 47);

assert.equal(evidencePackage.status, 'indexed');
assert.equal(evidencePackage.packageEntryCount, 28);
assert.equal(evidencePackage.missingPackageEntryCount, 0);
assert.equal(evidencePackage.p0IntakeTargetStatusLink.status, 'linked');
assert.deepEqual(evidencePackage.p0IntakeTargetStatusLink.missingSignals, []);
assert.equal(evidencePackage.readyForProductionRuntime, false);

assert.equal(packageHealth.status, 'missing-real-evidence');
assert.equal(packageHealth.packageEntryCount, evidencePackage.packageEntryCount);
assert.equal(packageHealth.missingPackageEntryCount, 0);
assert.equal(packageHealth.p0IntakeTargetStatusLinkStatus, 'linked');
assert.equal(packageHealth.readyForProductionRuntime, false);

assert.equal(nextTarget.status, 'target-needed');
assert.equal(nextTarget.nextPriority, 'P0');
assert.equal(nextTarget.readyForProductionRuntime, false);
assert.deepEqual(
  nextTarget.targets
    .filter((target) => target.priority === 'P0')
    .map((target) => target.gapKind),
  [
    'real-production-like-sample',
    'real-exported-corpus',
  ],
);

for (const reportPath of [
  'scripts/agent-session-v3-pilot-real-corpus-batch-closeout-audit.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-evidence-package-index.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts',
]) {
  assert.ok(
    evidencePackage.entries.some((entry) => entry.relativePath === reportPath && entry.present),
    `evidence package should include ${reportPath}`,
  );
}
assert.ok(
  smokeIndex.entries.some((entry) => entry.name === 'agent-session-v3-pilot-real-corpus-batch-package-health-rollup-smoke.ts'),
  'smoke index should include package health rollup coverage without forcing package health into the package it consumes.',
);
assert.ok(
  evidencePackage.entries.some((entry) => (
    entry.relativePath === 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts'
    && entry.present
    && entry.boundary.includes('no runtime blocking')
    && entry.role.includes('validator, field completeness, P0 target, and runbook evidence')
  )),
  'evidence package should preserve the readiness gate report entry and no-runtime-blocking boundary.',
);

assertIncludes(readinessText, '- indexed smoke coverage: 91 indexed, 0 missing, 0 unindexed', 'readiness snapshot');
assertIncludes(readinessText, '- CLI JSON contract coverage: 29 mapped, 0 missing audit mentions', 'readiness snapshot');
assertIncludes(readinessText, '- evidence package index: `indexed`, 28 entries, 0 missing entries', 'readiness snapshot');
assertIncludes(readinessText, '- package health: `missing-real-evidence`', 'readiness snapshot');
assertIncludes(readinessText, '- P0 intake target status linkage: `linked`, 0 missing signals', 'readiness snapshot');
assertIncludes(readinessText, '- remaining real-sample gaps: 47', 'readiness snapshot');
assertIncludes(readinessText, '- current P0 target kinds: `real-production-like-sample`, `real-exported-corpus`', 'readiness snapshot');

assertIncludes(statusText, 'real-production-like-sample` and `real-exported-corpus`', 'status next step');
assertIncludes(planText, 'This should not change runtime decisions or give v3 production authority.', 'v3 pilot plan');
assertIncludes(statusText, 'positive production-authority drift guard', 'status report-package audit guardrail');
assertIncludes(statusText, 'concrete desktop tools as an implicit chain', 'status report-package audit guardrail');
assertIncludes(planText, 'positive production-authority drift protection', 'plan report-package audit guardrail');
assertIncludes(planText, 'v3 replacing `AgentSessionV2` wording', 'plan report-package audit guardrail');
assertIncludes(readinessText, 'positive production-authority drift guard coverage', 'readiness report-package audit guardrail');
assertIncludes(readinessText, 'v3 production wiring wording', 'readiness report-package audit guardrail');
assertIncludes(runbookText, 'manual prioritization aids, not a runtime action order', 'real corpus batch runbook');
assertReadinessGateCloseoutText(statusText, 'status readiness-gate closeout');
assertReadinessGateCloseoutText(planText, 'plan readiness-gate closeout');
assertReadinessGateCloseoutText(readinessText, 'readiness checklist readiness-gate closeout');
assertReadinessGateCloseoutText(runbookText, 'runbook readiness-gate closeout');
assertIncludes(
  runbookText,
  'not as runtime authority, task routing, prioritization policy, report invocation order, or an action order',
  'runbook readiness-gate metadata boundary',
);
assertIncludes(
  runbookText,
  'The handoff checks below are optional reviewer aids, not a fixed execution order, production readiness gate, or automated recovery path.',
  'runbook handoff optional checks boundary',
);
assertIncludes(
  runbookText,
  'Run only the checks that match the evidence you already generated and the question a reviewer needs answered.',
  'runbook handoff optional checks boundary',
);

assertInOrder(
  statusText,
  'Use the final gap report first',
  'Keep all v3 pilot output debug-only',
  'status next-step section',
);
assertInOrder(
  runbookText,
  'agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts',
  'agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts',
  'real corpus batch runbook',
);
assertInOrder(
  runbookText,
  'agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts',
  'agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts',
  'real corpus batch runbook',
);

for (const [label, text] of [
  ['status', statusText],
  ['plan', planText],
  ['readiness', readinessText],
  ['runbook', runbookText],
  ['closeout report', closeout.reportText],
  ['evidence package report', evidencePackage.reportText],
  ['package health report', packageHealth.reportText],
  ['next target report', nextTarget.reportText],
] as const) {
  assertNoAuthority(text, label);
  assertNoProductionAuthorityDrift(text, label);
}

for (const [label, guardrail] of [
  ['closeout guardrail', closeout.guardrail],
  ['evidence package guardrail', evidencePackage.guardrail],
  ['package health guardrail', packageHealth.guardrail],
  ['next target guardrail', nextTarget.guardrail],
] as const) {
  assertGuardrailIncludes(guardrail, label, [
    'collect samples',
    'choose thresholds',
    'route permissions',
    'execute tools',
    'decide recovery',
    'grant runtime authority',
  ]);
}

console.log('agent session v3 pilot report package audit smoke ok');
