const { createLocalVoiceWorkerEnvironment } = require('./localVoiceRuntimeWorkerEnvironment.cjs');
const { createLocalVoiceWorkerProtocol } = require('./localVoiceRuntimeWorkerProtocol.cjs');

function createLocalVoiceRuntimeWorkerUtils({
  bundledPythonPath,
  describeRuntimeCandidate,
  getModeEnvDirectory,
  isPathInside,
  normalizeComparablePath,
  portableExecutableDir,
  projectRoot,
  runtimeRoot,
  splitOutputLines,
  takeTail,
}) {
  const { describeRuntimeEnvironment } = createLocalVoiceWorkerEnvironment({
    bundledPythonPath, getModeEnvDirectory, isPathInside, normalizeComparablePath,
    portableExecutableDir, projectRoot, runtimeRoot,
  });
  const { buildModeWorkerKey, buildWorkerExitReason, buildWorkerReadyLogDetails,
    buildWorkerRequestInput, buildWorkerRequestResult, createWorkerUnavailableError,
    getWorkerModeModelPath, getWorkerResponseRequestId, parseRunnerPayload,
    summarizeWorkerPayload, summarizeWorkerResponse } = createLocalVoiceWorkerProtocol({
    describeRuntimeCandidate, splitOutputLines, takeTail,
  });

  return {
    buildModeWorkerKey,
    buildWorkerExitReason,
    buildWorkerReadyLogDetails,
    buildWorkerRequestInput,
    buildWorkerRequestResult,
    createWorkerUnavailableError,
    describeRuntimeEnvironment,
    getWorkerModeModelPath,
    getWorkerResponseRequestId,
    parseRunnerPayload,
    summarizeWorkerPayload,
    summarizeWorkerResponse,
  };
}

module.exports = {
  createLocalVoiceRuntimeWorkerUtils,
};
