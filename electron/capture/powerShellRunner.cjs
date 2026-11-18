function executeTemporaryPowerShellScript({ app, execFile, fs, path }, script, options = {}) {
  const {
    sta = false,
    timeout = 5000,
    maxBuffer = 1024 * 1024,
  } = options;
  const scriptPath = path.join(
    app.getPath('temp'),
    `desktop-pet-${process.pid}-${Date.now()}-${Math.round(Math.random() * 100000)}.ps1`,
  );

  fs.writeFileSync(scriptPath, script, 'utf8');

  return new Promise((resolve, reject) => {
    const args = [
      '-NoProfile',
      ...(sta ? ['-STA'] : []),
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
    ];

    execFile(
      'powershell.exe',
      args,
      {
        windowsHide: true,
        encoding: 'utf8',
        timeout,
        maxBuffer,
      },
      (error, stdout, stderr) => {
        fs.unlink(scriptPath, () => {});
        if (error) {
          error.stderr = stderr;
          reject(error);
          return;
        }

        resolve(stdout);
      },
    );
  });
}

// A warm PowerShell worker registered by the app (electron/powerShellHost.cjs) runs the script
// without starting powershell.exe; when there is none, or it cannot run it, spawn as before.
function createCapturePowerShellRunner(dependencies) {
  const spawnScript = executeTemporaryPowerShellScript.bind(null, dependencies);
  return (script, options = {}) => {
    const powerShellHost = globalThis[Symbol.for('desktop-pet.powershell-host')];
    if (!powerShellHost) return spawnScript(script, options);
    return powerShellHost.run(script, { timeoutMs: options.timeout ?? 5000 })
      .then((hosted) => (hosted ? hosted.stdout : spawnScript(script, options)));
  };
}

module.exports = { createCapturePowerShellRunner };
