import assert from 'node:assert/strict';
import { createAgentCommandFromPlannerDecision } from '../src/agent/agentPlanner.ts';

const command = createAgentCommandFromPlannerDecision(
  '/agent 打开记事本，移动到副屏，然后输入 hello',
  {
    goal: '打开记事本移动到副屏并输入 hello',
    intent: 'tool',
    steps: [
      {
        args: {
          action: 'launch_local_app',
          target: 'notepad',
        },
        reason: '打开记事本',
        tool: 'execute_desktop_action',
      },
      {
        args: {
          action: 'move_window_to_display',
          fallbackToActiveWindow: true,
          target: 'notepad',
          targetDisplay: 'secondary',
        },
        reason: '移动窗口到副屏',
        tool: 'execute_desktop_action',
      },
      {
        args: {
          action: 'type_text',
          text: 'hello',
        },
        reason: '输入文本',
        tool: 'execute_desktop_input',
      },
    ],
    tool: 'execute_desktop_action',
  },
);

assert.equal(command?.kind, 'tool-call');
assert.equal(command?.toolCall?.name, 'execute_desktop_sequence');

const input = command?.toolCall?.input ?? {};
assert.equal(input.stopOnError, true);
assert.equal(input.postVerify, true);

const steps = JSON.parse(String(input.stepsJson ?? '[]')) as Array<{ args?: Record<string, unknown>; tool?: string }>;
assert.equal(steps.length, 3);
assert.equal(steps[0]?.args?.action, 'launch_local_app');
assert.equal(steps[1]?.args?.action, 'move_window_to_display');
assert.equal(steps[1]?.args?.targetDisplay, 'secondary');
assert.equal(steps[2]?.tool, 'execute_desktop_input');
assert.equal(steps[2]?.args?.action, 'type_text');

console.log('agent planner desktop step composition smoke ok');
