import assert from 'node:assert/strict';
import {
  createAgentActionPrimitiveSignature,
  createAgentRankedRecoveryStrategies,
  createAgentReplanSignalText,
  createAgentResultVerificationSignalText,
  createAgentToolCallSignature,
  createAgentTraceStuckSignalText,
  formatAgentActionEvidence,
  formatAgentStructuredCandidates,
  getAgentActionEvidence,
  getAgentStructuredEvidence,
  getLatestAgentToolResult,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentReplanSignalDependencies,
  type AgentSessionV2Step,
  type AgentSessionV2ToolResultEntry,
  type AgentSessionV2TraceEvent,
} from '../src/agent/legacy/index.ts';
import { createAgentResultVerificationSignalText } from '../src/agent/runtime/agentResultVerificationSignal.ts';
import { createAgentActionPrimitiveSignature } from '../src/agent/runtime/agentPlanningSignalEvidence.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  recoveryBuilder: recoveryBuilderSource,
  recoveryRanking: recoveryRankingSource,
  replanRuntime: replanRuntimeSource,
  session: sessionSource,
  signalBuilder: signalBuilderSource,
  signalEvidence: signalEvidenceSource,
  signalUtils: signalUtilsSource,
  traceStuckRuntime: traceStuckRuntimeSource,
  verificationRuntime: verificationRuntimeSource,
} = readProjectSources({
  recoveryBuilder: 'src/agent/runtime/agentRecoveryStrategyRanking.ts',
  recoveryRanking: 'src/agent/runtime/agentRecoveryStrategyRanking.ts',
  replanRuntime: 'src/agent/runtime/agentReplanSignal.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  signalBuilder: 'src/agent/runtime/agentReplanSignal.ts',
  signalEvidence: 'src/agent/runtime/agentPlanningSignalEvidence.ts',
  signalUtils: 'src/agent/runtime/agentPlanningSignalEvidence.ts',
  traceStuckRuntime: 'src/agent/runtime/agentTraceStuckSignal.ts',
  verificationRuntime: 'src/agent/runtime/agentResultVerificationSignal.ts',
});

assertSourceMatches(
  replanRuntimeSource,
  /export interface AgentReplanSignalDependencies/u,
  'Replan Signal Runtime should expose an explicit dependency interface.',
);
assertSourceMatches(
  recoveryRankingSource,
  /export function createAgentRankedRecoveryStrategies/u,
  'Recovery strategy ranking should live in the version-neutral Runtime module.',
);
assertSourceMatches(
  replanRuntimeSource,
  /from '\.\/agentRecoveryStrategyRanking'/u,
  'Replan Signal Runtime should consume Runtime recovery strategy ranking directly.',
);
assertSourceMatches(
  recoveryRankingSource,
  /from '\.\/agentRecoveryStrategyBudget'/u,
  'Recovery strategy ranking should reuse the Runtime strategy budget module.',
);
assertSourceMatches(
  signalEvidenceSource,
  /export function createAgentActionPrimitiveSignature/u,
  'Planning Signal Evidence Runtime should own action primitive signature generation.',
);
assertSourceMatches(
  signalEvidenceSource,
  /export function formatAgentStructuredCandidates/u,
  'Planning Signal Evidence Runtime should own structured candidate formatting.',
);
assertSourceMatches(
  signalEvidenceSource,
  /getAgentStructuredEvidence,[\s\S]*from '\.\/agentToolEvidence'/u,
  'Planning Signal Evidence Runtime should reuse structured evidence extraction from Agent Tool Evidence.',
);
assertSourceMatches(
  signalEvidenceSource,
  /export function getLatestAgentToolResult/u,
  'Planning Signal Evidence Runtime should own latest tool result lookup.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentPlanningSignalEvidence'/u,
  'AgentSessionV2 should consume Planning Signal Evidence Runtime directly.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /from '\.\/agentSessionV2PlanningSignalUtils'/u,
  'AgentSessionV2 should not depend on the Legacy planning evidence wrapper.',
);
assert.match(
  replanRuntimeSource,
  /export function createAgentReplanSignalText/u,
  'Replan signal builder should live in the version-neutral Runtime module.',
);
assert.match(
  traceStuckRuntimeSource,
  /export function createAgentTraceStuckSignalText/u,
  'Trace stuck signal builder should live in the version-neutral Runtime module.',
);
assert.match(
  sessionSource,
  /from '\.\/runtime\/agentReplanSignal'/u,
  'AgentSessionV2 should consume Replan Signal Runtime directly.',
);
assert.doesNotMatch(
  sessionSource,
  /function createAgentSessionV2ReplanSignalText/u,
  'AgentSessionV2 should not own replan signal implementation.',
);
assertSourceMatches(
  verificationRuntimeSource,
  /export function createAgentResultVerificationSignalText/u,
  'Result verification signal should be owned by the version-neutral Runtime module.',
);
assertSourceMatches(
  sessionSource,
  /createReplanSignalText:[\s\S]*createAgentReplanSignalText/u,
  'Production Session should consume the Runtime replan signal directly.',
);
assertSourceMatches(
  sessionSource,
  /createResultVerificationText: createAgentResultVerificationSignalText/u,
  'Production Session should consume the Runtime result verification signal directly.',
);
assertSourceMatches(
  sessionSource,
  /createTraceStuckSignalText:[\s\S]*createAgentTraceStuckSignalText/u,
  'Production Session should consume the Runtime trace-stuck signal directly.',
);
assert.doesNotMatch(
  sessionSource,
  /function createAgentSessionV2TraceStuckSignalText/u,
  'AgentSessionV2 should not own trace stuck signal implementation.',
);
assert.doesNotMatch(
  sessionSource,
  /function createAgentSessionV2ResultVerificationSignalText/u,
  'AgentSessionV2 should not own result verification signal implementation.',
);
assert.doesNotMatch(
  sessionSource,
  /function createAgentSessionV2RankedRecoveryStrategies/u,
  'AgentSessionV2 should not own recovery strategy ranking implementation.',
);
assert.doesNotMatch(
  sessionSource,
  /function resolveAgentSessionV2RecoveryStrategyFromCommand/u,
  'AgentSessionV2 should not own recovery strategy command classification.',
);

function createToolCommand(toolName: string, input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: 'planning signal smoke',
    kind: 'tool-call',
    sourceText: '/agent planning signal smoke',
    toolCall: {
      goal: 'planning signal smoke',
      input,
      name: toolName as AgentChatCommand['toolCall']['name'],
    },
  };
}

function createToolResultEntry(options: {
  command?: AgentChatCommand;
  result: AgentChatCommandResult;
}): AgentSessionV2ToolResultEntry {
  return {
    command: options.command ?? createToolCommand('execute_desktop_input', {
      action: 'click',
      x: 12,
      y: 24,
    }),
    result: options.result,
  };
}

const dependencies: AgentReplanSignalDependencies = {
  recoveryStrategyDependencies: {
    countAutoRecoveryWaits: () => 0,
    resolveAutoRecoveryMaxWaits: () => 3,
  },
};

const noOpActionResult: AgentChatCommandResult = {
  ok: true,
  responseText: 'Click sent.',
  stateSummary: {
    actionEvidence: {
      action: 'click',
      confidence: 0.4,
      diff: {
        changed: false,
        signals: ['uiChanged=false'],
        summary: 'No state change was detected.',
      },
      outcome: 'no-op',
      targetRef: {
        confidence: 'medium',
        kind: 'pixel',
        label: 'Start button',
      },
      timestamp: 1,
      tool: 'execute_desktop_input',
    },
  },
};
const noOpEntry = createToolResultEntry({ result: noOpActionResult });
const uncertainTypeEntry = createToolResultEntry({
  command: createToolCommand('execute_desktop_input', {
    action: 'type_text',
    text: 'abc',
  }),
  result: {
    ok: true,
    responseText: 'Text input sent.',
    stateSummary: {
      actionEvidence: {
        action: 'type_text',
        confidence: 0.45,
        diff: {
          changed: true,
          signals: ['visibleTextMaybeChanged=true'],
          summary: 'Text input was sent, but user-level completion is not proven.',
        },
        outcome: 'uncertain',
        snapshotProfile: 'light',
        targetRef: {
          confidence: 'medium',
          kind: 'uia',
          label: 'Search input',
        },
        timestamp: 2,
        tool: 'execute_desktop_input',
      },
    },
  },
});

assert.equal(getLatestAgentToolResult([noOpEntry]), noOpEntry);
assert.equal(getAgentActionEvidence(noOpActionResult)?.outcome, 'no-op');
assert.match(formatAgentActionEvidence(noOpActionResult), /outcome=no-op/u);
assert.equal(
  createAgentToolCallSignature('execute_desktop_input', { b: 2, a: 1 }),
  createAgentToolCallSignature('execute_desktop_input', { a: 1, b: 2 }),
);
assert.equal(
  createAgentActionPrimitiveSignature(createToolCommand('execute_desktop_input', {
    action: 'click',
    button: 'left',
    postVerifyQuery: 'ignored',
    x: 12,
    y: 24,
  })),
  createAgentActionPrimitiveSignature(createToolCommand('execute_desktop_input', {
    action: 'click',
    x: 12,
    y: 24,
  })),
);
assert.equal(
  createAgentActionPrimitiveSignature(createToolCommand('execute_desktop_input', {
    action: 'click',
    button: 'left',
    x: 12,
    y: 24,
  })),
  createAgentActionPrimitiveSignature(createToolCommand('execute_desktop_input', {
    action: 'click',
    x: 12,
    y: 24,
  })),
);

const verificationOptions = {
  sourceText: '/agent click start',
  toolResults: [noOpEntry],
  userGoal: 'click start',
};
const verificationSignal = createAgentResultVerificationSignalText(verificationOptions);
assert.equal(
  createAgentResultVerificationSignalText(verificationOptions),
  verificationSignal,
  'Legacy result verification API should preserve Runtime output exactly.',
);
assert.match(verificationSignal, /latestTool=execute_desktop_input/u);
assert.match(verificationSignal, /latestToolKind=action/u);
assert.match(verificationSignal, /actionEvidence=outcome=no-op/u);
assert.match(verificationSignal, /verify the user-level outcome from evidence/u);

const traceEvents: AgentSessionV2TraceEvent[] = [{
  id: 'trace-1',
  status: 'blocked',
  stepIndex: 1,
  summary: 'Permission policy blocked execute_desktop_input.',
  timestamp: 1,
  tool: 'execute_desktop_input',
  type: 'permission_routed',
}];
const traceStuckSignal = createAgentTraceStuckSignalText({
  dependencies,
  traceEvents,
  toolResults: [noOpEntry, noOpEntry],
});
assert.match(traceStuckSignal, /reason=recent_action_evidence_not_completed/u);
assert.match(traceStuckSignal, /actionOutcome=no-op/u);
assert.match(traceStuckSignal, /reason=repeated_incomplete_action_primitive/u);
assert.match(traceStuckSignal, /reason=permission_route_blocked/u);
assert.match(traceStuckSignal, /stuckSignalPrimaryReason=permission_route_blocked/u);
assert.match(traceStuckSignal, /stuckSignalSeverity=critical/u);
assert.match(traceStuckSignal, /stuckSignalThresholdGuard=maxSignals=5/u);
assert.match(traceStuckSignal, /stuckSignalPolicy=This signal is advisory/u);

const repeatedWindowSignal = createAgentTraceStuckSignalText({
  dependencies,
  traceEvents: [],
  toolResults: [noOpEntry, uncertainTypeEntry, noOpEntry, uncertainTypeEntry],
});
assert.match(repeatedWindowSignal, /reason=repeated_action_outcome_window/u);
assert.match(repeatedWindowSignal, /windowSize=2/u);
assert.match(repeatedWindowSignal, /repeatCount=2/u);
assert.match(repeatedWindowSignal, /windowSignature=.*outcome=no-op.*outcome=uncertain/u);
assert.match(repeatedWindowSignal, /stuckSignalPrimaryReason=repeated_action_outcome_window/u);
assert.match(repeatedWindowSignal, /stuckSignalConfidence=0\.88/u);
assert.match(repeatedWindowSignal, /Treat this as advisory/u);
assert.match(repeatedWindowSignal, /stuckSignalPolicy=This signal is advisory/u);

const failedEntry = createToolResultEntry({
  command: createToolCommand('locate_screen_elements', {
    query: 'start',
  }),
  result: {
    errorText: 'Could not locate target.',
    ok: false,
    responseText: 'Locate failed.',
    stateSummary: {
      missingEvidence: ['target coordinate'],
      recommendedRecovery: ['focus crop target area'],
      structuredEvidence: {
        targetCandidates: [{
          confidence: 'low',
          label: 'Start-like label',
        }],
        targetMatched: 'Start',
        visualActionReadiness: 'needs-coordinate',
      },
    },
  },
});
assert.equal(getAgentStructuredEvidence(failedEntry)?.targetMatched, 'Start');
assert.match(
  formatAgentStructuredCandidates(getAgentStructuredEvidence(failedEntry)?.targetCandidates),
  /1:Start-like label/u,
);
const steps: AgentSessionV2Step[] = [{
  action: 'tool_call',
  index: 1,
  summary: 'locate failed',
  tool: 'locate_screen_elements',
  understanding: {
    completedGoals: ['opened launcher'],
    remainingGoals: ['click start'],
    verificationStatus: 'partial',
  },
}];
const replanSignal = createAgentReplanSignalText({
  dependencies,
  steps,
  toolResults: [failedEntry],
});
assert.match(replanSignal, /reason=latest_tool_failed/u);
assert.match(replanSignal, /failedTool=locate_screen_elements/u);
assert.match(replanSignal, /targetCandidates=1:Start-like label/u);
assert.match(replanSignal, /rankedRecoveryStrategies=1\. score=88 strategy=relocate_with_coordinates/u);
assert.match(replanSignal, /remainingGoals=click start/u);

const loadingRecovery = createAgentRankedRecoveryStrategies({
  dependencies: dependencies.recoveryStrategyDependencies,
  entry: createToolResultEntry({
    command: createToolCommand('execute_desktop_input', { action: 'open_app', app: 'Example' }),
    result: {
      ok: true,
      responseText: 'App is still loading.',
      stateSummary: {
        structuredEvidence: {
          postActionState: 'loading',
        },
      },
    },
  }),
  toolResults: [],
});
assert.match(loadingRecovery, /strategy=wait_and_observe/u);
assert.match(loadingRecovery, /tool=execute_desktop_observation/u);

const focusCropRecovery = createAgentRankedRecoveryStrategies({
  dependencies: dependencies.recoveryStrategyDependencies,
  entry: createToolResultEntry({
    command: createToolCommand('locate_screen_elements', { query: 'start' }),
    result: {
      ok: true,
      responseText: 'Multiple candidates found.',
      stateSummary: {
        structuredEvidence: {
          targetCandidates: [
            {
              center: { coordinateSpace: 'native-screen', x: 100, y: 120 },
              confidence: 'medium',
              label: 'Start',
            },
            {
              centerRatio: { x: 0.5, y: 0.5 },
              confidence: 'low',
              label: 'Start menu',
            },
          ],
          visualActionReadiness: 'needs-target-selection',
        },
      },
    },
  }),
  toolResults: [],
});
assert.match(focusCropRecovery, /strategy=focus_candidate_crop/u);
assert.match(focusCropRecovery, /tool=locate_screen_elements/u);

const blockedRecovery = createAgentRankedRecoveryStrategies({
  dependencies: dependencies.recoveryStrategyDependencies,
  entry: createToolResultEntry({
    command: createToolCommand('execute_desktop_input', { action: 'click', x: 10, y: 20 }),
    result: {
      errorText: 'Permission denied by modal gate.',
      ok: false,
      responseText: 'Blocked.',
      stateSummary: {
        missingEvidence: ['safe actionable recovery target'],
        structuredEvidence: {
          postActionState: 'blocked',
        },
      },
    },
  }),
  toolResults: [],
});
assert.match(blockedRecovery, /strategy=read_blocker_or_gate/u);
assert.match(blockedRecovery, /strategy=final_blocked_with_evidence/u);
assert.doesNotMatch(
  blockedRecovery,
  /open_app\s*->|wait_ui\s*->|locate\s*->|click\s*->|verify/iu,
  'Recovery strategy output should be ranked hints, not a fixed tool chain.',
);

console.log('agent session v2 planning signal builders smoke ok');
