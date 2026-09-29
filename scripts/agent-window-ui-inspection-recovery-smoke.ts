import assert from 'node:assert/strict';
import { executeInspectWindowUi } from '../src/agent/agentRuntimeDesktopObservationTools.ts';
import { desktopPetShellRuntime } from '../src/desktopShellRuntime.ts';

function createInspectToolCall(targetText = 'Example Game') {
  return {
    goal: 'inspect launcher UI',
    input: {
      action: 'inspect_window_ui',
      query: 'Launcher',
      targetText,
    },
    name: 'execute_desktop_observation',
  };
}

const originalInspectWindowUi = desktopPetShellRuntime.inspectWindowUi;

try {
  desktopPetShellRuntime.inspectWindowUi = async () => ({
    controlCount: 3,
    controls: [
      {
        actions: ['invoke'],
        automationId: 'example-game-start',
        bounds: { height: 44, width: 160, x: 1200, y: 800 },
        controlType: 'Button',
        enabled: false,
        matchScore: 95,
        name: 'Example Game Start',
        offscreen: false,
      },
      {
        controlType: 'Text',
        enabled: true,
        matchScore: 0,
        name: 'Loading game resources 42%',
        offscreen: false,
      },
    ],
    matchedControls: [
      {
        actions: ['invoke'],
        automationId: 'example-game-start',
        bounds: { height: 44, width: 160, x: 1200, y: 800 },
        controlType: 'Button',
        enabled: false,
        matchScore: 95,
        name: 'Example Game Start',
        offscreen: false,
      },
    ],
    ok: true,
    query: 'Launcher',
    targetText: 'Example Game',
    window: {
      hwnd: 1001,
      processName: 'Launcher.exe',
      title: 'Launcher',
    },
  });

  const loadingResult = await executeInspectWindowUi(createInspectToolCall() as any);
  assert.equal(loadingResult.ok, true);
  assert.equal(loadingResult.stateSummary?.structuredEvidence?.postActionState, 'loading');
  assert.equal(loadingResult.stateSummary?.structuredEvidence?.postActionRecovery?.nextTool, 'execute_desktop_observation');
  assert.equal(loadingResult.stateSummary?.structuredEvidence?.postActionRecovery?.nextArgs?.action, 'wait_and_observe');
  assert.equal(loadingResult.stateSummary?.structuredEvidence?.visualActionReadiness, 'needs-primary-action');
  assert.match(loadingResult.stateSummary?.recommendedRecovery?.join('\n') ?? '', /wait_and_observe/u);

  desktopPetShellRuntime.inspectWindowUi = async () => ({
    controlCount: 3,
    controls: [
      {
        actions: ['invoke'],
        automationId: 'example-game-start',
        bounds: { height: 44, width: 160, x: 1200, y: 800 },
        controlType: 'Button',
        enabled: false,
        matchScore: 95,
        name: 'Example Game Start',
        offscreen: false,
      },
      {
        controlType: 'Text',
        enabled: true,
        matchScore: 0,
        name: 'Administrator permission confirmation required',
        offscreen: false,
      },
    ],
    matchedControls: [
      {
        actions: ['invoke'],
        automationId: 'example-game-start',
        bounds: { height: 44, width: 160, x: 1200, y: 800 },
        controlType: 'Button',
        enabled: false,
        matchScore: 95,
        name: 'Example Game Start',
        offscreen: false,
      },
    ],
    ok: true,
    query: 'Launcher',
    targetText: 'Example Game',
    window: {
      hwnd: 1001,
      processName: 'Launcher.exe',
      title: 'Launcher',
    },
  });

  const blockedResult = await executeInspectWindowUi(createInspectToolCall() as any);
  assert.equal(blockedResult.ok, true);
  assert.equal(blockedResult.stateSummary?.structuredEvidence?.postActionState, 'blocked');
  assert.equal(blockedResult.stateSummary?.structuredEvidence?.postActionRecovery?.nextTool, 'locate_screen_elements');
  assert.equal(blockedResult.stateSummary?.structuredEvidence?.postActionRecovery?.nextArgs?.action, 'describe_elements');
  assert.match(blockedResult.stateSummary?.recommendedRecovery?.join('\n') ?? '', /read-blocker/u);

  desktopPetShellRuntime.inspectWindowUi = async () => ({
    controlCount: 4,
    controls: [
      {
        actions: ['invoke'],
        automationId: 'example-game-start',
        bounds: { height: 44, width: 160, x: 1200, y: 800 },
        centerX: 1280,
        centerY: 822,
        controlType: 'Button',
        enabled: false,
        matchScore: 95,
        name: 'Example Game Start',
        offscreen: false,
      },
      {
        actions: ['invoke'],
        automationId: 'example-game-continue',
        bounds: { height: 44, width: 160, x: 1200, y: 850 },
        centerX: 1280,
        centerY: 872,
        controlType: 'Button',
        enabled: true,
        keyboardFocusable: true,
        matchScore: 48,
        name: 'Continue',
        offscreen: false,
      },
      {
        controlType: 'Text',
        enabled: true,
        matchScore: 0,
        name: 'Example Game is ready',
        offscreen: false,
      },
    ],
    matchedControls: [
      {
        actions: ['invoke'],
        automationId: 'example-game-start',
        bounds: { height: 44, width: 160, x: 1200, y: 800 },
        centerX: 1280,
        centerY: 822,
        controlType: 'Button',
        enabled: false,
        matchScore: 95,
        name: 'Example Game Start',
        offscreen: false,
      },
    ],
    ok: true,
    query: 'Launcher',
    targetText: 'Example Game',
    window: {
      hwnd: 1001,
      processName: 'Launcher.exe',
      title: 'Launcher',
    },
  });

  const alternateActionResult = await executeInspectWindowUi(createInspectToolCall() as any);
  assert.equal(alternateActionResult.ok, true);
  assert.equal(alternateActionResult.stateSummary?.structuredEvidence?.visualActionReadiness, 'ready');
  assert.equal(alternateActionResult.stateSummary?.structuredEvidence?.postActionState, null);
  assert.equal(alternateActionResult.stateSummary?.structuredEvidence?.postActionRecovery, null);
  assert.match(alternateActionResult.stateSummary?.structuredEvidence?.primaryAction ?? '', /Continue/u);
  assert.match(alternateActionResult.stateSummary?.structuredEvidence?.relation ?? '', /nearby enabled alternate/u);
  assert.deepEqual(alternateActionResult.stateSummary?.recommendedRecovery, []);

  desktopPetShellRuntime.inspectWindowUi = async () => ({
    controlCount: 1,
    controls: [
      {
        actions: ['invoke'],
        automationId: 'example-game-start',
        bounds: { height: 44, width: 160, x: 1200, y: 800 },
        centerX: 1280,
        centerY: 822,
        controlType: 'Button',
        enabled: true,
        matchScore: 98,
        name: 'Example Game Start',
        offscreen: false,
      },
    ],
    matchedControls: [
      {
        actions: ['invoke'],
        automationId: 'example-game-start',
        bounds: { height: 44, width: 160, x: 1200, y: 800 },
        centerX: 1280,
        centerY: 822,
        controlType: 'Button',
        enabled: true,
        matchScore: 98,
        name: 'Example Game Start',
        offscreen: false,
      },
    ],
    ok: true,
    query: 'Launcher',
    targetText: 'Example Game',
    window: {
      hwnd: 1001,
      processName: 'Launcher.exe',
      title: 'Launcher',
    },
  });

  const readyResult = await executeInspectWindowUi(createInspectToolCall() as any);
  assert.equal(readyResult.ok, true);
  assert.equal(readyResult.stateSummary?.structuredEvidence?.visualActionReadiness, 'ready');
  assert.equal(readyResult.stateSummary?.structuredEvidence?.postActionState, null);
  assert.equal(readyResult.stateSummary?.structuredEvidence?.postActionRecovery, null);
  assert.deepEqual(readyResult.stateSummary?.recommendedRecovery, []);
} finally {
  desktopPetShellRuntime.inspectWindowUi = originalInspectWindowUi;
}

console.log('agent window UI inspection recovery smoke ok');
