import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { projectPath, readProjectFile } from './smokeTestHarness.ts';

const checklistPath = projectPath('PROJECT_AGENT_V3_PILOT_READINESS_CHECKLIST.md');

assert.equal(existsSync(checklistPath), true, 'v3 pilot readiness checklist should exist.');

const checklist = readProjectFile('PROJECT_AGENT_V3_PILOT_READINESS_CHECKLIST.md');

for (const phrase of [
  'debug-only shadow mode',
  'must not replace the `AgentSessionV2` main loop',
  'must not choose tools, create commands, route permissions, or execute tools',
  'must not encode a fixed workflow or a fixed desktop tool chain',
  'real v2 runtime traces',
  'v2 final status and v3 mirror terminal status do not disagree',
  'fail closed by omitting the pilot summary',
]) {
  assert.match(checklist, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
}

for (const moduleName of [
  'agentSessionV3PilotStateMachine.ts',
  'agentSessionV3PilotEventAdapters.ts',
  'agentSessionV3PilotRunner.ts',
  'agentSessionV3PilotPhaseDriver.ts',
  'agentSessionV3PilotHarness.ts',
  'agentSessionV3PilotTraceSummary.ts',
  'runAgentSessionV3PilotHarnessWithDebugSummary',
]) {
  assert.match(checklist, new RegExp(moduleName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
}

assert.doesNotMatch(
  checklist,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'Readiness checklist should not encode a concrete desktop workflow.',
);

assert.doesNotMatch(
  checklist,
  /v3\s+can\s+replace\s+AgentSessionV2|replace\s+the\s+`AgentSessionV2`\s+main\s+loop\s+now/iu,
  'Readiness checklist should not authorize replacing AgentSessionV2.',
);

console.log('agent session v3 pilot readiness checklist smoke ok');
