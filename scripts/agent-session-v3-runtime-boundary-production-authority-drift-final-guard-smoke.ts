import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/agentSessionV3RuntimeBoundary.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

const scriptsDir = path.join(projectRoot, 'scripts');

function productionWiringSmokeFiles() {
  return readdirSync(scriptsDir)
    .filter((fileName) => (
      fileName.startsWith('agent-session-v3-runtime-boundary-production-wiring-')
      && fileName.endsWith('-smoke.ts')
    ))
    .sort();
}

type ProductionAuthorityDriftGuardInput =
  | 'runtime-boundary-contract'
  | 'status-page'
  | 'preflight-audit'
  | 'production-wiring-smoke-chain';

type ProductionAuthorityDriftGuardCheck =
  | 'production-authority-false'
  | 'production-ready-false'
  | 'positive-gate-closed'
  | 'agent-session-v2-owner-retained'
  | 'debug-shadow-only'
  | 'no-production-controller-or-adapter-contract'
  | 'no-v2-runtime-call'
  | 'no-tool-or-permission-routing'
  | 'no-fixed-tool-chain'
  | 'no-runtime-action-order';

interface ProductionAuthorityDriftGuardRow {
  check: ProductionAuthorityDriftGuardCheck;
  driftStatus: 'guarded';
  inputs: readonly ProductionAuthorityDriftGuardInput[];
  productionAuthority: false;
  productionReady: false;
}

interface ProductionAuthorityDriftFinalGuard {
  guard: 'production-authority-drift-final-guard';
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly ProductionAuthorityDriftGuardRow[];
  summaryDecision: 'no-production-authority-drift-detected';
}

const productionAuthorityDriftFinalGuard = {
  guard: 'production-authority-drift-final-guard',
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      check: 'production-authority-false',
      driftStatus: 'guarded',
      inputs: [
        'runtime-boundary-contract',
        'status-page',
        'preflight-audit',
        'production-wiring-smoke-chain',
      ],
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'production-ready-false',
      driftStatus: 'guarded',
      inputs: [
        'status-page',
        'preflight-audit',
        'production-wiring-smoke-chain',
      ],
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'positive-gate-closed',
      driftStatus: 'guarded',
      inputs: [
        'preflight-audit',
        'production-wiring-smoke-chain',
      ],
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'agent-session-v2-owner-retained',
      driftStatus: 'guarded',
      inputs: [
        'runtime-boundary-contract',
        'status-page',
        'preflight-audit',
        'production-wiring-smoke-chain',
      ],
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'debug-shadow-only',
      driftStatus: 'guarded',
      inputs: [
        'status-page',
        'preflight-audit',
        'production-wiring-smoke-chain',
      ],
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'no-production-controller-or-adapter-contract',
      driftStatus: 'guarded',
      inputs: [
        'runtime-boundary-contract',
        'preflight-audit',
        'production-wiring-smoke-chain',
      ],
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'no-v2-runtime-call',
      driftStatus: 'guarded',
      inputs: [
        'runtime-boundary-contract',
        'production-wiring-smoke-chain',
      ],
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'no-tool-or-permission-routing',
      driftStatus: 'guarded',
      inputs: [
        'status-page',
        'preflight-audit',
        'production-wiring-smoke-chain',
      ],
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'no-fixed-tool-chain',
      driftStatus: 'guarded',
      inputs: [
        'runtime-boundary-contract',
        'status-page',
        'preflight-audit',
        'production-wiring-smoke-chain',
      ],
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'no-runtime-action-order',
      driftStatus: 'guarded',
      inputs: [
        'status-page',
        'preflight-audit',
        'production-wiring-smoke-chain',
      ],
      productionAuthority: false,
      productionReady: false,
    },
  ],
  summaryDecision: 'no-production-authority-drift-detected',
} as const satisfies ProductionAuthorityDriftFinalGuard;

function rowForCheck(check: ProductionAuthorityDriftGuardCheck) {
  const row = productionAuthorityDriftFinalGuard.rows.find((candidate) => candidate.check === check);
  assert.ok(row, `${check} should exist in the production authority drift final guard.`);
  return row;
}

function assertNoPositiveAuthorityClaims(label: string, text: string) {
  assert.doesNotMatch(text, /productionAuthority:\s*true/u, `${label} must not set productionAuthority=true.`);
  assert.doesNotMatch(text, /productionReady:\s*true/u, `${label} must not set productionReady=true.`);
  assert.doesNotMatch(text, /positiveGateAllowed:\s*true/u, `${label} must not open a positive production gate.`);
  assert.doesNotMatch(text, /readyForPositiveGate:\s*true/u, `${label} must not mark a positive gate precondition ready.`);
  assert.doesNotMatch(text, /isProductionWiringPlan:\s*true/u, `${label} must not become a production wiring plan.`);
  assert.doesNotMatch(
    text,
    /decision:\s*['"]ready-for-production-wiring|summaryDecision:\s*['"]production-wiring-ready/u,
    `${label} must not claim production wiring is ready.`,
  );
}

function stripNegativeAssertionBlocks(text: string) {
  const keptLines: string[] = [];
  let skipping = false;

  for (const line of text.split(/\r?\n/u)) {
    if (line.includes('assert.doesNotMatch(')) {
      skipping = true;
      continue;
    }

    if (skipping) {
      if (line.trim() === ');') {
        skipping = false;
      }
      continue;
    }

    keptLines.push(line);
  }

  return keptLines.join('\n');
}

function assertNoRuntimeWiring(label: string, text: string) {
  assert.doesNotMatch(
    text,
    /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
    `${label} must not add production controller or adapter contracts.`,
  );
  assert.doesNotMatch(
    text,
    /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
    `${label} must not call production v2 runtime modules.`,
  );
  assert.doesNotMatch(
    text,
    /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
    `${label} must not define controller actions or tool decisions.`,
  );
  assert.doesNotMatch(
    text,
    /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
    `${label} must not prescribe concrete desktop tools.`,
  );
  assert.doesNotMatch(
    text,
    /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
    `${label} must not define fixed workflows or fallback chains.`,
  );
}

const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const wiringSmokeFiles = productionWiringSmokeFiles();
const wiringSmokeSources = wiringSmokeFiles.map((fileName) => ({
  fileName,
  source: readFileSync(path.join(scriptsDir, fileName), 'utf8'),
}));

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('productionAuthority=false'));
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(productionAuthorityDriftFinalGuard.productionAuthority, false);
assert.equal(productionAuthorityDriftFinalGuard.productionReady, false);
assert.equal(productionAuthorityDriftFinalGuard.positiveGateAllowed, false);
assert.equal(productionAuthorityDriftFinalGuard.isProductionWiringPlan, false);
assert.equal(productionAuthorityDriftFinalGuard.summaryDecision, 'no-production-authority-drift-detected');

assert.deepEqual(
  productionAuthorityDriftFinalGuard.rows.map((row) => row.check).sort(),
  [
    'agent-session-v2-owner-retained',
    'debug-shadow-only',
    'no-fixed-tool-chain',
    'no-production-controller-or-adapter-contract',
    'no-runtime-action-order',
    'no-tool-or-permission-routing',
    'no-v2-runtime-call',
    'positive-gate-closed',
    'production-authority-false',
    'production-ready-false',
  ],
);

for (const row of productionAuthorityDriftFinalGuard.rows) {
  assert.equal(row.driftStatus, 'guarded');
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.ok(row.inputs.length > 0);
}

assert.ok(rowForCheck('production-authority-false').inputs.includes('runtime-boundary-contract'));
assert.ok(rowForCheck('production-ready-false').inputs.includes('status-page'));
assert.ok(rowForCheck('positive-gate-closed').inputs.includes('production-wiring-smoke-chain'));
assert.ok(rowForCheck('agent-session-v2-owner-retained').inputs.includes('preflight-audit'));
assert.ok(rowForCheck('debug-shadow-only').inputs.includes('status-page'));
assert.ok(rowForCheck('no-production-controller-or-adapter-contract').inputs.includes('runtime-boundary-contract'));
assert.ok(rowForCheck('no-v2-runtime-call').inputs.includes('production-wiring-smoke-chain'));
assert.ok(rowForCheck('no-tool-or-permission-routing').inputs.includes('preflight-audit'));
assert.ok(rowForCheck('no-fixed-tool-chain').inputs.includes('runtime-boundary-contract'));
assert.ok(rowForCheck('no-runtime-action-order').inputs.includes('production-wiring-smoke-chain'));

assert.deepEqual(
  wiringSmokeFiles,
  [
    'agent-session-v3-runtime-boundary-production-wiring-gate-closeout-summary-checkpoint-smoke.ts',
    'agent-session-v3-runtime-boundary-production-wiring-negative-gate-blocker-rollup-checkpoint-smoke.ts',
    'agent-session-v3-runtime-boundary-production-wiring-negative-gate-consistency-checkpoint-smoke.ts',
    'agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-audit-smoke.ts',
    'agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-closeout-gate-smoke.ts',
    'agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-consistency-checkpoint-smoke.ts',
  ],
);

for (const [label, text] of [
  ['runtime boundary contract', boundarySource],
  ['v3 full-runtime preflight audit', auditText],
  ['v2 status page', statusText],
] as const) {
  assertNoPositiveAuthorityClaims(label, text);
}

assertNoRuntimeWiring('runtime boundary contract', boundarySource);
for (const { fileName, source } of wiringSmokeSources) {
  const sourceWithoutNegativeAssertions = stripNegativeAssertionBlocks(source);
  assertNoPositiveAuthorityClaims(fileName, sourceWithoutNegativeAssertions);
  assertNoRuntimeWiring(fileName, sourceWithoutNegativeAssertions);
}

assert.match(boundarySource, /productionAuthority: false/u);
assert.match(boundarySource, /contract-only/u);
assert.match(boundarySource, /AgentSessionV2 remains the production orchestrator/u);
assert.match(boundarySource, /no required ordered tool workflow/u);

assert.match(auditText, /Production Wiring Gate Closeout Summary Checkpoint Status/u);
assert.match(auditText, /Production Authority Drift Final Guard Status/u);
assert.match(
  auditText,
  /agent-session-v3-runtime-boundary-production-authority-drift-final-guard-smoke\.ts/u,
);
assert.match(auditText, /production wiring remains deferred/u);
assert.match(auditText, /positive gate remains closed/u);
assert.match(auditText, /no production-authority drift was detected/u);
assert.match(auditText, /has not drifted into production authority language/u);

assert.match(statusText, /Overall practical runtime including v3: about 99\.2%/u);
assert.match(statusText, /v3 full runtime preflight\/pilot: about 99\.2%/u);
assert.match(statusText, /None of these credits treat v3 as production runtime/u);
assert.match(statusText, /V3 runtime boundary production authority drift final guard.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-production-authority-drift-final-guard-smoke\.ts/u,
);

const serializedGuard = JSON.stringify(productionAuthorityDriftFinalGuard);
assert.doesNotMatch(
  serializedGuard,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Production authority drift final guard must not grant production authority.',
);
assert.doesNotMatch(
  serializedGuard,
  /isProductionWiringPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Production authority drift final guard must not become a production wiring plan.',
);

console.log('agent session v3 runtime boundary production authority drift final guard smoke ok');
