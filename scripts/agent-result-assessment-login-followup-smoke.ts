import assert from 'node:assert/strict';
import {
  assessAgentCommandResult,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/index.ts';

const command: AgentChatCommand = {
  capabilityId: 'desktop-observation',
  instruction: 'Wait for WeGame',
  kind: 'tool-call',
  sourceText: '/agent open League of Legends in WeGame',
  toolCall: {
    goal: 'open League of Legends in WeGame',
    input: {
      action: 'wait_and_observe',
      forceRefresh: true,
      includeVisual: true,
      query: 'WeGame',
      waitMs: 2500,
    },
    name: 'execute_desktop_observation',
  },
};

const loginResult: AgentChatCommandResult = {
  ok: true,
  receipt: {
    evidenceLines: [
      'Visual readable text: WeGame quick safe login account login',
      'Visual post-action state: login_required',
    ],
    status: 'success',
    summaryLines: ['Call: execute_desktop_observation wait_and_observe'],
    title: 'Desktop observation',
    toolName: 'execute_desktop_observation',
    verification: 'Waited 2500ms before observing current desktop state.',
  },
  responseText: [
    'Observed apps/windows: running=1. Running sample: wegame title="WeGame".',
    'Visual readable text: WeGame quick safe login account login',
    'Visual post-action state: login_required',
    'Visual action readiness: ready',
    'Visual primary action: click the quick safe login button',
    'Visual action candidate 1: quick safe login | confidence=high | centerRatio=0.500,0.710',
    'Visual coordinate audit: status=coordinate_ok',
  ].join('\n'),
  stateSummary: {
    observedState: [
      'Visual readable text: WeGame quick safe login account login',
      'Visual post-action state: login_required',
    ],
    structuredEvidence: {
      coordinateAuditStatus: 'coordinate_ok',
      captureSourceType: 'window',
      finalWindow: { hwnd: 133976, pid: 34712, title: 'WeGame' },
      elementCenterRatio: {
        coordinateSpace: 'source-ratio',
        x: 0.5,
        y: 0.71,
      },
      postActionState: 'login_required',
      primaryAction: 'quick safe login',
      launcherVerification: {
        primaryActionMatchesTarget: true,
        status: 'ready',
        targetSelected: true,
        targetVisible: true,
      },
      sourceBounds: {
        coordinateSpace: 'native-screen',
        height: 670,
        width: 1191,
        x: 684,
        y: 355,
      },
      status: 'unverified',
      targetMatched: 'WeGame login',
      visualActionReadiness: 'ready',
    },
    verificationEvidence: [
      'WeGame window is visible but user-level target is not launched.',
    ],
  },
  verification: 'Waited 2500ms before observing current desktop state.',
};

const assessed = assessAgentCommandResult(command, loginResult);

assert.equal(assessed.assessment?.status, 'unverified');
assert.equal(assessed.followUpActions?.[0]?.kind, 'run-command');
assert.equal(assessed.followUpActions?.[0]?.label, 'Click login button');

if (assessed.followUpActions?.[0]?.kind === 'run-command') {
  assert.equal(assessed.followUpActions[0].command.toolCall?.name, 'execute_desktop_sequence');
  const assessedStepsJson = String(assessed.followUpActions[0].command.toolCall?.input.stepsJson);
  assert.match(assessedStepsJson, /"action":"focus_window"/u);
  assert.match(assessedStepsJson, /"action":"click"/u);
  assert.match(assessedStepsJson, /"action":"send_keys"/u);
  assert.match(assessedStepsJson, /"repeat":1/u);
  assert.match(assessedStepsJson, /"holdMs":140/u);
  assert.match(assessedStepsJson, /"preClickDelayMs":180/u);
  assert.match(assessedStepsJson, /"x":1280/u);
  assert.match(assessedStepsJson, /"y":831/u);
  assert.match(assessedStepsJson, /"expectedForegroundHwnd":133976/u);
  assert.match(assessedStepsJson, /"expectedForegroundPid":34712/u);
  assert.equal(assessed.followUpActions[0].requiresApproval, true);
}

const candidateOwnedLoginResult: AgentChatCommandResult = {
  ...loginResult,
  stateSummary: {
    ...loginResult.stateSummary,
    structuredEvidence: {
      ...loginResult.stateSummary?.structuredEvidence,
      elementCenterRatio: {
        coordinateSpace: 'source-ratio',
        x: 0.5,
        y: 0.83,
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
    },
  },
};
const candidateOwnedAssessed = assessAgentCommandResult(command, candidateOwnedLoginResult);
assert.equal(candidateOwnedAssessed.followUpActions?.[0]?.kind, 'run-command');
if (candidateOwnedAssessed.followUpActions?.[0]?.kind === 'run-command') {
  const candidateStepsJson = String(candidateOwnedAssessed.followUpActions[0].command.toolCall?.input.stepsJson);
  assert.match(candidateStepsJson, /"x":1280/u);
  assert.match(candidateStepsJson, /"y":837/u);
  assert.doesNotMatch(candidateStepsJson, /"y":911/u);
  assert.match(candidateStepsJson, /"expectedForegroundHwnd":133976/u);
  assert.match(candidateStepsJson, /"expectedForegroundPid":34712/u);
}

assert.notEqual(assessed.followUpActions?.[0]?.label, 'Retry once');

const noisyQueryCommand: AgentChatCommand = {
  ...command,
  toolCall: command.toolCall
    ? {
        ...command.toolCall,
        input: {
          ...command.toolCall.input,
          query: 'suspected login related text',
        },
      }
    : command.toolCall,
};
const noisyQueryAssessed = assessAgentCommandResult(noisyQueryCommand, loginResult);
if (noisyQueryAssessed.followUpActions?.[0]?.kind === 'run-command') {
  const stepsJson = String(noisyQueryAssessed.followUpActions[0].command.toolCall?.input.stepsJson);
  assert.match(stepsJson, /"action":"focus_window"/u);
  assert.match(stepsJson, /"query":"WeGame"/u);
  assert.doesNotMatch(stepsJson, /suspected login related text/u);
}

const ambiguousLoginResult: AgentChatCommandResult = {
  ...loginResult,
  stateSummary: {
    ...loginResult.stateSummary,
    structuredEvidence: {
      ...loginResult.stateSummary?.structuredEvidence,
      primaryAction: '',
      targetMatched: '未明确，目标未匹配',
    },
  },
};

const ambiguousAssessed = assessAgentCommandResult(command, ambiguousLoginResult);

assert.equal(ambiguousAssessed.assessment?.status, 'unverified');
assert.equal(ambiguousAssessed.followUpActions?.[0]?.kind, 'run-command');
assert.equal(ambiguousAssessed.followUpActions?.[0]?.label, 'Locate login button');

if (ambiguousAssessed.followUpActions?.[0]?.kind === 'run-command') {
  assert.equal(ambiguousAssessed.followUpActions[0].command.toolCall?.name, 'locate_screen_elements');
  assert.notEqual(ambiguousAssessed.followUpActions[0].requiresApproval, true);
  assert.doesNotMatch(String(ambiguousAssessed.followUpActions[0].command.toolCall?.input?.stepsJson), /execute_desktop_input/u);
}

const uncertainChineseLoginResult: AgentChatCommandResult = {
  ...loginResult,
  stateSummary: {
    ...loginResult.stateSummary,
    structuredEvidence: {
      ...loginResult.stateSummary?.structuredEvidence,
      primaryAction: '',
      targetMatched: '暂无法确定有效操作，需先确认中间窗口是否为英雄联盟启动器',
    },
  },
};

const uncertainChineseAssessed = assessAgentCommandResult(command, uncertainChineseLoginResult);

assert.equal(uncertainChineseAssessed.assessment?.status, 'unverified');
assert.equal(uncertainChineseAssessed.followUpActions?.[0]?.kind, 'run-command');
assert.equal(uncertainChineseAssessed.followUpActions?.[0]?.label, 'Locate login button');

if (uncertainChineseAssessed.followUpActions?.[0]?.kind === 'run-command') {
  assert.equal(uncertainChineseAssessed.followUpActions[0].command.toolCall?.name, 'locate_screen_elements');
  assert.notEqual(uncertainChineseAssessed.followUpActions[0].requiresApproval, true);
  assert.doesNotMatch(String(uncertainChineseAssessed.followUpActions[0].command.toolCall?.input?.stepsJson), /execute_desktop_input/u);
}

const needsTargetSelectionResult: AgentChatCommandResult = {
  ...loginResult,
  stateSummary: {
    ...loginResult.stateSummary,
    structuredEvidence: {
      ...loginResult.stateSummary?.structuredEvidence,
      confidence: 'medium',
      launcherVerification: {
        primaryActionMatchesTarget: false,
        status: 'needs-target-selection',
        targetSelected: false,
        targetVisible: true,
      },
      primaryAction: '疑似点击启动对应游戏，无法完全确认',
      targetMatched: '部分匹配，疑似英雄联盟条目及对应启动按钮存在但无明确文字确认',
      visualActionReadiness: 'needs-target-selection',
    },
  },
};

const needsTargetSelectionAssessed = assessAgentCommandResult(command, needsTargetSelectionResult);

assert.equal(needsTargetSelectionAssessed.assessment?.status, 'unverified');
assert.equal(needsTargetSelectionAssessed.followUpActions?.[0]?.kind, 'run-command');
assert.equal(needsTargetSelectionAssessed.followUpActions?.[0]?.label, 'Locate login button');

if (needsTargetSelectionAssessed.followUpActions?.[0]?.kind === 'run-command') {
  assert.equal(needsTargetSelectionAssessed.followUpActions[0].command.toolCall?.name, 'locate_screen_elements');
  assert.notEqual(needsTargetSelectionAssessed.followUpActions[0].requiresApproval, true);
  assert.doesNotMatch(String(needsTargetSelectionAssessed.followUpActions[0].command.toolCall?.input?.stepsJson), /execute_desktop_input/u);
}

const unclearLoginButtonResult: AgentChatCommandResult = {
  ...loginResult,
  responseText: [
    'Visual post-action state: login_required',
    'Visual action readiness: ready',
    'Visual primary action: click orange primary action button',
    'Visual action candidate 1: orange operation button | confidence=medium | centerRatio=0.500,0.570',
    'Visual element center: x=1280 y=821 source=elementCenterRatio',
    'Visual coordinate audit: status=coordinate_ok',
    'Visual uncertainty: 无法确认当前界面是登录页还是更新页，无法确认橙色按钮具体功能，无法确认是否需要输入账号凭据',
  ].join('\n'),
  stateSummary: {
    ...loginResult.stateSummary,
    structuredEvidence: {
      ...loginResult.stateSummary?.structuredEvidence,
      confidence: 'medium',
      elementCenterRatio: {
        coordinateSpace: 'source-ratio',
        x: 0.5,
        y: 0.57,
      },
      launcherVerification: {
        primaryActionMatchesTarget: null,
        status: 'needs-relation',
        targetSelected: null,
        targetVisible: true,
      },
      postActionState: 'login_required',
      primaryAction: 'click orange primary action button',
      sourceBounds: {
        coordinateSpace: 'native-screen',
        height: 1440,
        width: 2560,
        x: 0,
        y: 0,
      },
      targetMatched: 'League of Legends client',
      visualActionReadiness: 'ready',
    },
  },
};

const unclearLoginButtonAssessed = assessAgentCommandResult(command, unclearLoginButtonResult);

assert.equal(unclearLoginButtonAssessed.assessment?.status, 'unverified');
assert.equal(unclearLoginButtonAssessed.followUpActions?.[0]?.kind, 'run-command');
assert.equal(unclearLoginButtonAssessed.followUpActions?.[0]?.label, 'Click login button');

if (unclearLoginButtonAssessed.followUpActions?.[0]?.kind === 'run-command') {
  assert.equal(unclearLoginButtonAssessed.followUpActions[0].command.toolCall?.name, 'execute_desktop_sequence');
  assert.equal(unclearLoginButtonAssessed.followUpActions[0].requiresApproval, true);
  assert.match(String(unclearLoginButtonAssessed.followUpActions[0].command.toolCall?.input.stepsJson), /"x":1280/u);
  assert.match(String(unclearLoginButtonAssessed.followUpActions[0].command.toolCall?.input.stepsJson), /"y":821/u);
  assert.doesNotMatch(String(unclearLoginButtonAssessed.followUpActions[0].command.toolCall?.input.stepsJson), /locate_screen_elements/u);
}

const screenOnlyLoginResult: AgentChatCommandResult = {
  ...loginResult,
  stateSummary: {
    ...loginResult.stateSummary,
    structuredEvidence: {
      ...loginResult.stateSummary?.structuredEvidence,
      captureSourceType: 'screen',
    },
  },
};
const screenOnlyLoginAssessed = assessAgentCommandResult(command, screenOnlyLoginResult);
assert.notEqual(screenOnlyLoginAssessed.followUpActions?.[0]?.label, 'Click login button');

const lowConfidenceVisualResult: AgentChatCommandResult = {
  ...loginResult,
  responseText: [
    loginResult.responseText,
    'Visual action readiness: low-confidence',
    'Visual coordinate audit: status=coordinate_unknown',
    'Visual primary action: 无法确定',
  ].join('\n'),
  stateSummary: {
    ...loginResult.stateSummary,
    structuredEvidence: {
      ...loginResult.stateSummary?.structuredEvidence,
      coordinateAuditStatus: 'coordinate_unknown',
      confidence: 'low',
      launcherVerification: {
        status: 'low-confidence',
        targetSelected: null,
        targetVisible: true,
      },
      primaryAction: '无法确定',
      targetMatched: '所有文字模糊无法识别',
      visualActionReadiness: 'low-confidence',
    },
  },
};

const lowConfidenceVisualAssessed = assessAgentCommandResult(command, lowConfidenceVisualResult);

assert.equal(lowConfidenceVisualAssessed.assessment?.status, 'unverified');
assert.notEqual(lowConfidenceVisualAssessed.followUpActions?.[0]?.label, 'Locate login button');

if (lowConfidenceVisualAssessed.followUpActions?.[0]?.kind === 'run-command') {
  assert.notEqual(lowConfidenceVisualAssessed.followUpActions[0].command.toolCall?.name, 'execute_desktop_sequence');
  assert.doesNotMatch(String(lowConfidenceVisualAssessed.followUpActions[0].command.toolCall?.input?.stepsJson), /execute_desktop_input/u);
}

const lowConfidenceAuditedLoginResult: AgentChatCommandResult = {
  ...loginResult,
  responseText: [
    loginResult.responseText,
    'Visual post-action state: login_required',
    'Visual action readiness: low-confidence',
    'Visual confidence: 0.3',
    'Visual coordinate audit: status=coordinate_ok | point=1280,835',
    'Visual primary action: 登录',
    'Visual target/action relation: 登录按钮是登录窗口主操作控件，关系相对明确',
  ].join('\n'),
  stateSummary: {
    ...loginResult.stateSummary,
    structuredEvidence: {
      ...loginResult.stateSummary?.structuredEvidence,
      confidence: 'low',
      coordinateAuditStatus: 'coordinate_ok',
      elementCenterRatio: { x: 0.5, y: 0.58 },
      launcherVerification: {
        primaryActionMatchesTarget: true,
        status: 'low-confidence',
        targetSelected: null,
        targetVisible: true,
      },
      postActionState: 'login_required',
      primaryAction: '登录',
      relation: '登录按钮是登录窗口主操作控件，关系相对明确',
      sourceBounds: {
        coordinateSpace: 'native-screen',
        height: 1440,
        width: 2560,
        x: 0,
        y: 0,
      },
      targetMatched: '登录',
      visualActionReadiness: 'low-confidence',
    },
  },
};

const lowConfidenceAuditedLoginAssessed = assessAgentCommandResult(command, lowConfidenceAuditedLoginResult);

assert.equal(lowConfidenceAuditedLoginAssessed.assessment?.status, 'unverified');
assert.equal(lowConfidenceAuditedLoginAssessed.followUpActions?.[0]?.kind, 'run-command');
assert.equal(lowConfidenceAuditedLoginAssessed.followUpActions?.[0]?.label, 'Click login button');

if (lowConfidenceAuditedLoginAssessed.followUpActions?.[0]?.kind === 'run-command') {
  assert.equal(lowConfidenceAuditedLoginAssessed.followUpActions[0].command.toolCall?.name, 'execute_desktop_sequence');
  assert.match(String(lowConfidenceAuditedLoginAssessed.followUpActions[0].command.toolCall?.input.stepsJson), /execute_desktop_input/u);
  assert.match(String(lowConfidenceAuditedLoginAssessed.followUpActions[0].command.toolCall?.input.stepsJson), /"x":1280/u);
  assert.match(String(lowConfidenceAuditedLoginAssessed.followUpActions[0].command.toolCall?.input.stepsJson), /"y":835/u);
}

console.log('agent result assessment login follow-up smoke ok');
