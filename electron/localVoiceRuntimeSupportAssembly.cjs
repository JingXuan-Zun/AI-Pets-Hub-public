const { createLocalVoiceRuntimeCandidateUtils } = require('./localVoiceRuntimeCandidateUtils.cjs');
const { createLocalVoiceRuntimeStatusUtils } = require('./localVoiceRuntimeStatusUtils.cjs');
const { createLocalVoiceRuntimeDiagnostics } = require('./localVoiceRuntimeDiagnostics.cjs');
const { createLocalVoiceRuntimeReferenceTextUtils } = require('./localVoiceRuntimeReferenceTextUtils.cjs');

function assembleCandidates(context) {
  const {
    describeRuntimeCandidate, getBrokenModeRuntimeCandidate, getModeCandidate, getModeLabel,
    getPythonCandidates, projectRoot, runtimeRoot, writeRuntimeLog,
  } = context;
  const {
    getFallbackRuntimeCandidates,
    getModeRuntimeCandidates,
  } = createLocalVoiceRuntimeCandidateUtils({
    describeRuntimeCandidate,
    getBrokenModeRuntimeCandidate,
    getModeCandidate,
    getModeLabel,
    getPythonCandidates,
    projectRoot,
    runtimeRoot,
    writeRuntimeLog,
  });
  return { getFallbackRuntimeCandidates, getModeRuntimeCandidates };
}

function assembleHealthStatus(context) {
  const {
    buildJsonError, buildReferenceTextCacheKey, describeRuntimeCandidate, extractMissingModuleName,
    getModeRuntimeCandidates, readPersistedReferenceText, runtimeRoot, uniqueStrings,
  } = context;
  const {
    buildLocalVoiceHealth,
    buildUnavailableModeProbeResult,
    normalizeModeProbeRuntime,
  } = createLocalVoiceRuntimeStatusUtils({
    buildJsonError,
    buildReferenceTextCacheKey,
    describeRuntimeCandidate,
    extractMissingModuleName,
    getModeRuntimeCandidates,
    readPersistedReferenceText,
    runtimeRoot,
    uniqueStrings,
  });
  return { buildLocalVoiceHealth, buildUnavailableModeProbeResult, normalizeModeProbeRuntime };
}

function assembleDiagnostics(context) {
  const {
    getFallbackRuntimeCandidates, getModeRuntimeCandidates, spawnCommand, runInlinePythonScript,
    getSharedOptions, describeRuntimeEnvironment, normalizeModeProbeRuntime, markBrokenModeRuntimeCandidate,
    buildUnavailableModeProbeResult, writeRuntimeLog, resolveAssetSelection, buildLocalVoiceHealth,
  } = context;
  const { resolveBasePythonRuntime, getHealth } = createLocalVoiceRuntimeDiagnostics({
    getFallbackRuntimeCandidates, getModeRuntimeCandidates,
    spawnCommand, runInlinePythonScript, getSharedOptions,
    describeRuntimeEnvironment, normalizeModeProbeRuntime,
    markBrokenModeRuntimeCandidate, buildUnavailableModeProbeResult,
    writeRuntimeLog, resolveAssetSelection, buildLocalVoiceHealth,
  });
  return { resolveBasePythonRuntime, getHealth };
}

function assembleReferenceText(context) {
  const {
    buildReferenceTextCacheKey, getConfiguredReferenceText, persistReferenceText, readPersistedReferenceText,
    referenceTextCache, writeRuntimeLog,
  } = context;
  const {
    ensureReferenceTextPrepared,
  } = createLocalVoiceRuntimeReferenceTextUtils({
    buildReferenceTextCacheKey,
    getConfiguredReferenceText,
    persistReferenceText,
    readPersistedReferenceText,
    referenceTextCache,
    writeRuntimeLog,
  });

  return { ensureReferenceTextPrepared };
}

function createLocalVoiceSupportAssembly(context) {
  const candidates = assembleCandidates(context);
  const status = assembleHealthStatus({ ...context, ...candidates });
  const diagnostics = assembleDiagnostics({ ...context, ...candidates, ...status });
  const referenceText = assembleReferenceText(context);
  return { ...candidates, ...diagnostics, ...referenceText };
}

module.exports = { createLocalVoiceSupportAssembly };
