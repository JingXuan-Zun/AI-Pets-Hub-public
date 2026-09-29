import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAgentSessionV3PilotRealCorpusBatchEvidencePackageIndex } from './agent-session-v3-pilot-real-corpus-batch-evidence-package-index.ts';
import { createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup } from './agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts';
import { createAgentSessionV3PilotRealCorpusBatchSmokeIndex } from './agent-session-v3-pilot-real-corpus-batch-smoke-index.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

function writeProjectFixtureFile(root: string, relativePath: string, content: string) {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), {
    recursive: true,
  });
  writeFileSync(filePath, content);
}

function createPlaceholderFile(root: string, relativePath: string) {
  writeProjectFixtureFile(
    root,
    relativePath,
    `// degraded linkage fixture for ${relativePath}\n`,
  );
}

function createTempProjectRoot() {
  const tempRoot = path.join(
    tmpdir(),
    `agent-v3-p0-linkage-degraded-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );

  mkdirSync(tempRoot, {
    recursive: true,
  });

  return tempRoot;
}

function createDegradedRunbookText() {
  return [
    '# Degraded Real Corpus Batch Runbook Fixture',
    '',
    'npx.cmd tsx .\\scripts\\agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts --pretty',
    'npx.cmd tsx .\\scripts\\agent-session-v3-pilot-real-corpus-batch-gap-action-checklist.ts --pretty',
    '',
    'This intentionally omits explicit caller-provided P0 intake target status guidance.',
  ].join('\n');
}

function createDegradedReadinessText() {
  return [
    '# Degraded V3 Pilot Readiness Fixture',
    '',
    '- [gap-kind:real-exported-corpus] Real exported corpus batches are still needed.',
    '- [gap-kind:real-production-like-sample] Real production-like sample batches are still needed.',
  ].join('\n');
}

const PACKAGE_ENTRY_PLACEHOLDER_PATHS = [
  'scripts/agent-session-v3-pilot-real-corpus-batch-closeout-audit.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-status-dashboard-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-gap-action-checklist.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-final-gap-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-smoke-index.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-readiness-snapshot-consistency-smoke.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-next-step-consistency-smoke.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-requirements-consistency-smoke.ts',
  'scripts/agent-session-v3-pilot-cli-json-contract-coverage-audit-smoke.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-evidence-package-index.ts',
];

const smokeIndex = createAgentSessionV3PilotRealCorpusBatchSmokeIndex({
  projectRoot,
});
const tempRoot = createTempProjectRoot();

try {
  for (const entry of smokeIndex.entries) {
    createPlaceholderFile(tempRoot, path.join('scripts', entry.name));
  }

  for (const relativePath of PACKAGE_ENTRY_PLACEHOLDER_PATHS) {
    createPlaceholderFile(tempRoot, relativePath);
  }

  writeProjectFixtureFile(
    tempRoot,
    'PROJECT_AGENT_V3_PILOT_PLAN.md',
    readProjectFile('PROJECT_AGENT_V3_PILOT_PLAN.md'),
  );
  writeProjectFixtureFile(
    tempRoot,
    'PROJECT_AGENT_V2_STATUS.md',
    readProjectFile('PROJECT_AGENT_V2_STATUS.md'),
  );
  writeProjectFixtureFile(
    tempRoot,
    'PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md',
    createDegradedRunbookText(),
  );
  writeProjectFixtureFile(
    tempRoot,
    'PROJECT_AGENT_V3_PILOT_READINESS_CHECKLIST.md',
    createDegradedReadinessText(),
  );
  assert.ok(
    existsSync(path.join(tempRoot, 'scripts/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts')),
    'degraded fixture should keep the P0 status script present so this tests linkage, not package file absence.',
  );

  const packageIndex = createAgentSessionV3PilotRealCorpusBatchEvidencePackageIndex({
    projectRoot: tempRoot,
  });

  assert.equal(packageIndex.kind, 'agent-session-v3-pilot-real-corpus-batch-evidence-package-index');
  assert.equal(packageIndex.readyForProductionRuntime, false);
  assert.equal(packageIndex.status, 'attention-needed');
  assert.equal(packageIndex.missingPackageEntryCount, 0);
  assert.equal(packageIndex.p0IntakeTargetStatusLink.status, 'attention-needed');
  assert.deepEqual(
    packageIndex.p0IntakeTargetStatusLink.missingSignals,
    [
      'runbook-order:next-target-before-p0-status',
      'runbook-order:p0-status-before-gap-priorities',
      'runbook-boundary:explicit-dir-no-discovery',
      'runbook-contract:p0-status-summary-shape',
      'readiness-coverage:explicit-p0-status-dir-boundary',
    ],
  );
  assert.match(packageIndex.summaryText, /p0IntakeTargetStatusLink=attention-needed/u);
  assert.match(packageIndex.reportText, /p0IntakeTargetStatusLink status=attention-needed/u);
  assert.match(packageIndex.reportText, /runbook-boundary:explicit-dir-no-discovery/u);
  assert.match(packageIndex.guardrail, /does not run smoke tests/u);
  assert.match(packageIndex.guardrail, /grant runtime authority/u);

  const packageHealth = createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup({
    projectRoot: tempRoot,
  });

  assert.equal(packageHealth.kind, 'agent-session-v3-pilot-real-corpus-batch-package-health-rollup');
  assert.equal(packageHealth.readyForProductionRuntime, false);
  assert.equal(packageHealth.status, 'package-attention-needed');
  assert.equal(packageHealth.missingPackageEntryCount, 0);
  assert.equal(packageHealth.p0IntakeTargetStatusLinkStatus, 'attention-needed');
  assert.equal(packageHealth.p0IntakeTargetStatusLinkMissingSignalCount, 5);
  assert.match(packageHealth.summaryText, /status=package-attention-needed/u);
  assert.match(packageHealth.summaryText, /p0IntakeTargetStatusLink=attention-needed/u);
  assert.match(packageHealth.reportText, /p0IntakeTargetStatusLink status=attention-needed missingSignals=5/u);
  assert.match(packageHealth.guardrail, /does not run smoke tests/u);
  assert.match(packageHealth.guardrail, /grant runtime authority/u);
} finally {
  rmSync(tempRoot, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch P0 linkage degraded smoke ok');
