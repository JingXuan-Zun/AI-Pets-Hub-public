const { createLocalVoiceRuntimeWarmup } = require('./localVoiceRuntimeWarmup.cjs');
const { createLocalVoiceInstallSteps } = require('./localVoiceRuntimeInstallSteps.cjs');
const { createLocalVoiceInstaller } = require('./localVoiceRuntimeInstaller.cjs');
const { createLocalVoiceSynthesis } = require('./localVoiceRuntimeSynthesis.cjs');
const { createLocalVoiceTranscription } = require('./localVoiceRuntimeTranscription.cjs');

function assembleWarmup(context) {
  const {
    resolveAssetSelection, getConfiguredReferenceText, writeRuntimeLog, warmupModeWorker,
    ensureReferenceTextPrepared, runRunnerCommand, requestModeWorker,
  } = context;
  const { warmup } = createLocalVoiceRuntimeWarmup({
    resolveAssetSelection, getConfiguredReferenceText, writeRuntimeLog,
    warmupModeWorker, ensureReferenceTextPrepared, runRunnerCommand, requestModeWorker,
  });

  return { warmup };
}

function assembleInstallSteps(context) {
  const {
    runtimeRoot, pathExists, ensureDir, spawnCommand,
    getSharedOptions,
  } = context;
  const { ensureVenv, installModeDependencies } = createLocalVoiceInstallSteps({
    runtimeRoot, pathExists, ensureDir, spawnCommand, getSharedOptions,
  });

  return { ensureVenv, installModeDependencies };
}

function assembleInstaller(context) {
  const {
    writeRuntimeLog, brokenModeRuntimeCandidates, resolveBasePythonRuntime, getSharedOptions,
    runInlinePythonScript, ensureVenv, installModeDependencies, getHealth,
  } = context;
  const { installDependencies } = createLocalVoiceInstaller({
    writeRuntimeLog, brokenModeRuntimeCandidates, resolveBasePythonRuntime, getSharedOptions,
    runInlinePythonScript, ensureVenv, installModeDependencies, getHealth,
  });

  return { installDependencies };
}

function assembleSynthesis(context) {
  const {
    createSynthesisRequest, activeSynthesisRequests, writeRuntimeLog, cleanupGeneratedAudioCacheBeforeSynthesize,
    resolveAssetSelection, ensureReferenceTextPrepared, runRunnerCommand, buildGeneratedAudioCacheKey,
    resolveGeneratedAudioCacheHit, getGeneratedAudioCacheFilePath, generatedAudioCacheRoot, persistGeneratedAudioCache,
  } = context;
  const { synthesize } = createLocalVoiceSynthesis({
    createSynthesisRequest, activeSynthesisRequests, writeRuntimeLog,
    cleanupGeneratedAudioCacheBeforeSynthesize, resolveAssetSelection, ensureReferenceTextPrepared,
    runRunnerCommand, buildGeneratedAudioCacheKey, resolveGeneratedAudioCacheHit,
    getGeneratedAudioCacheFilePath, generatedAudioCacheRoot, persistGeneratedAudioCache,
  });

  return { synthesize };
}

function assembleTranscription(context) {
  const {
    nextTranscriptionRequestId, writeRuntimeLog, resolveAssetSelection, ensureDir,
    runtimeRoot, runRunnerCommand,
  } = context;
  const { transcribe } = createLocalVoiceTranscription({
    nextTranscriptionRequestId,
    writeRuntimeLog, resolveAssetSelection, ensureDir, runtimeRoot, runRunnerCommand,
  });

  return { transcribe };
}

function createLocalVoiceServiceAssembly(context) {
  const warmup = assembleWarmup(context);
  const steps = assembleInstallSteps(context);
  const installer = assembleInstaller({ ...context, ...steps });
  const synthesis = assembleSynthesis(context);
  const transcription = assembleTranscription(context);
  return { ...warmup, ...installer, ...synthesis, ...transcription };
}

module.exports = { createLocalVoiceServiceAssembly };
