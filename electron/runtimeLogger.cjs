const MAX_RUNTIME_LOG_ENTRIES = 500;

function formatTimestamp(date = new Date()) {
  return date.toLocaleTimeString('en-GB', { hour12: false });
}

function summarizeRuntimeValue(value, depth = 0) {
  if (value == null) {
    return String(value);
  }

  if (typeof value === 'string') {
    return value.length > 160 ? `${value.slice(0, 157)}...` : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (depth >= 1) {
      return `[${value.length} items]`;
    }

    return `[${value.slice(0, 4).map((item) => summarizeRuntimeValue(item, depth + 1)).join(', ')}${value.length > 4 ? ', ...' : ''}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (depth >= 1) {
      return `{${entries.slice(0, 6).map(([key, item]) => `${key}: ${summarizeRuntimeValue(item, depth + 1)}`).join(', ')}${entries.length > 6 ? ', ...' : ''}}`;
    }

    return `{${entries.slice(0, 12).map(([key, item]) => `${key}: ${summarizeRuntimeValue(item, depth + 1)}`).join(', ')}${entries.length > 12 ? ', ...' : ''}}`;
  }

  return typeof value;
}

// API keys never reach the log, whatever path they came by (a key pasted into the chat during
// first-run setup is part of the message text the IPC log summarizes).
const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{16,}/gu,
  /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{16,}/giu,
];

function maskSecrets(line) {
  return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, (match, prefix) => (
    typeof prefix === 'string' && prefix ? `${prefix}***` : `${match.slice(0, 3)}…${match.slice(-4)}`
  )), String(line));
}

function createRuntimeLogger(options = {}) {
  const {
    limit = MAX_RUNTIME_LOG_ENTRIES,
    persist,
  } = options;

  let windowsProvider = () => [];
  let entries = [];

  function broadcast(line) {
    const windows = typeof windowsProvider === 'function'
      ? windowsProvider()
      : [];

    windows.forEach((win) => {
      if (!win || win.isDestroyed?.()) {
        return;
      }

      try {
        win.webContents.send('desktop-pet:runtime-log', line);
      } catch {
        // Ignore renderer broadcast failures.
      }
    });
  }

  function append(rawLine) {
    const line = maskSecrets(rawLine);
    entries = [line, ...entries].slice(0, Math.max(20, limit));

    if (typeof persist === 'function') {
      persist(line);
    }

    broadcast(line);
    return line;
  }

  return {
    getEntries() {
      return [...entries];
    },
    log(side, scope, message, details) {
      const detailText = details === undefined ? '' : ` ${summarizeRuntimeValue(details)}`;
      return append(`[${formatTimestamp()}][${side}][${scope}] ${message}${detailText}`);
    },
    setWindowsProvider(provider) {
      windowsProvider = typeof provider === 'function' ? provider : () => [];
    },
  };
}

module.exports = {
  createRuntimeLogger,
  maskSecrets,
  summarizeRuntimeValue,
};
