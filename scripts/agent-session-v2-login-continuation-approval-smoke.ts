import assert from 'node:assert/strict';

import { runAgentProductionSession, type AgentSessionV2ModelCaller } from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

let modelCallCount = 0;
const modelCaller: AgentSessionV2ModelCaller = async () => {
  modelCallCount += 1;
  if (modelCallCount === 1) {
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'locate_element',
        sourceQuery: 'WeGame',
        sourceType: 'window',
        targetDescription: 'League of Legends or any required safe login continuation control inside WeGame',
        targetText: 'League of Legends',
      },
      reason: 'Locate the requested game or required login continuation inside WeGame.',
      tool: 'locate_screen_elements',
    });
  }

  assert.fail(`Login continuation evidence should be converted to pending approval before model call ${modelCallCount}.`);
};

const result = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller,
  settings,
  sourceText: '/agent 打开 WeGame 里的英雄联盟',
  toolExecutor: async (command) => {
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    return {
      observations: [
        'WeGame is showing a login page.',
        'Visual target matched: 快速安全登录',
        'Visual element center: x=1280 y=806',
        'Visual summary: 未发现验证码、二维码、短信码、二次验证或 UAC。',
        'Post action state: login_required',
      ],
      ok: true,
      responseText: 'Located the safe 登录 continuation button at x=1280 y=806.',
      stateSummary: {
        observedState: [
          'WeGame login page is visible.',
        '快速安全登录 button is visible and appears safe to press.',
        ],
        structuredEvidence: {
          confidence: 'high',
          coordinateConfidence: 'high',
          captureSourceType: 'window',
          sourceBounds: {
            coordinateSpace: 'native-screen',
            height: 670,
            width: 1191,
            x: 684,
            y: 355,
          },
          sourceBounds: {
            coordinateSpace: 'native-screen',
            height: 670,
            width: 1191,
            x: 684,
            y: 355,
          },
          elementCenter: {
            coordinateSpace: 'native-screen',
            source: 'test',
            x: 1280,
            y: 806,
          },
          actionCandidates: [{
            bounds: {
              coordinateSpace: 'source-ratio',
              height: 0.08,
              width: 0.16,
              x: 0.42,
              y: 0.68,
            },
            centerRatio: {
              coordinateSpace: 'source-ratio',
              x: 0.5,
              y: 0.72,
            },
            confidence: 'high',
            label: '快速安全登录',
          }],
          finalWindow: { hwnd: 133976, pid: 34712, title: 'WeGame' },
          postActionState: 'login_required',
          primaryAction: '识别但不点击：快速安全登录',
          relation: '快速安全登录 is the visible safe login continuation control before launching League of Legends.',
          status: 'success',
          targetMatched: '快速安全登录',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: [
          '快速安全登录 button is visible with a usable native-screen coordinate.',
        ],
      },
      verification: 'WeGame requires login and a safe 快速安全登录 continuation button is visible.',
    };
  },
  userGoal: '打开 WeGame 里的英雄联盟',
});

assert.equal(modelCallCount, 1);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
const approvalInput = JSON.stringify(result.pendingApproval.command.toolCall.input ?? {});
assert.match(approvalInput, /forceMouseEventFallback/u);
assert.match(approvalInput, /send_keys/u);
assert.match(approvalInput, /1280/u);
assert.match(approvalInput, /\\"y\\":837/u);
assert.match(approvalInput, /expectedForegroundHwnd/iu);
assert.match(approvalInput, /133976/u);
assert.match(approvalInput, /\\"action\\":\\"focus_window\\"/u);
assert.match(approvalInput, /\\"hwnd\\":133976/u);
assert.equal(result.debug?.v4TaskShadow?.classification, 'approval_pending');

console.log('agent session v2 login continuation approval smoke ok');
