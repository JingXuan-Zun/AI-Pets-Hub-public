import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { projectPath, readProjectFile } from './smokeTestHarness.ts';

const scriptsDir = projectPath('scripts');

const EXPECTED_CLI_JSON_CONTRACT_COVERAGE: Record<string, string> = {
  'agent-session-v3-pilot-baseline-corpus-manifest-report.ts':
    'agent-session-v3-pilot-fixture-baseline-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-baseline-evidence-artifact-flow.ts':
    'agent-session-v3-pilot-template-artifact-flow-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-corpus-batch-index-report.ts':
    'agent-session-v3-pilot-manifest-loader-batch-index-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-corpus-batch-index-template.ts':
    'agent-session-v3-pilot-starter-templates-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-explicit-debug-corpus-exporter.ts':
    'agent-session-v3-pilot-explicit-debug-corpus-exporter-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-external-sample-corpus-manifest-loader.ts':
    'agent-session-v3-pilot-manifest-loader-batch-index-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-external-sample-corpus-manifest-template.ts':
    'agent-session-v3-pilot-starter-templates-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-external-sample-fixture-batch-loader.ts':
    'agent-session-v3-pilot-fixture-baseline-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-external-sample-fixture-set-exporter.ts':
    'agent-session-v3-pilot-fixture-baseline-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-multi-corpus-manifest-report.ts':
    'agent-session-v3-pilot-multi-manifest-sample-note-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-closeout-audit.ts':
    'agent-session-v3-pilot-real-corpus-batch-closeout-audit-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-consistency-report.ts':
    'agent-session-v3-pilot-real-corpus-batch-preflight-reports-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-evidence-summary.ts':
    'agent-session-v3-pilot-real-corpus-batch-evidence-summary-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-evidence-package-index.ts':
    'agent-session-v3-pilot-real-corpus-batch-evidence-package-index-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-final-gap-report.ts':
    'agent-session-v3-pilot-real-corpus-batch-final-gap-report-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-gap-action-checklist.ts':
    'agent-session-v3-pilot-real-corpus-batch-gap-action-checklist-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts':
    'agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts':
    'agent-session-v3-pilot-real-corpus-batch-handoff-bundle-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit.ts':
    'agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts':
    'agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts':
    'agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup.ts':
    'agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts':
    'agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts':
    'agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts':
    'agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-intake-template.ts':
    'agent-session-v3-pilot-template-artifact-flow-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-intake-validator.ts':
    'agent-session-v3-pilot-real-corpus-batch-intake-validator-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-metadata-quality-report.ts':
    'agent-session-v3-pilot-real-corpus-batch-metadata-quality-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup.ts':
    'agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts':
    'agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-operator-checklist-report.ts':
    'agent-session-v3-pilot-real-corpus-batch-operator-checklist-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts':
    'agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts':
    'agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts':
    'agent-session-v3-pilot-real-corpus-batch-package-health-rollup-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-path-health-report.ts':
    'agent-session-v3-pilot-real-corpus-batch-preflight-reports-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts':
    'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report.ts':
    'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-review-summary.ts':
    'agent-session-v3-pilot-real-corpus-batch-review-summary-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts':
    'agent-session-v3-pilot-real-corpus-batch-runbook-completion-report-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-sample-note-report.ts':
    'agent-session-v3-pilot-multi-manifest-sample-note-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-schema-shape-report.ts':
    'agent-session-v3-pilot-real-corpus-batch-preflight-reports-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts':
    'agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight-cli-json-contract-smoke.ts',
  'agent-session-v3-pilot-real-corpus-batch-status-dashboard-report.ts':
    'agent-session-v3-pilot-real-corpus-batch-status-dashboard-cli-json-contract-smoke.ts',
};

function readScript(scriptName: string) {
  return readProjectFile(`scripts/${scriptName}`);
}

function getV3PilotScriptNames() {
  return readdirSync(scriptsDir)
    .filter((name) => name.startsWith('agent-session-v3-pilot'))
    .filter((name) => name.endsWith('.ts'));
}

function hasCliJsonOutputFlags(source: string) {
  return source.includes("'--json'")
    || source.includes('"--json"')
    || source.includes("'--pretty'")
    || source.includes('"--pretty"');
}

function isRuntimeScript(name: string) {
  return !name.endsWith('-smoke.ts')
    && name !== 'agent-session-v3-pilot-cli-json-contract-helpers.ts';
}

const cliJsonScripts = getV3PilotScriptNames()
  .filter(isRuntimeScript)
  .filter((name) => hasCliJsonOutputFlags(readScript(name)))
  .sort();
const expectedScripts = Object.keys(EXPECTED_CLI_JSON_CONTRACT_COVERAGE).sort();

assert.deepEqual(
  cliJsonScripts,
  expectedScripts,
  'Every v3 pilot script with --json/--pretty output should have explicit CLI JSON contract coverage.',
);

for (const [targetScript, contractSmoke] of Object.entries(EXPECTED_CLI_JSON_CONTRACT_COVERAGE)) {
  const targetSource = readScript(targetScript);
  const smokeSource = readScript(contractSmoke);

  assert.ok(
    hasCliJsonOutputFlags(targetSource),
    `${targetScript} should still expose a machine-readable CLI JSON flag.`,
  );
  assert.match(
    smokeSource,
    new RegExp(targetScript.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'),
    `${contractSmoke} should explicitly exercise ${targetScript}.`,
  );
}

const contractSmokeNames = getV3PilotScriptNames()
  .filter((name) => name.endsWith('-cli-json-contract-smoke.ts'))
  .sort();

for (const smokeName of new Set(Object.values(EXPECTED_CLI_JSON_CONTRACT_COVERAGE))) {
  assert.ok(
    contractSmokeNames.includes(smokeName),
    `${smokeName} should exist as a CLI JSON contract smoke.`,
  );
}

console.log('agent session v3 pilot CLI JSON contract coverage audit smoke ok');
