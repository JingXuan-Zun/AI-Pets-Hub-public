const DESKTOP_ICON_SCRIPT_TIMEOUT_MS = 2500;

function stripPowerShellCliXml(value) {
  return String(value || '')
    .replace(/^#< CLIXML\s*/u, '')
    .replace(/<Objs[^>]*>/gu, '')
    .replace(/<\/Objs>/gu, '')
    .replace(/<S[^>]*>/gu, '')
    .replace(/<\/S>/gu, '')
    .replace(/_x000D__x000A_/gu, '\n')
    .replace(/_x000D_/gu, '\r')
    .replace(/_x000A_/gu, '\n')
    .replace(/_x0009_/gu, '\t')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&amp;/gu, '&')
    .trim();
}

function compactDesktopIconPowerShellError(value, maxLength = 1200) {
  const text = stripPowerShellCliXml(value)
    .replace(/\s+/gu, ' ')
    .trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function createDesktopIconPowerShellError(error, stdout, stderr) {
  const stderrText = compactDesktopIconPowerShellError(stderr);
  const stdoutText = compactDesktopIconPowerShellError(stdout);
  const messageText = compactDesktopIconPowerShellError(error?.message || String(error || ''));
  const detailText = [stderrText, stdoutText, messageText]
    .filter(Boolean)
    .find((text) => !/^Command failed:/iu.test(text))
    || stderrText
    || stdoutText
    || messageText
    || 'PowerShell desktop icon command failed.';
  const wrapped = new Error(detailText);
  wrapped.code = error?.code;
  wrapped.signal = error?.signal;
  wrapped.stderr = stderrText;
  wrapped.stdout = stdoutText;
  return wrapped;
}

function createDesktopIconPowerShellRunner({ app, fs, path, execFile }) {
  function runPowerShellScript(script) {
    const tempRoot = app?.getPath?.('temp') || process.cwd();
    const scriptPath = path.join(
      tempRoot,
      `desktop-pet-icons-${process.pid}-${Date.now()}-${Math.round(Math.random() * 100000)}.ps1`,
    );

    fs.writeFileSync(scriptPath, script, 'utf8');

    return new Promise((resolve, reject) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
        {
          windowsHide: true,
          encoding: 'utf8',
          timeout: DESKTOP_ICON_SCRIPT_TIMEOUT_MS,
          maxBuffer: 1024 * 1024,
        },
        (error, stdout, stderr) => {
          fs.unlink(scriptPath, () => {});
          if (error) {
            reject(createDesktopIconPowerShellError(error, stdout, stderr));
            return;
          }

          resolve(stdout);
        },
      );
    });
  }

  return runPowerShellScript;
}

module.exports = { compactDesktopIconPowerShellError, createDesktopIconPowerShellRunner };
