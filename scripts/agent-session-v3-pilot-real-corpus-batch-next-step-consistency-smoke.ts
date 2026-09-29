import assert from 'node:assert/strict';
import { createAgentSessionV3PilotRealCorpusBatchEvidencePackageIndex } from './agent-session-v3-pilot-real-corpus-batch-evidence-package-index.ts';
import { createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport } from './agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

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

function assertNoShellOrQueueSource(source: string) {
  const forbiddenTokens = [
    'spawn' + 'Sync',
    'exec' + 'Sync',
    'npm' + '.cmd',
    'create' + 'TaskQueue',
    'en' + 'queue',
    'sample' + ' collector',
    'handoff' + ' bundle creation',
  ];

  for (const token of forbiddenTokens) {
    assert.equal(
      source.toLowerCase().includes(token.toLowerCase()),
      false,
      `next-step consistency smoke should stay read-only: ${token}`,
    );
  }
}

function assertCurrentProgressEstimateIncludesV3(text: string) {
  assertIncludes(text, '- Overall practical runtime including v3: about 99.2%', 'status current estimate');
  assertIncludes(text, '- Preflight/pilot-inclusive legacy view: about 99.2%', 'status current estimate');
  assertIncludes(text, '- v1.5: about 99%', 'status current estimate');
  assertIncludes(text, '- v2: about 99%', 'status current estimate');
  assertIncludes(text, '- v2.5: about 98.9%', 'status current estimate');
  assertIncludes(text, '- v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');
  assertIncludes(text, '- v3 user-experience runtime: about 99.6%', 'status current estimate');
  assertIncludes(text, '- v3 pilot/evidence track: about 99.999%+', 'status current estimate');
  assertIncludes(
    text,
    'The practical v3-inclusive overall now counts the user-experience v3 runtime in the denominator instead of using the preflight/pilot number.',
    'status current estimate',
  );
  assertIncludes(
    text,
    '(v1.5 99 + v2 99 + v2.5 98.9 + v3 user-experience runtime 99.6) / 4 = about 99.2.',
    'status current estimate',
  );
  assertIncludes(
    text,
    'The separate v3 user-experience runtime estimate tracks production-like user-visible runtime work, not preflight paperwork.',
    'status current estimate',
  );
  assertInOrder(
    text,
    '- Overall practical runtime including v3: about 99.2%',
    '- v3 full runtime preflight/pilot: about 99.2%',
    'status current estimate',
  );
  assertInOrder(
    text,
    '- v3 user-experience runtime: about 99.6%',
    '- v3 pilot/evidence track: about 99.999%+',
    'status current estimate',
  );
}

function assertStatusNextStepNumbering(text: string) {
  const sectionStart = text.indexOf('## Next Recommended Step');
  assert.notEqual(sectionStart, -1, 'status should include a next recommended step section.');

  const sectionEnd = text.indexOf('The execution side of `Tool Execution Transaction v1`', sectionStart);
  assert.notEqual(sectionEnd, -1, 'status next-step section should end before the execution-side summary.');

  const section = text.slice(sectionStart, sectionEnd);
  const sections = section
    .split(/\r?\n(?=[A-Z][^\n]+:\r?\n)/u)
    .map((block) => block.trim())
    .filter(Boolean);

  let numberedBlockCount = 0;

  for (const block of sections) {
    const numbers = block
    .split(/\r?\n/u)
    .map((line) => line.match(/^(\d+)\. /u)?.[1])
    .filter((value): value is string => Boolean(value))
    .map((value) => Number(value));

    if (numbers.length === 0) {
      continue;
    }

    numberedBlockCount += 1;
    numbers.forEach((value, index) => {
      assert.equal(
        value,
        index + 1,
        `status next-step numbering should be continuous within block ${numberedBlockCount} at item ${index + 1}.`,
      );
    });
  }

  assert.ok(numberedBlockCount >= 2, 'status next-step section should include runtime-boundary and evidence numbered blocks.');
}

function assertObservabilityMapNotLinearChain(text: string, label: string) {
  assertIncludes(text, 'observability map', label);
  assert.doesNotMatch(
    text,
    /-> optional caller-owned [^\n]+(?:\r?\n\s*-> optional caller-owned [^\n]+){2,}/iu,
    `${label} should not present optional caller-owned reports as a long linear chain.`,
  );
}

const source = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-next-step-consistency-smoke.ts',
);

assertNoShellOrQueueSource(source);

const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const planText = readProjectFile('PROJECT_AGENT_V3_PILOT_PLAN.md');
const readinessText = readProjectFile('PROJECT_AGENT_V3_PILOT_READINESS_CHECKLIST.md');
const runbookText = readProjectFile('PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md');
const packageIndex = createAgentSessionV3PilotRealCorpusBatchEvidencePackageIndex({
  projectRoot,
});
const nextTarget = createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport({
  projectRoot,
});

assertCurrentProgressEstimateIncludesV3(statusText);
assertStatusNextStepNumbering(statusText);
assertObservabilityMapNotLinearChain(planText, 'v3 pilot plan observability map');
assertObservabilityMapNotLinearChain(readinessText, 'readiness checklist observability map');

const manualReportOrder = [
  'agent-session-v3-pilot-real-corpus-batch-final-gap-report.ts',
  'agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts',
  'agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts',
  'agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts',
  'agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts',
  'agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts',
  'agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts',
  'agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts',
  'agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup.ts',
  'agent-session-v3-pilot-real-corpus-batch-gap-action-checklist.ts',
];

assert.equal(packageIndex.status, 'indexed');
assert.equal(packageIndex.missingPackageEntryCount, 0);
assert.equal(packageIndex.readyForProductionRuntime, false);
assert.equal(nextTarget.status, 'target-needed');
assert.equal(nextTarget.nextPriority, 'P0');
assert.deepEqual(
  nextTarget.targets
    .filter((target) => target.priority === 'P0')
    .map((target) => target.gapKind),
  [
    'real-production-like-sample',
    'real-exported-corpus',
  ],
);

for (const reportPath of manualReportOrder) {
  assertIncludes(statusText, reportPath, 'status next-step section');
  assertIncludes(planText, reportPath, 'v3 pilot plan next-step section');
  assert.ok(
    packageIndex.entries.some((entry) => entry.relativePath === `scripts/${reportPath}` && entry.present),
    `evidence package should include ${reportPath}`,
  );
}

assertIncludes(
  statusText,
  'The next practical step is using the staged v3 default while developing the next feature, not more runtime scaffolding.',
  'status next-step section',
);
assertIncludes(
  statusText,
  'Keep `AgentSessionV2` available as the production fallback until v3 staged-default soak is stable.',
  'status next-step section',
);
assertIncludes(
  statusText,
  'The next evidence step should still be expanding v3 pilot evidence without changing production authority:',
  'status next-step section',
);
assertIncludes(
  statusText,
  'agent-session-v3-staged-default-regression-smoke.ts',
  'status next-step section',
);
assertIncludes(
  planText,
  'The next practical v3 step is manual real-sample evidence intake, not runtime wiring.',
  'v3 pilot plan next-step section',
);
for (const reportName of [
  'final gap report',
  'intake filling support report',
  'intake field completeness audit',
  'next evidence target report',
  'P0 intake target status report',
  'P0 real evidence closeout report',
  'runbook completion report',
  'intake readiness gate report',
  'missing evidence rollup',
  'gap action checklist',
]) {
  assertIncludes(planText, reportName, 'v3 pilot plan next-step report list');
}
assertIncludes(
  readinessText,
  '- production runtime readiness: `no`',
  'readiness current snapshot',
);
assertIncludes(
  readinessText,
  '- current P0 target kinds: `real-production-like-sample`, `real-exported-corpus`',
  'readiness current snapshot',
);
assertIncludes(
  runbookText,
  'Before filling real exported corpus batches, first read the current evidence target context',
  'real corpus batch runbook',
);
assertIncludes(
  runbookText,
  'manual prioritization aids, not a runtime action order',
  'real corpus batch runbook',
);

assertInOrder(
  statusText,
  'Use the final gap report first',
  'Keep all v3 pilot output debug-only',
  'status next-step section',
);
assertInOrder(
  planText,
  'The next practical v3 step is manual real-sample evidence intake, not runtime wiring.',
  'This should not change runtime decisions or give v3 production authority.',
  'v3 pilot plan next-step section',
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
assertInOrder(
  runbookText,
  'agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts',
  'agent-session-v3-pilot-real-corpus-batch-gap-action-checklist.ts',
  'real corpus batch runbook',
);

for (const text of [
  statusText,
  planText,
  readinessText,
  runbookText,
]) {
  assert.doesNotMatch(
    text,
    /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
    'next-step docs should not encode a fixed desktop tool chain.',
  );
}

assertIncludes(
  statusText,
  'avoid replacing the main `AgentSessionV2` loop yet',
  'status guardrail',
);
assertIncludes(
  planText,
  'This should not change runtime decisions or give v3 production authority.',
  'plan guardrail',
);
assertIncludes(
  planText,
  'generated ready rehearsal intake can carry filled `Sample source=rehearsal` and `Sample source status=synthetic-rehearsal` metadata',
  'plan rehearsal boundary',
);
assertIncludes(
  planText,
  '`real-exported` remains reserved for caller-owned exported samples',
  'plan real-exported boundary',
);
assertIncludes(
  planText,
  'does not satisfy real-exported P0 evidence',
  'plan P0 real evidence boundary',
);
assert.doesNotMatch(
  planText,
  /generated ready intake can carry filled `Sample source=real-exported`/u,
  'plan should not describe generated rehearsal as real-exported evidence.',
);
assert.doesNotMatch(
  planText,
  /real-exported handoff bundle/u,
  'plan should not describe artifact rehearsal closeout as a real-exported handoff bundle.',
);
assertIncludes(
  readinessText,
  'This snapshot must not be treated as permission to wire v3 into production',
  'readiness guardrail',
);
assertIncludes(
  runbookText,
  'The next decision after this runbook is evidence interpretation, not production wiring.',
  'runbook guardrail',
);

console.log('agent session v3 pilot real corpus batch next-step consistency smoke ok');

























