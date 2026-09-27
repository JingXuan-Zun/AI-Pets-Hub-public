import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
let modelCallCount = 0;
const executedTools: string[] = [];

const result = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async () => {
    modelCallCount += 1;
    assert.equal(modelCallCount, 1, 'the deterministic in-app gate should run before a second model plan');
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'inspect_window_ui',
        query: 'Launcher',
      },
      reason: 'Observe the outer app before operating on the requested inner target.',
      tool: 'execute_desktop_observation',
    });
  },
  settings,
  sourceText: '打开 Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    executedTools.push(command.toolCall?.name ?? command.kind);
    if (executedTools.length === 1) {
      assert.equal(command.toolCall?.name, 'execute_desktop_observation');
      return {
        ok: true,
        responseText: 'Launcher window is open.',
        stateSummary: {
          structuredEvidence: {
            finalWindow: {
              hwnd: 4096,
              pid: 8192,
              processName: 'launcher.exe',
              title: 'Launcher',
            },
            status: 'success',
            targetMatched: 'Launcher',
          },
        },
        verification: 'The outer Launcher window is available for in-app target resolution.',
      };
    }

    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    assert.equal(command.toolCall?.input.sourceQuery, 'Launcher');
    assert.equal(command.toolCall?.input.targetText, 'Game');
    return {
      ok: true,
      responseText: 'Game launch control is visible.',
      stateSummary: {
        structuredEvidence: {
          captureSourceType: 'window',
          confidence: 'high',
          coordinateConfidence: 'high',
          elementCenter: {
            coordinateSpace: 'native-screen',
            x: 1200,
            y: 700,
          },
          finalWindow: {
            hwnd: 4096,
            pid: 8192,
            processName: 'launcher.exe',
            title: 'Launcher',
          },
          primaryAction: 'Launch',
          relation: 'Launch belongs to Game.',
          sourceBounds: {
            coordinateSpace: 'native-screen',
            height: 800,
            width: 1200,
            x: 500,
            y: 200,
          },
          status: 'success',
          targetMatched: 'Game',
          visualActionReadiness: 'ready',
        },
      },
      verification: 'Game and its associated Launch control are visible inside Launcher.',
    };
  },
  userGoal: 'Open Game inside Launcher',
});

assert.equal(modelCallCount, 1);
assert.deepEqual(executedTools, ['execute_desktop_observation', 'locate_screen_elements']);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /execute_desktop_input/u);
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /1200/u);

console.log('agent runtime in-app gate smoke ok');
