import assert from 'node:assert/strict';
import {
  AGENT_TOOL_INPUT_PARAM_SPECS,
  buildAgentPermissionRoute,
  getAgentToolLifecycleMetadata,
  isAgentPermissionRouteSilentReadOnly,
  isAgentToolAvailableInMode,
  listAgentToolNames,
  listRegisteredAgentToolNamesOutsideModePolicies,
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentToolCallName,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const toolName = 'execute_desktop_action' satisfies AgentToolCallName;
const desktopInputToolName = 'execute_desktop_input' satisfies AgentToolCallName;

function createToolCommand(input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: 'test execute_desktop_action',
    kind: 'tool-call',
    sourceText: '/agent test execute_desktop_action',
    toolCall: {
      goal: 'test execute_desktop_action',
      input,
      name: toolName,
    },
  };
}

const registeredTools = new Set(listAgentToolNames());
assert.equal(registeredTools.has(toolName), true, 'execute_desktop_action should be registered');
assert.equal(registeredTools.has(desktopInputToolName), true, 'execute_desktop_input should be registered');
assert.equal(isAgentToolAvailableInMode(toolName, 'agent'), true, 'execute_desktop_action should be available in Agent mode');
assert.equal(isAgentToolAvailableInMode(desktopInputToolName, 'agent'), true, 'execute_desktop_input should be available in Agent mode');
assert.deepEqual(listRegisteredAgentToolNamesOutsideModePolicies(), []);

const lifecycle = getAgentToolLifecycleMetadata(toolName);
assert.equal(lifecycle.observes.includes('window-list'), true);
assert.equal(lifecycle.mutates.includes('window-state'), true);
assert.equal(lifecycle.verifies.includes('desktop-action-result'), true);

const schema = AGENT_TOOL_INPUT_PARAM_SPECS[toolName];
const actionSpec = schema.find((spec) => spec.key === 'action');
assert.equal(actionSpec?.required, true);
assert.equal(actionSpec?.enumValues?.includes('list_running_apps'), true);
assert.equal(actionSpec?.enumValues?.includes('open_or_focus_then_move_window_to_display'), true);
assert.equal(actionSpec?.enumValues?.includes('move_window_to_display'), true);
assert.equal(actionSpec?.enumValues?.includes('control_window'), true);
assert.equal(actionSpec?.enumValues?.includes('open_or_focus_then_control_window'), true);
assert.equal(actionSpec?.enumValues?.includes('maximize_window'), true);
assert.equal(actionSpec?.enumValues?.includes('open_url'), true);
assert.equal(actionSpec?.enumValues?.includes('interact_window_ui'), true);
assert.equal(actionSpec?.enumValues?.includes('invoke_window_ui'), true);
assert.equal(schema.some((spec) => spec.key === 'target'), true);
assert.equal(schema.some((spec) => spec.key === 'targetText'), true);
assert.equal(schema.some((spec) => spec.key === 'targetDescription'), true);
assert.equal(schema.some((spec) => spec.key === 'automationId'), true);
assert.equal(schema.some((spec) => spec.key === 'controlType'), true);
assert.equal(schema.some((spec) => spec.key === 'uiAction'), true);
assert.equal(schema.some((spec) => spec.key === 'value'), true);
assert.equal(schema.some((spec) => spec.key === 'targetDisplay'), true);
assert.equal(schema.some((spec) => spec.key === 'displayId'), true);
assert.equal(schema.some((spec) => spec.key === 'fallbackToActiveWindow'), true);
assert.equal(schema.some((spec) => spec.key === 'windowState'), true);
assert.equal(schema.some((spec) => spec.key === 'snap'), true);
assert.equal(schema.some((spec) => spec.key === 'coordinateSpace'), true);
const coordinateSpaceSpec = schema.find((spec) => spec.key === 'coordinateSpace');
assert.equal(coordinateSpaceSpec?.enumValues?.includes('native-screen'), true);
assert.equal(coordinateSpaceSpec?.enumValues?.includes('screen'), false);
assert.equal(coordinateSpaceSpec?.enumValues?.includes('display'), true);
assert.equal(schema.some((spec) => spec.key === 'x'), true);
assert.equal(schema.some((spec) => spec.key === 'y'), true);
assert.equal(schema.some((spec) => spec.key === 'width'), true);
assert.equal(schema.some((spec) => spec.key === 'height'), true);
assert.equal(schema.some((spec) => spec.key === 'pid'), true);
assert.equal(schema.some((spec) => spec.key === 'hwnd'), true);

const desktopInputSchema = AGENT_TOOL_INPUT_PARAM_SPECS[desktopInputToolName];
const desktopInputCoordinateSpaceSpec = desktopInputSchema.find((spec) => spec.key === 'coordinateSpace');
assert.equal(desktopInputSchema.some((spec) => spec.key === 'coordinateSpace'), true);
assert.equal(desktopInputCoordinateSpaceSpec?.enumValues?.includes('native-screen'), true);
assert.equal(desktopInputCoordinateSpaceSpec?.enumValues?.includes('dip'), true);
assert.equal(desktopInputCoordinateSpaceSpec?.enumValues?.includes('screen'), false);
assert.equal(desktopInputCoordinateSpaceSpec?.enumValues?.includes('display'), false);

const readRoute = buildAgentPermissionRoute(createToolCommand({
  action: 'list_running_apps',
  target: 'browser',
}));
assert.equal(readRoute.status, 'silent');
assert.equal(readRoute.maxRisk, 'read');
assert.equal(readRoute.requiresApproval, false);
assert.equal(isAgentPermissionRouteSilentReadOnly(readRoute), true);
assert.equal(readRoute.plan?.steps.some((step) => step.action.kind === 'list-running-apps'), true);

const defaultBrowserRoute = buildAgentPermissionRoute(createToolCommand({
  action: 'get_default_browser',
}));
assert.equal(defaultBrowserRoute.status, 'silent');
assert.equal(defaultBrowserRoute.maxRisk, 'read');

const activeWindowRoute = buildAgentPermissionRoute(createToolCommand({
  action: 'get_active_window_info',
}));
assert.equal(activeWindowRoute.status, 'silent');
assert.equal(activeWindowRoute.maxRisk, 'read');

for (const input of [
  { action: 'focus_window', target: 'Chrome' },
  { action: 'close_app', target: 'Notepad' },
  { action: 'open_url', target: 'https://example.com' },
  { action: 'open_app', target: 'Chrome' },
  { action: 'search_web', query: 'desktop pet agent' },
]) {
  const route = buildAgentPermissionRoute(createToolCommand(input));
  assert.equal(route.status, 'needs-approval', `${input.action} should require approval`);
  assert.equal(route.maxRisk, 'launch', `${input.action} should be a launch-risk action`);
  assert.equal(route.requiresApproval, true, `${input.action} should pause before execution`);
}

const moveWindowRoute = buildAgentPermissionRoute(createToolCommand({
  action: 'move_window_to_display',
  target: 'Chrome',
  targetDisplay: 'secondary',
}));
assert.equal(moveWindowRoute.status, 'needs-approval');
assert.equal(moveWindowRoute.maxRisk, 'reversible-write');
assert.equal(moveWindowRoute.requiresApproval, true);
assert.equal(moveWindowRoute.plan?.steps.some((step) => step.action.kind === 'move-window-to-display'), true);

const controlWindowRoute = buildAgentPermissionRoute(createToolCommand({
  action: 'control_window',
  snap: 'left',
  target: 'Chrome',
}));
assert.equal(controlWindowRoute.status, 'needs-approval');
assert.equal(controlWindowRoute.maxRisk, 'reversible-write');
assert.equal(controlWindowRoute.requiresApproval, true);
assert.equal(controlWindowRoute.plan?.steps.some((step) => step.action.kind === 'control-window'), true);

const invokeWindowUiRoute = buildAgentPermissionRoute(createToolCommand({
  action: 'interact_window_ui',
  automationId: 'launch-button',
  hwnd: 12345,
  targetText: 'Start',
  uiAction: 'invoke',
}));
assert.equal(invokeWindowUiRoute.status, 'needs-approval');
assert.equal(invokeWindowUiRoute.maxRisk, 'reversible-write');
assert.equal(invokeWindowUiRoute.requiresApproval, true);
assert.equal(invokeWindowUiRoute.plan?.steps.some((step) => step.action.kind === 'invoke-window-ui'), true);

const setWindowUiValueRoute = buildAgentPermissionRoute(createToolCommand({
  action: 'interact_window_ui',
  automationId: 'search-box',
  hwnd: 12345,
  targetText: 'Search',
  uiAction: 'set_value',
  value: 'Example Game',
}));
assert.equal(setWindowUiValueRoute.status, 'needs-approval');
assert.equal(setWindowUiValueRoute.maxRisk, 'reversible-write');
assert.equal(setWindowUiValueRoute.requiresApproval, true);
assert.equal(setWindowUiValueRoute.plan?.steps.some((step) => step.action.kind === 'interact-window-ui'), true);

const compoundOpenControlRoute = buildAgentPermissionRoute(createToolCommand({
  action: 'open_or_focus_then_control_window',
  target: 'Chrome',
  windowState: 'maximized',
}));
assert.equal(compoundOpenControlRoute.status, 'needs-approval');
assert.equal(compoundOpenControlRoute.maxRisk, 'launch');
assert.equal(compoundOpenControlRoute.requiresApproval, true);
assert.equal(compoundOpenControlRoute.plan?.steps.some((step) => step.action.kind === 'open-or-focus-then-control-window'), true);

const compoundOpenMoveRoute = buildAgentPermissionRoute(createToolCommand({
  action: 'open_or_focus_then_move_window_to_display',
  target: 'https://www.bilibili.com',
  targetDisplay: 'secondary',
}));
assert.equal(compoundOpenMoveRoute.status, 'needs-approval');
assert.equal(compoundOpenMoveRoute.maxRisk, 'launch');
assert.equal(compoundOpenMoveRoute.requiresApproval, true);
assert.equal(compoundOpenMoveRoute.plan?.steps.some((step) => step.action.kind === 'open-or-focus-then-move-window-to-display'), true);

const {
  appLauncherSource,
  bridgeSource,
  browserToolsSource,
  desktopLaunchToolsSource,
  desktopToolsSource,
  ipcSource,
  orchestratorSource,
  preloadSource,
  registrySource,
  runtimeSource,
  sessionSource,
  shellRuntimeSource,
  windowToolsSource,
  windowWorkflowToolsSource,
} = readProjectSources({
  appLauncherSource: 'electron/appLauncherService.cjs',
  bridgeSource: 'src/desktopShellBridge.ts',
  browserToolsSource: 'src/agent/agentRuntimeBrowserTools.ts',
  desktopLaunchToolsSource: 'src/agent/agentRuntimeDesktopLaunchTools.ts',
  desktopToolsSource: 'src/agent/agentRuntimeDesktopTools.ts',
  ipcSource: 'electron/ipcHandlers.cjs',
  orchestratorSource: 'src/agent/agentOrchestrator.ts',
  preloadSource: 'electron/preload.cjs',
  registrySource: 'src/agent/agentToolRegistry.ts',
  runtimeSource: 'src/agent/agentRuntimeExecutor.ts',
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
  shellRuntimeSource: 'src/desktopShellRuntime.ts',
  windowToolsSource: 'src/agent/agentRuntimeWindowTools.ts',
  windowWorkflowToolsSource: 'src/agent/agentRuntimeWindowWorkflowTools.ts',
});

assert.match(registrySource, /name: 'execute_desktop_action'/u);
assert.match(registrySource, /control_window/u);
assert.doesNotMatch(registrySource, /open_or_focus_then_control_window/u);
assert.doesNotMatch(registrySource, /open_or_focus_then_move_window_to_display/u);
assert.match(registrySource, /execute_desktop_sequence/u);
assert.match(registrySource, /move_window_to_display/u);
assert.match(orchestratorSource, /buildExecuteDesktopActionPlan/u);
assert.match(orchestratorSource, /control-window/u);
assert.match(orchestratorSource, /open-or-focus-then-control-window/u);
assert.match(orchestratorSource, /open-or-focus-then-move-window-to-display/u);
assert.match(orchestratorSource, /move-window-to-display/u);
assert.match(runtimeSource, /from '.\/agentRuntimeDesktopTools'/u);
assert.match(runtimeSource, /from '.\/agentRuntimeDesktopLaunchTools'/u);
assert.match(runtimeSource, /from '.\/agentRuntimeWindowTools'/u);
assert.match(runtimeSource, /execute_desktop_action: \(\{ runtime, toolCall \}\) => executeDesktopAction/u);
assert.match(desktopToolsSource, /export async function executeDesktopAction/u);
assert.match(desktopToolsSource, /executeFocusWindow\(toolCall\)/u);
assert.match(desktopToolsSource, /focus_window needs a process name, app name, window title, PID, or hwnd target/u);
assert.match(windowToolsSource, /export async function executeControlWindow/u);
assert.match(windowWorkflowToolsSource, /export async function executeOpenOrFocusThenControlWindow/u);
assert.match(windowWorkflowToolsSource, /export async function executeOpenOrFocusThenMoveWindowToDisplay/u);
assert.match(windowToolsSource, /export async function executeMoveWindowToDisplay/u);
assert.match(windowToolsSource, /export async function executeFocusWindow\(input: string \| AgentToolCallCommand\)/u);
assert.match(windowToolsSource, /desktopPetShellRuntime\.focusWindow\(\{ hwnd, pid, query \}\)/u);
assert.match(desktopLaunchToolsSource, /createAgentRuntimeLaunchEvidenceLines/u);
assert.match(desktopLaunchToolsSource, /createAgentStructuredWindowEvidence/u);
assert.match(windowToolsSource, /structuredEvidence/u);
assert.match(windowToolsSource, /moveStructuredEvidence/u);
assert.match(windowToolsSource, /controlStructuredEvidence/u);
assert.match(windowToolsSource, /targetMatched/u);
assert.match(desktopLaunchToolsSource, /targetMatched/u);
assert.match(desktopLaunchToolsSource, /finalUrl/u);
assert.match(windowToolsSource, /finalWindow/u);
assert.match(desktopLaunchToolsSource, /finalWindow/u);
assert.match(windowToolsSource, /finalDisplay/u);
assert.match(windowToolsSource, /confidence/u);
assert.match(desktopLaunchToolsSource, /confidence/u);
assert.match(desktopLaunchToolsSource, /Open request accepted, but final visible state was not verified/u);
assert.match(desktopLaunchToolsSource, /Launch request sent, but no focusable window was verified/u);
assert.match(browserToolsSource, /browserReceiptStatus/u);
assert.match(browserToolsSource, /Browser control returned ok, but no page\/tab evidence was returned/u);
assert.match(desktopToolsSource, /case 'control_window'/u);
assert.match(desktopToolsSource, /case 'interact_window_ui'/u);
assert.match(desktopToolsSource, /case 'invoke_window_ui'/u);
assert.match(desktopToolsSource, /case 'open_or_focus_then_control_window'/u);
assert.match(desktopToolsSource, /case 'close_window'/u);
assert.match(desktopToolsSource, /executeOpenResource/u);
assert.match(sessionSource, /prefer execute_desktop_action/u);
assert.match(sessionSource, /control_window/u);
assert.doesNotMatch(sessionSource, /prefer execute_desktop_action action "open_or_focus_then_control_window"/u);
assert.doesNotMatch(sessionSource, /prefer execute_desktop_action action "open_or_focus_then_move_window_to_display"/u);
assert.match(sessionSource, /prefer execute_desktop_sequence/u);
assert.match(registrySource, /recoversWith: \['observe_windows_and_apps', 'execute_desktop_observation', 'execute_desktop_action', 'execute_desktop_input', 'control_browser'\]/u);
assert.match(appLauncherSource, /function controlWindow/u);
assert.match(appLauncherSource, /function invokeWindowUi/u);
assert.match(appLauncherSource, /function moveWindowToDisplay/u);
assert.match(appLauncherSource, /\$identityRequested = \$requestedHwnd -gt 0 -or \$requestedPid -gt 0/u);
assert.match(appLauncherSource, /-not \$hwndMatches -or -not \$pidMatches/u);
assert.match(appLauncherSource, /\$candidateQueries\.Count -gt 0 -and -not \$semanticMatches/u);
assert.match(appLauncherSource, /stripPowerShellCliXml/u);
assert.match(appLauncherSource, /function createTopLevelWindowEnumeratorPowerShell/u);
assert.match(appLauncherSource, /EnumWindows/u);
assert.match(appLauncherSource, /GetWindowTextLength/u);
assert.match(appLauncherSource, /GetWindowThreadProcessId/u);
assert.match(appLauncherSource, /DwmGetWindowAttribute/u);
assert.match(appLauncherSource, /Get-DesktopPetTopLevelWindows/u);
assert.match(appLauncherSource, /function focusExistingAppWindow[\s\S]*Get-DesktopPetTopLevelWindows/u);
assert.match(appLauncherSource, /function listRunningApps[\s\S]*Get-DesktopPetTopLevelWindows/u);
assert.match(appLauncherSource, /function closeWindow[\s\S]*Get-DesktopPetTopLevelWindows/u);
assert.match(appLauncherSource, /function getActiveWindowInfo[\s\S]*Get-DesktopPetTopLevelWindows/u);
assert.doesNotMatch(appLauncherSource, /DesktopPetActiveWindow/u);
assert.match(ipcSource, /desktop-pet:move-window-to-display/u);
assert.match(ipcSource, /desktop-pet:control-window/u);
assert.match(ipcSource, /desktop-pet:invoke-window-ui/u);
assert.match(preloadSource, /moveWindowToDisplay/u);
assert.match(preloadSource, /controlWindow/u);
assert.match(preloadSource, /invokeWindowUi/u);
assert.match(bridgeSource, /moveWindowToDisplay/u);
assert.match(bridgeSource, /controlWindow/u);
assert.match(bridgeSource, /invokeWindowUi/u);
assert.match(bridgeSource, /focusWindow: \(request: \{ hwnd\?: number;[\s\S]*pid\?: number/u);
assert.match(shellRuntimeSource, /moveWindowToDisplay/u);
assert.match(shellRuntimeSource, /controlWindow/u);
assert.match(shellRuntimeSource, /invokeWindowUi/u);

const settings = {} as PetConfig['settings'];

function createWindowInventoryContinuation(options: {
  hwnd: number;
  pid: number;
  processName: string;
  sourceText: string;
  title: string;
  userGoal: string;
}) {
  return {
    historyLines: ['A live structured window inventory is available.'],
    sourceText: options.sourceText,
    steps: [],
    timing: null,
    traceEvents: [],
    toolResults: [{
      command: {
        capabilityId: 'desktop-observation',
        instruction: options.userGoal,
        kind: 'tool-call' as const,
        sourceText: options.sourceText,
        toolCall: {
          goal: options.userGoal,
          input: { includeRunningApps: true },
          name: 'observe_windows_and_apps',
        },
      },
      result: {
        ok: true,
        responseText: `${options.processName} pid=${options.pid} hwnd=${options.hwnd} title="${options.title}"`,
        stateSummary: {
          structuredEvidence: {
            observationCapturedAt: Date.now(),
            status: 'success' as const,
            targetCandidates: [{
              confidence: 'high' as const,
              label: `${options.processName} - ${options.title}`,
              source: 'observe_windows_and_apps',
              window: {
                hwnd: options.hwnd,
                pid: options.pid,
                processName: options.processName,
                title: options.title,
              },
            }],
          },
        },
      },
    }],
    userGoal: options.userGoal,
  };
}

let observeModelCallCount = 0;
const observeResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async ({ systemInstruction, userInput }) => {
    observeModelCallCount += 1;
    assert.match(systemInstruction, /execute_desktop_action/u);
    assert.match(systemInstruction, /observe first/u);

    if (observeModelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'list_running_apps',
          target: 'browser',
        },
        reason: 'Need to observe existing browser windows before deciding whether to focus or launch.',
        tool: toolName,
        understanding: {
          neededCapability: 'desktop action observation',
          successCriteria: 'running browser windows are known',
          userNeed: 'open the browser intelligently',
        },
      });
    }

    assert.match(userInput, /redirected read-only desktop action/u);
    assert.match(userInput, /tool=execute_desktop_observation/u);
    assert.match(userInput, /Chrome pid=42/u);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'focus_window',
        hwnd: 4200,
        pid: 42,
        target: 'Chrome',
      },
      reason: 'Chrome is already running, so bring the existing browser window forward.',
      tool: toolName,
      message: 'Chrome is already open; next step should focus that existing window.',
      understanding: {
        completedGoals: ['running browser window was observed'],
        remainingGoals: ['bring the browser window forward'],
        successCriteria: 'the existing browser window is focused instead of launching a duplicate',
        userNeed: 'open the browser intelligently',
        verificationEvidence: ['Chrome pid=42 hwnd=4200 title="New Tab"'],
        verificationGaps: ['Need permission before focusing a desktop window.'],
        verificationStatus: 'partial',
      },
    });
  },
  settings,
  sourceText: '/agent open browser',
  toolExecutor: async (command) => {
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall?.input.action, 'list_running_apps');
    return {
      observations: ['Chrome pid=42 hwnd=4200 title="New Tab"'],
      ok: true,
      responseText: '1. chrome.exe pid=42 hwnd=4200 title="New Tab"',
      stateSummary: {
        structuredEvidence: {
          observationCapturedAt: Date.now(),
          status: 'success',
          targetCandidates: [{
            confidence: 'high',
            label: 'Chrome - New Tab',
            source: 'observe_windows_and_apps',
            window: {
              hwnd: 4200,
              pid: 42,
              processName: 'Chrome',
              title: 'New Tab',
            },
          }],
        },
      },
      verification: 'listed running apps',
    };
  },
  userGoal: 'open browser',
});

assert.equal(observeResult.status, 'needs-approval');
assert.equal(observeResult.toolResults.length, 1);
assert.equal(observeResult.toolResults[0]?.command.toolCall?.name, 'execute_desktop_observation');
assert.equal(observeResult.pendingApproval?.command.toolCall?.name, toolName);
assert.equal(observeResult.pendingApproval?.command.toolCall?.input.action, 'focus_window');

const approvalResult = await runAgentProductionSession({
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'close_app',
      hwnd: 4300,
      pid: 43,
      target: 'Notepad',
    },
    reason: 'User asked to close a matching app, which needs approval before changing window state.',
    tool: toolName,
    understanding: {
      neededCapability: 'desktop window close action',
      successCriteria: 'matching app receives a normal close request after approval',
      userNeed: 'close Notepad',
    },
  }),
  settings,
  sourceText: '/agent close Notepad',
  toolExecutor: async () => {
    throw new Error('execute_desktop_action close_app should pause for approval');
  },
  userGoal: 'close Notepad',
});

assert.equal(approvalResult.status, 'needs-approval');
assert.equal(approvalResult.pendingApproval?.command.toolCall?.name, toolName);
assert.equal(approvalResult.pendingApproval?.command.toolCall?.input.action, 'close_app');
assert.match(approvalResult.pendingApproval?.routeSummary ?? '', /Requires user approval/u);

const moveApprovalResult = await runAgentProductionSession({
  continuation: createWindowInventoryContinuation({
    hwnd: 4400,
    pid: 44,
    processName: 'Chrome',
    sourceText: '/agent move Chrome to secondary screen',
    title: 'New Tab',
    userGoal: 'move Chrome to secondary screen',
  }),
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'move_window_to_display',
      hwnd: 4400,
      pid: 44,
      target: 'Chrome',
      targetDisplay: 'secondary',
    },
    reason: 'User asked to move a matching window to another display; this changes window bounds and needs approval.',
    tool: toolName,
    understanding: {
      neededCapability: 'desktop window move action',
      successCriteria: 'matching window is moved to the requested display after approval',
      userNeed: 'move Chrome to the secondary display',
    },
  }),
  settings,
  sourceText: '/agent move Chrome to secondary screen',
  toolExecutor: async () => {
    throw new Error('execute_desktop_action move_window_to_display should pause for approval');
  },
  userGoal: 'move Chrome to secondary screen',
});

assert.equal(moveApprovalResult.status, 'needs-approval');
assert.equal(moveApprovalResult.pendingApproval?.command.toolCall?.name, toolName);
assert.equal(moveApprovalResult.pendingApproval?.command.toolCall?.input.action, 'move_window_to_display');
assert.equal(moveApprovalResult.pendingApproval?.plan.steps[0]?.action.risk, 'reversible-write');

const controlWindowApprovalResult = await runAgentProductionSession({
  continuation: createWindowInventoryContinuation({
    hwnd: 4500,
    pid: 45,
    processName: 'Chrome',
    sourceText: '/agent snap Chrome to the left',
    title: 'New Tab',
    userGoal: 'snap Chrome to the left',
  }),
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'control_window',
      hwnd: 4500,
      pid: 45,
      snap: 'left',
      target: 'Chrome',
    },
    reason: 'User asked to snap a matching window, which changes window bounds and needs approval.',
    tool: toolName,
    understanding: {
      neededCapability: 'desktop window control action',
      successCriteria: 'matching window is snapped after approval',
      userNeed: 'snap Chrome to the left side',
    },
  }),
  settings,
  sourceText: '/agent snap Chrome to the left',
  toolExecutor: async () => {
    throw new Error('execute_desktop_action control_window should pause for approval');
  },
  userGoal: 'snap Chrome to the left',
});

assert.equal(controlWindowApprovalResult.status, 'needs-approval');
assert.equal(controlWindowApprovalResult.pendingApproval?.command.toolCall?.name, toolName);
assert.equal(controlWindowApprovalResult.pendingApproval?.command.toolCall?.input.action, 'control_window');
assert.equal(controlWindowApprovalResult.pendingApproval?.plan.steps[0]?.action.kind, 'control-window');
assert.equal(controlWindowApprovalResult.pendingApproval?.plan.steps[0]?.action.risk, 'reversible-write');

const openControlSequenceStepsJson = JSON.stringify([
  {
    args: {
      action: 'launch_local_app',
      target: 'Chrome',
    },
    reason: 'Open or focus Chrome first.',
    tool: 'execute_desktop_action',
  },
  {
    args: {
      action: 'control_window',
      fallbackToActiveWindow: true,
      target: 'Chrome',
      windowState: 'maximized',
    },
    reason: 'Maximize the resulting Chrome window.',
    tool: 'execute_desktop_action',
  },
]);
let compoundOpenControlModelCallCount = 0;
const compoundOpenControlApproval = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async ({ userInput }) => {
    compoundOpenControlModelCallCount += 1;
    if (compoundOpenControlModelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'open_or_focus_then_control_window',
          target: 'Chrome',
          windowState: 'maximized',
        },
        reason: 'Old compatibility compound action attempt.',
        tool: toolName,
        understanding: {
          neededCapability: 'compound desktop window control action',
          successCriteria: 'Chrome is opened or focused and the resulting window is maximized after one approval',
          userNeed: 'open Chrome and maximize it',
        },
      });
    }

    assert.match(userInput, /rejected transitional desktop action/u);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        stepsJson: openControlSequenceStepsJson,
      },
      reason: 'Re-plan the compatibility compound action as generic desktop sequence primitives.',
      tool: 'execute_desktop_sequence',
      understanding: {
        neededCapability: 'desktop primitive sequence',
        successCriteria: 'Chrome is opened or focused and the resulting window is maximized after one approval',
        userNeed: 'open Chrome and maximize it',
      },
    });
  },
  settings,
  sourceText: '/agent open Chrome and maximize it',
  toolExecutor: async () => {
    throw new Error('replanned execute_desktop_sequence should pause for one approval');
  },
  userGoal: 'open Chrome and maximize it',
});

assert.equal(compoundOpenControlModelCallCount, 2);
assert.equal(compoundOpenControlApproval.status, 'needs-approval');
assert.equal(compoundOpenControlApproval.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.equal(compoundOpenControlApproval.pendingApproval?.command.toolCall?.input.stepsJson, openControlSequenceStepsJson);
assert.equal(compoundOpenControlApproval.pendingApproval?.plan.steps.length, 1);
assert.equal(compoundOpenControlApproval.pendingApproval?.plan.steps[0]?.action.kind, 'execute-desktop-sequence');

const openMoveSequenceStepsJson = JSON.stringify([
  {
    args: {
      action: 'open_resource',
      resourceType: 'url',
      target: 'https://www.bilibili.com',
    },
    reason: 'Open the requested website first.',
    tool: 'execute_desktop_action',
  },
  {
    args: {
      action: 'move_window_to_display',
      fallbackToActiveWindow: true,
      target: 'https://www.bilibili.com',
      targetDisplay: 'secondary',
    },
    reason: 'Move the resulting browser window to the requested display.',
    tool: 'execute_desktop_action',
  },
]);
let compoundDirectModelCallCount = 0;
const compoundDirectApproval = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async ({ userInput }) => {
    compoundDirectModelCallCount += 1;
    if (compoundDirectModelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'open_or_focus_then_move_window_to_display',
          resourceType: 'url',
          target: 'https://www.bilibili.com',
          targetDisplay: 'secondary',
        },
        reason: 'Old compatibility compound action attempt.',
        tool: toolName,
        understanding: {
          neededCapability: 'compound desktop action',
          successCriteria: 'website is opened/focused and the resulting window is moved to the secondary display after one approval',
          userNeed: 'open bilibili and move it to the secondary screen',
        },
      });
    }

    assert.match(userInput, /rejected transitional desktop action/u);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        stepsJson: openMoveSequenceStepsJson,
      },
      reason: 'Re-plan the compatibility compound action as generic desktop sequence primitives.',
      tool: 'execute_desktop_sequence',
      understanding: {
        neededCapability: 'desktop primitive sequence',
        successCriteria: 'website is opened/focused and the resulting window is moved to the secondary display after one approval',
        userNeed: 'open bilibili and move it to the secondary screen',
      },
    });
  },
  settings,
  sourceText: '/agent open bilibili and move it to the secondary screen',
  toolExecutor: async () => {
    throw new Error('replanned execute_desktop_sequence should pause for one approval');
  },
  userGoal: 'open bilibili and move it to the secondary screen',
});

assert.equal(compoundDirectModelCallCount, 2);
assert.equal(compoundDirectApproval.status, 'needs-approval');
assert.equal(compoundDirectApproval.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.equal(compoundDirectApproval.pendingApproval?.command.toolCall?.input.stepsJson, openMoveSequenceStepsJson);
assert.equal(compoundDirectApproval.pendingApproval?.plan.steps.length, 1);

const compoundOpenMoveStart = await runAgentProductionSession({
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'launch_local_app',
      target: 'Chrome',
    },
    reason: 'Need to make Chrome available before moving its window.',
    tool: toolName,
    understanding: {
      neededCapability: 'desktop app launch then window move',
      successCriteria: 'Chrome is open and then moved to the secondary display',
      userNeed: 'open Chrome and move it to the secondary screen',
    },
  }),
  settings,
  sourceText: '/agent open Chrome and move it to the secondary screen',
  toolExecutor: async () => {
    throw new Error('open-and-move sequence should pause for one approval before execution');
  },
  userGoal: 'open Chrome and move it to the secondary screen',
});

assert.equal(compoundOpenMoveStart.status, 'needs-approval');
assert.equal(compoundOpenMoveStart.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
const compoundOpenMoveSteps = JSON.parse(
  String(compoundOpenMoveStart.pendingApproval?.command.toolCall?.input.stepsJson ?? '[]'),
);
assert.equal(compoundOpenMoveSteps.length, 2);
assert.equal(compoundOpenMoveSteps[0]?.args?.action, 'launch_local_app');
assert.equal(compoundOpenMoveSteps[0]?.args?.target, 'Chrome');
assert.equal(compoundOpenMoveSteps[1]?.args?.action, 'move_window_to_display');
assert.equal(compoundOpenMoveSteps[1]?.args?.targetDisplay, 'secondary');
assert.equal(compoundOpenMoveStart.pendingApproval?.plan.steps.length, 1);

console.log('agent execute desktop action tool smoke ok');
