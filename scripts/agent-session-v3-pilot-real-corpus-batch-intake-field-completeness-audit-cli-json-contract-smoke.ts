import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  assertNumberRecordKeys,
  assertObjectRecord,
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain,
  parseTrailingJsonObject,
} from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

function runCli(args: readonly string[]) {
  return process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/c', 'npx.cmd', 'tsx', ...args], {
      cwd: projectRoot,
      encoding: 'utf8',
    })
    : spawnSync('npx', ['tsx', ...args], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
}

function assertRequirementContract(value: unknown) {
  const requirement = assertObjectRecord(value, 'field requirement');

  assert.deepEqual(Object.keys(requirement).sort(), [
    'field',
    'gapKinds',
    'priorities',
    'scope',
  ]);
  assert.equal(typeof requirement.field, 'string');
  assert.match(String(requirement.scope), /^(index|manifest|sample-note)$/u);
  assert.ok(Array.isArray(requirement.gapKinds), 'requirement.gapKinds should be an array.');
  assert.ok(Array.isArray(requirement.priorities), 'requirement.priorities should be an array.');
}

function assertFieldAuditContract(value: unknown) {
  const field = assertObjectRecord(value, 'field audit');

  assert.deepEqual(Object.keys(field).sort(), [
    'field',
    'gapKinds',
    'message',
    'priorities',
    'scope',
    'status',
  ]);
  assert.equal(typeof field.field, 'string');
  assert.equal(typeof field.message, 'string');
  assert.match(String(field.scope), /^(index|manifest|sample-note)$/u);
  assert.match(String(field.status), /^(complete|missing|placeholder|unreadable)$/u);
  assert.ok(Array.isArray(field.gapKinds), 'field.gapKinds should be an array.');
  assert.ok(Array.isArray(field.priorities), 'field.priorities should be an array.');
}

function assertEntryContract(value: unknown) {
  const entry = assertObjectRecord(value, 'intake field completeness entry');

  assert.deepEqual(Object.keys(entry).sort(), [
    'completeFieldCount',
    'fieldAudits',
    'intakeDir',
    'missingFieldCount',
    'openFieldCount',
    'placeholderFieldCount',
    'requiredFieldCount',
    'status',
    'unreadableFieldCount',
  ]);
  assert.equal(typeof entry.intakeDir, 'string');
  assert.match(String(entry.status), /^(complete|open-fields|unreadable)$/u);
  assertNumberRecordKeys(
    entry,
    [
      'completeFieldCount',
      'missingFieldCount',
      'openFieldCount',
      'placeholderFieldCount',
      'requiredFieldCount',
      'unreadableFieldCount',
    ],
    'intake field completeness entry',
  );
  assert.ok(Array.isArray(entry.fieldAudits), 'fieldAudits should be an array.');
  for (const field of entry.fieldAudits) {
    assertFieldAuditContract(field);
  }
}

function assertIntakeStatusCountsContract(value: unknown) {
  const counts = assertObjectRecord(value, 'intakeStatusCounts');

  assert.deepEqual(Object.keys(counts).sort(), [
    'complete',
    'open-fields',
    'unreadable',
  ]);
  assertNumberRecordKeys(
    counts,
    [
      'complete',
      'open-fields',
      'unreadable',
    ],
    'intakeStatusCounts',
  );
}

function assertFieldStatusCountsByScopeContract(value: unknown) {
  const countsByScope = assertObjectRecord(value, 'fieldStatusCountsByScope');

  assert.deepEqual(Object.keys(countsByScope).sort(), [
    'index',
    'manifest',
    'sample-note',
  ]);

  for (const scope of [
    'index',
    'manifest',
    'sample-note',
  ]) {
    const counts = assertObjectRecord(countsByScope[scope], `fieldStatusCountsByScope.${scope}`);

    assert.deepEqual(Object.keys(counts).sort(), [
      'complete',
      'missing',
      'placeholder',
      'unreadable',
    ]);
    assertNumberRecordKeys(
      counts,
      [
        'complete',
        'missing',
        'placeholder',
        'unreadable',
      ],
      `fieldStatusCountsByScope.${scope}`,
    );
  }
}

function assertAuditContract(result: Record<string, unknown>) {
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit');
  assert.equal(result.version, 1);
  assert.equal(result.readyForProductionRuntime, false);
  assert.match(String(result.status), /^(complete|no-intake-dirs|open-fields|unreadable)$/u);
  assert.equal(typeof result.fillingSupportSummaryText, 'string');
  assert.equal(typeof result.guardrail, 'string');
  assert.equal(typeof result.reportText, 'string');
  assert.equal(typeof result.summaryText, 'string');
  assertNumberRecordKeys(
    result,
    [
      'completeFieldCount',
      'intakeCount',
      'missingFieldCount',
      'openFieldCount',
      'placeholderFieldCount',
      'requiredFieldCount',
      'unreadableFieldCount',
    ],
    'intake field completeness audit',
  );
  assertIntakeStatusCountsContract(result.intakeStatusCounts);
  assertFieldStatusCountsByScopeContract(result.fieldStatusCountsByScope);
  assert.ok(Array.isArray(result.fieldRequirements), 'fieldRequirements should be an array.');
  assert.ok(Array.isArray(result.intakeEntries), 'intakeEntries should be an array.');
  for (const requirement of result.fieldRequirements) {
    assertRequirementContract(requirement);
  }
  for (const entry of result.intakeEntries) {
    assertEntryContract(entry);
  }
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts CLI JSON contract',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-intake-field-completeness-audit-cli-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: tempDir,
    prettyJson: true,
  });
  const cliResult = runCli([
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts',
    '--dir',
    example.intakeDirs.ready,
    '--dir',
    example.intakeDirs.mixed,
    '--pretty',
  ]);

  assert.equal(
    cliResult.status,
    0,
    cliResult.stderr || cliResult.stdout || cliResult.error?.message,
  );
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit status=open-fields/u);
  assert.match(cliResult.stdout, /intakes=2/u);
  assert.match(cliResult.stdout, /completeIntakes=1/u);
  assert.match(cliResult.stdout, /openFieldIntakes=1/u);
  assert.match(cliResult.stdout, /unreadableIntakes=0/u);
  assert.match(cliResult.stdout, /placeholderFields=/u);
  assert.match(cliResult.stdout, /intakeStatusCounts:/u);
  assert.match(cliResult.stdout, /fieldStatusCountsByScope:/u);
  assert.match(cliResult.stdout, /intakeFieldCompleteness:/u);
  assert.match(cliResult.stdout, /readyForProductionRuntime=no/u);

  const result = parseTrailingJsonObject(cliResult.stdout);

  assertAuditContract(result);
  assert.equal(result.status, 'open-fields');
  assert.equal(result.intakeCount, 2);
  assert.deepEqual(result.intakeStatusCounts, {
    complete: 1,
    'open-fields': 1,
    unreadable: 0,
  });
  assert.ok(Number(result.requiredFieldCount) > 0);
  assert.ok(Number(result.completeFieldCount) > 0);
  assert.ok(Number(result.placeholderFieldCount) > 0);
  assert.ok(Number(result.openFieldCount) > 0);
  assert.equal(result.unreadableFieldCount, 0);
  const fieldStatusCountsByScope = assertObjectRecord(result.fieldStatusCountsByScope, 'fieldStatusCountsByScope');
  const sampleNoteCounts = assertObjectRecord(fieldStatusCountsByScope['sample-note'], 'sample-note field status counts');

  assert.ok(Number(sampleNoteCounts.complete) > 0);
  assert.ok(Number(sampleNoteCounts.placeholder) > 0);
  assert.ok(
    (result.fieldRequirements as Record<string, unknown>[]).some((requirement) => (
      requirement.scope === 'sample-note' && requirement.field === 'sample-source'
    )),
    'contract should expose sample-note field requirements.',
  );
  assert.ok(
    (result.intakeEntries as Record<string, unknown>[]).some((entry) => entry.status === 'complete'),
    'CLI contract should include a complete intake entry.',
  );
  assert.ok(
    (result.intakeEntries as Record<string, unknown>[]).some((entry) => entry.status === 'open-fields'),
    'CLI contract should include an open-fields intake entry.',
  );
  assert.match(String(result.fillingSupportSummaryText), /status=needs-intake-filling/u);
  assert.match(String(result.guardrail), /reads only explicitly supplied --dir intake directories/u);
  assert.match(String(result.guardrail), /does not discover directories/u);
  assert.match(String(result.guardrail), /auto-fill files/u);
  assert.match(String(result.guardrail), /grant runtime authority/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch intake field completeness audit CLI JSON contract smoke ok');
