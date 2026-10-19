function cleanupTemporaryScript({ rmSync }, tempDir) {
  if (!tempDir) return;
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
  }
}

function preparePowerShellScript(dependencies, script) {
  const { Buffer, mkdtempSync, writeFileSync, tmpdir, join } = dependencies;
  const encodedCommand = Buffer.from(script, 'utf16le').toString('base64');
  let tempDir = null;
  let args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedCommand];
  if (encodedCommand.length > 24000) {
    tempDir = mkdtempSync(join(tmpdir(), 'desktop-pet-input-'));
    try {
      const tempScriptPath = join(tempDir, 'input.ps1');
      // Windows PowerShell 5.1 reads a BOM-less script in the ANSI code page, which turned
      // typed Chinese into mojibake (官方 → 瀹樻柟); the BOM makes it read UTF-8.
      writeFileSync(tempScriptPath, `\uFEFF${script}`, 'utf8');
      args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tempScriptPath];
    } catch (error) {
      cleanupTemporaryScript(dependencies, tempDir);
      throw error;
    }
  }
  return { args, tempDir };
}

function runPowerShellScript(dependencies, script, timeout = dependencies.DESKTOP_INPUT_TIMEOUT_MS) {
  const { execFile } = dependencies;
  const { args, tempDir } = preparePowerShellScript(dependencies, script);
  return new Promise((resolve, reject) => {
    try {
      execFile(
        'powershell.exe',
        args,
        {
          encoding: 'utf8',
          timeout,
          windowsHide: true,
        },
        (error, stdout) => {
          cleanupTemporaryScript(dependencies, tempDir);
          if (error) {
            reject(error);
            return;
          }

          resolve(stdout);
        },
      );
    } catch (error) {
      cleanupTemporaryScript(dependencies, tempDir);
      reject(error);
    }
  });
}

function createDesktopInputPowerShellRunner(dependencies) {
  return runPowerShellScript.bind(null, dependencies);
}

module.exports = { createDesktopInputPowerShellRunner };
