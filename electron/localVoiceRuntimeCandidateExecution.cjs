const { ensureModeModelPath, runModeCandidateLoop } = require('./localVoiceRuntimeExecutionUtils.cjs');
const { createLocalVoiceCancelledError, isLocalVoiceCancelledError } = require('./localVoiceRuntimeProcessUtils.cjs');

async function warmupModeWorker(context, settings, mode, modelPath) {
  const { getModeRuntimeCandidates, getModeLabel, ensureModeWorker,
  clearBrokenModeRuntimeCandidate, markBrokenModeRuntimeCandidate } = context;
  const candidates = getModeRuntimeCandidates(settings, mode);
  ensureModeModelPath({ getModeLabel, mode, modelPath });
  return runModeCandidateLoop({
    candidates,
    executeCandidate: async (candidate) => {
      const worker = await ensureModeWorker(candidate, mode, modelPath);
      clearBrokenModeRuntimeCandidate(mode, candidate);
      return worker;
    },
    fallbackErrorMessage: `${getModeLabel(mode)} worker warmup failed.`,
    markBrokenCandidate: (candidate, error) => {
      markBrokenModeRuntimeCandidate(mode, candidate, error);
    },
  });
}

async function runRunnerCommand(context, { settings, mode, extraArgs, signal }) {
  const { getModeRuntimeCandidates, parseRunnerPayload, getWorkerModeModelPath,
  getModeLabel, acquireModeWorker, clearBrokenModeRuntimeCandidate,
  requestModeWorker, markBrokenModeRuntimeCandidate } = context;
  const candidates = getModeRuntimeCandidates(settings, mode);
  const requestPayload = parseRunnerPayload(extraArgs);
  const modelPath = getWorkerModeModelPath(mode, requestPayload);
  ensureModeModelPath({ getModeLabel, mode, modelPath });
  return runModeCandidateLoop({
    candidates,
    createLocalVoiceCancelledError,
    executeCandidate: async (candidate) => {
      const workerAssignment = await acquireModeWorker(candidate, mode, modelPath, signal);
      clearBrokenModeRuntimeCandidate(mode, candidate);
      try {
        return await requestModeWorker(workerAssignment.worker, requestPayload, signal);
      } finally {
        workerAssignment.release();
      }
    },
    fallbackErrorMessage: 'Local voice runner is unavailable.',
    isLocalVoiceCancelledError,
    markBrokenCandidate: (candidate, error) => {
      markBrokenModeRuntimeCandidate(mode, candidate, error);
    },
    signal,
  });
}

function createLocalVoiceCandidateExecution(context) {
  return {
    warmupModeWorker: warmupModeWorker.bind(null, context),
    runRunnerCommand: runRunnerCommand.bind(null, context),
  };
}

module.exports = { createLocalVoiceCandidateExecution };
