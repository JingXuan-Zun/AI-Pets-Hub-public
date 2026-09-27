import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

function assertIncludes(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const sessionSource = readProjectFile('src/agent/agentProductionSessionImplementation.ts');
const stateMachineSource = readProjectFile('src/agent/agentSessionV3PilotStateMachine.ts');
const runnerSource = readProjectFile('src/agent/agentSessionV3PilotRunner.ts');
const harnessSource = readProjectFile('src/agent/agentSessionV3PilotHarness.ts');
const shadowInputSource = readProjectFile('src/agent/agentSessionV3PilotShadowInputCollector.ts');
const shadowModeSource = readProjectFile('src/agent/agentSessionV3PilotShadowMode.ts');
const agreementSource = readProjectFile('src/agent/agentSessionV3PilotShadowAgreement.ts');
const finalResultStart = sessionSource.indexOf('function createAgentSessionV2FinalResult');
const finalResultEnd = sessionSource.indexOf('function createAgentSessionV2ContinuationSnapshot', finalResultStart);
assert.notEqual(finalResultStart, -1, 'AgentSessionV2 final result function should exist.');
assert.notEqual(finalResultEnd, -1, 'AgentSessionV2 continuation snapshot function should follow final result function.');
const finalResultSource = sessionSource.slice(finalResultStart, finalResultEnd);

assertIncludes(auditText, 'Agent v3 Full Runtime Preflight Audit v1', 'preflight audit');
assertIncludes(auditText, 'RunAgentSessionV2Options.v3PilotShadow', 'preflight audit attachment point');
assertIncludes(auditText, 'result.debug.v3PilotShadow', 'preflight audit attachment point');
assertIncludes(auditText, 'This path is still observer-only.', 'preflight audit attachment point');
assertIncludes(auditText, 'The current user-visible v3 attachment is the explicit experimental route:', 'preflight audit attachment point');
assertIncludes(auditText, "agentRuntimeMode === 'v3-experimental'", 'preflight audit boundary');

for (const moduleName of [
  'agentSessionV3PilotShadowInputCollector.ts',
  'agentSessionV3PilotEventAdapters.ts',
  'agentSessionV3PilotShadowMode.ts',
  'agentSessionV3PilotShadowAgreement.ts',
]) {
  assertIncludes(auditText, moduleName, 'preflight audit evidence adapter list');
}

for (const moduleName of [
  'agentSessionV3PilotStateMachine.ts',
  'agentSessionV3PilotRunner.ts',
  'agentSessionV3PilotPhaseDriver.ts',
  'agentSessionV3PilotHarness.ts',
]) {
  assertIncludes(auditText, moduleName, 'preflight audit future seam list');
}

assertIncludes(auditText, 'Classification: evidence adapter.', 'preflight audit classifications');
assertIncludes(auditText, 'Classification: evidence adapter / mirror runner.', 'preflight audit classifications');
assertIncludes(auditText, 'Classification: future runtime seam candidate.', 'preflight audit classifications');
assertIncludes(auditText, 'Moving these before adapter contracts exist would create a second orchestrator instead of a v3 runtime seam.', 'preflight audit boundary');
assertIncludes(auditText, 'Do not make v3 replace `AgentSessionV2` yet.', 'preflight audit guardrails');
assertIncludes(auditText, 'Do not copy `debug.v3PilotShadow` into continuation, history, model input, or tool results.', 'preflight audit guardrails');
assertIncludes(auditText, 'Do not let evidence adapters choose tools, route permissions, execute tools, or decide recovery.', 'preflight audit guardrails');
assertIncludes(auditText, 'Do not encode concrete desktop tools as an implicit chain.', 'preflight audit guardrails');
assertIncludes(auditText, 'Do not encode an observe, locate, execute, verify workflow as required runtime order.', 'preflight audit guardrails');
assertIncludes(auditText, 'V3RuntimeBoundary', 'preflight audit next safe step');

assert.match(sessionSource, /v3PilotShadow\?: AgentSessionV2V3PilotShadowOptions/u);
assert.match(sessionSource, /debug: resultOptions\.debug \?\? createAgentSessionV2DebugInfo\(\)/u);
assert.match(finalResultSource, /\.\.\.\(options\.debug \? \{ debug: options\.debug \} : \{\}\)/u);
assert.match(finalResultSource, /continuation: \{[\s\S]*historyLines: \[\.\.\.options\.historyLines\][\s\S]*toolResults: \[\.\.\.options\.toolResults\][\s\S]*userGoal: options\.userGoal[\s\S]*\}/u);
assert.doesNotMatch(
  finalResultSource,
  /continuation:\s*\{[\s\S]*v3PilotShadow/u,
  'AgentSessionV2 continuation should not retain v3 pilot shadow debug output.',
);

assert.match(shadowInputSource, /createAgentSessionV3PilotShadowInputCollector/u);
assert.match(shadowInputSource, /appendModelDecisionTurn/u);
assert.match(shadowInputSource, /appendToolExecutionTransaction/u);
assert.doesNotMatch(
  shadowInputSource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Shadow input collector should sample outcomes, not call production v2 runtime modules.',
);

assert.match(shadowModeSource, /runAgentSessionV3PilotShadowEventList/u);
assert.match(shadowModeSource, /status: 'disabled'/u);
assert.doesNotMatch(
  shadowModeSource,
  /runAgentSessionV2|buildAgentPermissionRoute|execute_desktop|toolExecutor/u,
  'Shadow mode should not gain production execution authority.',
);

assert.match(agreementSource, /evaluateAgentSessionV3PilotShadowAgreement/u);
assert.match(agreementSource, /No v3 pilot shadow debug result is attached/u);
assert.doesNotMatch(
  agreementSource,
  /runAgentSessionV2|runAgentSessionV3PilotShadowMode|buildAgentPermissionRoute|toolExecutor/u,
  'Agreement evaluator should read completed results only.',
);

assert.match(stateMachineSource, /export function advanceAgentSessionV3PilotState/u);
assert.match(runnerSource, /export async function runAgentSessionV3PilotRunner/u);
assert.match(harnessSource, /export interface AgentSessionV3PilotHarnessPorts/u);
assert.doesNotMatch(
  harnessSource,
  /runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|execute_desktop/u,
  'Harness should not call production v2 modules or concrete desktop tools directly.',
);

assert.doesNotMatch(
  auditText,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action/u,
  'Preflight audit should avoid concrete desktop tool chains.',
);
assert.doesNotMatch(
  auditText,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify/iu,
  'Preflight audit should not define a fixed observe/locate/execute/verify chain.',
);
assert.doesNotMatch(
  auditText,
  /readyForProductionRuntime=true|production runtime readiness:\s*`?yes`?/iu,
  'Preflight audit should not claim production runtime readiness.',
);

assertIncludes(statusText, 'V3 full runtime preflight audit', 'status completed direction');
assertIncludes(statusText, 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md', 'status completed direction');
assertIncludes(statusText, 'agent-session-v3-full-runtime-preflight-audit-smoke.ts', 'status completed direction');

console.log('agent session v3 full runtime preflight audit smoke ok');
