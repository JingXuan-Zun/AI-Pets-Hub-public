import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createAgentSessionV3PilotDebugSampleCorpusExport,
  createAgentSessionV3PilotShadowAgreementReport,
  createAgentSessionV3PilotShadowAgreementReportExport,
  createAgentSessionV3PilotShadowDebugExport,
  runAgentSessionV3PilotShadowMode,
  type AgentSessionV3PilotShadowAgreement,
} from '../src/agent/legacy/index.ts';
import { runAgentSessionV3PilotBaselineCorpusManifestReport } from './agent-session-v3-pilot-baseline-corpus-manifest-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport } from './agent-session-v3-pilot-real-corpus-batch-operator-checklist-report.ts';
import { readProjectSources } from './smokeTestHarness.ts';

function createAgreement(
  options: Pick<AgentSessionV3PilotShadowAgreement, 'status' | 'v2Status'>,
): AgentSessionV3PilotShadowAgreement {
  return {
    expectations: [],
    observed: {
      lastEvent: null,
      phase: null,
      runnerStatus: null,
      shadowStatus: null,
      terminalStatus: null,
      transitionCount: null,
    },
    reason: `${options.status} real corpus operator checklist sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

function getChecklistItemIds(
  report: Awaited<ReturnType<typeof runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport>>,
) {
  return new Set(report.checklistItems.map((item) => item.id));
}

async function writeFilledSampleNote(notePath: string) {
  const noteText = await readFile(notePath, 'utf8');

  await writeFile(
    notePath,
    noteText
      .replaceAll('replace-with-real-batch-label', 'ready-real-batch')
      .replaceAll('replace-with-export-date', '2026-06-23')
      .replaceAll('replace-with-machine-app-mode-or-branch', 'local-dev-agent-session-v2-shadow')
      .replaceAll('replace-with-scenario-family', 'terminal-state-alignment')
      .replaceAll('replace-with-export-command-or-manual-source', 'manual debug corpus export')
      .replaceAll('replace-with-sample-source-real-exported-rehearsal-or-unknown', 'real-exported')
      .replaceAll('replace-with-sample-source-status', 'real-exported-evidence')
      .replaceAll('replace-with-corpus-json-paths', './corpora/ready-corpus.json')
      .replaceAll('replace-with-sample-count', '12')
      .replaceAll('replace-with-intake-dir', 'tmp-agent-v3-real-corpus')
      .replaceAll('replace-with-ready-mixed-not-ready-empty-or-missing', 'ready')
      .replaceAll('replace-with-manifestSources', '1')
      .replaceAll('replace-with-indexManifests', '2')
      .replaceAll('ready=replace mixed=replace notReady=replace empty=replace', 'ready=2 mixed=0 notReady=0 empty=0')
      .replaceAll('yes/no and why', 'no, this batch only confirms local baseline alignment')
      .replaceAll('replace-with-p0-intake-dir', 'tmp-agent-v3-real-corpus')
      .replaceAll('replace-with-real-production-like-sample-signal', 'ready-for-manual-review')
      .replaceAll('replace-with-real-exported-corpus-signal', 'ready-for-manual-review')
      .replaceAll('replace-with-short-assessment', 'sufficient for manual baseline comparison')
      .replaceAll('replace-with-scope', 'v3 mirror alignment for this local sample set')
      .replaceAll('replace-with-limitations', 'no production runtime authority')
      .replaceAll('replace-with-next-samples', 'broader production-like traces')
      .replaceAll('keep-current / compare-profiles / propose-manual-review', 'keep-current'),
    'utf8',
  );
}

const { checklistSource } = readProjectSources({
  checklistSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-operator-checklist-report.ts',
});

assert.match(
  checklistSource,
  /export async function runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport/u,
  'operator checklist report should expose a caller-owned runner.',
);
assert.doesNotMatch(
  checklistSource,
  /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'operator checklist report should not know runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  checklistSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'operator checklist report should not encode a fixed desktop tool chain.',
);

const missingTempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-operator-checklist-missing-'));
try {
  const missingChecklist = await runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport({
    includeJsonText: true,
    intakeDir: missingTempDir,
    prettyJson: true,
  });

  assert.equal(missingChecklist.kind, 'agent-session-v3-pilot-real-corpus-batch-operator-checklist-report');
  assert.equal(missingChecklist.version, 1);
  assert.equal(missingChecklist.status, 'blocked');
  assert.equal(missingChecklist.evidenceSummary.status, 'blocked');
  assert.equal(missingChecklist.evidenceSummary.validator.status, 'missing');
  assert.equal(missingChecklist.evidenceSummary.phaseCoverageCounts.status, 'unavailable');
  assert.ok(missingChecklist.blockerCount >= 4);
  assert.ok(missingChecklist.reviewCount >= 2);
  assert.ok(missingChecklist.infoCount >= 2);
  const ids = getChecklistItemIds(missingChecklist);
  assert.ok(ids.has('gap-missing-required-files'));
  assert.ok(ids.has('gap-schema-issues'));
  assert.ok(ids.has('gap-path-issues'));
  assert.ok(ids.has('gap-consistency-issues'));
  assert.ok(ids.has('gap-note-missing'));
  assert.ok(ids.has('metadata-quality-issue-samples'));
  assert.ok(ids.has('evidence-summary-status'));
  assert.ok(ids.has('runbook-manual-review'));
  assert.match(missingChecklist.summaryText, /status=blocked/u);
  assert.match(missingChecklist.summaryText, /phaseCoverage=unavailable/u);
  assert.match(missingChecklist.reportText, /operatorChecklist:/u);
  assert.match(missingChecklist.reportText, /phaseCoverageCalibration status=unavailable/u);
  assert.match(missingChecklist.reportText, /PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK\.md/u);
  assert.ok(missingChecklist.jsonText);
  assert.deepEqual(JSON.parse(missingChecklist.jsonText), {
    ...missingChecklist,
    jsonText: null,
  });
} finally {
  await rm(missingTempDir, {
    force: true,
    recursive: true,
  });
}

const shadowResult = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin real corpus operator checklist sample',
      type: 'start',
    },
    {
      reason: 'terminal answer',
      route: 'terminal',
      terminalStatus: 'completed',
      type: 'model-decision-accepted',
    },
  ],
});
const shadowExport = createAgentSessionV3PilotShadowDebugExport(shadowResult);

function createCorpus(status: AgentSessionV3PilotShadowAgreement['status']) {
  return createAgentSessionV3PilotDebugSampleCorpusExport({
    agreementReport: createAgentSessionV3PilotShadowAgreementReportExport(
      createAgentSessionV3PilotShadowAgreementReport([
        createAgreement({
          status,
          v2Status: status === 'aligned' ? 'completed' : 'failed',
        }),
      ]),
      {
        includeSamples: true,
      },
    ),
    shadowDebugSamples: [{
      label: `${status}-shadow`,
      shadow: shadowExport,
    }],
  });
}

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-operator-checklist-'));
try {
  const intakeTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: tempDir,
    prettyJson: true,
  });
  await runAgentSessionV3PilotBaselineCorpusManifestReport({
    maxShadowDebugSamples: 3,
    outDir: path.join(tempDir, 'baseline'),
    prettyJson: true,
  });

  const corpusDir = path.join(tempDir, 'corpora');
  await mkdir(corpusDir, {
    recursive: true,
  });
  await writeFile(
    path.join(corpusDir, 'ready-corpus.json'),
    JSON.stringify(createCorpus('aligned')),
    'utf8',
  );
  await writeFile(
    path.join(corpusDir, 'mismatch-corpus.json'),
    JSON.stringify(createCorpus('mismatch')),
    'utf8',
  );

  assert.ok(intakeTemplate.indexPath);
  assert.ok(intakeTemplate.manifestPath);
  assert.ok(intakeTemplate.notePath);
  await writeFile(
    intakeTemplate.manifestPath,
    JSON.stringify({
      ...intakeTemplate.manifest,
      sources: [
        {
          label: 'ready-real-batch',
          path: './corpora/ready-corpus.json',
        },
        {
          label: 'mismatch-real-batch',
          path: './corpora/mismatch-corpus.json',
        },
      ],
    }, null, 2),
    'utf8',
  );

  const reviewChecklist = await runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport({
    includeJsonText: true,
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(reviewChecklist.status, 'review-needed');
  assert.equal(reviewChecklist.evidenceSummary.status, 'manual-review-needed');
  assert.equal(reviewChecklist.evidenceSummary.validator.status, 'mixed');
  assert.equal(reviewChecklist.evidenceSummary.phaseCoverageCounts.status, 'clean');
  assert.equal(reviewChecklist.blockerCount, 0);
  assert.ok(reviewChecklist.reviewCount >= 3);
  assert.ok(getChecklistItemIds(reviewChecklist).has('gap-index-mixed'));
  assert.ok(getChecklistItemIds(reviewChecklist).has('gap-note-incomplete'));
  assert.ok(getChecklistItemIds(reviewChecklist).has('gap-metadata-quality-review'));
  assert.ok(getChecklistItemIds(reviewChecklist).has('metadata-quality-issue-samples'));
  assert.match(reviewChecklist.summaryText, /status=review-needed/u);
  assert.match(reviewChecklist.summaryText, /phaseCoverage=clean/u);
  assert.match(reviewChecklist.reportText, /id=gap-index-mixed/u);
  assert.match(reviewChecklist.reportText, /phaseCoverageCalibration status=clean/u);
  assert.ok(reviewChecklist.jsonText);

  await writeFile(
    intakeTemplate.manifestPath,
    JSON.stringify({
      ...intakeTemplate.manifest,
      sources: [
        {
          label: 'ready-real-batch',
          path: './corpora/ready-corpus.json',
        },
      ],
    }, null, 2),
    'utf8',
  );
  await writeFile(
    intakeTemplate.indexPath,
    JSON.stringify({
      ...intakeTemplate.index,
      batches: [
        {
          generatedAt: '2026-06-23T10:00:00.000Z',
          label: 'baseline-artifact-flow',
          manifestPath: './baseline/explicit-debug-corpus-manifest.json',
          notes: 'baseline bundle generated by the reviewed baseline evidence artifact flow',
          sourceKind: 'baseline',
        },
        {
          generatedAt: '2026-06-23T10:05:00.000Z',
          label: 'ready-real-batch',
          manifestPath: './real-corpus-manifest.json',
          notes: 'caller-owned production-like exported corpus batch for manual review',
          sourceKind: 'production-like',
        },
      ],
    }, null, 2),
    'utf8',
  );
  await writeFilledSampleNote(intakeTemplate.notePath);

  const readyChecklist = await runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport({
    includeJsonText: true,
    intakeDir: tempDir,
    prettyJson: true,
  });

  assert.equal(readyChecklist.status, 'ready-for-manual-review');
  assert.equal(readyChecklist.evidenceSummary.status, 'manual-review-ready');
  assert.equal(readyChecklist.evidenceSummary.validator.status, 'ready');
  assert.equal(readyChecklist.evidenceSummary.phaseCoverageCounts.status, 'clean');
  assert.equal(readyChecklist.blockerCount, 0);
  assert.equal(readyChecklist.reviewCount, 0);
  assert.equal(readyChecklist.infoCount, 2);
  assert.deepEqual(
    readyChecklist.checklistItems.map((item) => item.id).sort(),
    ['evidence-summary-status', 'runbook-manual-review'],
  );
  assert.match(readyChecklist.summaryText, /status=ready-for-manual-review/u);
  assert.match(readyChecklist.summaryText, /phaseCoverage=clean/u);
  assert.match(readyChecklist.reportText, /operatorChecklist:/u);
  assert.ok(readyChecklist.jsonText);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch operator checklist report smoke ok');
