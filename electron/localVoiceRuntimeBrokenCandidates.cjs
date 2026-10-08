function buildModeRuntimeCandidateKey(context, mode, candidate) {
  const { describeRuntimeCandidate } = context;
  return `${mode}::${describeRuntimeCandidate(candidate)}`;
}

function clearBrokenModeRuntimeCandidate(context, mode, candidate) {
  const { brokenModeRuntimeCandidates } = context;
  brokenModeRuntimeCandidates.delete(buildModeRuntimeCandidateKey(context, mode, candidate));
}

function markBrokenModeRuntimeCandidate(context, mode, candidate, error) {
  const { brokenModeRuntimeCandidates, buildJsonError } = context;
  if (!candidate?.label || !String(candidate.label).startsWith('venv-')) {
    return;
  }

  brokenModeRuntimeCandidates.set(buildModeRuntimeCandidateKey(context, mode, candidate), {
    message: buildJsonError(error),
    recordedAt: Date.now(),
  });
}

function getBrokenModeRuntimeCandidate(context, mode, candidate) {
  const { brokenModeRuntimeCandidates } = context;
  return brokenModeRuntimeCandidates.get(buildModeRuntimeCandidateKey(context, mode, candidate)) ?? null;
}

function createLocalVoiceBrokenCandidates(context) {
  return {
    buildModeRuntimeCandidateKey: buildModeRuntimeCandidateKey.bind(null, context),
    clearBrokenModeRuntimeCandidate: clearBrokenModeRuntimeCandidate.bind(null, context),
    markBrokenModeRuntimeCandidate: markBrokenModeRuntimeCandidate.bind(null, context),
    getBrokenModeRuntimeCandidate: getBrokenModeRuntimeCandidate.bind(null, context),
  };
}

module.exports = { createLocalVoiceBrokenCandidates };
