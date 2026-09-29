import assert from 'node:assert/strict';
import {
  resolveAgentVisualExecutionStrategy,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/index.ts';

function createWeGameLocateCommand(): AgentChatCommand {
  return {
    instruction: 'locate login button in WeGame',
    kind: 'tool-call',
    sourceText: '打开 WeGame 里的英雄联盟',
    toolCall: {
      goal: '打开 WeGame 里的英雄联盟',
      input: {
        action: 'locate_element',
        hwnd: 2690792,
        sourceQuery: 'WeGame',
        sourceType: 'window',
        targetText: '登录',
      },
      name: 'locate_screen_elements',
    },
  };
}

function createLocateResult(structuredEvidence: NonNullable<AgentChatCommandResult['stateSummary']>['structuredEvidence']): AgentChatCommandResult {
  return {
    ok: true,
    responseText: 'Located visual state in WeGame.',
    stateSummary: {
      structuredEvidence,
    },
  };
}

const visibleOnlyDecision = resolveAgentVisualExecutionStrategy({
  command: createWeGameLocateCommand(),
  result: createLocateResult({
    confidence: 'high',
    coordinateConfidence: 'high',
    launcherVerification: {
      primaryActionMatchesTarget: null,
      status: 'needs-relation',
      targetVisible: true,
    },
    selectionVerificationStatus: 'visible-only',
    targetMatched: '登录',
    visualActionReadiness: 'ready',
  }),
  sourceText: '打开 WeGame 里的英雄联盟',
  userGoal: '打开 WeGame 里的英雄联盟',
});

assert.equal(visibleOnlyDecision.kind, 'none');
assert.equal(visibleOnlyDecision.command, undefined);
assert.match(visibleOnlyDecision.reason, /visible-only|needs-relation|not_actionable/u);

const actionableDecision = resolveAgentVisualExecutionStrategy({
  command: createWeGameLocateCommand(),
  result: createLocateResult({
    confidence: 'high',
    coordinateAuditStatus: 'coordinate_ok',
    coordinateConfidence: 'high',
    elementCenter: {
      coordinateSpace: 'native-screen',
      x: 1180,
      y: 740,
    },
    finalWindow: {
      hwnd: 2690792,
      processName: 'browser',
      title: 'WeGame',
    },
    launcherVerification: {
      detailMatchesTarget: true,
      primaryActionMatchesTarget: true,
      status: 'ready',
      targetSelected: true,
      targetVisible: true,
    },
    primaryAction: '快速安全登录',
    selectionVerificationStatus: 'selected',
    sourceBounds: {
      coordinateSpace: 'native-screen',
      height: 900,
      width: 1600,
      x: 320,
      y: 100,
    },
    targetMatched: '登录',
    visualActionReadiness: 'ready',
  }),
  sourceText: '打开 WeGame 里的英雄联盟',
  userGoal: '打开 WeGame 里的英雄联盟',
});

assert.equal(actionableDecision.kind, 'coordinate');
assert.equal(actionableDecision.command?.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(actionableDecision.command?.toolCall?.input?.stepsJson), /"action":"click"/u);
assert.match(String(actionableDecision.command?.toolCall?.input?.stepsJson), /"x":1180/u);
assert.match(String(actionableDecision.command?.toolCall?.input?.stepsJson), /"y":740/u);
assert.equal(actionableDecision.command?.toolCall?.input?.postVerifyRequired, true);

console.log('agent wegame actionable target gate smoke ok');
