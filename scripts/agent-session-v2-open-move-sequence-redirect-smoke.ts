import assert from 'node:assert/strict';
import { runAgentProductionSession, type AgentSessionV2ModelCaller } from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const sourceText = '/agent open https://www.bilibili.com, maximize the browser window, and move it to the secondary screen';
const userGoal = 'Open Bilibili in browser, maximize the window, and move it to the secondary screen.';

const modelCaller: AgentSessionV2ModelCaller = async () => JSON.stringify({
  action: 'tool_call',
  args: {
    action: 'open_resource',
    resourceType: 'url',
    target: 'https://www.bilibili.com',
  },
  reason: 'Open the requested URL first.',
  tool: 'execute_desktop_action',
  understanding: {
    remainingGoals: ['move and maximize the browser window'],
    successCriteria: 'Bilibili is maximized on the secondary screen.',
    userNeed: userGoal,
    verificationStatus: 'unknown',
  },
});

const result = await runAgentProductionSession({
  maxSteps: 2,
  modelCaller,
  settings: {} as PetConfig['settings'],
  sourceText,
  toolExecutor: async () => {
    throw new Error('The composed sequence should wait for one approval before execution.');
  },
  userGoal,
});

assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
const steps = JSON.parse(String(result.pendingApproval?.command.toolCall?.input.stepsJson ?? '[]')) as Array<{
  args?: Record<string, unknown>;
  tool?: string;
}>;
assert.equal(steps.length, 3);
assert.equal(steps[0]?.args?.action, 'open_resource');
assert.equal(steps[1]?.args?.action, 'move_window_to_display');
assert.equal(steps[1]?.args?.targetDisplay, 'secondary');
assert.equal(steps[2]?.args?.action, 'control_window');
assert.equal(steps[2]?.args?.windowState, 'maximized');

console.log('agent session v2 open move sequence redirect smoke ok');
