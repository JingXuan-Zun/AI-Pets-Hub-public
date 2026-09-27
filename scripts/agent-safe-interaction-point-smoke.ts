import assert from 'node:assert/strict';
import {
  resolveAgentVisualExecutionStrategy,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/index.ts';

const command: AgentChatCommand = {
  instruction: 'click the QQ login button',
  sourceText: '打开 QQ 并登录',
  toolCall: {
    goal: 'Open QQ and log in',
    input: {
      sourceQuery: 'QQ',
      targetText: '登录',
    },
    name: 'locate_screen_elements',
  },
};

const result: AgentChatCommandResult = {
  ok: true,
  responseText: 'QQ login button is actionable.',
  stateSummary: {
    structuredEvidence: {
      captureSourceType: 'window',
      captureTrusted: true,
      confidence: 'high',
      coordinateAuditStatus: 'coordinate_ok',
      coordinateConfidence: 'high',
      elementBounds: {
        coordinateSpace: 'native-screen',
        height: 56,
        width: 292,
        x: 1142,
        y: 838,
      },
      elementCenter: {
        coordinateSpace: 'native-screen',
        x: 1308,
        y: 842,
      },
      primaryAction: '登录',
      sourceBounds: {
        coordinateSpace: 'native-screen',
        height: 695,
        width: 496,
        x: 1032,
        y: 342,
      },
      targetMatched: 'QQ 登录按钮',
      visualActionReadiness: 'ready',
    },
  },
};

const decision = resolveAgentVisualExecutionStrategy({
  command,
  result,
  sourceText: command.sourceText,
  userGoal: 'Open QQ and log in',
});

assert.equal(decision.kind, 'coordinate');
assert.match(decision.reason, /geometric center/u);
const steps = JSON.parse(String(decision.command?.toolCall?.input.stepsJson)) as Array<{
  args?: { action?: string; x?: number; y?: number };
}>;
const clickStep = steps.find((step) => step.args?.action === 'click');
assert.equal(clickStep?.args?.x, 1288);
assert.equal(clickStep?.args?.y, 866);
assert.notEqual(clickStep?.args?.y, 842);

console.log('agent safe interaction point smoke ok');
