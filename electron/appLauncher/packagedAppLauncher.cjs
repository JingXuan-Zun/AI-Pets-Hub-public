const { PACKAGED_APP_LAUNCH_TIMEOUT_MS } = require('./appLauncherConstants.cjs');
const { compactPowerShellErrorText } = require('./powerShellOutput.cjs');

function createPackagedAppLauncher({ packagedAppLauncher, spawnDetachedAsync }) {
  async function launchPackagedApp(selectedApp) {
    const appId = String(selectedApp?.appId || '').trim();
    if (!appId || !appId.includes('!')) {
      return 'Packaged app entry is missing a valid AppUserModelId.';
    }

    const target = `shell:AppsFolder\\${appId}`;
    try {
      if (typeof packagedAppLauncher === 'function') {
        const result = await packagedAppLauncher({ app: selectedApp, appId, target });
        if (result === false) {
          return 'Packaged app launcher rejected the request.';
        }
        if (typeof result === 'string') {
          return result;
        }
        if (result && typeof result === 'object' && result.ok === false) {
          return String(result.error || 'Packaged app launcher rejected the request.');
        }
        return '';
      }

      await spawnDetachedAsync('explorer.exe', [target], {
        timeoutMs: PACKAGED_APP_LAUNCH_TIMEOUT_MS,
      });
      return '';
    } catch (error) {
      return compactPowerShellErrorText(error?.stderr)
        || compactPowerShellErrorText(error instanceof Error ? error.message : String(error))
        || 'Packaged app launch failed.';
    }
  }

  return { launchPackagedApp };
}

module.exports = { createPackagedAppLauncher };
