const fs = require('fs');
const path = require('path');

const MAX_ARGS = 64;
const MAX_ENV_KEYS = 64;
const SECRET_ENV_NAME_PATTERN = /(api[_-]?key|password|secret|token)/iu;
const PLACEHOLDER_VALUE_PATTERN = /^(?:<[^>]+>|your[_-]|replace[_-]|todo\b|\$\{[^}]+\})/iu;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value, limit = 4096) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function isPathLike(command) {
  return path.isAbsolute(command) || command.includes('/') || command.includes('\\');
}

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function isDirectory(directoryPath) {
  try {
    return fs.statSync(directoryPath).isDirectory();
  } catch {
    return false;
  }
}

function windowsExecutableExtensions(env) {
  const configured = text(env.PATHEXT || '.COM;.EXE;.BAT;.CMD');
  return configured.split(';').map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function executableCandidates(command, directory, platform, env) {
  const direct = path.join(directory, command);
  if (platform !== 'win32' || path.extname(command)) return [direct];
  return [direct, ...windowsExecutableExtensions(env).map((extension) => `${direct}${extension}`)];
}

function resolveNamedCommand(command, platform, env) {
  const pathValue = text(env.Path || env.PATH, 32768);
  const separator = platform === 'win32' ? ';' : path.delimiter;
  for (const directory of pathValue.split(separator).map((item) => item.trim().replace(/^"|"$/gu, '')).filter(Boolean)) {
    for (const candidate of executableCandidates(command, directory, platform, env)) {
      if (isFile(candidate)) return candidate;
    }
  }
  return null;
}

function addCheck(checks, id, label, status, detail) {
  checks.push({ detail, id, label, status });
}

function inspectEnvironmentEntries(checks, env) {
  const entries = Object.entries(isRecord(env) ? env : {}).slice(0, MAX_ENV_KEYS);
  const invalid = entries.filter(([key, value]) => (
    !key.trim()
    || typeof value !== 'string'
    || !value.trim()
    || PLACEHOLDER_VALUE_PATTERN.test(value.trim())
  ));
  if (invalid.length) {
    const labels = invalid.map(([key]) => key || '(empty name)').slice(0, 6).join(', ');
    addCheck(
      checks,
      'environment-values',
      'Environment values',
      invalid.some(([key]) => SECRET_ENV_NAME_PATTERN.test(key)) ? 'blocked' : 'warning',
      `Set real values for: ${labels}. Values are not included in this report.`,
    );
    return;
  }
  addCheck(
    checks,
    'environment-values',
    'Environment values',
    'ready',
    `${entries.length} environment variable name(s) checked; values are hidden.`,
  );
}

function inspectNetworkHint(checks, command, args) {
  const base = path.basename(command).toLowerCase();
  if (base !== 'npx' && base !== 'npx.cmd') return;
  const packageName = args.find((arg) => !arg.startsWith('-'));
  const offline = args.includes('--offline');
  addCheck(
    checks,
    'npx-network',
    'NPX package availability',
    'warning',
    offline
      ? `Offline mode requires ${packageName || 'the MCP package'} to exist in the local npm cache.`
      : `The first launch of ${packageName || 'this MCP package'} may require npm registry access.`,
  );
}

function overallStatus(checks) {
  if (checks.some((check) => check.status === 'blocked')) return 'blocked';
  return checks.some((check) => check.status === 'warning') ? 'warning' : 'ready';
}

function createMcpServerEnvironmentPreflightService(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || path.join(__dirname, '..'));
  const platform = options.platform || process.platform;
  const hostEnv = options.env || process.env;

  function inspect(request = {}) {
    const server = isRecord(request.server) ? request.server : {};
    const command = text(server.command, 1024);
    const requestedCwd = text(server.cwd);
    const cwd = requestedCwd ? path.resolve(projectRoot, requestedCwd) : projectRoot;
    const args = Array.isArray(server.args)
      ? server.args.filter((item) => typeof item === 'string').map((item) => item.slice(0, 4096)).slice(0, MAX_ARGS)
      : [];
    const checks = [];
    addCheck(
      checks,
      'working-directory',
      'Working directory',
      isDirectory(cwd) ? 'ready' : 'blocked',
      isDirectory(cwd) ? 'Working directory exists.' : 'Working directory does not exist or is not a directory.',
    );
    let resolvedCommand = null;
    if (!command) {
      addCheck(checks, 'command-availability', 'Command availability', 'blocked', 'Enter a command before checking the environment.');
    } else if (/^['"].*['"]$/u.test(command)) {
      addCheck(checks, 'command-availability', 'Command availability', 'blocked', 'Remove surrounding quotes from the command field; arguments are already passed separately.');
    } else {
      resolvedCommand = isPathLike(command)
        ? path.resolve(cwd, command)
        : resolveNamedCommand(command, platform, { ...hostEnv, ...(isRecord(server.env) ? server.env : {}) });
      addCheck(
        checks,
        'command-availability',
        'Command availability',
        resolvedCommand && isFile(resolvedCommand) ? 'ready' : 'blocked',
        resolvedCommand && isFile(resolvedCommand)
          ? `${path.basename(resolvedCommand)} is available through the desktop host.`
          : `${command} was not found as a file or on PATH.`,
      );
    }
    if ((cwd.includes(' ') || (resolvedCommand?.includes(' ') ?? false)) && resolvedCommand) {
      addCheck(checks, 'space-path', 'Paths with spaces', 'ready', 'Command and arguments use separate spawn fields, so spaces do not require extra quoting.');
    }
    inspectEnvironmentEntries(checks, server.env);
    inspectNetworkHint(checks, resolvedCommand || command, args);
    const status = overallStatus(checks);
    return {
      checks,
      commandKind: resolvedCommand && ['.cmd', '.bat'].includes(path.extname(resolvedCommand).toLowerCase())
        ? 'windows-command-script'
        : 'executable',
      ok: status !== 'blocked',
      resolvedCommand: resolvedCommand || null,
      status,
    };
  }

  return { inspect };
}

module.exports = { createMcpServerEnvironmentPreflightService };
