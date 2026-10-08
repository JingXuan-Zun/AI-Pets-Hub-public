const { buildWarmupResult, buildWarmupStartLogDetails, resolveWarmupPlan,
  shouldWarmTtsInference } = require('./localVoiceRuntimeWarmupUtils.cjs');
const { buildFailureLogDetails, buildPromptWarmupSuccessLogDetails,
  buildReferenceTextPreparedLogDetails, buildSkipReasonLogDetails,
  buildTtsWarmupPayload, buildWarmupWorkerLogDetails,
  getLocalVoiceLanguageCode } = require('./localVoiceRuntimeRequestUtils.cjs');
const { buildJsonError } = require('./localVoiceRuntimeProcessUtils.cjs');

function createWarmupState(context, settings) {
  const safeSettings = settings ?? {};
  const requestId = `warmup-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const assetSelection = context.resolveAssetSelection(safeSettings);
  const warmedModes = new Set();
  const referenceTextInfo = context.getConfiguredReferenceText(safeSettings, assetSelection);
  const warmupPlan = resolveWarmupPlan({ assetSelection, referenceTextInfo, safeSettings });
  return { safeSettings, requestId, assetSelection, warmedModes, referenceTextInfo, warmupPlan,
    warmedTtsWorker: null, ok: false, ttsInferenceReady: false };
}

function logWarmupStart(state, writeRuntimeLog) {
  writeRuntimeLog('Starting local voice warmup', buildWarmupStartLogDetails(state));
  if (state.warmupPlan.shouldSkipTtsWorker) {
    writeRuntimeLog('Local TTS warmup skipped', { requestId: state.requestId, reason: 'missing_tts_model' });
  }
  if (state.warmupPlan.shouldSkipSttWorker) {
    writeRuntimeLog('Local STT warmup skipped', { requestId: state.requestId, reason: 'missing_stt_model' });
  }
}

function logWarmupFailure(message, error, state, writeRuntimeLog) {
  writeRuntimeLog(message, buildFailureLogDetails({ errorText: buildJsonError(error), requestId: state.requestId }));
}

function startModeWarmup(mode, state, context) {
  const modelKey = mode === 'tts' ? 'ttsModel' : 'sttModel';
  return context.warmupModeWorker(state.safeSettings, mode, state.assetSelection[modelKey].path)
    .then((worker) => {
      if (mode === 'tts') state.warmedTtsWorker = worker;
      state.warmedModes.add(mode);
      state.ok = true;
      context.writeRuntimeLog(`Local ${mode.toUpperCase()} worker warmed`, buildWarmupWorkerLogDetails({
        modelPath: state.assetSelection[modelKey].path, requestId: state.requestId,
      }));
    })
    .catch((error) => logWarmupFailure(`Local ${mode.toUpperCase()} warmup failed`, error, state, context.writeRuntimeLog));
}

function startWorkerWarmups(state, context) {
  const tasks = [];
  if (state.warmupPlan.shouldWarmTtsWorker) tasks.push(startModeWarmup('tts', state, context));
  if (state.warmupPlan.shouldWarmSttWorker) tasks.push(startModeWarmup('stt', state, context));
  return tasks;
}

function completeReferencePreparation(referenceTextInfo, state, writeRuntimeLog) {
  state.referenceTextInfo = referenceTextInfo;
  state.ok = state.ok || Boolean(referenceTextInfo.referenceText);
  writeRuntimeLog('Local voice reference text prepared', buildReferenceTextPreparedLogDetails({
    referenceTextInfo, requestId: state.requestId,
  }));
}

function buildInferencePayload(state) {
  return buildTtsWarmupPayload({ assetSelection: state.assetSelection,
    languageCode: getLocalVoiceLanguageCode(state.safeSettings), referenceText: state.referenceTextInfo.referenceText });
}

function completeInferenceWarmup(result, state, writeRuntimeLog) {
  if (!result?.ok || !result?.parsed?.ok) throw new Error(result?.parsed?.error || 'tts_prompt_warmup_failed');
  state.ttsInferenceReady = true;
  state.ok = true;
  writeRuntimeLog('Local TTS prompt warmed', buildPromptWarmupSuccessLogDetails({
    parsed: result.parsed, requestId: state.requestId,
  }));
}

async function warmup(context, settings) {
  const state = createWarmupState(context, settings);
  const { writeRuntimeLog, ensureReferenceTextPrepared, runRunnerCommand, requestModeWorker } = context;
  logWarmupStart(state, writeRuntimeLog);
  const tasks = startWorkerWarmups(state, context);
  if (tasks.length > 0) await Promise.all(tasks);
  if (state.warmupPlan.shouldPrepareReferenceText) {
    try {
      const referenceTextInfo = await ensureReferenceTextPrepared({
        settings: state.safeSettings, assetSelection: state.assetSelection,
        requestId: state.requestId, purpose: 'warmup', runRunnerCommand,
      });
      completeReferencePreparation(referenceTextInfo, state, writeRuntimeLog);
    } catch (error) {
      logWarmupFailure('Local voice reference text warmup failed', error, state, writeRuntimeLog);
    }
  } else if (state.warmupPlan.referenceTextWarmupSkipReason) {
    writeRuntimeLog('Local voice reference text warmup skipped', buildSkipReasonLogDetails({
      reason: state.warmupPlan.referenceTextWarmupSkipReason, requestId: state.requestId,
    }));
  }
  if (shouldWarmTtsInference(state)) {
    try {
      const result = await requestModeWorker(state.warmedTtsWorker, buildInferencePayload(state));
      completeInferenceWarmup(result, state, writeRuntimeLog);
    } catch (error) {
      logWarmupFailure('Local TTS prompt warmup failed', error, state, writeRuntimeLog);
    }
  }
  const result = buildWarmupResult(state);
  writeRuntimeLog('Local voice warmup completed', { requestId: state.requestId, ...result });
  return result;
}

function createLocalVoiceRuntimeWarmup(context) {
  return { warmup: warmup.bind(null, context) };
}

module.exports = { createLocalVoiceRuntimeWarmup };
