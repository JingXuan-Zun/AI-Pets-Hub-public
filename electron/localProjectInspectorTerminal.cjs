const path = require('path');
const { spawn } = require('child_process');
const { getSafeStat } = require('./localProjectInspectorReader.cjs');

function prepareTerminalCommand(action, clock) {
  const startedAt = clock.now();

  if (process.platform !== 'win32') {
    return {
      ok: false,
      error: 'Project command execution is currently only supported on Windows.',
      execution: {
        kind: 'terminal-command',
        startedAt,
      },
    };
  }

  const cwd = String(action.cwd || '').trim();

  const command = String(action.command || '').trim();

  if (!cwd || !path.isAbsolute(cwd) || !getSafeStat(cwd)?.isDirectory()) {
    return {
      ok: false,
      error: 'Invalid working directory.',
      execution: {
        command,
        cwd,
        kind: 'terminal-command',
        startedAt,
      },
    };
  }

  if (!command) {
    return {
      ok: false,
      error: 'Missing command.',
      execution: {
        cwd,
        kind: 'terminal-command',
        startedAt,
      },
    };
  }
  return { ok: true, cwd, command, startedAt };
}

function terminalStarted(command, cwd, startedAt, child) {
  return {
    execution: {
      command,
      cwd,
      kind: 'terminal-command',
      observation: '已创建新的可见命令行窗口。后续输出和退出码在该窗口内显示，当前 Agent 只确认启动请求已发出。',
      processName: 'cmd.exe',
      startedAt,
      visibleWindow: true,
    },
    ok: true,
    pid: child.pid ?? null,
    verification: {
      confidence: 'started',
      ok: true,
      reason: 'visible-terminal-window-created',
      summary: '已创建新的可见命令行窗口；当前没有读取 stdout/stderr 或退出码。',
    },
  };
}

function terminalFailed(command, cwd, startedAt, error) {
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    execution: {
      command,
      cwd,
      kind: 'terminal-command',
      observation: '命令行窗口创建失败。',
      processName: 'cmd.exe',
      startedAt,
      visibleWindow: true,
    },
    verification: {
      confidence: 'failed',
      ok: false,
      reason: 'terminal-window-create-failed',
      summary: '命令行窗口创建失败。',
    },
  };
}

function runTerminalCommand(action, clock = Date) {
  const prepared = prepareTerminalCommand(action, clock);
  if (!prepared.ok) return prepared;
  const { command, cwd, startedAt } = prepared;
  try {
    const child = spawn('cmd.exe', ['/d', '/s', '/k', command], {
      cwd,
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.unref();
    return terminalStarted(command, cwd, startedAt, child);
  } catch (error) {
    return terminalFailed(command, cwd, startedAt, error);
  }
}

module.exports = { runTerminalCommand };
