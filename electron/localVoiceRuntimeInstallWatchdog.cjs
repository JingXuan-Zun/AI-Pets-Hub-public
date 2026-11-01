const fs = require('fs');
const path = require('path');

// Security software and sandboxes (360, Huorong, controlled folder access…) can freeze or block
// pip halfway; the install then showed "安装中" forever with no error. A step counts as stuck
// only when it printed nothing AND the files it writes stopped growing for STALL_MS: pip prints
// nothing while downloading PyTorch (2.5 GB), which can take a long time on a slow connection.
const STALL_MS = 10 * 60_000;
const CHECK_MS = 60_000;

const BLOCKED_PATTERN = /Access is denied|拒绝访问|PermissionError|WinError 5\b|Errno 13|Operation not permitted|being used by another process|WinError 32\b|WinError 225\b|virus|病毒/iu;

async function folderBytes(folder) {
  let total = 0;
  const pending = [folder];
  while (pending.length) {
    const current = pending.pop();
    let entries = [];
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(full);
      else {
        try {
          total += (await fs.promises.stat(full)).size;
        } catch {
          // A file pip just removed.
        }
      }
    }
  }
  return total;
}

function describeBlockedInstall(message, runtimeRoot) {
  if (!BLOCKED_PATTERN.test(message)) return message;
  return `安装文件被拦截（拒绝访问）。常见原因是杀毒软件、安全软件的沙箱或“受控文件夹访问”拦下了文件写入。请把这个文件夹加入信任 / 白名单后重新安装：${runtimeRoot}\n原始错误：${message.slice(-600)}`;
}

/**
 * Runs one install command; aborts it with a plain-language error when it stalls, and explains
 * "access denied" failures. watchFolders are where the step writes (temp, pip cache, the env).
 */
async function runWatchedInstallCommand({ spawnCommand, candidate, args, options, watchFolders, runtimeRoot, label, now = Date.now, stallMs = STALL_MS, checkMs = CHECK_MS }) {
  const controller = new AbortController();
  let lastActivity = now();
  let lastBytes = -1;
  let stalled = false;
  const touch = () => { lastActivity = now(); };
  const timer = setInterval(async () => {
    const bytes = (await Promise.all(watchFolders.map(folderBytes))).reduce((sum, value) => sum + value, 0);
    if (bytes !== lastBytes) {
      lastBytes = bytes;
      touch();
      return;
    }
    if (now() - lastActivity >= stallMs) {
      stalled = true;
      controller.abort();
    }
  }, checkMs);
  try {
    const result = await spawnCommand(candidate, args, {
      ...options,
      signal: controller.signal,
      onStdoutLine: (line) => { touch(); options.onStdoutLine?.(line); },
      onStderrLine: (line) => { touch(); options.onStderrLine?.(line); },
    });
    if (stalled) {
      throw new Error(`${label}卡住了：超过 ${Math.round(stallMs / 60_000)} 分钟没有任何进展。常见原因是杀毒软件或安全软件的沙箱拦住了安装，也可能是网络断了。请把这个文件夹加入信任 / 白名单、确认网络正常后重新安装：${runtimeRoot}`);
    }
    return result;
  } finally {
    clearInterval(timer);
  }
}

module.exports = { describeBlockedInstall, folderBytes, runWatchedInstallCommand };
