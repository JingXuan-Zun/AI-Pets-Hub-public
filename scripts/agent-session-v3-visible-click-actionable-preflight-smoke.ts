import assert from 'node:assert/strict';
import {
  resolveAgentVisualExecutionStrategy,
  runAgentSessionV3ExperimentalChatRunner,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
let toolCallCount = 0;

const result = await runAgentSessionV3ExperimentalChatRunner({
  maxSteps: 3,
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      app: 'WeGame',
      mode: 'visible_click',
      target: '登录按钮',
    },
    reason: 'Click the WeGame login button.',
    tool: 'execute_desktop_sequence',
  }),
  settings,
  sourceText: '/agent 点击 WeGame 登录按钮',
  toolExecutor: async (command: AgentChatCommand) => {
    toolCallCount += 1;
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    assert.equal(command.toolCall.input.sourceType, 'window');
    assert.equal(command.toolCall.input.allowScreenFallback, false);
    return {
      ok: true,
      responseText: 'Login button is visible but still needs relation verification.',
      stateSummary: {
        structuredEvidence: {
          captureSourceType: 'window',
          captureTrusted: true,
          confidence: 'high',
          coordinateAuditStatus: 'coordinate_ok',
          coordinateConfidence: 'high',
          elementCenter: { coordinateSpace: 'native-screen', x: 1280, y: 757 },
          finalWindow: { hwnd: 29953666, processName: 'wegame', title: 'WeGame' },
          launcherVerification: {
            primaryActionMatchesTarget: null,
            status: 'needs-relation',
            targetVisible: true,
          },
          primaryAction: '点击登录按钮',
          sourceBounds: {
            coordinateSpace: 'native-screen',
            height: 670,
            width: 1191,
            x: 684,
            y: 355,
          },
          targetMatched: '登录按钮',
          visualActionReadiness: 'ready',
        },
      },
      verification: 'Read-only actionable preflight returned window-bound evidence.',
    };
  },
  userGoal: '点击 WeGame 登录按钮',
});

assert.equal(toolCallCount, 1);
assert.equal(result.pendingApproval, null);
assert.notEqual(result.status, 'needs-approval');

const strategy = resolveAgentVisualExecutionStrategy({
  command: result.toolResults[0]!.command,
  result: result.toolResults[0]!.result,
  sourceText: '/agent 点击 WeGame 登录按钮',
  userGoal: '点击 WeGame 登录按钮',
});
assert.equal(strategy.kind, 'coordinate');
assert.equal(strategy.command?.toolCall?.input.mode, 'visible_click');
assert.equal(strategy.command?.toolCall?.input.sourceHwnd, 29953666);

console.log('agent session v3 visible click actionable preflight smoke ok');
