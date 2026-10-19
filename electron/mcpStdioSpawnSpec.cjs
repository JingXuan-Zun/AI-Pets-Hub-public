const fs = require('fs');
const path = require('path');

function isWindowsPlatform(platform = process.platform) {
  return platform === 'win32';
}

function isWindowsCommandScript(command) {
  const extension = path.extname(String(command || '')).toLowerCase();
  return extension === '.cmd' || extension === '.bat';
}

/**
 * MCP READMEs write bare "npx" / "npm" / "pnpm"; on Windows those are .cmd scripts that a direct
 * spawn cannot start (it only finds .exe/.com). True when a bare command resolves on PATH to a
 * .cmd/.bat before any .exe/.com.
 */
function isBareWindowsCommandScript(command, env = process.env) {
  const value = String(command || '');
  if (!value || path.extname(value) || /[\\/]/u.test(value)) return false;
  const directories = String(env.PATH || env.Path || '').split(path.delimiter).filter(Boolean);
  for (const directory of directories) {
    for (const extension of ['.exe', '.com', '.cmd', '.bat']) {
      if (fs.existsSync(path.join(directory, `${value}${extension}`))) {
        return extension === '.cmd' || extension === '.bat';
      }
    }
  }
  return false;
}

function getWindowsCommandProcessor(env = process.env) {
  const comSpec = String(env.ComSpec || '').trim();
  if (comSpec) {
    return comSpec;
  }

  const systemRoot = String(env.SystemRoot || env.windir || '').trim();
  return systemRoot ? path.join(systemRoot, 'System32', 'cmd.exe') : 'cmd.exe';
}

function createWindowsCommandScriptSpec(server, env = process.env) {
  return {
    args: ['/d', '/s', '/c', server.command, ...(server.args || [])],
    command: getWindowsCommandProcessor(env),
  };
}

function createMcpStdioSpawnSpec(server, platform = process.platform, env = process.env) {
  if (isWindowsPlatform(platform) && (isWindowsCommandScript(server.command) || isBareWindowsCommandScript(server.command, env))) {
    return createWindowsCommandScriptSpec(server, env);
  }

  return {
    args: server.args || [],
    command: server.command,
  };
}

module.exports = {
  createMcpStdioSpawnSpec,
  getWindowsCommandProcessor,
  isBareWindowsCommandScript,
  isWindowsCommandScript,
};
