function ensureModeModelPath({ getModeLabel, mode, modelPath }) {
  if (!modelPath) {
    throw new Error(`${getModeLabel(mode)} model path is required.`);
  }

  return modelPath;
}

function classifyModeCandidateError({ error, isLocalVoiceCancelledError }) {
  if (typeof isLocalVoiceCancelledError === 'function' && isLocalVoiceCancelledError(error)) {
    return {
      action: 'throw',
      error,
    };
  }

  if (error?.code === 'ENOENT') {
    return {
      action: 'retry',
      error,
    };
  }

  return {
    action: 'mark-broken',
    error,
  };
}

function normalizeBaseRuntimeCandidateResult({
  candidate,
  formatSpawnFailure,
  result,
  splitOutputLines,
  takeTail,
}) {
  if (!result.ok && result.error && result.error.code === 'ENOENT') {
    return {
      status: 'retry',
      error: result.error,
    };
  }

  if (!result.ok) {
    return {
      status: 'error',
      error: new Error(formatSpawnFailure(result)),
    };
  }

  return {
    status: 'resolved',
    runtime: {
      candidate,
      executable: takeTail(splitOutputLines(result.stdout), 1)[0] || candidate.executable,
    },
  };
}

function normalizeProbeCommandResult({ formatSpawnFailure, label, result }) {
  if (!result.ok && result.error && result.error.code === 'ENOENT') {
    return {
      status: 'retry',
      error: result.error,
    };
  }

  if (!result.ok) {
    return {
      status: 'mark-broken',
      error: new Error(formatSpawnFailure(result)),
    };
  }

  const stdout = result.stdout.trim();
  if (!stdout) {
    return {
      status: 'mark-broken',
      error: new Error(`${label} health check returned no content.`),
    };
  }

  return {
    status: 'parse',
    stdout,
  };
}

function normalizeProbeRuntimeResult({
  candidate,
  describeRuntimeEnvironment,
  label,
  normalizeModeProbeRuntime,
  packageNames,
  parseJsonFromCommandOutput,
  stdout,
}) {
  try {
    const parsed = parseJsonFromCommandOutput(stdout);
    const normalizedProbe = normalizeModeProbeRuntime({
      candidate,
      describeRuntimeEnvironment,
      label,
      packageNames,
      parsed,
    });

    if (!normalizedProbe.ok) {
      return {
        status: 'mark-broken',
        error: new Error(normalizedProbe.error),
      };
    }

    return {
      status: 'resolved',
      result: normalizedProbe.result,
    };
  } catch (error) {
    return {
      status: 'mark-broken',
      error,
    };
  }
}

async function runModeCandidateLoop({
  candidates,
  createLocalVoiceCancelledError,
  executeCandidate,
  fallbackErrorMessage,
  isLocalVoiceCancelledError,
  markBrokenCandidate,
  resolveFinalFailure,
  signal,
}) {
  let lastFailure = null;

  for (const candidate of candidates) {
    if (signal?.aborted) {
      if (typeof createLocalVoiceCancelledError === 'function') {
        throw createLocalVoiceCancelledError();
      }

      throw new Error('local_voice_cancelled');
    }

    try {
      return await executeCandidate(candidate);
    } catch (error) {
      const candidateFailure = classifyModeCandidateError({
        error,
        isLocalVoiceCancelledError,
      });

      if (candidateFailure.action === 'throw') {
        throw error;
      }

      if (candidateFailure.action === 'mark-broken' && typeof markBrokenCandidate === 'function') {
        markBrokenCandidate(candidate, error);
      }

      lastFailure = error;
    }
  }

  if (typeof resolveFinalFailure === 'function') {
    return resolveFinalFailure(lastFailure);
  }

  throw lastFailure ?? new Error(fallbackErrorMessage);
}

module.exports = {
  classifyModeCandidateError,
  ensureModeModelPath,
  normalizeBaseRuntimeCandidateResult,
  normalizeProbeCommandResult,
  normalizeProbeRuntimeResult,
  runModeCandidateLoop,
};
