const { buildBaseRuntimeInstallFailureResult, buildInstallExecutionFailureResult,
  buildInstallHealthCheckSettings, buildInstallSuccessResult, buildMissingPackagesInstallFailureResult,
  getDefaultLocalVoiceMissingPackages, resolvePreferredTorchPackages,
} = require('./localVoiceRuntimeInstallUtils.cjs');
const { DEFAULT_TORCHAUDIO_VERSION, DEFAULT_TORCH_VERSION, getModePackages } = require('./localVoiceRuntimeModeUtils.cjs');
const { uniqueStrings } = require('./localVoiceRuntimePathUtils.cjs');
const { createInstallProgressReporter, parseJsonFromCommandOutput } = require('./localVoiceRuntimeCommandUtils.cjs');
const { buildJsonError } = require('./localVoiceRuntimeProcessUtils.cjs');

function createInstallState(context, settings, options) {
  const { writeRuntimeLog, brokenModeRuntimeCandidates } = context;
  const safeSettings = settings ?? {};
  const defaultMissingPackages = getDefaultLocalVoiceMissingPackages(getModePackages, uniqueStrings);
  const healthCheckSettings = buildInstallHealthCheckSettings(safeSettings);
  writeRuntimeLog('Starting local voice dependency installation');
  brokenModeRuntimeCandidates.clear();
  const progress = createInstallProgressReporter(
    options.onProgress,
    (message) => writeRuntimeLog(`Install progress: ${message}`),
  );

  progress.push('Preparing local voice dependency installation...');

  return { safeSettings, defaultMissingPackages, healthCheckSettings, progress };
}

async function installRuntimes(context, baseRuntime, progress) {
  const { getSharedOptions, runInlinePythonScript, ensureVenv, installModeDependencies } = context;
  const preferredTorchPackages = await resolvePreferredTorchPackages({
    baseRuntime,
    defaultTorchaudioVersion: DEFAULT_TORCHAUDIO_VERSION,
    defaultTorchVersion: DEFAULT_TORCH_VERSION,
    getSharedOptions,
    parseJsonFromCommandOutput,
    runInlinePythonScript,
  });
  progress.push(`Isolated runtimes will use PyTorch ${preferredTorchPackages.torchVersion} / torchaudio ${preferredTorchPackages.torchaudioVersion}`);
  const ttsRuntime = await ensureVenv(baseRuntime, 'tts', progress, { recreate: true });
  await installModeDependencies(baseRuntime, ttsRuntime, 'tts', progress, preferredTorchPackages);

  const sttRuntime = await ensureVenv(baseRuntime, 'stt', progress, { recreate: true });
  await installModeDependencies(baseRuntime, sttRuntime, 'stt', progress, preferredTorchPackages);

}

function finishInstall(health, baseRuntime, progress) {
  if (health.missingPackages.length > 0) {
    const failureResult = buildMissingPackagesInstallFailureResult({
      executable: health.executable,
      messages: progress.getMessages(),
      missingPackages: health.missingPackages,
    });

    progress.setExecutable(health.executable ?? baseRuntime.executable);
    progress.setMissingPackages(failureResult.missingPackages);
    progress.setError(failureResult.error);
    progress.push(`Installation completed but some packages are still missing: ${health.missingPackages.join(', ')}`);
    progress.setStage('failed');
    return failureResult;
  }

  progress.setExecutable(health.executable ?? baseRuntime.executable);
  progress.setMissingPackages([]);
  progress.setError(null);
  progress.push('Local voice isolated runtimes installed successfully.');
  progress.setStage('completed');
  return buildInstallSuccessResult({
    executable: health.executable,
    messages: progress.getMessages(),
  });
}

async function failInstall(context, state, baseRuntime, error) {
  const { getHealth } = context;
  const { healthCheckSettings, defaultMissingPackages, progress } = state;
  const health = await getHealth(healthCheckSettings);
  const failureResult = buildInstallExecutionFailureResult({
    error: buildJsonError(error),
    executable: health.executable ?? baseRuntime.executable,
    messages: progress.getMessages(),
    missingPackages: health.missingPackages.length > 0
      ? health.missingPackages
      : defaultMissingPackages,
  });

  progress.setExecutable(failureResult.executable);
  progress.setMissingPackages(failureResult.missingPackages);
  progress.setError(failureResult.error);
  progress.push(`Installation failed: ${failureResult.error}`);
  progress.setStage('failed');
  return failureResult;
}

async function executeInstall(context, state, baseRuntime) {
  try {
    await installRuntimes(context, baseRuntime, state.progress);
    const health = await context.getHealth(state.healthCheckSettings);
    return finishInstall(health, baseRuntime, state.progress);
  } catch (error) {
    return failInstall(context, state, baseRuntime, error);
  }
}

function createLocalVoiceInstaller(context) {
  const { resolveBasePythonRuntime } = context;
  async function installDependencies(settings, options = {}) {
    const state = createInstallState(context, settings, options);
    const { safeSettings, defaultMissingPackages, progress } = state;
    let baseRuntime = null;
    try {
      baseRuntime = await resolveBasePythonRuntime(safeSettings);
      progress.setExecutable(baseRuntime.executable);
      progress.push(`Base Python runtime: ${baseRuntime.executable}`);
      progress.setStage('running');
      progress.push('Checking or creating isolated runtimes. The first install may take several minutes.');
    } catch (error) {
      const failureResult = buildBaseRuntimeInstallFailureResult({
        error,
        missingPackages: defaultMissingPackages,
      });

      progress.setMissingPackages(failureResult.missingPackages);
      progress.setError(failureResult.error);
      failureResult.messages.forEach((message) => progress.push(message));
      progress.setStage('failed');
      return failureResult;
    }

    return executeInstall(context, state, baseRuntime);
  }
  return { installDependencies };
}

module.exports = { createLocalVoiceInstaller };
