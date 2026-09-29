import assert from 'node:assert/strict';
import { executeDesktopSequence } from '../src/agent/agentRuntimeDesktopSequenceTools.ts';
import { desktopPetShellRuntime } from '../src/desktopShellRuntime.ts';

const originalOpenResource = desktopPetShellRuntime.openResource;
const originalMoveWindowToDisplay = desktopPetShellRuntime.moveWindowToDisplay;
const originalControlWindow = desktopPetShellRuntime.controlWindow;
let moveAttempts = 0;
let latestMoveRequest: Record<string, unknown> | null = null;
let latestControlRequest: Record<string, unknown> | null = null;

try {
  desktopPetShellRuntime.openResource = async () => ({
    action: 'opened',
    ok: true,
    resourceType: 'url',
    status: 'launched-unverified',
    url: 'https://www.bilibili.com',
  });
  desktopPetShellRuntime.moveWindowToDisplay = async (request) => {
    latestMoveRequest = request as Record<string, unknown>;
    moveAttempts += 1;
    if (moveAttempts < 3) {
      return { ok: false, reason: 'no-window-match' };
    }
    return {
      hwnd: 12345,
      ok: true,
      processName: 'chrome',
      targetDisplayId: 'secondary-display',
      targetDisplayLabel: 'Secondary',
      title: 'bilibili',
      verified: true,
    };
  };
  desktopPetShellRuntime.controlWindow = async (request) => {
    latestControlRequest = request as Record<string, unknown>;
    return {
      hwnd: 12345,
      ok: true,
      processName: 'chrome',
      title: 'bilibili',
      windowState: 'maximized',
    };
  };

  const result = await executeDesktopSequence({} as never, {
    goal: 'open bilibili and move it to the secondary display',
    input: {
      postVerify: false,
      stepsJson: JSON.stringify([
        {
          args: { action: 'open_resource', resourceType: 'url', target: 'https://www.bilibili.com' },
          tool: 'execute_desktop_action',
        },
        {
          args: { action: 'move_window_to_display', targetDisplay: 'secondary' },
          tool: 'execute_desktop_action',
        },
      ]),
    },
    name: 'execute_desktop_sequence',
  });

  assert.equal(result.ok, true);
  assert.equal(moveAttempts, 3);
  assert.equal(latestMoveRequest?.query, 'https://www.bilibili.com');
  assert.equal(latestMoveRequest?.fallbackToActiveWindow, true);
  assert.deepEqual(latestMoveRequest?.queryCandidates, [
    'https://www.bilibili.com',
    'browser',
    'web browser',
  ]);
  assert.match(result.observations?.join('\n') ?? '', /windowReadyRetries=2/u);
  assert.match(result.responseText, /2\/2/u);

  moveAttempts = 2;
  latestMoveRequest = null;
  const explicitPageTargetResult = await executeDesktopSequence({} as never, {
    goal: 'open bilibili and move it to the secondary display',
    input: {
      postVerify: false,
      stepsJson: JSON.stringify([
        {
          args: { action: 'open_resource', resourceType: 'url', target: 'https://www.bilibili.com' },
          tool: 'execute_desktop_action',
        },
        {
          args: { action: 'move_window_to_display', target: 'bilibili', targetDisplay: 'secondary' },
          tool: 'execute_desktop_action',
        },
      ]),
    },
    name: 'execute_desktop_sequence',
  });

  assert.equal(explicitPageTargetResult.ok, true);
  assert.equal(latestMoveRequest?.query, 'bilibili');
  assert.deepEqual(latestMoveRequest?.queryCandidates, [
    'bilibili',
    'https://www.bilibili.com',
    'browser',
    'web browser',
  ]);

  moveAttempts = 2;
  latestControlRequest = null;
  const maximizeAfterMoveResult = await executeDesktopSequence({} as never, {
    goal: 'open bilibili, move it, then maximize the browser window',
    input: {
      postVerify: false,
      stepsJson: JSON.stringify([
        {
          args: { action: 'open_resource', resourceType: 'url', target: 'https://www.bilibili.com' },
          tool: 'execute_desktop_action',
        },
        {
          args: { action: 'move_window_to_display', target: 'bilibili', targetDisplay: 'secondary' },
          tool: 'execute_desktop_action',
        },
        {
          args: { action: 'control_window', windowState: 'maximized' },
          tool: 'execute_desktop_action',
        },
      ]),
    },
    name: 'execute_desktop_sequence',
  });

  assert.equal(maximizeAfterMoveResult.ok, true);
  assert.equal(latestControlRequest?.hwnd, 12345);
  assert.equal(latestControlRequest?.state, 'maximized');
} finally {
  desktopPetShellRuntime.openResource = originalOpenResource;
  desktopPetShellRuntime.moveWindowToDisplay = originalMoveWindowToDisplay;
  desktopPetShellRuntime.controlWindow = originalControlWindow;
}

console.log('agent sequence window ready move retry smoke ok');
