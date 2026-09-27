import assert from 'node:assert/strict';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { createAgentSessionV3PilotRealCorpusBatchCloseoutAudit } from './agent-session-v3-pilot-real-corpus-batch-closeout-audit.ts';
import { createAgentSessionV3PilotRealCorpusBatchEvidencePackageIndex } from './agent-session-v3-pilot-real-corpus-batch-evidence-package-index.ts';
import { createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport } from './agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts';
import { createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup } from './agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

function assertSnapshotLine(checklistText: string, line: string) {
  assert.ok(
    checklistText.includes(`- ${line}`),
    `readiness checklist current snapshot should include: ${line}`,
  );
}

const {
  source,
  checklistText,
} = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-readiness-snapshot-consistency-smoke.ts',
  checklistText: 'PROJECT_AGENT_V3_PILOT_READINESS_CHECKLIST.md',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-readiness-snapshot-consistency-smoke.ts',
);
assert.ok(
  [
    'spawn' + 'Sync',
    'exec' + 'Sync',
    'npm' + '.cmd',
  ].every((token) => !source.includes(token)),
  'readiness snapshot consistency smoke should not execute smoke tests or shell commands.',
);
assert.ok(
  [
    'create' + 'TaskQueue',
    'en' + 'queue',
    'sample' + ' collector',
    'handoff' + ' bundle creation',
  ].every((token) => !source.toLowerCase().includes(token.toLowerCase())),
  'readiness snapshot consistency smoke should stay read-only.',
);

const closeout = createAgentSessionV3PilotRealCorpusBatchCloseoutAudit({
  projectRoot,
});
const evidencePackage = createAgentSessionV3PilotRealCorpusBatchEvidencePackageIndex({
  projectRoot,
});
const packageHealth = createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup({
  projectRoot,
});
const nextTarget = createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport({
  projectRoot,
});

assert.equal(closeout.readyForProductionRuntime, false);
assert.equal(evidencePackage.readyForProductionRuntime, false);
assert.equal(packageHealth.readyForProductionRuntime, false);
assert.equal(nextTarget.readyForProductionRuntime, false);

assertSnapshotLine(checklistText, `closeout audit: \`${closeout.status}\``);
assertSnapshotLine(
  checklistText,
  `indexed smoke coverage: ${closeout.smokeIndexEntryCount} indexed, ${closeout.smokeIndexMissingCount} missing, ${closeout.smokeIndexUnindexedCount} unindexed`,
);
assertSnapshotLine(
  checklistText,
  `CLI JSON contract coverage: ${closeout.cliContractSmokeCount} mapped, ${closeout.missingCliContractAuditMentionCount} missing audit mentions`,
);
assertSnapshotLine(
  checklistText,
  `evidence package index: \`${evidencePackage.status}\`, ${evidencePackage.packageEntryCount} entries, ${evidencePackage.missingPackageEntryCount} missing entries`,
);
assertSnapshotLine(checklistText, `package health: \`${packageHealth.status}\``);
assertSnapshotLine(
  checklistText,
  `P0 intake target status linkage: \`${evidencePackage.p0IntakeTargetStatusLink.status}\`, ${evidencePackage.p0IntakeTargetStatusLink.missingSignals.length} missing signals`,
);
assertSnapshotLine(checklistText, `remaining real-sample gaps: ${closeout.realSampleGapCount}`);
assertSnapshotLine(
  checklistText,
  `next evidence target status: \`${nextTarget.status}\`, next priority \`${nextTarget.nextPriority ?? 'none'}\``,
);
assertSnapshotLine(
  checklistText,
  `current P0 target kinds: ${nextTarget.targets
    .filter((target) => target.priority === 'P0')
    .map((target) => `\`${target.gapKind}\``)
    .join(', ')}`,
);
assertSnapshotLine(checklistText, 'production runtime readiness: `no`');

assert.match(
  checklistText,
  /This snapshot must not be treated as permission to wire v3 into production, choose tools, execute tools, route permissions, decide recovery, collect samples, or change readiness thresholds/u,
);
assert.match(
  checklistText,
  /agent-session-v3-pilot-real-corpus-batch-readiness-snapshot-consistency-smoke\.ts/u,
);
assert.match(
  checklistText,
  /readiness snapshot consistency smoke coverage/u,
);

console.log('agent session v3 pilot real corpus batch readiness snapshot consistency smoke ok');
