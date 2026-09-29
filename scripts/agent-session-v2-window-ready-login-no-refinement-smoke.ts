import assert from 'node:assert/strict';
import { runAgentProductionSession, type AgentChatCommand } from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
let modelCallCount = 0;
let toolCallCount = 0;

const result = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async () => {
    modelCallCount += 1;
    if (modelCallCount > 1) {
      return JSON.stringify({ action: 'ask_user', message: 'unexpected second model call' });
    }
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'locate_element',
        allowScreenFallback: false,
        sourceQuery: 'WeGame',
        sourceType: 'window',
        targetText: '快速安全登录',
      },
      reason: 'Locate the WeGame login button before click approval.',
      tool: 'locate_screen_elements',
    });
  },
  settings,
  sourceText: '/agent 打开 WeGame 并登录',
  toolExecutor: async (command: AgentChatCommand) => {
    toolCallCount += 1;
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    if (toolCallCount === 1) {
      assert.equal(command.toolCall.input.action, 'locate_element');
    } else if (toolCallCount === 2) {
      assert.equal(command.toolCall.input.action, 'describe_elements');
      assert.equal(command.toolCall.input.forceRefresh, true);
      assert.match(String(command.toolCall.input.question), /AgentRuntime target resolution/u);
    } else {
      assert.fail(`Unexpected locate: ${JSON.stringify(command.toolCall.input)}`);
    }
    return {
      ok: true,
      receipt: {
        evidenceLines: ['Window-bound visual locate returned actionable login evidence.'],
        status: 'unverified',
        summaryLines: ['Call: locate_screen_elements'],
        title: 'Screen element observation',
        toolName: 'locate_screen_elements',
        verification: 'Visual snapshot evidence requires click outcome verification.',
      },
      responseText: 'Located 快速安全登录 at x=1280 y=757 in WeGame.',
      stateSummary: {
        structuredEvidence: {
          actionCandidates: [{
            bounds: {
              coordinateSpace: 'native-screen',
              height: 48,
              width: 180,
              x: 1190,
              y: 733,
            },
            centerRatio: { coordinateSpace: 'source-ratio', x: 0.5, y: 0.6 },
            confidence: 'high',
            label: '快速安全登录',
            relation: 'Login action for the prefilled account.',
            source: 'visual',
          }],
          captureSourceType: 'window',
          captureTrusted: true,
          confidence: 'high',
          coordinateAuditStatus: 'coordinate_ok',
          coordinateConfidence: 'high',
          elementCenter: { coordinateSpace: 'native-screen', x: 1280, y: 757 },
          elementBounds: {
            coordinateSpace: 'native-screen',
            height: 48,
            width: 180,
            x: 1190,
            y: 733,
          },
          elementCenterRatio: { coordinateSpace: 'source-ratio', x: 0.5, y: 0.6 },
          finalWindow: { hwnd: 29953666, processName: 'wegame', title: 'WeGame' },
          launcherVerification: {
            primaryActionMatchesTarget: true,
            status: 'ready',
            targetVisible: true,
          },
          postActionState: 'login_required',
          primaryAction: '点击快速安全登录按钮',
          relation: 'Button belongs to the prefilled WeGame account.',
          sourceBounds: {
            coordinateSpace: 'native-screen',
            height: 670,
            width: 1191,
            x: 684,
            y: 355,
          },
          targetCandidates: [{
            centerRatio: { coordinateSpace: 'source-ratio', x: 0.5, y: 0.6 },
            confidence: 'high',
            label: '快速安全登录',
            source: 'visual',
          }],
          targetMatched: '快速安全登录',
          visualActionReadiness: 'ready',
        },
      },
      verification: 'Login button is window-bound and actionable; click outcome is not verified yet.',
    };
  },
  userGoal: '打开 WeGame 并登录',
});

assert.equal(modelCallCount, 1, result.continuation.historyLines.join('\n'));
assert.equal(toolCallCount, 2);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(result.continuation.historyLines.join('\n'), /in-app target locate result/u);

console.log('agent session v2 window ready login no refinement smoke ok');
