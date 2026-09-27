const path = require('path');

function isWindowsPlatform(platform = process.platform) {
  return platform === 'win32';
}

function isWindowsCommandScript(command) {
  const extension = path.extname(String(command || '')).toLowerCase();
  return extension === '.cmd' || extension === '.bat';
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
  if (isWindowsPlatform(platform) && isWindowsCommandScript(server.command)) {
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
  isWindowsCommandScript,
};
