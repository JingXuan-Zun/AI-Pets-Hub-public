import assert from 'node:assert/strict';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { createAgentSessionV3PilotRealCorpusBatchCloseoutAudit } from './agent-session-v3-pilot-real-corpus-batch-closeout-audit.ts';
import { createAgentSessionV3PilotRealCorpusBatchSmokeIndex } from './agent-session-v3-pilot-real-corpus-batch-smoke-index.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-closeout-audit.ts',
});

assert.match(
  source,
  /export function createAgentSessionV3PilotRealCorpusBatchCloseoutAudit/u,
  'real corpus batch closeout audit should expose a caller-owned report builder.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-closeout-audit.ts',
);
assert.doesNotMatch(
  source,
  /spawnSync|execSync|npm\.cmd/u,
  'closeout audit should not execute smoke tests or shell commands.',
);

const result = createAgentSessionV3PilotRealCorpusBatchCloseoutAudit({
  projectRoot,
});
const smokeIndex = createAgentSessionV3PilotRealCorpusBatchSmokeIndex({
  projectRoot,
});

assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-closeout-audit');
assert.equal(result.version, 1);
assert.equal(result.readyForProductionRuntime, false);
assert.equal(result.status, 'aligned');
assert.equal(result.smokeIndexEntryCount, smokeIndex.entryCount);
assert.equal(result.smokeIndexMissingCount, 0);
assert.equal(result.smokeIndexUnindexedCount, 0);
assert.equal(result.indexedSmokeDocMentionCount, smokeIndex.entryCount);
assert.equal(result.missingDocMentionCount, 0);
assert.deepEqual(result.missingDocMentionNames, []);
assert.equal(result.cliContractSmokeCount, smokeIndex.groupCounts['cli-contract']);
assert.equal(result.cliContractAuditMentionCount, smokeIndex.groupCounts['cli-contract']);
assert.equal(result.missingCliContractAuditMentionCount, 0);
assert.deepEqual(result.missingCliContractAuditMentionNames, []);
assert.ok(result.realSampleGapCount > 0, 'closeout audit should preserve real sample gaps.');
assert.equal(result.smokeGroupCounts['coverage-index'], smokeIndex.groupCounts['coverage-index']);
assert.equal(result.smokeGroupCounts['cli-contract'], smokeIndex.groupCounts['cli-contract']);
assert.equal(result.smokeGroupCounts['evidence-package'], smokeIndex.groupCounts['evidence-package']);
assert.equal(result.smokeGroupCounts['next-evidence-target'], smokeIndex.groupCounts['next-evidence-target']);
assert.equal(result.smokeGroupCounts['p0-intake-target-status'], smokeIndex.groupCounts['p0-intake-target-status']);
assert.equal(result.smokeGroupCounts['p0-real-evidence-closeout'], smokeIndex.groupCounts['p0-real-evidence-closeout']);
assert.equal(result.smokeGroupCounts['final-gap-report'], smokeIndex.groupCounts['final-gap-report']);
assert.equal(result.smokeGroupCounts['intake-field-completeness'], smokeIndex.groupCounts['intake-field-completeness']);
assert.equal(result.smokeGroupCounts['intake-filling-support'], smokeIndex.groupCounts['intake-filling-support']);
assert.equal(result.smokeGroupCounts['intake-readiness-gate'], smokeIndex.groupCounts['intake-readiness-gate']);
assert.equal(result.smokeGroupCounts['intake-template'], smokeIndex.groupCounts['intake-template']);
assert.equal(result.smokeGroupCounts['package-health'], smokeIndex.groupCounts['package-health']);
assert.equal(result.smokeGroupCounts['runbook-completion'], smokeIndex.groupCounts['runbook-completion']);
assert.equal(result.smokeGroupCounts.handoff, smokeIndex.groupCounts.handoff);
assert.equal(result.docCoverage.length, 4);
assert.ok(
  result.docCoverage.some((doc) => doc.docPath === 'PROJECT_AGENT_V3_PILOT_PLAN.md' && doc.mentionedSmokeCount > 0),
  'v3 pilot plan should carry detailed smoke coverage mentions.',
);
assert.match(result.statusDashboardSummaryText, /readyForProductionRuntime=no/u);
assert.match(result.summaryText, /status=aligned/u);
assert.match(result.summaryText, new RegExp(`smokes=${smokeIndex.entryCount}`, 'u'));
assert.match(result.summaryText, new RegExp(`indexedDocMentions=${smokeIndex.entryCount}`, 'u'));
assert.match(result.summaryText, /missingDocMentions=0/u);
assert.match(result.summaryText, new RegExp(`cliContractSmokes=${smokeIndex.groupCounts['cli-contract']}`, 'u'));
assert.match(result.summaryText, /missingCliContractAuditMentions=0/u);
assert.match(result.summaryText, /readyForProductionRuntime=no/u);
assert.match(result.reportText, /docCoverage:/u);
assert.match(result.reportText, /missingDocMentionSmokes: none/u);
assert.match(result.reportText, /missingCliContractAuditMentions: none/u);
assert.match(result.reportText, /group=handoff count=10/u);
assert.match(result.reportText, /group=final-gap-report count=1/u);
assert.match(result.reportText, /group=intake-field-completeness count=2/u);
assert.match(result.reportText, /group=intake-filling-support count=1/u);
assert.match(result.reportText, /group=intake-readiness-gate count=1/u);
assert.match(result.reportText, /group=intake-template count=6/u);
assert.match(result.reportText, /does not run smoke tests, collect samples, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, or grant runtime authority/u);

console.log('agent session v3 pilot real corpus batch closeout audit smoke ok');
