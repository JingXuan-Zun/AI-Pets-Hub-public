import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

function extractBetween(source: string, startNeedle: string, endNeedle: string) {
  const start = source.indexOf(startNeedle);
  assert.ok(start >= 0, `${startNeedle} should exist`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(end > start, `${endNeedle} should exist after ${startNeedle}`);
  return source.slice(start, end);
}

const {
  controllerSource,
  senderSource,
  sessionSource,
  featureFlagSource,
} = readProjectSources({
  controllerSource: 'src/components/chat/agentRunController.ts',
  senderSource: 'src/components/chat/usePetChatMessageSender.ts',
  sessionSource: 'src/components/chat/usePetChatSession.ts',
  featureFlagSource: 'src/agent/agentSessionV3ExperimentalFeatureFlag.ts',
});

assert.match(controllerSource, /runAgentSessionV3ExperimentalFeatureFlagRoute/u);
assert.match(controllerSource, /agentRuntimeMode\?: AgentSessionV3ExperimentalFeatureFlagMode/u);
assert.match(controllerSource, /runAgentSessionV3Experimental\?: AgentPreparedSessionV3ExperimentalRunner/u);
assert.match(controllerSource, /export interface AgentPreparedSessionV3ExperimentalRunnerContext/u);
assert.match(controllerSource, /export type AgentPreparedSessionV3ExperimentalRunner/u);

const preparedRunSource = extractBetween(
  controllerSource,
  'export async function runPreparedAgentProductionSession',
  '\n\nfunction createAgentProductionSessionDisplayResult',
);
assert.match(
  preparedRunSource,
  /mode: agentRuntimeMode \?\? preparedRequest\.currentConfig\.settings\.agentRuntimeMode \?\? 'v2-default'/u,
  'chat route should use configured runtime mode before falling back to v2',
);
assert.match(
  preparedRunSource,
  /runV2: \(\) => runAgentSessionV2\(\{/u,
  'chat route should still provide the v2 runner as the default/fallback path',
);
assert.match(
  preparedRunSource,
  /runV3Experimental: runAgentSessionV3Experimental[\s\S]*\? \(\) => runAgentSessionV3Experimental\(\{/u,
  'chat route should only invoke v3 through an injected experimental runner',
);
assert.match(
  preparedRunSource,
  /v3ExperimentalAvailable: Boolean\(runAgentSessionV3Experimental\)/u,
  'v3 availability should be tied to the injected runner, not a hardcoded switch',
);
assert.match(
  preparedRunSource,
  /runtimeRoute = routedResult\.decision\.route/u,
  'chat route should report which runtime path actually ran',
);
assert.match(
  preparedRunSource,
  /toolExecutor: AgentSessionV2ToolExecutor = async \(command\) => \{[\s\S]*assessAgentCommandResult\(/u,
  'v3 injected runner should receive the same guarded tool executor path',
);
assert.match(
  preparedRunSource,
  /onProgress: AgentRuntimeProgressHandler = \(event\) => \{[\s\S]*updateAgentProductionSessionProgressMessage/u,
  'v3 injected runner should receive the same progress update path',
);

const approvalContinuationSource = extractBetween(
  controllerSource,
  'export async function resolveAgentApprovalRequest',
  '\n\nexport const agentRunController',
);
assert.match(
  approvalContinuationSource,
  /runAgentSessionV3ExperimentalFeatureFlagRoute\(\{/u,
  'approval continuation should use the same v2/v3 feature-flag route after approval resume integration',
);
assert.match(
  approvalContinuationSource,
  /approvedToolResult,[\s\S]*continuation: approval\.agentSessionV2/u,
  'approval continuation should pass the approved result and prior continuation to the v3 runner',
);
assert.match(
  approvalContinuationSource,
  /runV2: \(\) => runAgentSessionV2\(\{/u,
  'approval continuation should retain the v2 fallback path',
);

assert.match(senderSource, /agentRuntimeMode\?: AgentSessionV3ExperimentalFeatureFlagMode/u);
assert.match(senderSource, /runAgentSessionV3Experimental\?: AgentPreparedSessionV3ExperimentalRunner/u);
assert.match(
  senderSource,
  /runPreparedAgentProductionSession\(\{[\s\S]*agentRuntimeMode,[\s\S]*runAgentSessionV3Experimental,/u,
  'message sender should pass optional v3 route controls to the prepared agent run',
);
assert.match(sessionSource, /agentRuntimeMode\?: AgentSessionV3ExperimentalFeatureFlagMode/u);
assert.match(sessionSource, /runAgentSessionV3Experimental\?: AgentPreparedSessionV3ExperimentalRunner/u);
assert.match(
  sessionSource,
  /usePetChatMessageSender\(\{[\s\S]*agentRuntimeMode,[\s\S]*runAgentSessionV3Experimental,/u,
  'chat session should expose optional v3 route controls without requiring callers to use them',
);

assert.doesNotMatch(
  featureFlagSource,
  /runAgentSessionV2\(|runAgentSessionV3ExperimentalSession\(/u,
  'feature flag route should still choose injected runners, not directly own runtime execution',
);

for (const [label, source] of [
  ['agent run controller', controllerSource],
  ['message sender', senderSource],
  ['chat session', sessionSource],
] as const) {
  assert.doesNotMatch(
    source,
    /observe_windows_and_apps\s*->\s*locate_screen_elements|locate_screen_elements\s*->\s*execute_desktop|execute_desktop_sequence\s*->\s*observe_windows_and_apps/iu,
    `${label} must not encode a fixed desktop workflow.`,
  );
  assert.doesNotMatch(
    source,
    /implementationQueue|orderedSteps|requiredReportOrder|recoveryAction/u,
    `${label} must not define fixed tool queues, report order, or recovery actions.`,
  );
}

console.log('agent session v3 experimental chat route smoke ok');
