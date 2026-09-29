function readRuntimePathSetting(settings) {
  return typeof settings?.localVoiceRuntimePath === 'string'
    ? settings.localVoiceRuntimePath.trim()
    : '';
}

function createLocalVoiceRuntimeCandidateUtils({
  describeRuntimeCandidate,
  getBrokenModeRuntimeCandidate,
  getModeCandidate,
  getModeLabel,
  getPythonCandidates,
  projectRoot,
  runtimeRoot,
  writeRuntimeLog,
}) {
  function getFallbackRuntimeCandidates(settings) {
    return getPythonCandidates(readRuntimePathSetting(settings), { projectRoot });
  }

  function getModeRuntimeCandidates(settings, mode) {
    const dedicatedCandidate = getModeCandidate(runtimeRoot, mode);
    const fallbackCandidates = getFallbackRuntimeCandidates(settings);
    const candidates = dedicatedCandidate
      ? [dedicatedCandidate, ...fallbackCandidates]
      : fallbackCandidates;

    return candidates.filter((candidate) => {
      const brokenCandidate = getBrokenModeRuntimeCandidate(mode, candidate);
      if (!brokenCandidate) {
        return true;
      }

      writeRuntimeLog(`${getModeLabel(mode)} skipping broken runtime candidate`, {
        candidate: describeRuntimeCandidate(candidate),
        error: brokenCandidate.message,
      });
      return false;
    });
  }

  return {
    getFallbackRuntimeCandidates,
    getModeRuntimeCandidates,
  };
}

module.exports = {
  createLocalVoiceRuntimeCandidateUtils,
};
