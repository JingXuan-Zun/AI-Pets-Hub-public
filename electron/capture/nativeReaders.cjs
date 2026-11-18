async function getNativeDisplayBounds(dependencies) {
  const { process, runTemporaryPowerShellScript, getNativeDisplayBoundsPowerShellScript, parseNativeDisplayBounds } = dependencies;

  if (process.platform !== 'win32') {
    return [];
  }

  try {
    const stdout = await runTemporaryPowerShellScript(
      getNativeDisplayBoundsPowerShellScript(),
      {
        timeout: 1600,
        maxBuffer: 1024 * 1024,
      },
    );
    return parseNativeDisplayBounds(stdout);
  } catch (_error) {
    return [];
  }
}

async function getNativeWindowCaptureSources(dependencies, options = {}) {
  const { process, execFile, getNativeWindowCaptureSourcesPowerShellScript, readNativeResultList,
    getOwnCaptureWindowTitleSet, buildFilteredWindowCaptureSources } = dependencies;

  if (process.platform !== 'win32') {
    return [];
  }

  try {
    const script = getNativeWindowCaptureSourcesPowerShellScript(options);
    const timeout = options.includeThumbnails === false ? 1800 : 4500;
    // Warm PowerShell worker registered by the app (electron/powerShellHost.cjs), else spawn.
    const powerShellHost = globalThis[Symbol.for('desktop-pet.powershell-host')];
    const hosted = powerShellHost ? await powerShellHost.run(script, { timeoutMs: timeout }) : null;
    const stdout = hosted ? hosted.stdout : await new Promise((resolve, reject) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        {
          windowsHide: true,
          encoding: 'utf8',
          timeout,
          maxBuffer: 12 * 1024 * 1024,
        },
        (error, output) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(output);
        },
      );
    });

    const sourceList = readNativeResultList(stdout);
    const ownWindowTitleSet = getOwnCaptureWindowTitleSet();
    return buildFilteredWindowCaptureSources(sourceList, {
      ownWindowTitleSet,
      requireThumbnail: false,
    });
  } catch (error) {
    return [];
  }
}

async function getNativeScreenPreviewMap(dependencies, displays = []) {
  const { process, runTemporaryPowerShellScript, getNativeScreenPreviewPowerShellScript, parseNativeScreenPreviews } = dependencies;

  if (process.platform !== 'win32' || !Array.isArray(displays) || !displays.length) {
    return new Map();
  }

  try {
    const stdout = await runTemporaryPowerShellScript(
      getNativeScreenPreviewPowerShellScript(displays),
      {
        timeout: 5000,
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    return parseNativeScreenPreviews(stdout);
  } catch (_error) {
    return new Map();
  }
}

function createCaptureNativeReaders(dependencies) {
  return {
    getNativeDisplayBounds: getNativeDisplayBounds.bind(null, dependencies),
    getNativeWindowCaptureSources: getNativeWindowCaptureSources.bind(null, dependencies),
    getNativeScreenPreviewMap: getNativeScreenPreviewMap.bind(null, dependencies),
  };
}

module.exports = { createCaptureNativeReaders };
