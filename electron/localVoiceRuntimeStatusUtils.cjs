const { createLocalVoiceHealth } = require('./localVoiceRuntimeHealth.cjs');

function normalizeModeProbeSuccess({
  candidate,
  describeRuntimeEnvironment,
  extractMissingModuleName,
  label,
  packageNames,
  parsed,
  uniqueStrings,
}) {
  const detectedPackages = Array.isArray(parsed.detected_packages) ? parsed.detected_packages : [];
  const importError = typeof parsed.import_error === 'string' ? parsed.import_error.trim() : '';
  const missingDependencyFromImport = extractMissingModuleName(importError);
  const missingPackages = uniqueStrings([
    ...(Array.isArray(parsed.missing_packages) ? parsed.missing_packages : packageNames),
    ...(missingDependencyFromImport ? [missingDependencyFromImport] : []),
  ]);
  const executable = typeof parsed.executable === 'string' ? parsed.executable : candidate.executable;
  const pythonVersion = typeof parsed.python_version === 'string' ? parsed.python_version : null;
  const device = parsed.device === 'cuda' || parsed.device === 'cpu' ? parsed.device : 'unknown';

  if (importError) {
    return {
      ok: false,
      error: importError,
    };
  }

  const runtimeDescriptor = describeRuntimeEnvironment(candidate, executable);
  return {
    ok: true,
    result: {
      available: true,
      executable,
      pythonVersion,
      runtimeLabel: runtimeDescriptor.kind,
      device,
      detectedPackages,
      missingPackages,
      messages: [
        `${label} 环境：${executable}`,
        `${label} ${runtimeDescriptor.message}`,
      ],
    },
  };
}

function buildUnavailableModeProbeResult({ buildJsonError, label, lastFailure, packageNames }) {
  return {
    available: false,
    executable: null,
    pythonVersion: null,
    runtimeLabel: null,
    device: 'unknown',
    detectedPackages: [],
    missingPackages: packageNames,
    messages: [
      lastFailure
        ? `${label} 运行环境不可用：${buildJsonError(lastFailure)}`
        : `No usable ${label} runtime was found.`,
    ],
  };
}

function createLocalVoiceRuntimeStatusUtils({
  buildJsonError,
  buildReferenceTextCacheKey,
  describeRuntimeCandidate,
  extractMissingModuleName,
  getModeRuntimeCandidates,
  readPersistedReferenceText,
  runtimeRoot,
  uniqueStrings,
}) {
  function normalizeModeProbeRuntime(options) {
    return normalizeModeProbeSuccess({
      ...options,
      extractMissingModuleName,
      uniqueStrings,
    });
  }

  const { buildLocalVoiceHealth } = createLocalVoiceHealth({
    buildReferenceTextCacheKey, readPersistedReferenceText, uniqueStrings,
    describeRuntimeCandidate, getModeRuntimeCandidates, runtimeRoot,
  });

  return {
    buildLocalVoiceHealth,
    buildUnavailableModeProbeResult(options) {
      return buildUnavailableModeProbeResult({
        ...options,
        buildJsonError,
      });
    },
    normalizeModeProbeRuntime,
  };
}

module.exports = {
  createLocalVoiceRuntimeStatusUtils,
};
