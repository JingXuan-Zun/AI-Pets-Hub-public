const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getWindowsSystemInfoPowerShellScript } = require('./systemInfoWindowsScript.cjs');

function cleanupTemporaryPowerShellScript(scriptPath) {
  try {
    fs.unlink(scriptPath, () => {});
  } catch {
    // Cleanup must not replace the collection result or the original launch error.
  }
}

function runTemporaryPowerShellScript(script, options = {}) {
  const {
    timeout = 5000,
    maxBuffer = 1024 * 1024,
  } = options;
  const scriptPath = path.join(
    os.tmpdir(),
    `desktop-pet-system-info-${process.pid}-${Date.now()}-${Math.round(Math.random() * 100000)}.ps1`,
  );

  fs.writeFileSync(scriptPath, script, 'utf8');

  return new Promise((resolve, reject) => {
    try {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
        {
          windowsHide: true,
          encoding: 'utf8',
          timeout,
          maxBuffer,
        },
        (error, stdout, stderr) => {
          cleanupTemporaryPowerShellScript(scriptPath);
          if (error && !String(stdout || '').trim()) {
            error.stderr = stderr;
            reject(error);
            return;
          }

          resolve(stdout);
        },
      );
    } catch (error) {
      cleanupTemporaryPowerShellScript(scriptPath);
      reject(error);
    }
  });
}

function runWindowsSystemInfoPowerShell() {
  if (process.platform !== 'win32') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    runTemporaryPowerShellScript(
      getWindowsSystemInfoPowerShellScript(),
      {
        timeout: 8000,
        maxBuffer: 1024 * 1024,
      },
    )
      .then((stdout) => {
        try {
          resolve(JSON.parse(String(stdout || '{}').trim() || '{}'));
        } catch (parseError) {
          resolve({
            error: parseError instanceof Error ? parseError.message : String(parseError),
          });
        }
      })
      .catch((error) => {
        resolve({
          error: [
            error?.message || String(error),
            error?.stderr ? String(error.stderr).trim() : '',
          ].filter(Boolean).join(': '),
        });
      });
  });
}

module.exports = { runWindowsSystemInfoPowerShell };
