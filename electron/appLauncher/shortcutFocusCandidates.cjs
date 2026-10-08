const fs = require('fs');
const path = require('path');
const { uniqueCaseInsensitive, normalizeSearchText } = require('./appSearchMatching.cjs');

function createShortcutFocusCandidates({ runPowerShellScript, shortcutTargetPathCache }) {
  async function readShortcutTargetPath(shortcutPath) {
    if (!shortcutPath || path.extname(shortcutPath).toLowerCase() !== '.lnk') {
      return null;
    }

    const cacheKey = shortcutPath.toLowerCase();
    let stat = null;
    try {
      stat = fs.statSync(shortcutPath);
    } catch {
      shortcutTargetPathCache.delete(cacheKey);
      return null;
    }

    const cached = shortcutTargetPathCache.get(cacheKey);
    if (
      cached
      && cached.mtimeMs === stat.mtimeMs
      && cached.size === stat.size
    ) {
      return cached.targetPath;
    }

    try {
      const stdout = await runPowerShellScript(String.raw`
$ErrorActionPreference = 'Stop'
$shortcutPath = @'
${JSON.stringify(shortcutPath)}
'@ | ConvertFrom-Json
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$targetPath = [string]$shortcut.TargetPath
if ([string]::IsNullOrWhiteSpace($targetPath)) {
  ''
} else {
  $targetPath
}
`, 1800);
      const targetPath = String(stdout || '').trim();
      const normalizedTargetPath = targetPath && fs.existsSync(targetPath) ? targetPath : null;
      shortcutTargetPathCache.set(cacheKey, {
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        targetPath: normalizedTargetPath,
      });
      return normalizedTargetPath;
    } catch {
      shortcutTargetPathCache.set(cacheKey, {
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        targetPath: null,
      });
      return null;
    }
  }

  function getProcessNameFromPath(appPath) {
    if (!appPath || typeof appPath !== 'string') {
      return null;
    }

    const extension = path.extname(appPath).toLowerCase();
    if (extension !== '.exe') {
      return null;
    }

    return path.basename(appPath, extension);
  }

  async function buildFocusCandidates(query, selectedApp) {
    const processNames = [];
    const titleQueries = [
      query,
      selectedApp?.name,
    ];

    if (selectedApp?.path) {
      const directProcessName = getProcessNameFromPath(selectedApp.path);
      if (directProcessName) {
        processNames.push(directProcessName);
      }

      const shortcutTargetPath = await readShortcutTargetPath(selectedApp.path);
      const shortcutProcessName = getProcessNameFromPath(shortcutTargetPath);
      if (shortcutProcessName) {
        processNames.push(shortcutProcessName);
      }
    }

    return {
      processNames: uniqueCaseInsensitive(processNames),
      titleQueries: uniqueCaseInsensitive(titleQueries).map(normalizeSearchText).filter(Boolean),
    };
  }

  return { readShortcutTargetPath, buildFocusCandidates };
}

module.exports = { createShortcutFocusCandidates };
