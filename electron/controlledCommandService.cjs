const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_COMMAND_TIMEOUT_MS = 12000;
const MAX_COMMAND_TIMEOUT_MS = 30000;
const MAX_COMMAND_TEXT_LENGTH = 800;
const MAX_OUTPUT_CHARS = 12000;

const BLOCKED_COMMAND_PATTERNS = [
  /\b(?:remove-item|rm|del|erase|rd|rmdir)\b/iu,
  /\b(?:diskpart|bcdedit|cipher|takeown|icacls)\b/iu,
  /\b(?:shutdown|restart-computer|stop-computer|logoff)\b/iu,
  /\breg(?:istry)?\s+(?:delete|add|import|load|unload)\b/iu,
  /\b(?:taskkill|stop-process)\b/iu,
  /\b(?:sc|schtasks)\s+(?:delete|create|change)\b/iu,
  /\bnet\s+user\b/iu,
];

// `format` is dangerous only when it is the command being invoked. A URL
// query such as `https://wttr.in/Beijing?format=3` is read-only data and must
// not be rejected by the command safety gate.
const BLOCKED_FORMAT_COMMAND_PATTERN = /(?:^|[\s/&])format(?:\.com|\.exe)?(?:\s|$)/iu;

const BLOCKED_SHELL_OPERATOR_PATTERN = /(?:&&|\|\||[|<>;`])/u;

function compactOutput(value, maxLength = MAX_OUTPUT_CHARS) {
  const text = String(value || '').replace(/\0/g, '').trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 80))}\n...[output truncated ${text.length - maxLength} chars]`;
}

function normalizeShell(value) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  return normalizedValue === 'cmd' ? 'cmd' : 'powershell';
}

function normalizeTimeoutMs(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return DEFAULT_COMMAND_TIMEOUT_MS;
  }

  return Math.max(1000, Math.min(MAX_COMMAND_TIMEOUT_MS, Math.round(numberValue)));
}

function resolveCwd(rawCwd, app) {
  const configuredCwd = String(rawCwd || '').trim();
  const fallbackCwd = (() => {
    try {
      return app?.getPath?.('home') || os.homedir();
    } catch {
      return os.homedir();
    }
  })();

  if (!configuredCwd) {
    return fallbackCwd;
  }

  const resolvedCwd = path.resolve(configuredCwd);
  try {
    if (fs.statSync(resolvedCwd).isDirectory()) {
      return resolvedCwd;
    }
  } catch {
    // Fall through to fallback cwd.
  }

  return fallbackCwd;
}

function validateCommand(command) {
  const normalizedCommand = String(command || '').trim();
  if (!normalizedCommand) {
    return {
      ok: false,
      reason: 'Command is empty.',
    };
  }

  if (normalizedCommand.length > MAX_COMMAND_TEXT_LENGTH) {
    return {
      ok: false,
      reason: `Command is too long. Max length is ${MAX_COMMAND_TEXT_LENGTH} characters.`,
    };
  }

  if (/[\r\n]/u.test(normalizedCommand)) {
    return {
      ok: false,
      reason: 'Multi-line commands are blocked in controlled command v1.',
    };
  }

  if (BLOCKED_SHELL_OPERATOR_PATTERN.test(normalizedCommand)) {
    return {
      ok: false,
      reason: 'Shell operators, pipes, redirection, and command chaining are blocked in controlled command v1.',
    };
  }

  const blockedPattern = BLOCKED_COMMAND_PATTERNS.find((pattern) => pattern.test(normalizedCommand))
    || (BLOCKED_FORMAT_COMMAND_PATTERN.test(normalizedCommand) ? BLOCKED_FORMAT_COMMAND_PATTERN : null);
  if (blockedPattern) {
    return {
      ok: false,
      reason: 'The command matched a blocked destructive or system-mutating pattern.',
    };
  }

  return {
    command: normalizedCommand,
    ok: true,
  };
}

function buildExecFileInvocation(command, shellName) {
  if (shellName === 'cmd') {
    return {
      args: ['/d', '/s', '/c', command],
      file: 'cmd.exe',
    };
  }

  return {
    args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    file: 'powershell.exe',
  };
}

function runExecFile({ args, cwd, file, onChild, timeoutMs }) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = execFile(
      file,
      args,
      {
        cwd,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 4,
        timeout: timeoutMs,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const execError = error && typeof error === 'object' ? error : null;
        resolve({
          durationMs: Date.now() - startedAt,
          error: execError?.message || (error ? String(error) : ''),
          exitCode: Number.isFinite(Number(execError?.code)) ? Number(execError.code) : 0,
          signal: execError?.signal || null,
          stderr: compactOutput(stderr),
          stdout: compactOutput(stdout),
          timedOut: Boolean(execError?.killed) && /timed out/iu.test(execError?.message || ''),
        });
      },
    );
    onChild?.(child);
  });
}

function createControlledCommandService({ app, log } = {}) {
  const activeCommands = new Map();

  async function runControlledCommand(request = {}) {
    const validation = validateCommand(request?.command ?? request?.script ?? request?.query);
    const shellName = normalizeShell(request?.shell);
    const timeoutMs = normalizeTimeoutMs(request?.timeoutMs);
    const cwd = resolveCwd(request?.cwd, app);
    const requestId = String(request?.requestId || '').trim();

    if (!validation.ok) {
      return {
        ok: false,
        blocked: true,
        command: String(request?.command ?? request?.script ?? request?.query ?? '').trim(),
        cwd,
        error: validation.reason,
        shell: shellName,
      };
    }

    const invocation = buildExecFileInvocation(validation.command, shellName);
    log?.('controlled command started', {
      command: validation.command.slice(0, 120),
      cwd,
      shell: shellName,
    });

    const result = await runExecFile({
      ...invocation,
      cwd,
      onChild: (child) => {
        if (requestId) {
          activeCommands.set(requestId, child);
        }
      },
      timeoutMs,
    }).finally(() => {
      if (requestId) {
        activeCommands.delete(requestId);
      }
    });
    const ok = !result.error && result.exitCode === 0 && !result.timedOut;
    log?.('controlled command completed', {
      exitCode: result.exitCode,
      ok,
      shell: shellName,
      timedOut: result.timedOut,
    });

    return {
      ...result,
      blocked: false,
      command: validation.command,
      cwd,
      ok,
      shell: shellName,
      timeoutMs,
    };
  }

  function cancelControlledCommand(request = {}) {
    const requestId = String(request?.requestId || '').trim();
    if (!requestId) {
      return {
        cancelled: false,
        error: 'requestId is required.',
        ok: false,
      };
    }

    const child = activeCommands.get(requestId);
    if (!child || child.killed) {
      return {
        cancelled: false,
        error: 'No active controlled command matched the requestId.',
        ok: false,
        requestId,
      };
    }

    try {
      const cancelled = child.kill();
      activeCommands.delete(requestId);
      log?.('controlled command cancelled', { cancelled, requestId });
      return {
        cancelled,
        ok: cancelled,
        requestId,
      };
    } catch (error) {
      return {
        cancelled: false,
        error: error instanceof Error ? error.message : String(error),
        ok: false,
        requestId,
      };
    }
  }

  return {
    cancelControlledCommand,
    runControlledCommand,
  };
}

module.exports = {
  createControlledCommandService,
  validateCommand,
};
