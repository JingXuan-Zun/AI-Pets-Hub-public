import { readProjectSources } from './smokeTestHarness.ts';

import assert from 'node:assert/strict';

import {
  buildAgentPermissionRoute,
  prepareAgentToolInput,
  type AgentChatCommand,
} from '../src/agent/index.ts';

const {
  registry,
  sequence,
  schema,
  windowTools,
} = readProjectSources({
  registry: 'src/agent/agentToolRegistry.ts',
  sequence: 'src/agent/agentRuntimeDesktopSequenceTools.ts',
  schema: 'src/agent/agentToolInputSchema.ts',
  windowTools: 'src/agent/agentRuntimeWindowTools.ts',
});

assert.match(
  schema,
  /execute_desktop_sequence:\s*\[[\s\S]*key: 'mode'[\s\S]*key: 'visibleClickJson'[\s\S]*key: 'app'[\s\S]*key: 'target'[\s\S]*key: 'requireSameHwnd'[\s\S]*key: 'requireActionable'/u,
  'execute_desktop_sequence schema should accept generic visible_click app/target parameters',
);
assert.match(
  schema,
  /key: 'stepsJson',\s*required: true/u,
  'ordinary desktop sequences should preserve their required stepsJson schema contract',
);
assert.match(
  schema,
  /function isAgentToolInputRequired[\s\S]*toolName !== 'execute_desktop_sequence'[\s\S]*spec\.key !== 'stepsJson'[\s\S]*mode === 'visible_click'/u,
  'visible_click should be the explicit exception that bypasses stepsJson validation',
);
assert.match(
  registry,
  /mode[^\n]*visible_click[\s\S]*pass app and target instead of stepsJson/u,
  'tool registry should document visible_click as app/target driven rather than stepsJson driven',
);
assert.match(
  registry,
  /app="WeGame", target="登录按钮" or app="QQ", target="登录按钮"[\s\S]*not app-specific[\s\S]*must not hard-code coordinates/u,
  'planner guidance should present WeGame only as an example and prohibit hard-coded coordinates',
);
assert.match(
  sequence,
  /interface AgentRuntimeVisibleClickSpec[\s\S]*app: string;[\s\S]*target: string/u,
  'visibleClick runtime should model app and target as generic parameters',
);
assert.match(
  sequence,
  /function parseAgentRuntimeVisibleClickSpec[\s\S]*mode === 'visible_click'/u,
  'visibleClick runtime should be enabled by explicit visible_click mode',
);
assert.match(
  sequence,
  /executeLocateScreenElements[\s\S]*sourceType: 'window'[\s\S]*targetText: spec\.target/u,
  'visibleClick should locate the requested target inside a window capture',
);
assert.match(
  sequence,
  /parseAgentRuntimeVisibleClickStrategySteps[\s\S]*getAgentRuntimeSequenceStepAction\(step\) === 'click'[\s\S]*VisibleClick mode intentionally runs one visible pointer click only; keyboard fallbacks are disabled for diagnosis/u,
  'visibleClick should keep only the coordinate click and disable keyboard fallbacks for diagnosis',
);
assert.match(
  sequence,
  /const focusToolCall:[\s\S]*action: 'focus_window',[\s\S]*\.\.\.\(spec\.app \? \{ query: spec\.app \} : \{\}\),[\s\S]*\.\.\.\(!spec\.app && spec\.sourceHwnd \? \{ hwnd: spec\.sourceHwnd \} : \{\}\)/u,
  'visibleClick should resolve the current window from the logical app target before using a stale HWND hint',
);
assert.match(
  sequence,
  /sourceId: hasFocusedHwnd \? `window:\$\{Math\.round\(focusedHwnd\)\}:0`[\s\S]*captureStayedOnWindow/u,
  'visibleClick should bind locate to a concrete window capture source and reject untrusted/window-mismatched evidence',
);
assert.match(
  sequence,
  /const canReuseInheritedTarget = inheritedTarget[\s\S]*focusedHwnd === spec\.sourceHwnd[\s\S]*will re-locate the target because the dispatch-time window identity changed/u,
  'visibleClick should re-locate instead of reusing coordinates when dispatch-time HWND changes',
);
assert.match(
  sequence,
  /postVerifyHwnd:[\s\S]*postVerifyRequireSameHwnd: spec\.requireSameHwnd[\s\S]*postVerifySourceQuery: spec\.app/u,
  'visibleClick should post-verify against the focused app HWND rather than an arbitrary screen capture',
);
assert.match(
  windowTools,
  /const structuredEvidence = \{[\s\S]*finalWindow: \{[\s\S]*hwnd: focusedHwnd[\s\S]*focus_window returned focusedHwnd=/u,
  'focus_window success should expose its HWND through structured finalWindow evidence',
);
assert.match(
  sequence,
  /const canReuseInheritedTarget = inheritedTarget[\s\S]*focusedHwnd === spec\.sourceHwnd[\s\S]*expectedForegroundHwnd: spec\.sourceHwnd/u,
  'inherited visibleClick targets should reuse coordinates only when dispatch-time HWND remains identical',
);

const preparedVisibleClick = prepareAgentToolInput('execute_desktop_sequence', {
  app: 'QQ',
  mode: 'visible_click',
  postVerifyVisualQuery: 'QQ login page changed after clicking',
  requireActionable: true,
  requireSameHwnd: true,
  target: '登录按钮',
});
assert.equal(preparedVisibleClick.ok, true, 'generic visible_click input should pass schema preparation without stepsJson');
if (preparedVisibleClick.ok === false) {
  throw new Error(preparedVisibleClick.error);
}

const visibleClickCommand: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: 'Click the login button in QQ',
  kind: 'tool-call',
  sourceText: '点击 QQ 登录按钮',
  toolCall: {
    goal: 'Click the login button in QQ',
    input: preparedVisibleClick.input,
    name: 'execute_desktop_sequence',
  },
};
const permissionRoute = buildAgentPermissionRoute(visibleClickCommand);
assert.equal(permissionRoute.status, 'needs-approval');
assert.equal(permissionRoute.requiresApproval, true, 'visible_click should keep the existing one-approval sequence boundary');
assert.equal(permissionRoute.plan?.steps.length, 1, 'visible_click should create one grouped approval plan');
assert.match(permissionRoute.plan?.steps[0]?.summary ?? '', /Visible click "登录按钮" in "QQ" with one approval/u);

console.log('agent visible click sequence mode smoke ok');
