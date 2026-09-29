import assert from 'node:assert/strict';
import { desktopPetShellRuntime } from '../src/desktopShellRuntime.ts';
import { executeDesktopAction } from '../src/agent/agentRuntimeDesktopTools.ts';

const originalInvokeWindowUi = desktopPetShellRuntime.invokeWindowUi;
let callCount = 0;
const observedUiActions: string[] = [];

try {
  desktopPetShellRuntime.invokeWindowUi = async (request?: unknown) => {
    callCount += 1;
    const input = request as Record<string, unknown>;
    observedUiActions.push(String(input.uiAction ?? ''));
    assert.equal(input.automationId, 'launch-button');
    assert.equal(input.targetText, 'Start');
    assert.equal(input.controlType, 'Button');
    assert.equal(input.hwnd, 12345);

    return {
      candidates: [
        {
          actions: ['invoke'],
          automationId: 'launch-button',
          controlType: 'Button',
          matchScore: 138,
          name: 'Start',
        },
      ],
      control: {
        actions: ['invoke'],
        automationId: 'launch-button',
        controlType: 'Button',
        matchScore: 138,
        name: 'Start',
      },
      invoked: true,
      method: input.uiAction === 'select' ? 'uia-selection-item-pattern' : 'uia-invoke-pattern',
      ok: true,
      query: 'Launcher',
      resolvedAction: input.uiAction === 'select' ? 'select' : 'invoke',
      targetText: 'Start',
      uiAction: input.uiAction,
      window: {
        hwnd: 12345,
        processName: 'Launcher.exe',
        title: 'Launcher',
      },
    };
  };

  const result = await executeDesktopAction(
    {} as never,
    {
      goal: 'invoke Start in Launcher',
      input: {
        action: 'invoke_window_ui',
        automationId: 'launch-button',
        controlType: 'Button',
        hwnd: 12345,
        query: 'Launcher',
        targetText: 'Start',
      },
      name: 'execute_desktop_action',
    },
  );

  assert.equal(callCount, 1);
  assert.equal(result.ok, true);
  assert.equal(result.receipt?.status, 'success');
  assert.match(result.observations?.join('\n') ?? '', /uia-invoke-pattern/u);
  assert.match(result.responseText, /Applied UI Automation action/u);

  const selectResult = await executeDesktopAction(
    {} as never,
    {
      goal: 'select Start in Launcher',
      input: {
        action: 'select_window_ui',
        automationId: 'launch-button',
        controlType: 'Button',
        hwnd: 12345,
        targetText: 'Start',
      },
      name: 'execute_desktop_action',
    },
  );

  assert.equal(callCount, 2);
  assert.equal(selectResult.ok, true);
  assert.match(selectResult.observations?.join('\n') ?? '', /Resolved UI action: select/u);

  const missingValueResult = await executeDesktopAction(
    {} as never,
    {
      goal: 'fill Search in Launcher without a value',
      input: {
        action: 'interact_window_ui',
        automationId: 'search-box',
        controlType: 'Edit',
        hwnd: 12345,
        query: 'Launcher',
        targetText: 'Search',
        uiAction: 'set_value',
      },
      name: 'execute_desktop_action',
    },
  );

  assert.equal(callCount, 2);
  assert.equal(missingValueResult.ok, false);
  assert.equal(missingValueResult.receipt?.status, 'blocked');
  assert.equal(missingValueResult.stateSummary?.structuredEvidence?.status, 'needs-user');
  assert.equal(missingValueResult.stateSummary?.structuredEvidence?.postActionRecovery?.strategy, 'ask-user');
  assert.match(missingValueResult.responseText, /needs a non-empty value/u);

  desktopPetShellRuntime.invokeWindowUi = async (request?: unknown) => {
    callCount += 1;
    const input = request as Record<string, unknown>;
    observedUiActions.push(String(input.uiAction ?? ''));
    assert.equal(input.automationId, 'settings-item');
    assert.equal(input.targetText, 'Advanced settings');
    assert.equal(input.controlType, 'ListItem');
    assert.equal(input.uiAction, 'scroll_into_view');

    return {
      candidates: [
        {
          actions: ['scroll-into-view'],
          automationId: 'settings-item',
          controlType: 'ListItem',
          matchScore: 138,
          name: 'Advanced settings',
          offscreen: false,
        },
      ],
      control: {
        actions: ['scroll-into-view'],
        automationId: 'settings-item',
        controlType: 'ListItem',
        matchScore: 138,
        name: 'Advanced settings',
        offscreen: false,
      },
      invoked: true,
      method: 'uia-scroll-item-pattern.scroll-into-view',
      ok: true,
      query: 'Settings',
      resolvedAction: 'scroll_into_view',
      targetText: 'Advanced settings',
      uiAction: input.uiAction,
      window: {
        hwnd: 9876,
        processName: 'Settings.exe',
        title: 'Settings',
      },
    };
  };

  const scrollResult = await executeDesktopAction(
    {} as never,
    {
      goal: 'scroll Advanced settings into view',
      input: {
        action: 'interact_window_ui',
        automationId: 'settings-item',
        controlType: 'ListItem',
        hwnd: 9876,
        query: 'Settings',
        targetText: 'Advanced settings',
        uiAction: 'scroll_into_view',
      },
      name: 'execute_desktop_action',
    },
  );

  assert.equal(callCount, 3);
  assert.equal(scrollResult.ok, true);
  assert.match(scrollResult.observations?.join('\n') ?? '', /scroll-into-view/u);
  assert.match(scrollResult.responseText, /scroll_into_view/u);

  desktopPetShellRuntime.invokeWindowUi = async (request?: unknown) => {
    callCount += 1;
    const input = request as Record<string, unknown>;
    observedUiActions.push(String(input.uiAction ?? ''));
    assert.equal(input.automationId, 'game-search-box');
    assert.equal(input.targetText, 'Search games');
    assert.equal(input.controlType, 'Edit');
    assert.equal(input.uiAction, 'focus');

    return {
      candidates: [
        {
          actions: ['focus'],
          automationId: 'game-search-box',
          controlType: 'Edit',
          keyboardFocusable: true,
          matchScore: 138,
          name: 'Search games',
        },
      ],
      control: {
        actions: ['focus'],
        automationId: 'game-search-box',
        controlType: 'Edit',
        hasKeyboardFocus: true,
        keyboardFocusable: true,
        matchScore: 138,
        name: 'Search games',
      },
      invoked: true,
      method: 'uia-automation-element.set-focus',
      ok: true,
      query: 'Launcher',
      resolvedAction: 'focus',
      targetText: 'Search games',
      uiAction: input.uiAction,
      window: {
        hwnd: 4321,
        processName: 'Launcher.exe',
        title: 'Launcher',
      },
    };
  };

  const focusResult = await executeDesktopAction(
    {} as never,
    {
      goal: 'focus Search games in Launcher',
      input: {
        action: 'interact_window_ui',
        automationId: 'game-search-box',
        controlType: 'Edit',
        hwnd: 4321,
        query: 'Launcher',
        targetText: 'Search games',
        uiAction: 'focus',
      },
      name: 'execute_desktop_action',
    },
  );

  assert.equal(callCount, 4);
  assert.equal(focusResult.ok, true);
  assert.match(focusResult.observations?.join('\n') ?? '', /uia-automation-element\.set-focus/u);
  assert.match(focusResult.responseText, /focus/u);

  desktopPetShellRuntime.invokeWindowUi = async (request?: unknown) => {
    callCount += 1;
    const input = request as Record<string, unknown>;
    observedUiActions.push(String(input.uiAction ?? ''));
    assert.equal(input.automationId, 'example-game-item');
    assert.equal(input.targetText, 'Example Game');
    assert.equal(input.controlType, 'ListItem');
    assert.equal(input.uiAction, 'select');

    return {
      candidates: [
        {
          actions: ['select'],
          automationId: 'example-game-item',
          controlType: 'ListItem',
          matchScore: 140,
          name: 'Example Game',
          selected: false,
          selectionItem: true,
        },
      ],
      control: {
        actions: ['select'],
        automationId: 'example-game-item',
        controlType: 'ListItem',
        matchScore: 140,
        name: 'Example Game',
        selected: false,
        selectionItem: true,
      },
      invoked: true,
      method: 'uia-selection-item-pattern',
      ok: true,
      query: 'Launcher',
      resolvedAction: 'select',
      targetText: 'Example Game',
      uiAction: input.uiAction,
      window: {
        hwnd: 2468,
        processName: 'Launcher.exe',
        title: 'Launcher',
      },
    };
  };

  const unverifiedSelectResult = await executeDesktopAction(
    {} as never,
    {
      goal: 'select Example Game in Launcher',
      input: {
        action: 'interact_window_ui',
        automationId: 'example-game-item',
        controlType: 'ListItem',
        hwnd: 2468,
        query: 'Launcher',
        targetText: 'Example Game',
        uiAction: 'select',
      },
      name: 'execute_desktop_action',
    },
  );

  assert.equal(callCount, 5);
  assert.equal(unverifiedSelectResult.ok, true);
  assert.equal(unverifiedSelectResult.receipt?.status, 'unverified');
  assert.equal(unverifiedSelectResult.stateSummary?.structuredEvidence?.status, 'unverified');
  assert.equal(unverifiedSelectResult.stateSummary?.structuredEvidence?.selectionVerificationStatus, 'visible-only');
  assert.match(unverifiedSelectResult.stateSummary?.missingEvidence?.join('\n') ?? '', /not confirmed as selected/u);
  assert.deepEqual(observedUiActions, ['invoke', 'select', 'scroll_into_view', 'focus', 'select']);
} finally {
  desktopPetShellRuntime.invokeWindowUi = originalInvokeWindowUi;
}

console.log('agent execute desktop action window ui interaction smoke ok');
