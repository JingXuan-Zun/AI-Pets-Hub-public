function cleanupPending(pending, error) {
  pending.forEach(({ reject: rejectPending }) => rejectPending(error));
  pending.clear();
}

function createMessageReceiver(pending) {
  return (event) => {
    let payload = null;
    try {
      payload = JSON.parse(String(event.data || ''));
    } catch {
      return;
    }

    if (!payload || typeof payload.id !== 'number' || !pending.has(payload.id)) {
      return;
    }

    const next = pending.get(payload.id);
    pending.delete(payload.id);
    if (payload.error) {
      next.reject(new Error(payload.error.message || 'DevTools command failed'));
      return;
    }

    next.resolve(payload.result);
  };
}

function createCommandSender(ws, WebSocketCtor, pending, sequence) {
  return function send(method, params = {}) {
    if (ws.readyState !== WebSocketCtor.OPEN) {
      return Promise.reject(new Error('DevTools websocket is not open'));
    }

    sequence.messageId += 1;
    const id = sequence.messageId;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolveCommand, rejectCommand) => {
      pending.set(id, {
        reject: rejectCommand,
        resolve: resolveCommand,
      });
      ws.send(payload);
    });
  };
}

function createDevToolsClient(webSocketDebuggerUrl) {
  return new Promise((resolve, reject) => {
    const WebSocketCtor = global.WebSocket;

    if (typeof WebSocketCtor !== 'function') {
      reject(new Error('This Electron runtime does not expose WebSocket in the main process.'));
      return;
    }

    const ws = new WebSocketCtor(webSocketDebuggerUrl);
    const pending = new Map();
    const sequence = { messageId: 0 };

    ws.onmessage = createMessageReceiver(pending);
    ws.onerror = () => {
      cleanupPending(pending, new Error('DevTools websocket error'));
      reject(new Error('DevTools websocket error'));
    };
    ws.onclose = () => {
      cleanupPending(pending, new Error('DevTools websocket closed'));
    };
    ws.onopen = () => {
      resolve({
        send: createCommandSender(ws, WebSocketCtor, pending, sequence),
        close() {
          try {
            ws.close();
          } catch {
            // Ignore close errors.
          }
        },
      });
    };
  });
}

module.exports = { createDevToolsClient };
