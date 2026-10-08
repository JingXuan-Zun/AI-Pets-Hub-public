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
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;
    if (modelCallCount > 1) {
      // The deterministic in-app gate (locate plus focused refinement) must
      // have run before the model plans the click.
      assert.equal(modelCallCount, 2);
      assert.match(userInput, /in-app target locate:|visual refinement:/u);
      assert.match(userInput, /target=Game/u);
      assert.match(userInput, /elementCenter=1200,700/u);
      return JSON.stringify({
        action: 'tool_call',
        args: {
          stepsJson: JSON.stringify([
            {
              args: {
                action: 'click',
                x: 1200,
                y: 700,
              },
              reason: 'Click the located Launch control for Game.',
              tool: 'execute_desktop_input',
            },
          ]),
        },
        reason: 'The located target/action evidence is ready; request approval for the click.',
        tool: 'execute_desktop_sequence',
      });
    }
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
    // The first locate targets the inner app target (not the outer window);
    // the runtime may follow with a read-only focused refinement whose target
    // description extends it with the focused candidate.
    assert.match(String(command.toolCall?.input.targetDescription), /^Game(?:$|; focused candidate: )/u);
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

assert.equal(modelCallCount, 2);
assert.deepEqual(executedTools, ['execute_desktop_observation', 'locate_screen_elements', 'locate_screen_elements']);
assert.equal(result.status, 'needs-approval');
assert.doesNotMatch(result.continuation.historyLines.join('\n'), /target-stale/u);
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /execute_desktop_input/u);
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /1200/u);

console.log('agent runtime in-app gate smoke ok');
