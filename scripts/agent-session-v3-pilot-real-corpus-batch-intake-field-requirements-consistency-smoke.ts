import assert from 'node:assert/strict';
import { runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit } from './agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts';
import {
  createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport,
  type AgentSessionV3PilotRealCorpusBatchIntakeFillingItem,
} from './agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

type RequirementScope = 'index' | 'manifest' | 'sample-note';

interface ExpectedRequirement {
  field: string;
  gapKinds: Set<string>;
  priorities: Set<string>;
  scope: RequirementScope;
}

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

function assertReadOnlySmokeSource(source: string) {
  const forbiddenTokens = [
    'runAgent' + 'SessionV2',
    'execute' + '_desktop',
    'observe' + '_windows_and_apps',
    'locate' + '_screen_elements',
    'buildAgent' + 'PermissionRoute',
    'tool' + 'Executor',
    'spawn' + 'Sync',
    'exec' + 'Sync',
    'npm' + '.cmd',
    'write' + 'File',
    'mk' + 'dtemp',
    'create' + 'TaskQueue',
    'en' + 'queue',
    'sample' + ' collector',
    'handoff' + ' bundle creation',
  ];

  for (const token of forbiddenTokens) {
    assert.equal(
      source.toLowerCase().includes(token.toLowerCase()),
      false,
      `intake field requirements consistency smoke should stay read-only: ${token}`,
    );
  }
}

function assertNoFixedDesktopChain(text: string, label: string) {
  const fixedChain = [
    'observe' + '_windows_and_apps',
    'locate' + '_screen_elements',
    'execute' + '_desktop_sequence',
  ].join('\\s*->\\s*');

  assert.doesNotMatch(
    text,
    new RegExp(fixedChain, 'iu'),
    `${label} should not encode a fixed desktop tool chain.`,
  );
}

function requirementKey(scope: RequirementScope, field: string) {
  return `${scope}:${field}`;
}

function getExpectedRequirement(
  requirements: Map<string, ExpectedRequirement>,
  scope: RequirementScope,
  field: string,
) {
  const key = requirementKey(scope, field);
  const existing = requirements.get(key);

  if (existing) {
    return existing;
  }

  const created: ExpectedRequirement = {
    field,
    gapKinds: new Set(),
    priorities: new Set(),
    scope,
  };
  requirements.set(key, created);

  return created;
}

function addExpectedRequirement(
  requirements: Map<string, ExpectedRequirement>,
  item: AgentSessionV3PilotRealCorpusBatchIntakeFillingItem,
  scope: RequirementScope,
  field: string,
) {
  const requirement = getExpectedRequirement(requirements, scope, field);

  requirement.gapKinds.add(item.gapKind);
  requirement.priorities.add(item.priority);
}

function createExpectedRequirements(
  fillingItems: readonly AgentSessionV3PilotRealCorpusBatchIntakeFillingItem[],
) {
  const requirements = new Map<string, ExpectedRequirement>();

  for (const item of fillingItems) {
    for (const field of item.sampleNoteFields) {
      addExpectedRequirement(requirements, item, 'sample-note', field.id);
    }
    for (const field of item.manifestFields) {
      addExpectedRequirement(requirements, item, 'manifest', field);
    }
    for (const field of item.indexFields) {
      addExpectedRequirement(requirements, item, 'index', field);
    }
  }

  return requirements;
}

function parseArrayField(field: string) {
  const match = field.match(/^([a-zA-Z0-9_]+)\[\]\.([a-zA-Z0-9_]+)$/u);

  if (!match) {
    return null;
  }

  return {
    arrayName: match[1],
    key: match[2],
  };
}

function assertJsonArrayFieldCovered(
  container: Record<string, unknown>,
  field: string,
  label: string,
) {
  const parsed = parseArrayField(field);

  assert.ok(parsed, `${label} requirement should use array field syntax: ${field}`);

  const value = container[parsed.arrayName];

  assert.ok(Array.isArray(value), `${label} template should include ${parsed.arrayName} array.`);
  assert.ok(value.length > 0, `${label} template should include at least one ${parsed.arrayName} entry.`);
  assert.ok(
    value.some((entry) => (
      Boolean(entry)
        && typeof entry === 'object'
        && !Array.isArray(entry)
        && parsed.key in entry
    )),
    `${label} template should include ${field}.`,
  );
}

const {
  fieldCompletenessAuditSource,
  fillingSupportSource,
  planText,
  readinessText,
  runbookText,
  source,
  statusText,
} = readProjectSources({
  fieldCompletenessAuditSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts',
  fillingSupportSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts',
  planText: 'PROJECT_AGENT_V3_PILOT_PLAN.md',
  readinessText: 'PROJECT_AGENT_V3_PILOT_READINESS_CHECKLIST.md',
  runbookText: 'PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md',
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-requirements-consistency-smoke.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

assertReadOnlySmokeSource(source);

assertReadOnlySmokeSource(fillingSupportSource);
assertReadOnlySmokeSource(fieldCompletenessAuditSource);

const fillingSupport = createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport({
  projectRoot,
});
const fieldCompletenessAudit = await runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit({
  projectRoot,
});
const intakeTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate();
const expectedRequirements = createExpectedRequirements(fillingSupport.fillingItems);
const auditRequirementsByKey = new Map(
  fieldCompletenessAudit.fieldRequirements.map((requirement) => [
    requirementKey(requirement.scope, requirement.field),
    requirement,
  ]),
);

assert.equal(fillingSupport.readyForProductionRuntime, false);
assert.equal(fieldCompletenessAudit.readyForProductionRuntime, false);
assert.equal(fillingSupport.status, 'needs-intake-filling');
assert.equal(fieldCompletenessAudit.status, 'no-intake-dirs');
assert.equal(fieldCompletenessAudit.fillingSupportSummaryText, fillingSupport.summaryText);
assert.equal(fieldCompletenessAudit.requiredFieldCount, expectedRequirements.size);
assert.deepEqual(
  [...auditRequirementsByKey.keys()].sort(),
  [...expectedRequirements.keys()].sort(),
  'field completeness audit requirements should derive from filling support fields.',
);

for (const [key, expected] of expectedRequirements) {
  const actual = auditRequirementsByKey.get(key);

  assert.ok(actual, `audit should include requirement ${key}.`);
  assert.deepEqual(actual.gapKinds, [...expected.gapKinds].sort());
  assert.deepEqual(actual.priorities, [...expected.priorities].sort());
}

assert.ok(
  fieldCompletenessAudit.fieldRequirements.some((requirement) => requirement.scope === 'sample-note'),
  'field requirements should include sample-note fields.',
);
assert.ok(
  fieldCompletenessAudit.fieldRequirements.some((requirement) => requirement.scope === 'manifest'),
  'field requirements should include manifest fields.',
);
assert.ok(
  fieldCompletenessAudit.fieldRequirements.some((requirement) => requirement.scope === 'index'),
  'field requirements should include index fields.',
);

const sampleNoteFieldsById = new Map<string, string>();

for (const item of fillingSupport.fillingItems) {
  for (const field of item.sampleNoteFields) {
    const existingPlaceholder = sampleNoteFieldsById.get(field.id);

    assert.ok(
      !existingPlaceholder || existingPlaceholder === field.placeholder,
      `sample-note field ${field.id} should keep one stable placeholder.`,
    );
    sampleNoteFieldsById.set(field.id, field.placeholder);
  }
}

for (const [fieldId, placeholder] of sampleNoteFieldsById) {
  assertIncludes(
    intakeTemplate.noteText,
    placeholder,
    `sample note template field ${fieldId}`,
  );
}

for (const requirement of fieldCompletenessAudit.fieldRequirements) {
  if (requirement.scope === 'manifest') {
    assertJsonArrayFieldCovered(
      intakeTemplate.manifest as Record<string, unknown>,
      requirement.field,
      'manifest',
    );
  } else if (requirement.scope === 'index') {
    assertJsonArrayFieldCovered(
      intakeTemplate.index as Record<string, unknown>,
      requirement.field,
      'index',
    );
  }
}

assert.ok(
  JSON.stringify(intakeTemplate.manifest).includes('replace-with'),
  'manifest template should keep caller-visible placeholder values.',
);
assert.ok(
  JSON.stringify(intakeTemplate.index).includes('replace-with'),
  'index template should keep caller-visible placeholder values.',
);
assert.ok(
  intakeTemplate.index.batches?.some((batch) => batch.manifestPath === './real-corpus-manifest.json'),
  'index template should include the current real corpus manifest entry checked by the audit.',
);

const consistencySmokeName = 'agent-session-v3-pilot-real-corpus-batch-intake-field-requirements-consistency-smoke.ts';

for (const [label, text] of [
  ['status page', statusText],
  ['v3 pilot plan', planText],
  ['readiness checklist', readinessText],
  ['real corpus runbook', runbookText],
] as const) {
  assertIncludes(text, consistencySmokeName, label);
  assertNoFixedDesktopChain(text, label);
}

assertIncludes(
  runbookText,
  'Optionally use the intake field completeness audit after filling a caller-owned intake directory and before interpreting readiness',
  'real corpus runbook',
);
assertIncludes(
  runbookText,
  '## Completion Criteria',
  'real corpus runbook',
);
assertIncludes(
  runbookText,
  'the intake field completeness audit reports no open sample-note, manifest, or index fields for reviewed `--dir` values',
  'real corpus runbook completion criteria',
);
assertInOrder(
  runbookText,
  'agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts',
  'agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts',
  'real corpus runbook',
);
assertInOrder(
  runbookText,
  'agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts',
  '## Step 3: Add Already Exported Corpus Files',
  'real corpus runbook',
);
assertIncludes(
  runbookText,
  'The next decision after this runbook is evidence interpretation, not production wiring.',
  'real corpus runbook guardrail',
);

for (const guardrail of [
  fillingSupport.guardrail,
  fieldCompletenessAudit.guardrail,
  intakeTemplate.readmeText,
  runbookText,
]) {
  assert.match(guardrail, /collect samples|collect desktop samples|does not discover directories/u);
  assert.match(guardrail, /execute tools|make v3 execute tools/u);
  assert.match(guardrail, /grant runtime authority|production-ready|production wiring/u);
}

assert.match(intakeTemplate.noteText, /does not make v3 production-ready/u);
assert.match(intakeTemplate.noteText, /execute tools/u);

assert.match(
  fieldCompletenessAudit.reportText,
  /fieldRequirements:/u,
  'field completeness audit should expose requirement detail for manual review.',
);
assert.match(
  fillingSupport.reportText,
  /followUpReports:.*intake-field-completeness-audit\.ts/su,
  'filling support should point reviewers at the field completeness audit.',
);

console.log('agent session v3 pilot real corpus batch intake field requirements consistency smoke ok');
