import assert from 'node:assert/strict';
import {
  createAgentSessionV3PilotShadowAgreementReport,
  createAgentSessionV3PilotShadowAgreementReportExport,
  createAgentSessionV3PilotShadowDebugExport,
  runAgentSessionV3PilotDiagnosticSampleRunner,
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
    reason: `${options.status} diagnostic runner sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { runnerSource, indexSource } = readProjectSources({
  runnerSource: 'src/agent/agentSessionV3PilotDiagnosticSampleRunner.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(
  runnerSource,
  /export async function runAgentSessionV3PilotDiagnosticSampleRunner/u,
  'v3 pilot diagnostic sample runner should live in its own module.',
);
assert.match(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotDiagnosticSampleRunner'/u,
  'v3 pilot diagnostic sample runner should be exported through the agent barrel.',
);
assert.doesNotMatch(
  runnerSource,
  /AgentSessionV2|runAgentSessionV2|executeAgentSessionV2|buildAgentPermissionRoute|execute_desktop|observe_windows_and_apps|locate_screen_elements|toolExecutor/u,
  'v3 pilot diagnostic sample runner should not know v2 runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  runnerSource,
  /from 'node:fs'|writeFile|appendFile|createWriteStream|mkdir/u,
  'v3 pilot diagnostic sample runner should not write logs directly.',
);
assert.doesNotMatch(
  runnerSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'v3 pilot diagnostic sample runner should not encode a fixed tool chain.',
);

const agreementReportExport = createAgentSessionV3PilotShadowAgreementReportExport(
  createAgentSessionV3PilotShadowAgreementReport([
    createAgreement({
      status: 'aligned',
      v2Status: 'completed',
    }),
    createAgreement({
      status: 'inconclusive',
      v2Status: 'budget-exceeded',
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

const terminalExport = createAgentSessionV3PilotShadowDebugExport(terminalShadow);
const waitingExport = createAgentSessionV3PilotShadowDebugExport(waitingShadow);

const collected = await runAgentSessionV3PilotDiagnosticSampleRunner({
  agreementReport: {
    collect: async () => agreementReportExport,
  },
  includeJsonText: true,
  label: 'smoke-collected',
  shadowDebugSamples: [
    {
      collect: () => terminalExport,
      label: 'terminal',
    },
    {
      collect: async () => waitingExport,
      label: 'waiting',
    },
  ],
});

assert.equal(collected.kind, 'agent-session-v3-pilot-diagnostic-sample-run');
assert.equal(collected.version, 1);
assert.equal(collected.label, 'smoke-collected');
assert.equal(collected.status, 'collected');
assert.equal(collected.issueCount, 0);
assert.equal(collected.collection.corpus.counts.agreementSampleCount, 2);
assert.equal(collected.collection.corpus.counts.shadowDebugSampleCount, 2);
assert.equal(collected.collection.corpus.counts.shadowAnomalySampleCount, 1);
assert.match(collected.summaryText, /agreementSamples=2/u);
assert.ok(collected.jsonText);
assert.equal(JSON.parse(collected.jsonText).kind, 'agent-session-v3-pilot-debug-sample-corpus');
assert.doesNotMatch(collected.jsonText, /\n/u);

const partial = await runAgentSessionV3PilotDiagnosticSampleRunner({
  includeJsonText: true,
  label: 'smoke-partial',
  prettyJson: true,
  shadowDebugSamples: [
    {
      collect: () => {
        throw new Error('diagnostic shadow producer failed');
      },
      label: 'bad-shadow',
    },
    waitingExport,
  ],
});

assert.equal(partial.status, 'partial');
assert.equal(partial.issueCount, 1);
assert.equal(partial.collection.issues[0]?.label, 'bad-shadow');
assert.equal(partial.collection.corpus.counts.shadowDebugSampleCount, 1);
assert.ok(partial.jsonText);
assert.match(partial.jsonText, /\n/u);
assert.equal(JSON.parse(partial.jsonText).counts.shadowAnomalySampleCount, 1);

const failed = await runAgentSessionV3PilotDiagnosticSampleRunner({
  agreementReport: {
    collect: async () => {
      throw new Error('diagnostic agreement producer failed');
    },
  },
  shadowDebugSamples: [{
    collect: async () => {
      throw new Error('diagnostic shadow producer failed');
    },
    label: 'failed-shadow',
  }],
});

assert.equal(failed.status, 'failed');
assert.equal(failed.issueCount, 2);
assert.equal(failed.jsonText, null);
assert.equal(failed.collection.corpus.counts.agreementSampleCount, 0);
assert.equal(failed.collection.corpus.counts.shadowDebugSampleCount, 0);

const empty = await runAgentSessionV3PilotDiagnosticSampleRunner({
  includeJsonText: true,
  label: 'empty',
});
assert.equal(empty.status, 'collected');
assert.equal(empty.issueCount, 0);
assert.equal(empty.collection.corpus.counts.agreementSampleCount, 0);
assert.equal(empty.collection.corpus.counts.shadowDebugSampleCount, 0);
assert.ok(empty.jsonText);

console.log('agent session v3 pilot diagnostic sample runner smoke ok');
