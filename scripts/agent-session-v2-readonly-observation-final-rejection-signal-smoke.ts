import assert from 'node:assert/strict';
import {
  createAgentReadonlyObservationFinalRejection,
  type AgentSessionV2Decision,
  type AgentSessionV2ToolResultEntry,
} from '../src/agent/legacy/index.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  index: indexSource,
  runtimeSignal: runtimeSignalSource,
  session: sessionSource,
  finalResponse: finalResponseSource,
  guards: guardsSource,
  signal: signalSource,
} = readProjectSources({
  index: 'src/agent/legacy/index.ts',
  runtimeSignal: 'src/agent/runtime/agentFinalAnswerRejectionSignals.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  finalResponse: 'src/agent/productionSession/finalResponse.ts',
  guards: 'src/agent/productionSession/finalEvidenceGuards.ts',
  signal: 'src/agent/runtime/agentFinalAnswerRejectionSignals.ts',
});

assertSourceMatches(sessionSource, /from '\.\/productionSession\/finalResponse'/u, 'The root must import the checked final response module.');
assertSourceMatches(sessionSource, /const \{ prepareFinalResponse \} = createAgentProductionFinalResponse\(\{/u, 'The root must instantiate the checked final response module.');
assertSourceMatches(sessionSource, /prepareFinalResponse\(decision, stepIndex/u, 'The root must dispatch responses through the checked module.');

assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentReadonlyObservationFinalRejection/u,
  'Read-only observation final rejection should live in Runtime.',
);
assertSourceMatches(
  runtimeSignalSource,
  /readonlyObservationFinalRejectionPolicy=This rejection is advisory\/evidence-driven/u,
  'Read-only observation final rejection signal should explicitly remain advisory and evidence-driven.',
);
assertSourceMatches(
  finalResponseSource,
  /from '\.\.\/runtime\/agentFinalAnswerRejectionSignals'/u,
  'AgentSessionV2 should consume Runtime final-answer rejection signals.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function createAgentSessionV2ReadonlyObservationFinalRejection/u,
  'AgentSessionV2 should not own read-only observation final rejection signal implementation.',
);
assertSourceMatches(
  sessionSource,
  /shouldRejectAgentProductionReadonlyObservationFinal: shouldRejectAgentSessionV2ReadonlyObservationFinal/u,
  'Production session should bind the existing evidence guard from its module.',
);

assertSourceMatches(sessionSource, /from '\.\/productionSession\/finalEvidenceGuards'/u, 'The root must import the checked implementation.');
assertSourceMatches(sessionSource, /createAgentProductionFinalEvidenceGuards\(\{/u, 'The root must instantiate the reachable evidence guard module.');
assertSourceMatches(guardsSource, /function shouldRejectAgentProductionReadonlyObservationFinal/u, 'The predicate implementation must remain in the bound production module.');

const decision: AgentSessionV2Decision = {
  action: 'final_answer',
  message: 'ExampleLauncher is open.',
  understanding: {
    completedGoals: ['confirmed ExampleLauncher appears installed'],
    remainingGoals: [],
    successCriteria: 'ExampleLauncher is opened',
    userNeed: 'open ExampleLauncher',
    verificationEvidence: ['Observed installed app entry for ExampleLauncher.'],
    verificationStatus: 'satisfied',
  },
};

const toolResults: AgentSessionV2ToolResultEntry[] = [
  {
    command: {
      kind: 'tool_call',
      toolCall: {
        input: {
          includeInstalledApps: true,
          query: 'ExampleLauncher',
        },
        name: 'observe_windows_and_apps',
      },
    },
    durationMs: 12,
    finishedAt: 1000,
    result: {
      observations: [
        'Observed apps/windows: installed=5, running=0.',
      ],
      ok: true,
      responseText: 'Observed apps/windows: installed=5, running=0.',
      verification: 'Read-only observation completed.',
    },
    startedAt: 988,
  },
];

const rejectionText = createAgentReadonlyObservationFinalRejection({
  actionCoverageDependencies: {
    hasDesktopOrganizationRequest: () => false,
    hasWindowMoveToDisplayRequest: () => false,
  },
  decision,
  sourceText: '/agent open ExampleLauncher',
  toolResults,
  userGoal: 'open ExampleLauncher',
});

assert.match(
  rejectionText,
  /The model produced a rejected final_answer because only read-only observation tools have run/u,
);
assert.match(
  rejectionText,
  /Rule: read-only observation can identify candidates, but it cannot satisfy open\/start\/launch\/control requests/u,
);
assert.match(rejectionText, /requestedActionCoverage=open-or-launch=open\/focus\/launch the requested app or resource/u);
assert.match(rejectionText, /observedTools=observe_windows_and_apps/u);
assert.match(rejectionText, /readonlyObservationFinalRejectionPolicy=This rejection is advisory\/evidence-driven/u);
assert.match(rejectionText, /Next action must request approval/u);
assert.match(rejectionText, /rejectedMessage=ExampleLauncher is open/u);
assert.doesNotMatch(
  rejectionText,
  /open_app\s*->\s*wait_ui\s*->\s*locate\s*->\s*click\s*->\s*verify/iu,
  'Read-only observation final rejection signal should not encode a fixed tool chain.',
);

const explicitDirectActionText = createAgentReadonlyObservationFinalRejection({
  actionCoverageDependencies: {
    hasDesktopOrganizationRequest: () => false,
    hasWindowMoveToDisplayRequest: () => false,
  },
  decision: {
    action: 'final_answer',
    message: 'Done.',
  },
  sourceText: '/agent do the thing',
  toolResults: [],
  userGoal: 'do the thing',
});

assert.match(explicitDirectActionText, /requestedActionCoverage=explicit direct action request/u);
assert.match(explicitDirectActionText, /observedTools=none/u);

console.log('agent session v2 readonly observation final rejection signal smoke ok');
