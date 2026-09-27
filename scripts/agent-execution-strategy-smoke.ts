import assert from 'node:assert/strict';
import {
  resolveAgentVisualExecutionStrategy,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/index.ts';

function createLocateCommand(): AgentChatCommand {
  return {
    instruction: 'locate login button',
    sourceText: 'click login',
    toolCall: {
      goal: 'click login',
      input: {
        query: 'WeGame',
        sourceQuery: 'WeGame',
      },
      name: 'locate_screen_elements',
    },
  };
}

const uiaResult: AgentChatCommandResult = {
  ok: true,
  responseText: 'ready',
  stateSummary: {
    structuredEvidence: {
      actionCandidates: [
        {
          actions: ['invoke'],
          automationId: 'login-btn',
          center: {
            coordinateSpace: 'native-screen',
            x: 400,
            y: 260,
          },
          confidence: 'high',
          controlType: 'Button',
          enabled: true,
          label: '快速安全登录',
          source: 'ui-automation',
          window: {
            hwnd: 12345,
            processName: 'WeGame.exe',
            title: 'WeGame',
          },
        },
      ],
      confidence: 'high',
      coordinateConfidence: 'high',
      elementCenter: {
        coordinateSpace: 'native-screen',
        x: 400,
        y: 260,
      },
      primaryAction: '快速安全登录',
      targetMatched: '快速安全登录',
      sourceBounds: {
        coordinateSpace: 'native-screen',
        height: 720,
        width: 1280,
        x: 0,
        y: 0,
      },
      visualActionReadiness: 'ready',
    },
  },
};

const uiaDecision = resolveAgentVisualExecutionStrategy({
  command: createLocateCommand(),
  result: uiaResult,
  sourceText: '点击 WeGame 登录按钮',
  userGoal: '登录 WeGame',
});

assert.equal(uiaDecision.kind, 'uia');
assert.match(uiaDecision.reason, /UIA invoke candidate/u);
assert.match(uiaDecision.diagnostics.join('\n'), /Execution strategy: uia/u);
assert.equal(uiaDecision.command?.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(uiaDecision.command?.toolCall?.input?.stepsJson), /"action":"interact_window_ui"/u);
assert.match(String(uiaDecision.command?.toolCall?.input?.stepsJson), /"uiAction":"invoke"/u);
assert.equal(uiaDecision.command?.toolCall?.input?.executionStrategy, 'uia');
assert.equal(uiaDecision.command?.toolCall?.input?.postVerifyRequired, true);

const coordinateResult: AgentChatCommandResult = {
  ok: true,
  responseText: 'ready',
  stateSummary: {
    structuredEvidence: {
      confidence: 'high',
      coordinateAuditStatus: 'coordinate_ok',
      coordinateConfidence: 'high',
      elementCenter: {
        coordinateSpace: 'native-screen',
        x: 500,
        y: 300,
      },
      primaryAction: '开始游戏',
      targetMatched: '英雄联盟',
      sourceBounds: {
        coordinateSpace: 'native-screen',
        height: 720,
        width: 1280,
        x: 0,
        y: 0,
      },
      visualActionReadiness: 'ready',
    },
  },
};

const coordinateDecision = resolveAgentVisualExecutionStrategy({
  command: createLocateCommand(),
  result: coordinateResult,
  sourceText: '启动英雄联盟',
  userGoal: '打开 WeGame 中的英雄联盟',
});

assert.equal(coordinateDecision.kind, 'coordinate');
assert.match(coordinateDecision.reason, /No usable UIA candidate/u);
assert.match(coordinateDecision.diagnostics.join('\n'), /Execution strategy: coordinate/u);
assert.match(String(coordinateDecision.command?.toolCall?.input?.stepsJson), /"action":"click"/u);
assert.match(String(coordinateDecision.command?.toolCall?.input?.stepsJson), /"coordinateSpace":"native-screen"/u);
assert.equal(coordinateDecision.command?.toolCall?.input?.executionStrategy, 'coordinate');
assert.equal(coordinateDecision.command?.toolCall?.input?.postVerifyRequired, true);
assert.doesNotMatch(String(coordinateDecision.command?.toolCall?.input?.stepsJson), /"send_keys"/u);

const hwndBoundCoordinateDecision = resolveAgentVisualExecutionStrategy({
  command: createLocateCommand(),
  result: {
    ...coordinateResult,
    stateSummary: {
      structuredEvidence: {
        ...coordinateResult.stateSummary!.structuredEvidence!,
        finalWindow: {
          hwnd: 123456,
          processName: 'wegame',
          title: 'WeGame',
        },
      },
    },
  },
  sourceText: '点击 WeGame 登录按钮',
  userGoal: '登录 WeGame',
});
assert.equal(hwndBoundCoordinateDecision.kind, 'coordinate');
assert.equal(hwndBoundCoordinateDecision.command?.toolCall?.input?.mode, 'visible_click');
assert.equal(hwndBoundCoordinateDecision.command?.toolCall?.input?.sourceHwnd, 123456);
assert.equal(hwndBoundCoordinateDecision.command?.toolCall?.input?.targetX, 500);
assert.equal(hwndBoundCoordinateDecision.command?.toolCall?.input?.targetY, 300);
assert.equal(hwndBoundCoordinateDecision.command?.toolCall?.input?.requireSameHwnd, true);
assert.equal(hwndBoundCoordinateDecision.command?.toolCall?.input?.stepsJson, undefined);

const badCoordinateDecision = resolveAgentVisualExecutionStrategy({
  command: createLocateCommand(),
  result: {
    ok: true,
    responseText: 'ready',
    stateSummary: {
      structuredEvidence: {
        confidence: 'high',
        coordinateAudit: {
          coordinateSpace: 'native-screen',
          insideSourceBounds: false,
          point: { x: 1280, y: 858 },
          reason: 'Point is outside the selected capture source bounds.',
          sourceBounds: { height: 670, width: 1191, x: 0, y: 0 },
          status: 'coordinate_out_of_bounds',
        },
        coordinateAuditStatus: 'coordinate_out_of_bounds',
        coordinateConfidence: 'high',
        elementCenter: {
          coordinateSpace: 'native-screen',
          x: 1280,
          y: 858,
        },
        primaryAction: '快速安全登录',
        sourceBounds: {
          coordinateSpace: 'native-screen',
          height: 670,
          width: 1191,
          x: 0,
          y: 0,
        },
        targetMatched: '账号密码登录',
        visualActionReadiness: 'ready',
      },
    },
  },
  sourceText: '点击 WeGame 登录按钮',
  userGoal: '登录 WeGame',
});

assert.equal(badCoordinateDecision.kind, 'none');
assert.equal(badCoordinateDecision.command, undefined);
assert.match(badCoordinateDecision.reason, /coordinate audit is coordinate_out_of_bounds/u);
assert.match(badCoordinateDecision.diagnostics.join('\n'), /Coordinate audit: coordinate_out_of_bounds/u);

const ratioCoordinateDecision = resolveAgentVisualExecutionStrategy({
  command: createLocateCommand(),
  result: {
    ok: true,
    responseText: 'ready',
    stateSummary: {
      structuredEvidence: {
        confidence: 'high',
        coordinateConfidence: 'high',
        elementCenter: {
          coordinateSpace: 'native-screen',
          x: 1280,
          y: 858,
        },
        elementCenterRatio: {
          coordinateSpace: 'source-ratio',
          x: 0.5,
          y: 0.8,
        },
        primaryAction: '快速安全登录',
        sourceBounds: {
          coordinateSpace: 'native-screen',
          height: 670,
          width: 1191,
          x: 100,
          y: 200,
        },
        targetMatched: '账号密码登录',
        visualActionReadiness: 'ready',
      },
    },
  },
  sourceText: '点击 WeGame 登录按钮',
  userGoal: '登录 WeGame',
});

assert.equal(ratioCoordinateDecision.kind, 'coordinate');
assert.match(ratioCoordinateDecision.reason, /derived native-screen point/u);
assert.match(String(ratioCoordinateDecision.command?.toolCall?.input?.stepsJson), /"x":696/u);
assert.match(String(ratioCoordinateDecision.command?.toolCall?.input?.stepsJson), /"y":736/u);

const loginCoordinateDecision = resolveAgentVisualExecutionStrategy({
  command: createLocateCommand(),
  result: {
    ok: true,
    responseText: 'ready',
    stateSummary: {
      structuredEvidence: {
        confidence: 'high',
        coordinateConfidence: 'high',
        elementCenterRatio: {
          coordinateSpace: 'source-ratio',
          x: 0.5,
          y: 0.8,
        },
        primaryAction: '快速安全登录',
        sourceBounds: {
          coordinateSpace: 'native-screen',
          height: 670,
          width: 1191,
          x: 100,
          y: 200,
        },
        targetMatched: '账号密码登录',
        visualActionReadiness: 'ready',
      },
    },
  },
  sourceText: '点击 WeGame 登录按钮',
  userGoal: '登录 WeGame',
});

assert.equal(loginCoordinateDecision.kind, 'coordinate');
assert.match(String(loginCoordinateDecision.command?.toolCall?.input?.stepsJson), /"action":"focus_window"/u);
assert.match(String(loginCoordinateDecision.command?.toolCall?.input?.stepsJson), /"query":"WeGame"/u);
assert.match(String(loginCoordinateDecision.command?.toolCall?.input?.stepsJson), /"action":"click"/u);
assert.match(String(loginCoordinateDecision.command?.toolCall?.input?.stepsJson), /"action":"send_keys"/u);
assert.match(String(loginCoordinateDecision.command?.toolCall?.input?.stepsJson), /"repeat":1/u);
assert.match(String(loginCoordinateDecision.command?.toolCall?.input?.stepsJson), /"holdMs":140/u);
assert.match(String(loginCoordinateDecision.command?.toolCall?.input?.stepsJson), /"preClickDelayMs":180/u);
assert.match(String(loginCoordinateDecision.command?.toolCall?.input?.stepsJson), /"forceMouseEventFallback":true/u);
assert.match(String(loginCoordinateDecision.command?.toolCall?.input?.stepsJson), /\{ENTER\}/u);
assert.equal(loginCoordinateDecision.command?.toolCall?.input?.postVerifyRequired, true);

const textOnlyLoginCoordinateDecision = resolveAgentVisualExecutionStrategy({
  command: createLocateCommand(),
  result: {
    ok: true,
    responseText: [
      'Screen element observation (describe_elements): Visual target matched: 橙色按钮',
      'Visual primary action: 点击登录按钮完成登录',
      'Visual element center: x=1280 y=700',
      'Visual element center ratio: x=0.500 y=0.560',
      'Visual source bounds: x=0 y=0 width=2560 height=1440',
      'Visual coordinate audit: status=coordinate_ok | point=1280,700',
      'Launcher verification: status=needs-relation targetVisible=true selected=unknown detailMatches=unknown actionMatches=unknown',
      'Visual action readiness: ready',
      'Visual confidence: 0.6',
    ].join(' '),
  },
  sourceText: 'click WeGame login button',
  userGoal: 'login WeGame',
});

assert.equal(textOnlyLoginCoordinateDecision.kind, 'none');
assert.equal(textOnlyLoginCoordinateDecision.command, undefined);
assert.match(textOnlyLoginCoordinateDecision.reason, /needs-relation/u);

const noisyQueryLoginCoordinateDecision = resolveAgentVisualExecutionStrategy({
  command: {
    ...createLocateCommand(),
    toolCall: {
      ...createLocateCommand().toolCall,
      input: {
        query: 'suspected login related text',
      },
    },
  },
  result: {
    ok: true,
    responseText: 'ready',
    stateSummary: {
      structuredEvidence: {
        confidence: 'high',
        coordinateAuditStatus: 'coordinate_ok',
        coordinateConfidence: 'high',
        elementCenter: {
          coordinateSpace: 'native-screen',
          x: 1281,
          y: 822,
        },
        primaryAction: 'quick safe login',
        sourceBounds: {
          coordinateSpace: 'native-screen',
          height: 900,
          width: 1600,
          x: 0,
          y: 0,
        },
        targetMatched: 'account login',
        visualActionReadiness: 'ready',
      },
    },
  },
  sourceText: 'click WeGame login button',
  userGoal: 'login WeGame',
});
assert.doesNotMatch(String(noisyQueryLoginCoordinateDecision.command?.toolCall?.input?.stepsJson), /"query":"WeGame"/u);
assert.doesNotMatch(String(noisyQueryLoginCoordinateDecision.command?.toolCall?.input?.stepsJson), /suspected login related text/u);

const ambiguousLoginCoordinateDecision = resolveAgentVisualExecutionStrategy({
  command: createLocateCommand(),
  result: {
    ok: true,
    responseText: 'ready',
    stateSummary: {
      structuredEvidence: {
        confidence: 'high',
        coordinateAuditStatus: 'coordinate_ok',
        coordinateConfidence: 'high',
        elementCenter: {
          coordinateSpace: 'native-screen',
          x: 1281,
          y: 573,
        },
        primaryAction: '',
        targetMatched: '未明确，目标未匹配',
        visualActionReadiness: 'ready',
      },
    },
  },
  sourceText: 'Open League of Legends from WeGame',
  userGoal: 'Open League of Legends from WeGame',
});

assert.equal(ambiguousLoginCoordinateDecision.kind, 'none');
assert.equal(ambiguousLoginCoordinateDecision.command, undefined);
assert.match(ambiguousLoginCoordinateDecision.reason, /target_not_resolved/u);
assert.match(ambiguousLoginCoordinateDecision.diagnostics.join('\n'), /Execution strategy: none/u);

const blockedDecision = resolveAgentVisualExecutionStrategy({
  command: createLocateCommand(),
  result: {
    ok: true,
    responseText: 'not ready',
    stateSummary: {
      structuredEvidence: {
        confidence: 'high',
        visualActionReadiness: 'needs-primary-action',
      },
    },
  },
  sourceText: '启动英雄联盟',
  userGoal: '打开 WeGame 中的英雄联盟',
});

assert.equal(blockedDecision.kind, 'none');
assert.equal(blockedDecision.command, undefined);
assert.match(blockedDecision.reason, /needs-primary-action/u);

console.log('agent execution strategy smoke ok');
