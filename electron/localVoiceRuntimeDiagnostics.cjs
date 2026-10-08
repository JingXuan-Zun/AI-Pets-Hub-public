const { normalizeBaseRuntimeCandidateResult, normalizeProbeCommandResult,
  normalizeProbeRuntimeResult, runModeCandidateLoop } = require('./localVoiceRuntimeExecutionUtils.cjs');
const { buildProbeScript, getModePackages, getModeLabel } = require('./localVoiceRuntimeModeUtils.cjs');
const { formatSpawnFailure, splitOutputLines, takeTail,
  parseJsonFromCommandOutput } = require('./localVoiceRuntimeCommandUtils.cjs');

async function executeBaseCandidate(candidate, context) {
  const { spawnCommand, getSharedOptions } = context;
  const result = await spawnCommand(candidate, ['-c', 'import sys; print(sys.executable)'], getSharedOptions());
  const normalizedResult = normalizeBaseRuntimeCandidateResult({
    candidate, formatSpawnFailure, result, splitOutputLines, takeTail,
  });
  if (normalizedResult.status !== 'resolved') throw normalizedResult.error;
  return normalizedResult.runtime;
}

async function resolveBasePythonRuntime(context, settings) {
  const candidates = context.getFallbackRuntimeCandidates(settings);
  return runModeCandidateLoop({
    candidates,
    executeCandidate: (candidate) => executeBaseCandidate(candidate, context),
    fallbackErrorMessage: 'No usable Python runtime found.',
  });
}

async function executeProbeCandidate(candidate, label, packageNames, probeScript, context) {
  const { runInlinePythonScript, getSharedOptions, describeRuntimeEnvironment, normalizeModeProbeRuntime } = context;
  const result = await runInlinePythonScript(candidate, probeScript, getSharedOptions());
  const normalizedCommand = normalizeProbeCommandResult({ formatSpawnFailure, label, result });
  if (normalizedCommand.status !== 'parse') throw normalizedCommand.error;
  const normalizedProbe = normalizeProbeRuntimeResult({
    candidate, describeRuntimeEnvironment, label, normalizeModeProbeRuntime,
    packageNames, parseJsonFromCommandOutput, stdout: normalizedCommand.stdout,
  });
  if (normalizedProbe.status !== 'resolved') throw normalizedProbe.error;
  return normalizedProbe.result;
}

async function probeModeRuntime(context, settings, mode) {
  const { getModeRuntimeCandidates, markBrokenModeRuntimeCandidate, buildUnavailableModeProbeResult } = context;
  const label = getModeLabel(mode);
  const packageNames = getModePackages(mode);
  const candidates = getModeRuntimeCandidates(settings, mode);
  const probeScript = buildProbeScript(mode, packageNames);
  return runModeCandidateLoop({
    candidates,
    executeCandidate: (candidate) => executeProbeCandidate(candidate, label, packageNames, probeScript, context),
    fallbackErrorMessage: `${label} runtime probe unavailable.`,
    markBrokenCandidate: (candidate, error) => markBrokenModeRuntimeCandidate(mode, candidate, error),
    resolveFinalFailure: (lastFailure) => buildUnavailableModeProbeResult({ label, lastFailure, packageNames }),
  });
}

async function getHealth(context, settings) {
  const { writeRuntimeLog, resolveAssetSelection, buildLocalVoiceHealth, probeModeRuntime } = context;
  const safeSettings = settings ?? {};
  writeRuntimeLog('Checking local voice runtime health');
  const assetSelection = resolveAssetSelection(safeSettings);
  const ttsRuntime = await probeModeRuntime(safeSettings, 'tts');
  const sttRuntime = await probeModeRuntime(safeSettings, 'stt');
  const health = buildLocalVoiceHealth({ assetSelection, safeSettings, sttRuntime, ttsRuntime });
  writeRuntimeLog('Local voice runtime health check completed', {
    status: health.status,
    executable: health.executable,
    missingPackages: health.missingPackages.length,
  });
  return health;
}

function createLocalVoiceRuntimeDiagnostics(context) {
  const probe = probeModeRuntime.bind(null, context);
  return {
    resolveBasePythonRuntime: resolveBasePythonRuntime.bind(null, context),
    probeModeRuntime: probe,
    getHealth: getHealth.bind(null, { ...context, probeModeRuntime: probe }),
  };
}

module.exports = { createLocalVoiceRuntimeDiagnostics };
