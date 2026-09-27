import assert from 'node:assert/strict';
import {
  createAgentSessionV3PilotDebugSampleCorpusExport,
  createAgentSessionV3PilotShadowAgreementReport,
  createAgentSessionV3PilotShadowAgreementReportExport,
  createAgentSessionV3PilotShadowDebugExport,
  runAgentSessionV3PilotShadowMode,
  stringifyAgentSessionV3PilotDebugSampleCorpusExport,
  type AgentSessionV3PilotShadowAgreement,
  type AgentSessionV3PilotShadowDebugExport,
} from '../src/agent/legacy/index.ts';
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
    reason: `${options.status} corpus sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { corpusSource, indexSource } = readProjectSources({
  corpusSource: 'src/agent/agentSessionV3PilotDebugSampleCorpus.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(
  corpusSource,
  /export function createAgentSessionV3PilotDebugSampleCorpusExport/u,
  'v3 pilot debug sample corpus export helper should live in its own module.',
);
assert.match(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotDebugSampleCorpus'/u,
  'v3 pilot debug sample corpus helper should be exported through the agent barrel.',
);
assert.doesNotMatch(
  corpusSource,
  /AgentSessionV2|runAgentSessionV2|executeAgentSessionV2|buildAgentPermissionRoute|execute_desktop|observe_windows_and_apps|locate_screen_elements|toolExecutor/u,
  'v3 pilot debug sample corpus should not know v2 runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  corpusSource,
  /from 'node:fs'|writeFile|appendFile|createWriteStream|mkdir/u,
  'v3 pilot debug sample corpus should not write logs directly.',
);
assert.doesNotMatch(
  corpusSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'v3 pilot debug sample corpus should not encode a fixed tool chain.',
);

const agreementReport = createAgentSessionV3PilotShadowAgreementReport([
  {
    agreement: createAgreement({
      status: 'aligned',
      v2Status: 'completed',
    }),
    label: 'aligned completed',
  },
  {
    agreement: createAgreement({
      status: 'inconclusive',
      v2Status: 'budget-exceeded',
    }),
    label: 'budget stop',
  },
]);
const agreementReportExport = createAgentSessionV3PilotShadowAgreementReportExport(agreementReport, {
  includeSamples: true,
});

const terminalShadow = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin terminal sample',
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

const waitingShadow = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [{
    reason: 'begin waiting sample',
    type: 'start',
  }],
});

const invalidShadow = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [{
    reason: 'invalid event first',
    route: 'execute',
    type: 'command-prepared',
  }],
});

const driverFailedShadow = await runAgentSessionV3PilotShadowMode({
  driver: () => {
    throw new Error('sample corpus driver failed');
  },
  enabled: true,
});

const terminalExport = createAgentSessionV3PilotShadowDebugExport(terminalShadow);
const waitingExport = createAgentSessionV3PilotShadowDebugExport(waitingShadow);
const invalidExport = createAgentSessionV3PilotShadowDebugExport(invalidShadow);
const driverFailedExport = createAgentSessionV3PilotShadowDebugExport(driverFailedShadow);

const corpus = createAgentSessionV3PilotDebugSampleCorpusExport({
  agreementReport: agreementReportExport,
  shadowDebugSamples: [
    {
      label: 'terminal',
      shadow: terminalExport,
    },
    {
      label: 'waiting',
      shadow: waitingExport,
    },
    {
      label: 'invalid',
      shadow: invalidExport,
    },
    driverFailedExport,
  ],
});

assert.equal(corpus.kind, 'agent-session-v3-pilot-debug-sample-corpus');
assert.equal(corpus.version, 1);
assert.equal(corpus.agreementReport?.sampleCount, 2);
assert.equal(corpus.counts.agreementSampleCount, 2);
assert.equal(corpus.counts.shadowDebugSampleCount, 4);
assert.equal(corpus.counts.shadowAnomalySampleCount, 3);
assert.equal(corpus.counts.shadowModeStatusCounts.observed, 3);
assert.equal(corpus.counts.shadowModeStatusCounts.omitted, 1);
assert.equal(corpus.counts.shadowModeStatusCounts.disabled, 0);
assert.equal(corpus.counts.shadowRunnerStatusCounts.terminal, 1);
assert.equal(corpus.counts.shadowRunnerStatusCounts['waiting-for-event'], 1);
assert.equal(corpus.counts.shadowRunnerStatusCounts['invalid-transition'], 1);
assert.equal(corpus.counts.shadowRunnerStatusCounts['driver-failed'], 1);
assert.equal(corpus.counts.shadowRunnerStatusCounts.none, 0);
assert.equal(corpus.counts.shadowPhaseCoverage.coveredSampleCount, 4);
assert.equal(corpus.counts.shadowPhaseCoverage.missingCoverageSampleCount, 0);
assert.equal(corpus.counts.shadowPhaseCoverage.terminalObservedSampleCount, 1);
assert.equal(corpus.counts.shadowPhaseCoverage.acceptedTransitionCount, 3);
assert.equal(corpus.counts.shadowPhaseCoverage.rejectedTransitionCount, 1);
assert.equal(corpus.counts.shadowPhaseCoverage.statusCounts.terminal, 1);
assert.equal(corpus.counts.shadowPhaseCoverage.statusCounts.partial, 1);
assert.equal(corpus.counts.shadowPhaseCoverage.statusCounts.invalid, 2);
assert.equal(corpus.counts.shadowPhaseCoverage.statusCounts.missing, 0);
assert.equal(corpus.counts.shadowPhaseCoverage.phaseVisitCounts.init, 4);
assert.equal(corpus.counts.shadowPhaseCoverage.phaseVisitCounts.model_decision, 2);
assert.equal(corpus.counts.shadowPhaseCoverage.phaseVisitCounts.done, 1);
assert.equal(corpus.counts.shadowPhaseCoverage.phaseVisitCounts.execute_transaction, 0);
assert.equal(corpus.counts.shadowPhaseCoverage.eventTypeCounts.start, 2);
assert.equal(corpus.counts.shadowPhaseCoverage.eventTypeCounts['model-decision-accepted'], 1);
assert.equal(corpus.counts.shadowPhaseCoverage.eventTypeCounts['command-prepared'], 1);
assert.deepEqual(corpus.counts.shadowPhaseCoverage.unvisitedPhasesAcrossCorpus, [
  'prepare_command',
  'needs_approval',
  'execute_transaction',
  'evaluate',
  'recover',
  'failed',
]);
assert.equal(corpus.shadowDebugSamples?.[0]?.label, 'terminal');
assert.equal(corpus.shadowDebugSamples?.[3]?.label, null);
assert.match(corpus.summaryText, /agreementSamples=2/u);
assert.match(corpus.summaryText, /shadowSamples=4/u);
assert.match(corpus.summaryText, /shadowAnomalies=3/u);
assert.match(corpus.summaryText, /shadowMode=observed=3,omitted=1/u);
assert.match(corpus.summaryText, /shadowRunner=driver-failed=1,invalid-transition=1,terminal=1,waiting-for-event=1/u);
assert.match(corpus.summaryText, /phaseCoverage=invalid=2,partial=1,terminal=1/u);
assert.match(corpus.summaryText, /unvisitedPhases=prepare_command,needs_approval,execute_transaction,evaluate,recover,failed/u);

const compactCorpus = createAgentSessionV3PilotDebugSampleCorpusExport({
  agreementReport: agreementReportExport,
  shadowDebugSamples: [terminalExport, waitingExport],
}, {
  includeAgreementReport: false,
  includeShadowDebugSamples: false,
});
assert.equal(compactCorpus.agreementReport, undefined);
assert.equal(compactCorpus.shadowDebugSamples, undefined);
assert.equal(compactCorpus.counts.agreementSampleCount, 2);
assert.equal(compactCorpus.counts.shadowDebugSampleCount, 2);
assert.equal(compactCorpus.counts.shadowPhaseCoverage.coveredSampleCount, 2);

const limitedCorpus = createAgentSessionV3PilotDebugSampleCorpusExport({
  agreementReport: agreementReportExport,
  shadowDebugSamples: [terminalExport, waitingExport, invalidExport],
}, {
  maxShadowDebugSamples: 1,
});
assert.equal(limitedCorpus.shadowDebugSamples?.length, 1);
assert.equal(limitedCorpus.counts.shadowDebugSampleCount, 3);

const emptyCorpus = createAgentSessionV3PilotDebugSampleCorpusExport({});
assert.equal(emptyCorpus.counts.agreementSampleCount, 0);
assert.equal(emptyCorpus.counts.shadowDebugSampleCount, 0);
assert.equal(emptyCorpus.counts.shadowPhaseCoverage.coveredSampleCount, 0);
assert.deepEqual(emptyCorpus.counts.shadowPhaseCoverage.unvisitedPhasesAcrossCorpus, [
  'init',
  'model_decision',
  'prepare_command',
  'needs_approval',
  'execute_transaction',
  'evaluate',
  'recover',
  'done',
  'failed',
]);
assert.match(emptyCorpus.summaryText, /shadowMode=none/u);
assert.match(emptyCorpus.summaryText, /shadowRunner=none/u);
assert.match(emptyCorpus.summaryText, /phaseCoverage=none/u);

const legacyShadowWithoutPhaseCoverage: AgentSessionV3PilotShadowDebugExport = {
  ...terminalExport,
};
delete legacyShadowWithoutPhaseCoverage.phaseCoverage;
const legacyCorpus = createAgentSessionV3PilotDebugSampleCorpusExport({
  shadowDebugSamples: [legacyShadowWithoutPhaseCoverage],
});
assert.equal(legacyCorpus.counts.shadowPhaseCoverage.coveredSampleCount, 0);
assert.equal(legacyCorpus.counts.shadowPhaseCoverage.missingCoverageSampleCount, 1);
assert.equal(legacyCorpus.counts.shadowPhaseCoverage.statusCounts.missing, 1);
assert.match(legacyCorpus.summaryText, /phaseCoverage=missing=1/u);

const jsonText = stringifyAgentSessionV3PilotDebugSampleCorpusExport(corpus);
assert.deepEqual(JSON.parse(jsonText), corpus);
assert.doesNotMatch(jsonText, /\n/u);

const prettyJson = stringifyAgentSessionV3PilotDebugSampleCorpusExport(corpus, {
  pretty: true,
});
assert.deepEqual(JSON.parse(prettyJson), corpus);
assert.match(prettyJson, /\n/u);

const shadowSamples: AgentSessionV3PilotShadowDebugExport[] = [
  terminalExport,
  waitingExport,
];
assert.equal(
  createAgentSessionV3PilotDebugSampleCorpusExport({ shadowDebugSamples: shadowSamples })
    .counts.shadowDebugSampleCount,
  2,
);

console.log('agent session v3 pilot debug sample corpus smoke ok');
