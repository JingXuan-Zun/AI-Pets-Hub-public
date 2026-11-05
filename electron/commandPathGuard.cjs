const path = require('path');
const { createSensitivePathPolicy } = require('./sensitivePathPolicy.cjs');

// What a command line may not touch: the app's own data and settings (userData, the MCP config),
// besides the credential stores the file tools already refuse. Settings change through the
// settings / plugins tools, which ask the user; a command writing the files directly skipped
// all of that (she once rewrote the MCP config with [IO.File]::WriteAllText).

// Names of the app's own files, wherever they are and however the path is spelled ($env:APPDATA…).
const OWN_FILE_NAMES = ['.desktop-pet-mcp', 'desktop-pet-config', 'desktop-pet-chat-history', 'browser-search-profile'];

/** Path-looking parts of a command line: quoted strings and anything with a drive or share. */
function pathCandidates(command) {
  const quoted = [...command.matchAll(/(["'])(.*?)\1/gu)].map((match) => match[2]);
  const bare = command.split(/\s+/u).filter((part) => /^(?:[A-Za-z]:[\\/]|\\\\)/u.test(part));
  return [...quoted, ...bare].map((value) => value.replace(/^["']|["',;)]+$/gu, '')).filter((value) => /^(?:[A-Za-z]:[\\/]|\\\\)/u.test(value));
}

function createCommandPathGuard({ protectedRoots = [] } = {}) {
  const roots = protectedRoots.filter(Boolean);
  const policy = createSensitivePathPolicy({ extraRoots: roots });
  const rootNames = roots.map((root) => path.basename(root).toLowerCase()).filter((name) => name.length >= 6);
  return {
    /** A reason when the command reaches protected data, else null. */
    check(command, cwd) {
      const text = String(command ?? '');
      const lower = text.toLowerCase();
      if (OWN_FILE_NAMES.some((name) => lower.includes(name)) || rootNames.some((name) => lower.includes(name))) {
        return '不能用：这条命令碰到了桌宠自己的数据或设置文件。要改设置请用 settings / plugins 工具（会先问用户）。';
      }
      if (cwd && policy.isSensitivePath(cwd)) return '不能在桌宠自己的数据文件夹里运行命令。';
      if (pathCandidates(text).some((candidate) => policy.isSensitivePath(candidate))) {
        return '不能用：这条命令碰到了密钥、浏览器登录数据或桌宠自己的数据。';
      }
      return null;
    },
  };
}

module.exports = { createCommandPathGuard, pathCandidates };
