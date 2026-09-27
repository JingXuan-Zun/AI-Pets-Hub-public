import assert from 'node:assert/strict';
import { executeDesktopInput } from '../src/agent/agentRuntimeDesktopTools.ts';
import { desktopPetShellRuntime } from '../src/desktopShellRuntime.ts';

type DesktopInputPayload = {
  action?: string;
  coordinateSpace?: string;
  keys?: string;
  x?: number;
  y?: number;
};

const originalExecuteDesktopInput = desktopPetShellRuntime.executeDesktopInput;
const originalListCaptureSources = desktopPetShellRuntime.listCaptureSources;
const capturedPayloads: DesktopInputPayload[] = [];
const captureOrder: string[] = [];

try {
  desktopPetShellRuntime.executeDesktopInput = async (payload?: unknown) => {
    const request = (payload ?? {}) as DesktopInputPayload;
    captureOrder.push('execute');
    capturedPayloads.push(request);

    return {
      action: request.action,
      button: 'left',
      keys: request.keys,
      ok: true,
      x: request.coordinateSpace === 'dip' ? 246 : request.x,
      y: request.coordinateSpace === 'dip' ? 912 : request.y,
    };
  };
  desktopPetShellRuntime.listCaptureSources = async () => {
    captureOrder.push('capture');
    return [];
  };

  await executeDesktopInput({
    goal: 'move with visual/native-screen coordinates',
    input: {
      action: 'move_mouse',
      x: 123,
      y: 456,
    },
    name: 'execute_desktop_input',
  });
  assert.equal(capturedPayloads.at(-1)?.coordinateSpace, 'native-screen');

  await executeDesktopInput({
    goal: 'move with explicit DIP coordinates',
    input: {
      action: 'move_mouse',
      coordinateSpace: 'dip',
      x: 12,
      y: 34,
    },
    name: 'execute_desktop_input',
  });
  assert.equal(capturedPayloads.at(-1)?.coordinateSpace, 'dip');

  await executeDesktopInput({
    goal: 'send keys without pointer coordinates',
    input: {
      action: 'send_keys',
      keys: 'Enter',
    },
    name: 'execute_desktop_input',
  });
  assert.equal(capturedPayloads.at(-1)?.coordinateSpace, undefined);

  captureOrder.length = 0;
  await executeDesktopInput({
    goal: 'click with visual/native-screen coordinates',
    input: {
      action: 'click',
      x: 123,
      y: 456,
    },
    name: 'execute_desktop_input',
  });
  assert.deepEqual(captureOrder, ['capture', 'execute', 'capture']);

  captureOrder.length = 0;
  await executeDesktopInput({
    goal: 'click with explicit DIP coordinates',
    input: {
      action: 'click',
      coordinateSpace: 'dip',
      x: 12,
      y: 34,
    },
    name: 'execute_desktop_input',
  });
  assert.deepEqual(captureOrder, ['execute', 'capture']);
} finally {
  desktopPetShellRuntime.executeDesktopInput = originalExecuteDesktopInput;
  desktopPetShellRuntime.listCaptureSources = originalListCaptureSources;
}

console.log('agent desktop input coordinate-space smoke ok');
