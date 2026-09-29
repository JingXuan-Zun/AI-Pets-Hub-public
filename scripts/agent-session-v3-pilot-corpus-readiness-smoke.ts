import assert from 'node:assert/strict';
import {
  createAgentSessionV3PilotDebugSampleCorpusExport,
  createAgentSessionV3PilotShadowAgreementReport,
  createAgentSessionV3PilotShadowAgreementReportExport,
  createAgentSessionV3PilotShadowDebugExport,
  evaluateAgentSessionV3PilotCorpusReadiness,
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
    reason: `${options.status} readiness sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { readinessSource, indexSource } = readProjectSources({
  readinessSource: 'src/agent/agentSessionV3PilotCorpusReadiness.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(
  readinessSource,
  /export function evaluateAgentSessionV3PilotCorpusReadiness/u,
  'v3 pilot corpus readiness evaluator should live in its own module.',
);
assert.match(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotCorpusReadiness'/u,
  'v3 pilot corpus readiness evaluator should be exported through the agent barrel.',
);
assert.doesNotMatch(
  readinessSource,
  /AgentSessionV2|runAgentSessionV2|executeAgentSessionV2|buildAgentPermissionRoute|execute_desktop|observe_windows_and_apps|locate_screen_elements|toolExecutor/u,
  'v3 pilot corpus readiness should not know v2 runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  readinessSource,
  /from 'node:fs'|writeFile|appendFile|createWriteStream|mkdir/u,
  'v3 pilot corpus readiness should not write logs directly.',
);
assert.doesNotMatch(
  readinessSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'v3 pilot corpus readiness should not encode a fixed tool chain.',
);

const alignedAndBudgetAgreementReport = createAgentSessionV3PilotShadowAgreementReport([
  createAgreement({
    status: 'aligned',
    v2Status: 'completed',
  }),
  createAgreement({
    status: 'aligned',
    v2Status: 'needs-approval',
  }),
  createAgreement({
    status: 'inconclusive',
    v2Status: 'budget-exceeded',
  }),
  createAgreement({
    status: 'inconclusive',
    v2Status: 'max-steps',
  }),
]);
const alignedAndBudgetAgreementReportExport = createAgentSessionV3PilotShadowAgreementReportExport(
  alignedAndBudgetAgreementReport,
  {
    includeSamples: true,
  },
);

const terminalShadow = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin readiness terminal sample',
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
const approvalShadow = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin readiness approval sample',
      type: 'start',
    },
    {
      reason: 'prepare approval command',
      route: 'prepare-command',
      type: 'model-decision-accepted',
    },
    {
      reason: 'approval required',
      route: 'approval',
      type: 'command-prepared',
    },
  ],
});
const recoveryFailedShadow = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin readiness recovery failed sample',
      type: 'start',
    },
    {
      reason: 'prepare approval command',
      route: 'prepare-command',
      type: 'model-decision-accepted',
    },
    {
      reason: 'approval required',
      route: 'approval',
      type: 'command-prepared',
    },
    {
      reason: 'approval granted',
      type: 'approval-granted',
    },
    {
      ok: false,
      reason: 'transaction finished with recoverable issue',
      type: 'transaction-finished',
    },
    {
      reason: 'evaluation asks recovery',
      type: 'evaluation-needs-recovery',
    },
    {
      reason: 'recovery exhausted',
      type: 'recovery-exhausted',
    },
  ],
});

const readyCorpus = createAgentSessionV3PilotDebugSampleCorpusExport({
  agreementReport: alignedAndBudgetAgreementReportExport,
  shadowDebugSamples: [
    {
      label: 'terminal',
      shadow: createAgentSessionV3PilotShadowDebugExport(terminalShadow),
    },
    {
      label: 'approval-wait',
      shadow: createAgentSessionV3PilotShadowDebugExport(approvalShadow),
    },
  ],
});
const ready = evaluateAgentSessionV3PilotCorpusReadiness({
  corpus: readyCorpus,
  thresholds: {
    minAgreementSamples: 4,
    minShadowSamples: 2,
  },
});

assert.equal(ready.kind, 'agent-session-v3-pilot-corpus-readiness');
assert.equal(ready.version, 1);
assert.equal(ready.status, 'ready');
assert.equal(ready.checks.every((check) => check.passed), true);
assert.match(ready.summaryText, /status=ready/u);
assert.equal(
  ready.checks.find((check) => check.key === 'max-blocking-inconclusive')?.actual,
  0,
);
assert.equal(
  ready.checks.find((check) => check.key === 'min-terminal-observed-shadow-samples')?.actual,
  1,
);

const strictPhaseCoverage = evaluateAgentSessionV3PilotCorpusReadiness({
  corpus: readyCorpus,
  thresholds: {
    minAgreementSamples: 4,
    minShadowSamples: 2,
    minTerminalObservedShadowSamples: 2,
    requireFullPhaseCoverage: true,
    requireNoMissingPhaseCoverage: true,
  },
});
assert.equal(strictPhaseCoverage.status, 'not-ready');
assert.equal(
  strictPhaseCoverage.checks.find((check) => check.key === 'no-missing-phase-coverage')?.actual,
  0,
);
assert.equal(
  strictPhaseCoverage.checks.find((check) => check.key === 'min-terminal-observed-shadow-samples')?.actual,
  1,
);
assert.ok(
  (strictPhaseCoverage.checks.find((check) => check.key === 'full-phase-coverage')?.actual ?? 0) > 0,
);

const fullPhaseCoverageCorpus = createAgentSessionV3PilotDebugSampleCorpusExport({
  agreementReport: alignedAndBudgetAgreementReportExport,
  shadowDebugSamples: [
    {
      label: 'terminal',
      shadow: createAgentSessionV3PilotShadowDebugExport(terminalShadow),
    },
    {
      label: 'recovery-failed',
      shadow: createAgentSessionV3PilotShadowDebugExport(recoveryFailedShadow),
    },
  ],
});
const strictFullPhaseCoverage = evaluateAgentSessionV3PilotCorpusReadiness({
  corpus: fullPhaseCoverageCorpus,
  thresholds: {
    minAgreementSamples: 4,
    minShadowSamples: 2,
    minTerminalObservedShadowSamples: 2,
    requireFullPhaseCoverage: true,
    requireNoMissingPhaseCoverage: true,
  },
});
assert.equal(strictFullPhaseCoverage.status, 'ready');
assert.equal(
  strictFullPhaseCoverage.checks.find((check) => check.key === 'full-phase-coverage')?.actual,
  0,
);
assert.equal(
  strictFullPhaseCoverage.checks.find((check) => check.key === 'no-missing-phase-coverage')?.actual,
  0,
);

const strictBudget = evaluateAgentSessionV3PilotCorpusReadiness({
  corpus: readyCorpus,
  thresholds: {
    allowInconclusiveBudgetStops: false,
    minAgreementSamples: 4,
    minShadowSamples: 2,
  },
});
assert.equal(strictBudget.status, 'not-ready');
assert.equal(
  strictBudget.checks.find((check) => check.key === 'max-blocking-inconclusive')?.actual,
  2,
);

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
    throw new Error('readiness runner failed');
  },
  enabled: true,
});
const mismatchAgreementReportExport = createAgentSessionV3PilotShadowAgreementReportExport(
  createAgentSessionV3PilotShadowAgreementReport([
    createAgreement({
      status: 'aligned',
      v2Status: 'completed',
    }),
    createAgreement({
      status: 'mismatch',
      v2Status: 'failed',
    }),
    createAgreement({
      status: 'unavailable',
      v2Status: 'completed',
    }),
  ]),
);
const blockedCorpus = createAgentSessionV3PilotDebugSampleCorpusExport({
  agreementReport: mismatchAgreementReportExport,
  shadowDebugSamples: [
    createAgentSessionV3PilotShadowDebugExport(invalidShadow),
    createAgentSessionV3PilotShadowDebugExport(driverFailedShadow),
  ],
});
const blocked = evaluateAgentSessionV3PilotCorpusReadiness({
  collectorIssueCount: 1,
  corpus: blockedCorpus,
  thresholds: {
    minAgreementSamples: 3,
    minShadowSamples: 2,
  },
});

assert.equal(blocked.status, 'not-ready');
assert.equal(blocked.checks.find((check) => check.key === 'max-mismatches')?.actual, 1);
assert.equal(blocked.checks.find((check) => check.key === 'max-unavailable')?.actual, 1);
assert.equal(blocked.checks.find((check) => check.key === 'max-collector-issues')?.actual, 1);
assert.equal(blocked.checks.find((check) => check.key === 'no-runner-failures')?.actual, 1);
assert.equal(blocked.checks.find((check) => check.key === 'no-invalid-transitions')?.actual, 1);
assert.match(blocked.summaryText, /status=not-ready/u);

const relaxed = evaluateAgentSessionV3PilotCorpusReadiness({
  collectorIssueCount: 1,
  corpus: blockedCorpus,
  thresholds: {
    maxCollectorIssues: 1,
    maxMismatches: 1,
    maxUnavailable: 1,
    minAgreementSamples: 3,
    minShadowSamples: 2,
    requireNoInvalidTransitions: false,
    requireNoRunnerFailures: false,
    requireNoShadowOmissions: false,
  },
});
assert.equal(relaxed.status, 'ready');
assert.equal(
  relaxed.checks.some((check) => check.key === 'no-runner-failures'),
  false,
);

const empty = evaluateAgentSessionV3PilotCorpusReadiness({
  corpus: createAgentSessionV3PilotDebugSampleCorpusExport({}),
});
assert.equal(empty.status, 'not-ready');
assert.equal(empty.checks.find((check) => check.key === 'min-agreement-samples')?.actual, 0);
assert.equal(empty.checks.find((check) => check.key === 'min-shadow-samples')?.actual, 0);

console.log('agent session v3 pilot corpus readiness smoke ok');
