import assert from 'node:assert/strict';
import {
  collectAgentSessionV3PilotDebugSampleCorpus,
  createAgentSessionV3PilotShadowAgreementReport,
  createAgentSessionV3PilotShadowAgreementReportExport,
  createAgentSessionV3PilotShadowDebugExport,
  runAgentSessionV3PilotShadowMode,
  type AgentSessionV3PilotShadowAgreement,
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
    reason: `${options.status} collector sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { collectorSource, indexSource } = readProjectSources({
  collectorSource: 'src/agent/agentSessionV3PilotDebugSampleCollector.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(
  collectorSource,
  /export async function collectAgentSessionV3PilotDebugSampleCorpus/u,
  'v3 pilot debug sample collector should live in its own module.',
);
assert.match(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotDebugSampleCollector'/u,
  'v3 pilot debug sample collector should be exported through the agent barrel.',
);
assert.doesNotMatch(
  collectorSource,
  /AgentSessionV2|runAgentSessionV2|executeAgentSessionV2|buildAgentPermissionRoute|execute_desktop|observe_windows_and_apps|locate_screen_elements|toolExecutor/u,
  'v3 pilot debug sample collector should not know v2 runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  collectorSource,
  /from 'node:fs'|writeFile|appendFile|createWriteStream|mkdir/u,
  'v3 pilot debug sample collector should not write logs directly.',
);
assert.doesNotMatch(
  collectorSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'v3 pilot debug sample collector should not encode a fixed tool chain.',
);

const agreementReportExport = createAgentSessionV3PilotShadowAgreementReportExport(
  createAgentSessionV3PilotShadowAgreementReport([
    createAgreement({
      status: 'aligned',
      v2Status: 'completed',
    }),
    createAgreement({
      status: 'inconclusive',
      v2Status: 'max-steps',
    }),
  ]),
);

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

const terminalExport = createAgentSessionV3PilotShadowDebugExport(terminalShadow);
const waitingExport = createAgentSessionV3PilotShadowDebugExport(waitingShadow);
const invalidExport = createAgentSessionV3PilotShadowDebugExport(invalidShadow);

const collected = await collectAgentSessionV3PilotDebugSampleCorpus({
  agreementReport: {
    collect: async () => agreementReportExport,
  },
  corpusOptions: {
    maxShadowDebugSamples: 2,
  },
  shadowDebugSamples: [
    {
      collect: () => terminalExport,
      label: 'terminal-provider',
    },
    {
      collect: async () => ({
        label: 'waiting-returned',
        shadow: waitingExport,
      }),
      label: 'waiting-provider',
    },
    invalidExport,
    null,
  ],
});

assert.equal(collected.status, 'collected');
assert.deepEqual(collected.issues, []);
assert.equal(collected.corpus.counts.agreementSampleCount, 2);
assert.equal(collected.corpus.counts.shadowDebugSampleCount, 3);
assert.equal(collected.corpus.counts.shadowAnomalySampleCount, 2);
assert.equal(collected.corpus.shadowDebugSamples?.length, 2);
assert.equal(collected.corpus.shadowDebugSamples?.[0]?.label, 'terminal-provider');
assert.equal(collected.corpus.shadowDebugSamples?.[1]?.label, 'waiting-returned');

const partial = await collectAgentSessionV3PilotDebugSampleCorpus({
  agreementReport: {
    collect: () => {
      throw new Error('agreement producer failed');
    },
  },
  corpusOptions: {
    includeShadowDebugSamples: false,
  },
  shadowDebugSamples: [
    {
      collect: () => {
        throw new Error('shadow producer failed');
      },
      label: 'bad-shadow',
    },
    waitingExport,
  ],
});

assert.equal(partial.status, 'partial');
assert.equal(partial.issues.length, 2);
assert.equal(partial.issues[0]?.source, 'agreement-report');
assert.match(partial.issues[0]?.errorText ?? '', /agreement producer failed/u);
assert.equal(partial.issues[1]?.source, 'shadow-debug');
assert.equal(partial.issues[1]?.index, 0);
assert.equal(partial.issues[1]?.label, 'bad-shadow');
assert.equal(partial.corpus.counts.agreementSampleCount, 0);
assert.equal(partial.corpus.counts.shadowDebugSampleCount, 1);
assert.equal(partial.corpus.shadowDebugSamples, undefined);

const failed = await collectAgentSessionV3PilotDebugSampleCorpus({
  agreementReport: {
    collect: async () => {
      throw new Error('agreement failed');
    },
  },
  shadowDebugSamples: [{
    collect: async () => {
      throw new Error('shadow failed');
    },
    label: 'failed-shadow',
  }],
});

assert.equal(failed.status, 'failed');
assert.equal(failed.issues.length, 2);
assert.equal(failed.corpus.counts.agreementSampleCount, 0);
assert.equal(failed.corpus.counts.shadowDebugSampleCount, 0);

const direct = await collectAgentSessionV3PilotDebugSampleCorpus({
  agreementReport: agreementReportExport,
  shadowDebugSamples: [{
    label: 'direct-terminal',
    shadow: terminalExport,
  }],
});

assert.equal(direct.status, 'collected');
assert.equal(direct.corpus.counts.agreementSampleCount, 2);
assert.equal(direct.corpus.counts.shadowDebugSampleCount, 1);
assert.equal(direct.corpus.shadowDebugSamples?.[0]?.label, 'direct-terminal');

const empty = await collectAgentSessionV3PilotDebugSampleCorpus({});
assert.equal(empty.status, 'collected');
assert.deepEqual(empty.issues, []);
assert.equal(empty.corpus.counts.agreementSampleCount, 0);
assert.equal(empty.corpus.counts.shadowDebugSampleCount, 0);

console.log('agent session v3 pilot debug sample collector smoke ok');
