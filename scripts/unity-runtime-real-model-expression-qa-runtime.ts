import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import net, { type Socket } from 'node:net';
import path from 'node:path';
import {
  DEFAULT_HOST,
  createUnityExpressionQaCommands,
  type UnityBridgeEvent,
  type UnityExpressionQaOptions,
} from './unity-runtime-real-model-expression-qa-config';
import { writeUnityExpressionQaEvidence } from './unity-runtime-real-model-expression-qa-preflight';
import {
  captureUnityRuntimeScreenshot,
  type UnityScreenshotCropRequest,
} from './unity-runtime-real-model-expression-qa-screenshot';

type BridgeHandle = {
  close: () => void;
  send: (command: Record<string, unknown>) => void;
  waitConnected: () => Promise<void>;
};

function appendSocketChunkEvents(
  events: UnityBridgeEvent[],
  state: { buffer: string },
  chunk: string,
) {
  state.buffer += chunk;
  const lines = state.buffer.split(/\r?\n/u);
  state.buffer = lines.pop() ?? '';
  lines.map((line) => line.trim()).filter(Boolean).forEach((line) => {
    events.push(JSON.parse(line) as UnityBridgeEvent);
  });
}

async function startBridgeServer(port: number, events: UnityBridgeEvent[]): Promise<BridgeHandle> {
  let clientSocket: Socket | null = null;
  const state = { buffer: '' };
  let resolveConnected: (() => void) | null = null;
  const connected = new Promise<void>((resolve) => {
    resolveConnected = resolve;
  });
  const server = net.createServer((socket) => {
    clientSocket?.destroy();
    clientSocket = socket;
    socket.setEncoding('utf8');
    socket.setNoDelay(true);
    resolveConnected?.();
    socket.on('data', (chunk) => appendSocketChunkEvents(events, state, String(chunk)));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, DEFAULT_HOST, resolve);
  });
  return {
    close: () => {
      clientSocket?.destroy();
      server.close();
    },
    send: (command) => {
      assert.ok(clientSocket && !clientSocket.destroyed, 'Unity runtime is not connected');
      clientSocket.write(`${JSON.stringify(command)}\n`);
    },
    waitConnected: () => connected,
  };
}

function launchUnityRuntime(options: UnityExpressionQaOptions) {
  const args = [
    ...options.runtimeArgs,
    '--desktop-pet-bridge-port',
    String(options.port),
  ];
  assert.ok(
    existsSync(options.runtimeExe),
    `Unity runtime executable does not exist: ${options.runtimeExe}`,
  );
  return spawn(options.runtimeExe, args, {
    cwd: path.dirname(options.runtimeExe),
    detached: false,
    stdio: 'ignore',
    windowsHide: false,
  });
}

async function terminateRuntime(child: ChildProcess | null) {
  if (!child?.pid || child.exitCode != null || child.signalCode != null) {
    return;
  }

  if (process.platform !== 'win32') {
    child.kill('SIGKILL');
    return;
  }

  await new Promise<void>((resolve) => {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    killer.on('exit', () => resolve());
    killer.on('error', () => resolve());
  });
}

function waitForEvent(
  events: UnityBridgeEvent[],
  predicate: (event: UnityBridgeEvent) => boolean,
  timeoutMs: number,
) {
  return new Promise<UnityBridgeEvent>((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const event = events.find(predicate);
      if (event) {
        clearInterval(timer);
        resolve(event);
        return;
      }

      if (Date.now() - startedAt > timeoutMs) {
        clearInterval(timer);
        reject(new Error(`Timed out waiting for Unity event after ${timeoutMs}ms`));
      }
    }, 100);
  });
}

async function waitForUnityConnection(bridge: BridgeHandle, timeoutMs: number) {
  await Promise.race([
    bridge.waitConnected(),
    new Promise((_, reject) => setTimeout(() => (
      reject(new Error(`Unity runtime did not connect to bridge within ${timeoutMs}ms`))
    ), timeoutMs)),
  ]);
}

async function sendAndAssertExpressionQa(
  bridge: BridgeHandle,
  events: UnityBridgeEvent[],
  options: UnityExpressionQaOptions,
  commands: Array<Record<string, unknown>>,
) {
  bridge.send(commands[0]);
  await waitForEvent(events, (event) => event.type === 'ready' && event.petId === 'qa-main', options.timeoutMs);
  bridge.send(commands[1]);
  bridge.send(commands[2]);
  await waitForEvent(events, (event) => event.type === 'expression-state-changed' && event.expressionKey === options.expressionKey, options.timeoutMs);
  await waitForExpressionDiagnostic(events, options.expressionKey, 'vrm-expression', options.timeoutMs);
  bridge.send(commands[3]);
  await waitForEvent(events, (event) => event.type === 'expression-state-changed' && event.expressionKey === options.fallbackExpressionKey, options.timeoutMs);
  await waitForExpressionDiagnostic(events, options.fallbackExpressionKey, 'blendshape-fallback', options.timeoutMs);
  assert.ok(events.some((event) => event.type === 'visual-bounds'), 'Unity runtime should emit visual-bounds evidence');
  assert.equal(events.find((event) => event.type === 'error')?.errorMessage, undefined, 'Unity runtime should not emit errors');
  return commands;
}

function serializeQaRuntimeError(error: unknown) {
  return error instanceof Error
    ? { message: error.message, stack: error.stack }
    : { message: String(error) };
}

async function waitForExpressionDiagnostic(
  events: UnityBridgeEvent[],
  expressionKey: string,
  expressionSource: string,
  timeoutMs: number,
) {
  const diagnostic = await waitForEvent(events, (event) => (
    event.type === 'expression-application-diagnostic'
    && event.expressionKey === expressionKey
  ), timeoutMs);
  assert.equal(
    diagnostic.expressionSource,
    expressionSource,
    `Unity expression ${expressionKey} should apply through ${expressionSource}. Diagnostic: ${JSON.stringify(diagnostic)}`,
  );
  return diagnostic;
}

function toNumber(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function resolveLatestVisualBounds(events: UnityBridgeEvent[]) {
  return events.findLast((event) => (
    event.type === 'visual-bounds'
    && toNumber(event.left) > 0
    && toNumber(event.right) > 0
    && toNumber(event.top) > 0
    && toNumber(event.bottom) > 0
  )) ?? null;
}

function resolveScreenshotCrop(
  commands: Array<Record<string, unknown>>,
  events: UnityBridgeEvent[],
  options: UnityExpressionQaOptions,
): UnityScreenshotCropRequest | null {
  const layout = commands.find((command) => command.type === 'setLayout');
  const bounds = resolveLatestVisualBounds(events);
  if (!layout || !bounds) {
    return null;
  }

  return {
    centerCssX: toNumber(layout.viewportX) + toNumber(layout.viewportWidth) * 0.5,
    centerCssY: toNumber(layout.viewportY) + toNumber(layout.viewportHeight) * 0.5,
    cssScreenHeight: toNumber(layout.screenHeight, 1),
    cssScreenWidth: toNumber(layout.screenWidth, 1),
    extentBottom: toNumber(bounds.bottom),
    extentLeft: toNumber(bounds.left),
    extentRight: toNumber(bounds.right),
    extentTop: toNumber(bounds.top),
    paddingCss: 18,
    path: options.screenshotCropPath,
  };
}

async function captureScreenshotIfEnabled(
  child: ChildProcess | null,
  options: UnityExpressionQaOptions,
  commands: Array<Record<string, unknown>>,
  events: UnityBridgeEvent[],
) {
  if (!options.captureScreenshot) {
    return null;
  }

  assert.ok(child?.pid, 'Unity runtime pid is required for screenshot capture');
  await new Promise((resolve) => setTimeout(resolve, 700));
  return captureUnityRuntimeScreenshot(
    child.pid,
    options.screenshotPath,
    options.timeoutMs,
    resolveScreenshotCrop(commands, events, options),
  );
}

export async function runUnityExpressionRealRuntimeQa(
  options: UnityExpressionQaOptions,
  modelPath: string,
) {
  const events: UnityBridgeEvent[] = [];
  const bridge = await startBridgeServer(options.port, events);
  let child: ChildProcess | null = null;
  const commands = createUnityExpressionQaCommands(options, modelPath);
  try {
    child = launchUnityRuntime(options);
    await waitForUnityConnection(bridge, options.timeoutMs);
    await sendAndAssertExpressionQa(bridge, events, options, commands);
    const screenshot = await captureScreenshotIfEnabled(child, options, commands, events);
    await writeUnityExpressionQaEvidence(options.evidencePath, {
      commands,
      events,
      modelPath,
      runtimeExe: options.runtimeExe,
      screenshot,
    });
    console.log(`unity runtime real-model expression QA ok: ${options.evidencePath}`);
  } catch (error) {
    await writeUnityExpressionQaEvidence(options.evidencePath, {
      commands,
      error: serializeQaRuntimeError(error),
      events,
      modelPath,
      runtimeExe: options.runtimeExe,
    });
    throw error;
  } finally {
    bridge.close();
    await terminateRuntime(child);
  }
}
