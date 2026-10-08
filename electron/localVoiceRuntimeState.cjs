function createLocalVoiceRuntimeState({
  now = () => Date.now(),
  createAbortController = () => new AbortController(),
} = {}) {
  const referenceTextCache = new Map();
  const modeWorkerPool = new Map();
  const brokenModeRuntimeCandidates = new Map();
  const activeSynthesisRequests = new Map();
  let synthesisSequence = 0;
  let transcriptionSequence = 0;

  function createSynthesisRequest() {
    const synthesisRequest = {
      id: `tts-${++synthesisSequence}`,
      controller: createAbortController(),
      cancelReason: 'active',
      startedAt: now(),
    };
    activeSynthesisRequests.set(synthesisRequest.id, synthesisRequest);
    return synthesisRequest;
  }

  return {
    referenceTextCache, modeWorkerPool, brokenModeRuntimeCandidates, activeSynthesisRequests,
    createSynthesisRequest,
    nextTranscriptionRequestId: () => `stt-${++transcriptionSequence}`,
  };
}

module.exports = { createLocalVoiceRuntimeState };
