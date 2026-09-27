const net = require('net');

const DEFAULT_BRIDGE_HOST = '127.0.0.1';
const DEFAULT_BRIDGE_PORT = 19777;
const pointerDiagnosticsEnabled = process.env.DESKTOP_PET_POINTER_DIAGNOSTICS === '1';

function normalizePort(value, fallbackPort = DEFAULT_BRIDGE_PORT) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : fallbackPort;
}

function createInitialStatus({ host, port }) {
  return {
    clientAddress: null,
    clientPort: null,
    connected: false,
    host,
    lastCommandAt: null,
    lastConnectedAt: null,
    lastDisconnectAt: null,
    lastError: null,
    listening: false,
    port,
  };
}

function summarizeUnityCommandForDiagnostics(command, transport) {
  if (!command || typeof command !== 'object') {
    return {
      ...transport,
      type: 'unknown',
    };
  }

  const summary = {
    ...transport,
    petId: command.petId ?? 'main',
    type: command.type ?? 'unknown',
  };

  if (command.type === 'setLayout') {
    return {
      ...summary,
      screenHeight: command.screenHeight,
      screenWidth: command.screenWidth,
      viewportHeight: command.viewportHeight,
      viewportWidth: command.viewportWidth,
      viewportX: command.viewportX,
      viewportY: command.viewportY,
    };
  }

  if (command.type === 'setVisibility') {
    return {
      ...summary,
      visible: command.visible,
    };
  }

  return summary;
}

function createUnityBridgeService({
  host = DEFAULT_BRIDGE_HOST,
  port = DEFAULT_BRIDGE_PORT,
  log,
  rendererWindowsProvider,
} = {}) {
  const normalizedHost = typeof host === 'string' && host.trim()
    ? host.trim()
    : DEFAULT_BRIDGE_HOST;
  const normalizedPort = normalizePort(port);
  let status = createInitialStatus({
    host: normalizedHost,
    port: normalizedPort,
  });
  let server = null;
  let activeSocket = null;
  let activeSocketBuffer = '';
  const commandStateByPetId = new Map();

  function getRendererWindows() {
    return typeof rendererWindowsProvider === 'function'
      ? rendererWindowsProvider().filter((win) => win && !win.isDestroyed?.())
      : [];
  }

  function emitToRenderer(channel, payload) {
    getRendererWindows().forEach((win) => {
      try {
        win.webContents.send(channel, payload);
      } catch (error) {
        log?.('failed to emit unity bridge payload', {
          channel,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  function updateStatus(nextPartial) {
    status = {
      ...status,
      ...nextPartial,
    };
    emitToRenderer('desktop-pet:unity-bridge-status', status);
    return status;
  }

  function rememberCommand(command) {
    if (!command || typeof command !== 'object') {
      return;
    }

    const petId = typeof command.petId === 'string' && command.petId.trim()
      ? command.petId.trim()
      : 'main';
    const bucket = commandStateByPetId.get(petId) ?? {};
    bucket[command.type] = command;
    commandStateByPetId.set(petId, bucket);
  }

  function writeLineToSocket(line) {
    if (!activeSocket || activeSocket.destroyed) {
      return false;
    }

    try {
      activeSocket.write(`${line}\n`);
      return true;
    } catch (error) {
      log?.('failed to write unity bridge command', error?.stack || error);
      updateStatus({
        lastError: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  function sendCommand(command) {
    if (!command || typeof command !== 'object') {
      return {
        connected: Boolean(activeSocket && !activeSocket.destroyed),
        ok: false,
        queued: false,
      };
    }

    const normalizedCommand = {
      ...command,
      petId: typeof command.petId === 'string' && command.petId.trim()
        ? command.petId.trim()
        : 'main',
      runtimeKind: 'unity',
      type: typeof command.type === 'string' ? command.type : '',
    };

    rememberCommand(normalizedCommand);
    updateStatus({
      lastCommandAt: Date.now(),
    });

    const serialized = JSON.stringify(normalizedCommand);
    const delivered = writeLineToSocket(serialized);
    if (delivered) {
      log?.('unity bridge command sent', {
        petId: normalizedCommand.petId,
        type: normalizedCommand.type,
      });
    }
    if (
      pointerDiagnosticsEnabled
      && (normalizedCommand.type === 'setLayout' || normalizedCommand.type === 'setVisibility')
    ) {
      log?.(
        'unity bridge command diagnostic',
        summarizeUnityCommandForDiagnostics(normalizedCommand, {
          connected: Boolean(activeSocket && !activeSocket.destroyed),
          queued: !delivered,
        }),
      );
    }

    return {
      connected: Boolean(activeSocket && !activeSocket.destroyed),
      ok: true,
      queued: !delivered,
    };
  }

  function replayCommandState() {
    for (const [, bucket] of commandStateByPetId.entries()) {
      const orderedCommands = [
        bucket.loadAvatar,
        bucket.setLayout,
        bucket.setSemanticState,
        bucket.setVisibility,
      ].filter(Boolean);

      orderedCommands.forEach((command) => {
        const serialized = JSON.stringify(command);
        writeLineToSocket(serialized);
      });
    }
  }

  function handleBridgeEvent(rawLine) {
    if (typeof rawLine !== 'string' || !rawLine.trim()) {
      return;
    }

    try {
      const parsed = JSON.parse(rawLine);
      emitToRenderer('desktop-pet:unity-bridge-event', parsed);
      if (parsed?.type === 'error') {
        updateStatus({
          lastError: typeof parsed.errorMessage === 'string' ? parsed.errorMessage : null,
        });
      }
      log?.('unity bridge event received', {
        petId: parsed?.petId ?? 'main',
        type: parsed?.type ?? 'unknown',
      });
    } catch (error) {
      log?.('failed to parse unity bridge event', {
        error: error instanceof Error ? error.message : String(error),
        rawLine,
      });
      updateStatus({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function detachSocket(nextSocket) {
    if (!nextSocket) {
      return;
    }

    if (activeSocket === nextSocket) {
      activeSocket = null;
      activeSocketBuffer = '';
    }

    updateStatus({
      clientAddress: null,
      clientPort: null,
      connected: false,
      lastDisconnectAt: Date.now(),
    });
  }

  function attachSocket(nextSocket) {
    if (activeSocket && activeSocket !== nextSocket && !activeSocket.destroyed) {
      activeSocket.destroy();
    }

    activeSocket = nextSocket;
    activeSocketBuffer = '';
    nextSocket.setEncoding('utf8');
    nextSocket.setNoDelay(true);

    updateStatus({
      clientAddress: nextSocket.remoteAddress ?? null,
      clientPort: nextSocket.remotePort ?? null,
      connected: true,
      lastConnectedAt: Date.now(),
      lastError: null,
    });
    log?.('unity bridge client connected', {
      remoteAddress: nextSocket.remoteAddress ?? null,
      remotePort: nextSocket.remotePort ?? null,
    });
    replayCommandState();

    nextSocket.on('data', (chunk) => {
      activeSocketBuffer += typeof chunk === 'string' ? chunk : String(chunk);
      const lines = activeSocketBuffer.split(/\r?\n/u);
      activeSocketBuffer = lines.pop() ?? '';
      lines
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach(handleBridgeEvent);
    });

    nextSocket.on('error', (error) => {
      log?.('unity bridge socket error', error?.stack || error);
      updateStatus({
        lastError: error instanceof Error ? error.message : String(error),
      });
    });

    nextSocket.on('close', () => {
      log?.('unity bridge client disconnected');
      detachSocket(nextSocket);
    });
  }

  function start() {
    if (server) {
      return;
    }

    server = net.createServer((socket) => {
      attachSocket(socket);
    });

    server.on('error', (error) => {
      log?.('unity bridge server error', error?.stack || error);
      updateStatus({
        lastError: error instanceof Error ? error.message : String(error),
      });
    });

    server.listen(normalizedPort, normalizedHost, () => {
      log?.('unity bridge server listening', {
        host: normalizedHost,
        port: normalizedPort,
      });
      updateStatus({
        listening: true,
        port: normalizedPort,
      });
    });
  }

  function stop() {
    if (activeSocket && !activeSocket.destroyed) {
      activeSocket.destroy();
    }

    activeSocket = null;
    activeSocketBuffer = '';

    if (server) {
      try {
        server.close();
      } catch {
        // Ignore close failures during app shutdown.
      }
      server = null;
    }

    updateStatus({
      clientAddress: null,
      clientPort: null,
      connected: false,
      listening: false,
    });
  }

  return {
    getStatus: () => ({ ...status }),
    sendCommand,
    start,
    stop,
  };
}

module.exports = {
  DEFAULT_BRIDGE_HOST,
  DEFAULT_BRIDGE_PORT,
  createUnityBridgeService,
};
