import assert from 'node:assert/strict';
import { createAgentCommandFromPlannerDecision } from '../src/agent/agentPlanner.ts';
import { readProjectFile } from './smokeTestHarness.ts';

const command = createAgentCommandFromPlannerDecision(
  '/agent 打开 Chrome 然后放到副屏上',
  {
    args: {
      query: 'Chrome',
    },
    goal: '打开 Chrome 并移动到副屏',
    intent: 'tool',
    tool: 'launch_local_app',
  },
);

assert.equal(command?.kind, 'tool-call');
assert.equal(command?.toolCall?.name, 'execute_desktop_sequence');

const stepsJson = String(command?.toolCall?.input.stepsJson ?? '');
const runtimeCorePlanJson = String(command?.toolCall?.input.runtimeCorePlanJson ?? '');
const steps = JSON.parse(stepsJson) as Array<{ args?: Record<string, unknown>; tool?: string }>;
const runtimeCorePlan = JSON.parse(runtimeCorePlanJson) as {
  kind?: string;
  steps?: Array<{ action?: string; kind?: string; tool?: string }>;
  target?: string;
  targetDisplay?: string;
  version?: number;
};

assert.equal(steps.length, 2);
assert.equal(steps[0]?.tool, 'execute_desktop_action');
assert.equal(steps[0]?.args?.action, 'launch_local_app');
assert.equal(steps[0]?.args?.target, 'Chrome');
assert.equal(steps[1]?.tool, 'execute_desktop_action');
assert.equal(steps[1]?.args?.action, 'move_window_to_display');
assert.equal(steps[1]?.args?.target, 'Chrome');
assert.equal(steps[1]?.args?.targetDisplay, 'secondary');
assert.equal(steps[1]?.args?.fallbackToActiveWindow, true);
assert.equal(command?.toolCall?.input.postVerify, true);
assert.equal(command?.toolCall?.input.postVerifyQuery, 'Chrome on secondary display');
assert.equal(command?.toolCall?.input.postVerifyVisualQuery, '');
assert.equal(runtimeCorePlan.version, 1);
assert.equal(runtimeCorePlan.kind, 'open_target_and_move_window');
assert.equal(runtimeCorePlan.target, 'Chrome');
assert.equal(runtimeCorePlan.targetDisplay, 'secondary');
assert.equal(runtimeCorePlan.steps?.length, 3);
assert.equal(runtimeCorePlan.steps?.[0]?.kind, 'open_app_or_resource');
assert.equal(runtimeCorePlan.steps?.[1]?.kind, 'move_window');
assert.equal(runtimeCorePlan.steps?.[2]?.kind, 'verify_window_on_display');

const englishCommand = createAgentCommandFromPlannerDecision(
  '/agent open Notepad and move it to the primary monitor',
  {
    args: {
      query: 'Notepad',
    },
    goal: 'Open Notepad and move it to the primary monitor',
    intent: 'tool',
    tool: 'launch_local_app',
  },
);
const englishSteps = JSON.parse(String(englishCommand?.toolCall?.input.stepsJson ?? '[]')) as Array<{
  args?: Record<string, unknown>;
  tool?: string;
}>;

assert.equal(englishCommand?.toolCall?.name, 'execute_desktop_sequence');
assert.equal(englishSteps[1]?.args?.targetDisplay, 'primary');

const browserSearchAndMoveCommand = createAgentCommandFromPlannerDecision(
  '/agent search bilibili in the browser and put it on the secondary monitor',
  {
    args: {
      query: 'bilibili',
    },
    goal: 'Search bilibili and move the browser window to the secondary monitor',
    intent: 'tool',
    tool: 'browser_search',
  },
);
const browserSearchAndMoveSteps = JSON.parse(String(browserSearchAndMoveCommand?.toolCall?.input.stepsJson ?? '[]')) as Array<{
  args?: Record<string, unknown>;
  tool?: string;
}>;

assert.equal(browserSearchAndMoveCommand?.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(browserSearchAndMoveCommand?.toolCall?.input.runtimeCorePlanJson ?? ''), /open_target_and_move_window/u);
assert.equal(browserSearchAndMoveSteps.length, 2);
assert.equal(browserSearchAndMoveSteps[0]?.tool, 'execute_desktop_action');
assert.equal(browserSearchAndMoveSteps[0]?.args?.action, 'search_web');
assert.equal(browserSearchAndMoveSteps[0]?.args?.query, 'bilibili');
assert.equal(browserSearchAndMoveSteps[1]?.tool, 'execute_desktop_action');
assert.equal(browserSearchAndMoveSteps[1]?.args?.action, 'move_window_to_display');
assert.equal(browserSearchAndMoveSteps[1]?.args?.target, 'bilibili');
assert.equal(browserSearchAndMoveSteps[1]?.args?.targetDisplay, 'secondary');
assert.equal(browserSearchAndMoveSteps[1]?.args?.fallbackToActiveWindow, true);
assert.deepEqual(browserSearchAndMoveSteps[1]?.args?.queryCandidates, [
  'bilibili',
  'browser',
  'web browser',
]);

const searchWebAndMoveCommand = createAgentCommandFromPlannerDecision(
  '/agent search OpenAI docs and move the browser to the secondary monitor',
  {
    args: {
      query: 'OpenAI docs',
    },
    goal: 'Search OpenAI docs and move the browser window to the secondary monitor',
    intent: 'tool',
    tool: 'search_web',
  },
);
const searchWebAndMoveSteps = JSON.parse(String(searchWebAndMoveCommand?.toolCall?.input.stepsJson ?? '[]')) as Array<{
  args?: Record<string, unknown>;
  tool?: string;
}>;

assert.equal(searchWebAndMoveCommand?.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(searchWebAndMoveCommand?.toolCall?.input.runtimeCorePlanJson ?? ''), /open_target_and_move_window/u);
assert.equal(searchWebAndMoveSteps.length, 2);
assert.equal(searchWebAndMoveSteps[0]?.args?.action, 'search_web');
assert.equal(searchWebAndMoveSteps[0]?.args?.query, 'OpenAI docs');
assert.equal(searchWebAndMoveSteps[1]?.args?.action, 'move_window_to_display');
assert.equal(searchWebAndMoveSteps[1]?.args?.targetDisplay, 'secondary');
assert.deepEqual(searchWebAndMoveSteps[1]?.args?.queryCandidates, [
  'OpenAI docs',
  'browser',
  'web browser',
]);

const desktopInputSource = readProjectFile('electron/desktopInputService.cjs');
assert.doesNotMatch(desktopInputSource, /execFileSync/u, 'desktop input should not block Electron main process with execFileSync');
assert.match(desktopInputSource, /async function executeDesktopInput/u);
assert.match(desktopInputSource, /await runPowerShellScript/u);

const appLauncherSource = readProjectFile('electron/appLauncherService.cjs');
const moveWindowSourceStart = appLauncherSource.indexOf('async function moveWindowToDisplay');
const moveWindowSourceEnd = appLauncherSource.indexOf('function normalizeWindowControlState', moveWindowSourceStart);
const moveWindowSource = appLauncherSource.slice(moveWindowSourceStart, moveWindowSourceEnd);
assert.doesNotMatch(
  appLauncherSource,
  /\b(?:execFileSync|execSync|spawnSync)\b/u,
  'app launcher hot path should not block Electron main process with sync child processes',
);
assert.match(appLauncherSource, /async function runPowerShellScript/u);
assert.match(appLauncherSource, /await runPowerShellScript/u);
assert.match(appLauncherSource, /APP_INDEX_MAX_SHORTCUT_DIRECTORIES/u);
assert.match(appLauncherSource, /APP_INDEX_MAX_SHORTCUTS/u);
assert.match(appLauncherSource, /APP_INDEX_MAX_EXECUTABLE_SCAN_DIRECTORIES/u);
assert.match(moveWindowSource, /queryCandidates/u);
assert.match(moveWindowSource, /\$candidateQueries/u);
assert.match(moveWindowSource, /function Test-DesktopPetWindowMatchesCandidate/u);
assert.match(moveWindowSource, /Test-DesktopPetWindowMatchesCandidate \$foregroundProcess\.ProcessName \$foregroundTitle \$candidateQueries/u);
assert.match(moveWindowSource, /getDetectedBrowserCandidates/u);
assert.match(moveWindowSource, /browserCategoryQueryRequested/u);
assert.match(moveWindowSource, /\$retryMoveAttempted = \$false/u);
assert.match(moveWindowSource, /if \(\$moved -and -not \$verified\)/u);
assert.match(moveWindowSource, /retryMoveAttempted = \[bool\]\$retryMoveAttempted/u);
assert.doesNotMatch(
  moveWindowSource,
  /\$normalizedQuery = Normalize-DesktopPetText \$query\r?\n\$windows = Get-DesktopPetTopLevelWindows/u,
  'move_window_to_display should match against bounded query candidates instead of one narrow query',
);

console.log('agent open move display sequence smoke ok');
