const { PACKAGED_APP_INDEX_TIMEOUT_MS } = require('./appLauncherConstants.cjs');
const { normalizeAliasList } = require('./appSearchMatching.cjs');

function createPackagedAppIndex({ runPowerShellScript, logMessage, packagedAppProvider }) {
  function parsePackagedAppRows(value) {
    if (Array.isArray(value)) {
      return value;
    }

    if (value && typeof value === 'object') {
      return [value];
    }

    try {
      const parsed = JSON.parse(String(value || '[]').trim() || '[]');
      return Array.isArray(parsed) ? parsed : [parsed].filter(Boolean);
    } catch {
      return [];
    }
  }

  async function createPackagedAppEntries() {
    if (process.platform !== 'win32') {
      return [];
    }

    let rows = [];
    try {
      if (typeof packagedAppProvider === 'function') {
        rows = parsePackagedAppRows(await packagedAppProvider());
      } else {
        const script = String.raw`
Get-StartApps |
  Where-Object {
    -not [string]::IsNullOrWhiteSpace($_.Name) -and
    -not [string]::IsNullOrWhiteSpace($_.AppID) -and
    ([string]$_.AppID).Contains('!')
  } |
  Select-Object -Property Name, AppID |
  ConvertTo-Json -Depth 3 -Compress
`;
        rows = parsePackagedAppRows(await runPowerShellScript(script, PACKAGED_APP_INDEX_TIMEOUT_MS));
      }
    } catch (error) {
      logMessage('packaged app index scan failed', error?.stack || error);
      return [];
    }

    const seenAppIds = new Set();
    return rows
      .map((row) => {
        const name = String(row?.Name || row?.name || '').trim();
        const appId = String(row?.AppID || row?.AppId || row?.appId || '').trim();
        const appIdKey = appId.toLowerCase();
        if (!name || !appId || !appId.includes('!') || seenAppIds.has(appIdKey)) {
          return null;
        }

        seenAppIds.add(appIdKey);
        return {
          aliases: normalizeAliasList([name, appId]),
          appId,
          category: 'packaged-app',
          name,
          path: '',
          sourceRoot: 'windows-start-apps',
          type: 'aumid',
        };
      })
      .filter(Boolean);
  }
  return { createPackagedAppEntries };
}

module.exports = { createPackagedAppIndex };
