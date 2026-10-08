function createDesktopIconFetcher({ runPowerShellScript, getDesktopIconPowerShellScript, normalizeDesktopIcon, attachDesktopIconCoordinateSpaces }) {
  async function fetchDesktopIcons(options = {}) {
    if (process.platform !== 'win32') {
      return [];
    }

    const stdout = await runPowerShellScript(getDesktopIconPowerShellScript({
      includeReadOnlyPositionFallback: Boolean(options?.includeReadOnlyPositionFallback),
    }));
    const parsed = JSON.parse(String(stdout || '[]').trim() || '[]');
    const rawIcons = Array.isArray(parsed) ? parsed : [parsed];
    return rawIcons
      .map(normalizeDesktopIcon)
      .map(attachDesktopIconCoordinateSpaces)
      .filter(Boolean);
  }

  return fetchDesktopIcons;
}

function createDesktopIconFallbackResolver({ fetchDesktopIcons, listDesktopFileFallbackIcons, logMessage }) {
  async function resolveDesktopIconReadFallbacks(icons, options = {}) {
    const includeReadOnlyPositionFallback = Boolean(options?.includeReadOnlyPositionFallback);
    const includeFileSystemFallback = Boolean(options?.includeFileSystemFallback);
    if (includeReadOnlyPositionFallback && !icons.length) {
      try {
        const positionFallbackIcons = await fetchDesktopIcons({
          includeReadOnlyPositionFallback: true,
        });
        if (positionFallbackIcons.length) {
          logMessage('desktop icon read-only position fallback used', {
            count: positionFallbackIcons.length,
          });
          return positionFallbackIcons;
        }
      } catch (error) {
        logMessage('desktop icon read-only position fallback failed', error?.stack || error);
      }
    }

    if (includeFileSystemFallback && !icons.length) {
      const fileFallbackIcons = listDesktopFileFallbackIcons();
      if (fileFallbackIcons.length) {
        logMessage('desktop icon filesystem fallback used', { count: fileFallbackIcons.length });
      }
      return fileFallbackIcons;
    }

    return icons;
  }

  return resolveDesktopIconReadFallbacks;
}

function createDesktopIconReader(dependencies) {
  const fetchDesktopIcons = createDesktopIconFetcher(dependencies);
  const resolveDesktopIconReadFallbacks = createDesktopIconFallbackResolver({
    fetchDesktopIcons, listDesktopFileFallbackIcons: dependencies.listDesktopFileFallbackIcons, logMessage: dependencies.logMessage,
  });
  return { fetchDesktopIcons, resolveDesktopIconReadFallbacks };
}

module.exports = { createDesktopIconReader };
