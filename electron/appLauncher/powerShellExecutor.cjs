const fs = require('fs');
const os = require('os');
const path = require('path');
const { FOCUS_WINDOW_TIMEOUT_MS } = require('./appLauncherConstants.cjs');
const { stripPowerShellCliXml, decodePowerShellOutput, compactPowerShellErrorText } = require('./powerShellOutput.cjs');

function createPowerShellExecutor({ execFileAsync }) {
  async function runPowerShellScript(script, timeout = FOCUS_WINDOW_TIMEOUT_MS) {
    const prologue = [
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
      '[Console]::InputEncoding = [System.Text.Encoding]::UTF8',
      '$OutputEncoding = [System.Text.Encoding]::UTF8',
      "$ProgressPreference = 'SilentlyContinue'",
      "$InformationPreference = 'SilentlyContinue'",
      "$VerbosePreference = 'SilentlyContinue'",
    ].join('\n');
    const fullScript = `${prologue}\n${script}`;
    const encodedCommand = Buffer.from(fullScript, 'utf16le').toString('base64');
    const encodedArgs = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-OutputFormat', 'Text', '-EncodedCommand', encodedCommand];
    const shouldUseScriptFile = encodedArgs.join(' ').length > 7000;
    const scriptPath = shouldUseScriptFile
      ? path.join(os.tmpdir(), `ai-desktop-pet-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`)
      : '';
    const args = shouldUseScriptFile
      ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-OutputFormat', 'Text', '-File', scriptPath]
      : encodedArgs;

    try {
      if (shouldUseScriptFile) {
        fs.writeFileSync(scriptPath, `\uFEFF${fullScript}`, 'utf8');
      }

      const stdout = await execFileAsync(
        'powershell.exe',
        args,
        {
          encoding: 'buffer',
          timeout,
          windowsHide: true,
        },
      );
      return stripPowerShellCliXml(decodePowerShellOutput(stdout));
    } catch (error) {
      const stderr = compactPowerShellErrorText(error?.stderr);
      const stdout = compactPowerShellErrorText(error?.stdout);
      const message = compactPowerShellErrorText(error instanceof Error ? error.message : String(error));
      throw new Error(stderr || stdout || message || 'PowerShell command failed.');
    } finally {
      if (scriptPath) {
        try {
          fs.rmSync(scriptPath, { force: true });
        } catch {
          // Best-effort cleanup for temporary PowerShell files.
        }
      }
    }
  }

  return { runPowerShellScript };
}

module.exports = { createPowerShellExecutor };
