let rendererRuntimeLoggingInstalled = false;

function summarizeRuntimeValue(value: unknown, depth = 0): string {
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
    const entries = Object.entries(value as Record<string, unknown>);
    if (depth >= 1) {
      return `{${entries.slice(0, 4).map(([key]) => key).join(', ')}${entries.length > 4 ? ', ...' : ''}}`;
    }

    return `{${entries.slice(0, 4).map(([key, item]) => `${key}: ${summarizeRuntimeValue(item, depth + 1)}`).join(', ')}${entries.length > 4 ? ', ...' : ''}}`;
  }

  return typeof value;
}

function resolvePanelLabel() {
  if (typeof window === 'undefined') {
    return '\u672a\u77e5\u7a97\u53e3';
  }

  const panelMode = new URLSearchParams(window.location.search).get('panel');
  switch (panelMode) {
    case 'settings':
      return '\u8bbe\u7f6e\u7a97';
    case 'chat':
      return '\u804a\u5929\u7a97';
    case 'area-picker':
      return '\u6846\u9009\u7a97';
    default:
      return '\u4e3b\u754c\u9762';
  }
}

function buildScope(scope: string) {
  const normalizedScope = scope.trim() || 'runtime';
  return `${resolvePanelLabel()}/${normalizedScope}`;
}

function canPushRuntimeLog() {
  return typeof window !== 'undefined'
    && Boolean(window.desktopPetShell?.desktopMode)
    && typeof window.desktopPetShell?.pushRuntimeLog === 'function';
}

function normalizeErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
        ? error.stack.split('\n').slice(0, 5).join('\n')
        : undefined,
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  if (error == null) {
    return { message: String(error) };
  }

  return {
    message: summarizeRuntimeValue(error),
  };
}

function buildConsoleMessage(args: unknown[]) {
  if (!args.length) {
    return 'console.error';
  }

  const [firstArg, ...restArgs] = args;
  if (typeof firstArg === 'string' && firstArg.trim()) {
    const suffix = restArgs.length > 0
      ? ` ${restArgs.map((item) => summarizeRuntimeValue(item)).join(' | ')}`
      : '';
    return `${firstArg.trim()}${suffix}`.trim();
  }

  return `console.error ${args.map((item) => summarizeRuntimeValue(item)).join(' | ')}`.trim();
}

export function pushFrontendRuntimeLog(scope: string, message: string, details?: unknown) {
  if (!canPushRuntimeLog()) {
    return;
  }

  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    return;
  }

  try {
    window.desktopPetShell?.pushRuntimeLog?.(buildScope(scope), normalizedMessage, details);
  } catch {
    // Ignore renderer log forwarding failures.
  }
}

export function pushFrontendRuntimeError(scope: string, message: string, error: unknown, details?: Record<string, unknown>) {
  const normalizedError = normalizeErrorDetails(error);
  pushFrontendRuntimeLog(scope, message, {
    errorName: normalizedError.name ?? null,
    errorMessage: normalizedError.message ?? null,
    errorStack: normalizedError.stack ?? null,
    ...(details ?? {}),
    error: normalizedError,
  });
}

export function installRendererRuntimeLogging() {
  if (rendererRuntimeLoggingInstalled || !canPushRuntimeLog()) {
    return;
  }

  rendererRuntimeLoggingInstalled = true;
  const originalConsoleError = console.error.bind(console);

  console.error = (...args: unknown[]) => {
    pushFrontendRuntimeLog('frontend-error', buildConsoleMessage(args));
    originalConsoleError(...args);
  };

  window.addEventListener('error', (event) => {
    pushFrontendRuntimeError('unhandled-error', 'window error captured', event.error ?? event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    pushFrontendRuntimeError('unhandled-error', 'unhandled promise rejection', event.reason);
  });

  pushFrontendRuntimeLog('frontend', 'renderer runtime logging ready');
}
