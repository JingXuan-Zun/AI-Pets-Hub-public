import net from 'node:net';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 19777;
const host = process.env.UNITY_BRIDGE_HOST || DEFAULT_HOST;
const port = Number.parseInt(process.env.UNITY_BRIDGE_PORT || '', 10) || DEFAULT_PORT;
const reconnectDelayMs = 1000;
let socket = null;
let buffer = '';
let reconnectTimer = null;
let perfTimer = null;
const petStateById = new Map();

function nowIso() {
  return new Date().toISOString();
}

function log(message, details = null) {
  if (details == null) {
    console.log(`[unity-diagnostic ${nowIso()}] ${message}`);
    return;
  }

  console.log(`[unity-diagnostic ${nowIso()}] ${message}`, details);
}

function getPetState(petId) {
  const normalizedPetId = typeof petId === 'string' && petId.trim()
    ? petId.trim()
    : 'main';
  const existingState = petStateById.get(normalizedPetId);
  if (existingState) {
    return existingState;
  }

  const nextState = {
    expressionKey: null,
    motionKey: null,
    petId: normalizedPetId,
    scale: 1,
    visible: true,
  };
  petStateById.set(normalizedPetId, nextState);
  return nextState;
}

function writeEvent(event) {
  if (!socket || socket.destroyed) {
    return;
  }

  socket.write(`${JSON.stringify({
    runtimeKind: 'unity',
    ...event,
  })}\n`);
}

function resolveBounds(scale = 1, visible = true) {
  if (!visible) {
    return {
      bottom: 0,
      left: 0,
      right: 0,
      top: 0,
    };
  }

  const normalizedScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return {
    bottom: Math.round(70 * normalizedScale),
    left: Math.round(95 * normalizedScale),
    right: Math.round(95 * normalizedScale),
    top: Math.round(150 * normalizedScale),
  };
}

function emitReadyAndBounds(petId) {
  const state = getPetState(petId);
  writeEvent({
    petId: state.petId,
    type: 'ready',
  });
  writeEvent({
    bounds: resolveBounds(state.scale, state.visible),
    petId: state.petId,
    source: 'measured',
    type: 'visual-bounds',
  });
}

function handleCommand(command) {
  if (!command || typeof command !== 'object') {
    return;
  }

  const state = getPetState(command.petId);
  log('command received', {
    petId: state.petId,
    type: command.type,
  });

  if (command.type === 'loadAvatar') {
    state.modelUrl = typeof command.modelUrl === 'string' ? command.modelUrl : '';
    emitReadyAndBounds(state.petId);
    return;
  }

  if (command.type === 'setLayout') {
    state.scale = Number.isFinite(Number(command.scale)) ? Number(command.scale) : state.scale;
    state.presentationMode = typeof command.presentationMode === 'string'
      ? command.presentationMode
      : state.presentationMode;
    writeEvent({
      bounds: resolveBounds(state.scale, state.visible),
      petId: state.petId,
      source: 'measured',
      type: 'visual-bounds',
    });
    return;
  }

  if (command.type === 'setVisibility') {
    state.visible = command.visible !== false;
    writeEvent({
      bounds: resolveBounds(state.scale, state.visible),
      petId: state.petId,
      source: 'measured',
      type: 'visual-bounds',
    });
    return;
  }

  if (command.type === 'setSemanticState') {
    const motionKey = typeof command.motionKey === 'string' && command.motionKey.trim()
      ? command.motionKey.trim()
      : null;
    const expressionKey = typeof command.expressionKey === 'string' && command.expressionKey.trim()
      ? command.expressionKey.trim()
      : null;

    if (motionKey !== state.motionKey) {
      state.motionKey = motionKey;
      writeEvent({
        motionKey,
        petId: state.petId,
        type: 'motion-state-changed',
      });
    }

    if (expressionKey !== state.expressionKey) {
      state.expressionKey = expressionKey;
      writeEvent({
        expressionKey,
        petId: state.petId,
        type: 'expression-state-changed',
      });
    }
  }
}

function handleLine(line) {
  try {
    handleCommand(JSON.parse(line));
  } catch (error) {
    log('failed to parse command', error instanceof Error ? error.message : String(error));
  }
}

function stopPerfTimer() {
  if (perfTimer) {
    clearInterval(perfTimer);
    perfTimer = null;
  }
}

function startPerfTimer() {
  stopPerfTimer();
  perfTimer = setInterval(() => {
    for (const state of petStateById.values()) {
      writeEvent({
        fps: 60,
        frameIntervalMs: 16.7,
        petId: state.petId,
        type: 'perf-stats',
      });
    }
  }, 2000);
}

function scheduleReconnect() {
  stopPerfTimer();
  if (reconnectTimer) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, reconnectDelayMs);
}

function connect() {
  log(`connecting to ${host}:${port}`);
  socket = net.createConnection({ host, port }, () => {
    buffer = '';
    log('connected');
    emitReadyAndBounds('main');
    startPerfTimer();
  });
  socket.setEncoding('utf8');
  socket.setNoDelay(true);

  socket.on('data', (chunk) => {
    buffer += typeof chunk === 'string' ? chunk : String(chunk);
    const lines = buffer.split(/\r?\n/u);
    buffer = lines.pop() ?? '';
    lines
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach(handleLine);
  });

  socket.on('error', (error) => {
    log('socket error', error instanceof Error ? error.message : String(error));
  });

  socket.on('close', () => {
    log('disconnected, reconnecting soon');
    scheduleReconnect();
  });
}

process.on('SIGINT', () => {
  log('stopping');
  stopPerfTimer();
  if (socket && !socket.destroyed) {
    socket.destroy();
  }
  process.exit(0);
});

connect();
