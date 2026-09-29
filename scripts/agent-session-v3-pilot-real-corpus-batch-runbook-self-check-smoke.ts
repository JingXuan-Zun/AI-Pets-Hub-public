import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const { runbookText, checklistSource } = readProjectSources({
  runbookText: 'PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md',
  checklistSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-operator-checklist-report.ts',
});

assert.doesNotMatch(
  runbookText,
  /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'real corpus batch runbook should not mention runtime execution, permissions, concrete tools, or tool execution internals.',
);
assert.doesNotMatch(
  runbookText,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'real corpus batch runbook should not encode a fixed desktop tool chain.',
);

assert.match(
  checklistSource,
  /kind: 'agent-session-v3-pilot-real-corpus-batch-operator-checklist-report'/u,
  'operator checklist script should keep its stable result kind.',
);

const checklistCommand = 'agent-session-v3-pilot-real-corpus-batch-operator-checklist-report.ts';
const evidenceSummaryCommand = 'agent-session-v3-pilot-real-corpus-batch-evidence-summary.ts';
const handoffArtifactIntegrityCommand = 'agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts';
const handoffBundleCommand = 'agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts';
const handoffReviewerPacketSummaryCommand = 'agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts';
const handoffSampleSourceConsistencyCommand = 'agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts';
const handoffSourcePreflightRollupCommand = 'agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup.ts';
const gapActionChecklistCommand = 'agent-session-v3-pilot-real-corpus-batch-gap-action-checklist.ts';
const nextEvidenceTargetCommand = 'agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts';
const p0IntakeTargetStatusCommand = 'agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
const p0RealEvidenceCloseoutCommand = 'agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
const reviewSummaryCommand = 'agent-session-v3-pilot-real-corpus-batch-review-summary.ts';
const readinessRollupExampleCommand = 'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
const readinessRollupCommand = 'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report.ts';
const sourceDeclarationPreflightCommand = 'agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts';
const validatorCommand = 'agent-session-v3-pilot-real-corpus-batch-intake-validator.ts';
const postBundleSourceDeclarationPreflightIndex = runbookText.indexOf(
  '--handoff-dir .\\tmp-agent-v3-real-corpus-handoff',
  runbookText.indexOf('Optional: Create A Handoff Bundle'),
);
const checklistIndex = runbookText.indexOf(checklistCommand);
const evidenceSummaryIndex = runbookText.indexOf(evidenceSummaryCommand);
const handoffArtifactIntegrityIndex = runbookText.indexOf(handoffArtifactIntegrityCommand);
const handoffBundleIndex = runbookText.indexOf(handoffBundleCommand);
const handoffReviewerPacketSummaryIndex = runbookText.indexOf(handoffReviewerPacketSummaryCommand);
const handoffSampleSourceConsistencyIndex = runbookText.indexOf(handoffSampleSourceConsistencyCommand);
const handoffSourcePreflightRollupIndex = runbookText.indexOf(handoffSourcePreflightRollupCommand);
const gapActionChecklistIndex = runbookText.indexOf(gapActionChecklistCommand);
const nextEvidenceTargetIndex = runbookText.indexOf(nextEvidenceTargetCommand);
const p0IntakeTargetStatusIndex = runbookText.indexOf(p0IntakeTargetStatusCommand);
const p0RealEvidenceCloseoutIndex = runbookText.indexOf(p0RealEvidenceCloseoutCommand);
const reviewSummaryIndex = runbookText.indexOf(reviewSummaryCommand);
const readinessRollupExampleIndex = runbookText.indexOf(readinessRollupExampleCommand);
const readinessRollupIndex = runbookText.indexOf(readinessRollupCommand);
const sourceDeclarationPreflightIndex = runbookText.indexOf(sourceDeclarationPreflightCommand);
const validatorIndex = runbookText.indexOf(validatorCommand);

assert.notEqual(checklistIndex, -1, 'runbook should include the operator checklist command.');
assert.notEqual(evidenceSummaryIndex, -1, 'runbook should include the evidence summary drill-down command.');
assert.notEqual(handoffArtifactIntegrityIndex, -1, 'runbook should include the handoff artifact integrity command.');
assert.notEqual(handoffBundleIndex, -1, 'runbook should include the handoff bundle command.');
assert.notEqual(handoffReviewerPacketSummaryIndex, -1, 'runbook should include the handoff reviewer packet summary command.');
assert.notEqual(handoffSampleSourceConsistencyIndex, -1, 'runbook should include the handoff sample-source consistency command.');
assert.notEqual(handoffSourcePreflightRollupIndex, -1, 'runbook should include the handoff source preflight rollup command.');
assert.notEqual(gapActionChecklistIndex, -1, 'runbook should include the gap action checklist command.');
assert.notEqual(nextEvidenceTargetIndex, -1, 'runbook should include the next evidence target command.');
assert.notEqual(p0IntakeTargetStatusIndex, -1, 'runbook should include the P0 intake target status command.');
assert.notEqual(p0RealEvidenceCloseoutIndex, -1, 'runbook should include the P0 real evidence closeout command.');
assert.notEqual(reviewSummaryIndex, -1, 'runbook should include the batch review summary command.');
assert.notEqual(readinessRollupExampleIndex, -1, 'runbook should include the readiness rollup example command.');
assert.notEqual(readinessRollupIndex, -1, 'runbook should include the readiness rollup command.');
assert.notEqual(sourceDeclarationPreflightIndex, -1, 'runbook should include the source declaration preflight command.');
assert.notEqual(validatorIndex, -1, 'runbook should include the validator drill-down command.');
assert.notEqual(postBundleSourceDeclarationPreflightIndex, -1, 'runbook should include the post-bundle source declaration preflight command.');
assert.ok(
  nextEvidenceTargetIndex < p0IntakeTargetStatusIndex,
  'runbook should present the next evidence target report before explicit P0 intake status.',
);
assert.ok(
  p0IntakeTargetStatusIndex < gapActionChecklistIndex,
  'runbook should present explicit P0 intake status before broader gap priorities.',
);
assert.ok(
  p0IntakeTargetStatusIndex < p0RealEvidenceCloseoutIndex,
  'runbook should present explicit P0 intake status before P0 real evidence closeout.',
);
assert.ok(
  p0RealEvidenceCloseoutIndex < gapActionChecklistIndex,
  'runbook should present P0 real evidence closeout before broader gap priorities.',
);
assert.ok(
  p0IntakeTargetStatusIndex < readinessRollupExampleIndex,
  'runbook should present explicit P0 intake status before optional rollup rehearsal.',
);
assert.ok(
  p0IntakeTargetStatusIndex < reviewSummaryIndex,
  'runbook should present explicit P0 intake status before real multi-intake review.',
);
assert.ok(
  gapActionChecklistIndex < readinessRollupExampleIndex,
  'runbook should present gap priorities before optional rollup rehearsal.',
);
assert.ok(
  gapActionChecklistIndex < reviewSummaryIndex,
  'runbook should present gap priorities before real multi-intake review.',
);
assert.ok(
  sourceDeclarationPreflightIndex < reviewSummaryIndex,
  'runbook should present source declaration preflight before real multi-intake review.',
);
assert.ok(
  reviewSummaryIndex < readinessRollupIndex,
  'runbook should present batch review summary before readiness rollup detail.',
);
assert.ok(
  readinessRollupIndex < checklistIndex,
  'runbook should present readiness rollup before per-intake checklist drill-down.',
);
assert.ok(
  checklistIndex < evidenceSummaryIndex,
  'runbook should present the operator checklist before evidence summary drill-down.',
);
assert.ok(
  checklistIndex < handoffBundleIndex,
  'runbook should present checklist drill-down before optional handoff bundling.',
);
assert.ok(
  handoffBundleIndex < handoffSampleSourceConsistencyIndex,
  'runbook should present handoff bundling before optional handoff sample-source consistency checking.',
);
assert.ok(
  handoffBundleIndex < postBundleSourceDeclarationPreflightIndex,
  'runbook should present handoff bundling before post-bundle source declaration preflight.',
);
assert.ok(
  handoffBundleIndex < handoffArtifactIntegrityIndex,
  'runbook should present handoff bundling before optional handoff artifact integrity checking.',
);
assert.ok(
  postBundleSourceDeclarationPreflightIndex < handoffArtifactIntegrityIndex,
  'runbook should present post-bundle source declaration preflight before handoff artifact integrity checking.',
);
assert.ok(
  postBundleSourceDeclarationPreflightIndex < handoffSourcePreflightRollupIndex,
  'runbook should present single source declaration preflight before handoff source preflight rollup.',
);
assert.ok(
  handoffSourcePreflightRollupIndex < handoffArtifactIntegrityIndex,
  'runbook should present handoff source preflight rollup before artifact integrity checking.',
);
assert.ok(
  handoffArtifactIntegrityIndex < handoffSampleSourceConsistencyIndex,
  'runbook should present handoff artifact integrity before sample-source consistency checking.',
);
assert.ok(
  handoffSampleSourceConsistencyIndex < handoffReviewerPacketSummaryIndex,
  'runbook should present sample-source consistency before reviewer packet summary.',
);
assert.ok(
  checklistIndex < validatorIndex,
  'runbook should present the operator checklist before validator drill-down.',
);
assert.ok(
  readinessRollupExampleIndex < readinessRollupIndex,
  'runbook should present the rollup example before the multi-intake rollup report command.',
);

assert.match(runbookText, /Optional: Rehearse Readiness Rollup With An Example/u);
assert.match(runbookText, /Optional: Review Current P0 Targets And Gap Priorities/u);
assert.match(runbookText, /Before filling real exported corpus batches, first read the current evidence target context/u);
assert.match(runbookText, /AgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport status=<target-needed\|package-attention-needed\|no-target-needed> packageHealth=<status> targets=<n> nextPriority=<value> missingPackageEntries=<n> realSampleGaps=<n> P0=<n> P1=<n> P2=<n> readyForProductionRuntime=no/u);
assert.match(runbookText, /Then check any caller-owned P0 intake directories explicitly/u);
assert.match(runbookText, /Always pass each directory with `--dir`; this report does not discover directories/u);
assert.match(runbookText, /AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport status=<no-intake-dirs\|blocked\|review-needed\|ready-for-manual-review> intakes=<n> blocked=<n> reviewNeeded=<n> readyForManualReview=<n> p0Targets=<n> nextPriority=<value> readyForProductionRuntime=no/u);
assert.match(runbookText, /P0 intake target status meaning:/u);
assert.match(runbookText, /`no-intake-dirs`: no explicit `--dir` value was supplied/u);
assert.match(runbookText, /`blocked`: at least one supplied intake has validator, source declaration, source-kind, manifest, or sample-note blockers/u);
assert.match(runbookText, /`review-needed`: no supplied intake is blocked, but at least one still needs human interpretation/u);
assert.match(runbookText, /`ready-for-manual-review`: supplied intakes have no machine-detected blockers or review items/u);
assert.match(runbookText, /The same report also prints `p0TargetSignals` for the current P0 gap kinds/u);
assert.match(runbookText, /`missing`: no supplied intake currently supports that P0 evidence target/u);
assert.match(runbookText, /`blocked`: at least one supplied supporting intake has blocker evidence/u);
assert.match(runbookText, /`review-needed`: supporting intake evidence exists, but still needs human interpretation/u);
assert.match(runbookText, /`ready-for-manual-review`: supporting intake evidence has no machine-detected blocker or review item/u);
assert.match(runbookText, /After the P0 intake status and readiness rollup can both be read, use the P0 real evidence closeout report/u);
assert.match(runbookText, /AgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport status=<no-intake-dirs\|package-attention-needed\|blocked\|review-needed\|ready-for-manual-review> packageHealth=<status> nextPriority=<value> intakes=<n> p0Status=<status> p0Targets=<n> p0Blocked=<n> p0ReviewNeeded=<n> p0ReadyForManualReview=<n> readinessRollup=<status> readyForProductionRuntime=no/u);
assert.match(runbookText, /This closeout report only combines package health, next evidence target, explicit P0 intake status, and readiness rollup evidence/u);
assert.match(runbookText, /It does not collect samples, discover directories, choose thresholds, define a runtime workflow, or grant v3 production authority/u);
assert.match(runbookText, /After the target context and explicit P0 intake status are visible, you can read the current dashboard gaps as a short manual priority checklist/u);
assert.match(runbookText, /AgentSessionV3PilotRealCorpusBatchGapActionChecklist actions=<n> dashboardGaps=<n> P0=<n> P1=<n> P2=<n> readyForProductionRuntime=no/u);
assert.match(runbookText, /Use this report only to decide which evidence gaps deserve human attention first/u);
assert.match(runbookText, /`P0`: production-like samples and real exported corpus evidence/u);
assert.match(runbookText, /`P1`: broader corpus and manifest distribution evidence/u);
assert.match(runbookText, /`P2`: fixture and threshold-profile comparison evidence/u);
assert.match(runbookText, /These reports summarize existing `PROJECT_AGENT_V3_PILOT_READINESS_CHECKLIST\.md` gaps, missing-evidence state, and explicitly supplied intake directories/u);
assert.match(runbookText, /They do not discover directories, collect samples, run smoke tests, choose thresholds, define a runtime workflow, or grant v3 production authority/u);
assert.match(runbookText, /manual prioritization aids, not a runtime action order/u);
assert.match(runbookText, /caller-owned missing\/mixed\/ready example layout/u);
assert.match(runbookText, /AgentSessionV3PilotRealCorpusBatchReadinessRollupExample status=blocked/u);
assert.match(runbookText, /Use this example only to rehearse how to read the rollup report/u);
assert.match(runbookText, /`missing-intake` should demonstrate a blocked intake/u);
assert.match(runbookText, /`mixed-intake` should demonstrate a review-needed intake/u);
assert.match(runbookText, /`ready-intake` should demonstrate a ready-for-manual-review intake/u);
assert.match(runbookText, /`review-summary-report\.txt` should be read first as the one-page human overview/u);
assert.match(runbookText, /The example uses synthetic already-exported corpus artifacts/u);
assert.match(runbookText, /It does not collect desktop samples, represent a real production-like corpus, tune thresholds, or prove that v3 is production-ready/u);
assert.match(runbookText, /Replace the example directories with real caller-owned exported corpus batches/u);
assert.match(runbookText, /check caller-declared source metadata before interpreting readiness reports/u);
assert.match(runbookText, /AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight/u);
assert.match(runbookText, /Source declaration preflight status meaning:/u);
assert.match(runbookText, /`blocked`: the sample note is missing/u);
assert.match(runbookText, /`review-needed`: the sample source is explicitly `unknown`/u);
assert.match(runbookText, /`consistent`: the caller-declared `Sample source` and `Sample source status` fields are internally consistent/u);
assert.match(runbookText, /Use `--expected-source real-exported` only when the intake is meant to point at caller-owned real exported samples/u);
assert.match(runbookText, /add `--handoff-dir \.\\tmp-agent-v3-real-corpus-handoff` to compare declarations/u);
assert.match(runbookText, /This preflight does not infer realness from file content, collect samples, change readiness, define a required workflow, execute tools, decide recovery, or grant runtime authority/u);
assert.match(runbookText, /start with the batch review summary/u);
assert.match(runbookText, /one-page human overview/u);
assert.match(runbookText, /summary-only evidence view/u);
assert.match(runbookText, /where to spend human review time first/u);
assert.match(runbookText, /preserves readiness rollup status and checklist focus items/u);
assert.match(runbookText, /does not choose thresholds/u);
assert.match(runbookText, /change readiness, replace nested reports, or grant runtime authority/u);
assert.match(runbookText, /use the readiness rollup report for repeated checklist item detail/u);
assert.match(runbookText, /Then use the operator checklist report for each intake that needs drill-down/u);
assert.match(runbookText, /compresses validator, evidence-summary, and metadata-quality output into blocker, review, and info items/u);
assert.match(runbookText, /Operator checklist status meaning:/u);
assert.match(runbookText, /`blocked`: fix blocker checklist items before manual interpretation/u);
assert.match(runbookText, /`review-needed`: machine-readable checks ran far enough/u);
assert.match(runbookText, /`ready-for-manual-review`: no blocker or review checklist items were found/u);
assert.match(runbookText, /If the checklist reports blockers or you need nested detail/u);
assert.match(runbookText, /After the review summary, use the readiness rollup report/u);
assert.match(runbookText, /Readiness rollup status meaning:/u);
assert.match(runbookText, /`blocked`: at least one intake checklist is blocked/u);
assert.match(runbookText, /`review-needed`: no intake is blocked, but at least one intake still has review items/u);
assert.match(runbookText, /`ready-for-manual-review`: every intake checklist has no blocker or review items/u);
assert.match(runbookText, /Evidence summary status meaning:/u);
assert.match(runbookText, /Status meaning:/u);
assert.match(runbookText, /Optional: Create A Handoff Bundle/u);
assert.match(runbookText, /After the review summary, readiness rollup, and per-intake checklist drill-down can be interpreted/u);
assert.match(runbookText, /--sample-source real-exported/u);
assert.match(runbookText, /Use `--sample-source real-exported` only when the intake directories point at caller-owned real exported samples/u);
assert.match(runbookText, /Use `--sample-source rehearsal` for generated or synthetic rehearsal directories, including the readiness-rollup example and artifact-rehearsal smoke path/u);
assert.match(runbookText, /sampleSource=unknown/u);
assert.match(runbookText, /sampleSourceStatus=missing-real-sample-declaration/u);
assert.match(runbookText, /`README\.md`/u);
assert.match(runbookText, /`handoff-manifest\.txt`/u);
assert.match(runbookText, /`handoff-index\.json`/u);
assert.match(runbookText, /one `intake-XX-operator-checklist\.txt` and `\.json` pair per intake directory/u);
assert.match(runbookText, /records `sampleSource` and `sampleSourceStatus`/u);
assert.match(runbookText, /does not infer realness from file content/u);
assert.match(runbookText, /does not use sample source to change readiness/u);
assert.match(runbookText, /archive and share the already interpreted evidence view/u);
assert.match(runbookText, /It does not choose thresholds, change readiness, replace nested reports, collect samples, execute tools, route permissions, decide recovery, or grant runtime authority/u);
assert.match(runbookText, /Read `README\.md` first when handing the bundle to another reviewer/u);
assert.match(runbookText, /Use `handoff-manifest\.txt` for a quick plain-text file list/u);
assert.match(runbookText, /re-run source declaration preflight against the generated handoff bundle/u);
assert.match(runbookText, /--handoff-dir \.\\tmp-agent-v3-real-corpus-handoff --expected-source real-exported/u);
assert.match(runbookText, /source-declaration consistency check only/u);
assert.match(runbookText, /intake sample note and handoff bundle agree on `real-exported` \/ `real-exported-evidence`/u);
assert.match(runbookText, /does not make the handoff bundle authoritative, define a required workflow, infer realness from file content, collect samples, change readiness, execute tools, decide recovery, or grant runtime authority/u);
assert.match(runbookText, /If you are checking a generated rehearsal bundle instead of caller-owned real exported samples/u);
assert.match(runbookText, /use `--expected-source rehearsal` and expect `rehearsal` \/ `synthetic-rehearsal`/u);
assert.match(runbookText, /Do not run the `real-exported` variant against generated readiness-rollup examples or artifact-rehearsal smoke output/u);
assert.match(runbookText, /summarize several intake\/handoff source declaration checks into one handoff source preflight rollup/u);
assert.match(runbookText, /agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup\.ts/u);
assert.match(runbookText, /--case batch-a --dir \.\\tmp-agent-v3-real-corpus-a --handoff-dir \.\\tmp-agent-v3-real-corpus-handoff --expected-source real-exported/u);
assert.match(runbookText, /compact handoff source declaration view across multiple caller-owned intake directories or handoff bundles/u);
assert.match(runbookText, /summarizes source declaration preflight, handoff sample-source consistency, and reviewer packet summary status/u);
assert.match(runbookText, /aggregate `consistent`, `review-needed`, or `blocked` entries/u);
assert.match(runbookText, /does not make the handoff bundle authoritative, collect samples, change readiness, define runtime action order, execute tools, decide recovery, or grant runtime authority/u);
assert.match(runbookText, /verify that the handoff artifact paths and JSON contracts are intact/u);
assert.match(runbookText, /referenced README\/manifest\/report files/u);
assert.match(runbookText, /review summary JSON kind\/status/u);
assert.match(runbookText, /surfaces review summary optional evidence report paths as non-blocking artifact observations/u);
assert.match(runbookText, /Missing or empty optional evidence report paths do not change artifact integrity status/u);
assert.match(runbookText, /does not collect samples, run optional evidence reports, change readiness, choose thresholds, execute tools, route permissions, decide recovery, or grant runtime authority/u);
assert.match(runbookText, /readiness rollup JSON kind\/status/u);
assert.match(runbookText, /per-intake operator checklist JSON kind\/status/u);
assert.match(runbookText, /verify that the handoff sample-source declaration is consistent/u);
assert.match(runbookText, /--expected-source real-exported/u);
assert.match(runbookText, /checks only already generated bundle files/u);
assert.match(runbookText, /Treat `status=blocked` as a handoff packaging issue/u);
assert.match(runbookText, /treat `status=review-needed` as a remaining evidence-declaration gap/u);
assert.match(runbookText, /create a reviewer packet summary/u);
assert.match(runbookText, /summarizes artifact integrity, sample-source consistency, review summary status, readiness rollup status, status counts, and optional evidence report paths/u);
assert.match(runbookText, /Optional evidence report paths are reviewer-visible references only/u);
assert.match(runbookText, /missing, empty, or malformed optional evidence report entries do not change reviewer packet status and do not create reviewer packet issues/u);
assert.match(runbookText, /does not run optional evidence reports, collect samples, change readiness, choose thresholds, execute tools, route permissions, decide recovery, or grant runtime authority/u);
assert.match(runbookText, /`status=ready-for-reviewer` as a clean reviewer packet, not production readiness/u);
assert.match(runbookText, /Threshold Review Rules/u);
assert.match(runbookText, /This runbook must not:/u);
assert.match(runbookText, /replace `AgentSessionV2`/u);
assert.match(runbookText, /make v3 choose tools/u);
assert.match(runbookText, /make v3 execute tools/u);
assert.match(runbookText, /make v3 route permission/u);
assert.match(runbookText, /make v3 decide recovery/u);
assert.match(runbookText, /define a required observe, locate, execute, verify sequence/u);
assert.match(runbookText, /prioritize existing real-sample gaps before filling caller-owned intake directories/u);
assert.match(runbookText, /compress existing evidence into an operator checklist without changing runtime behavior/u);
assert.match(runbookText, /the operator checklist report has no blocker items/u);
assert.match(runbookText, /The next decision after this runbook is evidence interpretation, not production wiring/u);

console.log('agent session v3 pilot real corpus batch runbook self-check smoke ok');
