const { execFile, spawn } = require('child_process');

function execFileAsync(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }

      resolve(stdout);
    });
  });
}

function spawnDetachedAsync(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    let child = null;
    let settled = false;
    const timeoutMs = Math.max(0, Number(options.timeoutMs) || 0);
    const spawnOptions = { ...options };
    delete spawnOptions.timeoutMs;
    let timeoutId = null;
    const settle = (callback, value) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      callback(value);
    };

    try {
      child = spawn(file, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        ...spawnOptions,
      });
    } catch (error) {
      reject(error);
      return;
    }

    child.once('error', (error) => settle(reject, error));
    child.once('spawn', () => {
      child.unref();
      settle(resolve);
    });
    if (timeoutMs > 0) {
      timeoutId = setTimeout(
        () => settle(reject, new Error('Detached process dispatch timed out.')),
        timeoutMs,
      );
    }
  });
}

module.exports = { execFileAsync, spawnDetachedAsync };
