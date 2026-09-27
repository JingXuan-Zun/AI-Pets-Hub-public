import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
let modelCallCount = 0;
let toolCallCount = 0;

const result = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async () => {
    modelCallCount += 1;
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'locate_element',
        sourceQuery: 'Example App',
        sourceType: 'window',
        targetText: 'Sign in',
      },
      reason: 'Locate the visible sign-in control.',
      tool: 'locate_screen_elements',
    });
  },
  settings,
  sourceText: '/agent open Example App and sign in',
  toolExecutor: async (command: AgentChatCommand) => {
    toolCallCount += 1;
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    return {
      ok: true,
      responseText: 'A sign-in button is visible, but the reported click point is above the button.',
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
            center: { coordinateSpace: 'native-screen', x: 1280, y: 703 },
            confidence: 'high',
            label: 'Sign in',
            relation: 'Sign-in action for the prefilled account.',
          }],
          captureSourceType: 'window',
          captureTrusted: true,
          confidence: 'high',
          coordinateAuditStatus: 'coordinate_ok',
          coordinateConfidence: 'high',
          elementCenter: { coordinateSpace: 'native-screen', x: 1280, y: 703 },
          elementBounds: {
            coordinateSpace: 'native-screen',
            height: 240,
            width: 360,
            x: 1100,
            y: 600,
          },
          finalWindow: { hwnd: 99, pid: 100, title: 'Example App' },
          postActionState: 'login_required',
          primaryAction: 'Sign in',
          relation: 'Sign-in action for the prefilled account.',
          targetMatched: 'Sign in',
          visualActionReadiness: 'ready',
        },
      },
      verification: 'The reported center is only inside the larger panel, not inside the Sign in button bounds.',
    };
  },
  userGoal: 'Open Example App and sign in',
});

assert.ok(toolCallCount >= 2, 'the Runtime must collect more than one visual sample before deciding');
assert.notEqual(result.status, 'needs-approval', 'a coordinate outside the action control bounds must never request a click approval');
assert.equal(result.pendingApproval, null);

console.log('agent session v2 actionable area gate smoke ok');
