const { buildFailureLogDetails, buildPersistGeneratedAudioInput, buildSynthesisCacheKeyInput,
  buildSynthesisCancelledLogDetails, buildSynthesisOutput, buildSynthesisRunnerArgs,
  buildSynthesisStartLogDetails, buildSynthesisSuccessLogDetails, ensureSynthesisAssetSelection,
  getLocalVoiceLanguageCode, normalizeSynthesisSeed, resolveRunnerAudioFilePath,
} = require('./localVoiceRuntimeRequestUtils.cjs');
const { buildJsonError, createLocalVoiceCancelledError, isLocalVoiceCancelledError } = require('./localVoiceRuntimeProcessUtils.cjs');
const { isPathInside } = require('./localVoiceRuntimePathUtils.cjs');

function startSynthesis(context, synthesisRequest, text, settings, seed) {
  const { activeSynthesisRequests, writeRuntimeLog, cleanupGeneratedAudioCacheBeforeSynthesize } = context;
  const signal = synthesisRequest.controller.signal;
  const safeSettings = settings ?? {};
  const normalizedSeed = normalizeSynthesisSeed(seed);
  const languageCode = getLocalVoiceLanguageCode(safeSettings);
  writeRuntimeLog(
    'Starting local voice synthesis',
    buildSynthesisStartLogDetails({
      activeRequestCount: activeSynthesisRequests.size,
      normalizedSeed,
      requestId: synthesisRequest.id,
      text,
    }),
  );
  cleanupGeneratedAudioCacheBeforeSynthesize();

  return { synthesisRequest, signal, safeSettings, normalizedSeed, languageCode, text };
}

async function prepareSynthesis(context, state) {
  const { resolveAssetSelection, ensureReferenceTextPrepared, runRunnerCommand,
    buildGeneratedAudioCacheKey, resolveGeneratedAudioCacheHit, getGeneratedAudioCacheFilePath } = context;
  const { safeSettings, signal, synthesisRequest, languageCode, normalizedSeed, text } = state;
  const assetSelection = resolveAssetSelection(safeSettings);
  ensureSynthesisAssetSelection(assetSelection);

  const referenceTextInfo = await ensureReferenceTextPrepared({
    settings: safeSettings,
    assetSelection,
    signal,
    requestId: synthesisRequest.id,
    runRunnerCommand,
  });
  const referenceText = referenceTextInfo.referenceText;

  const cacheKey = buildGeneratedAudioCacheKey(buildSynthesisCacheKeyInput({
    assetSelection,
    languageCode,
    normalizedSeed,
    referenceText,
    text,
  }));
  const cachedOutput = resolveGeneratedAudioCacheHit(cacheKey, synthesisRequest.id);
  if (cachedOutput) {
    return { cachedOutput };
  }
  const outputAudioPath = getGeneratedAudioCacheFilePath(cacheKey);

  return { assetSelection, referenceText, cacheKey, outputAudioPath };
}

async function runSynthesis(context, state, prepared) {
  const { runRunnerCommand } = context;
  const { safeSettings, signal, languageCode, normalizedSeed, text } = state;
  const { assetSelection, referenceText, outputAudioPath } = prepared;
  const ttsExtraArgs = buildSynthesisRunnerArgs({
    assetSelection,
    languageCode,
    normalizedSeed,
    outputAudioPath,
    referenceText,
    text,
  });

  const result = await runRunnerCommand({
    settings: safeSettings,
    mode: 'tts',
    extraArgs: ttsExtraArgs,
    signal,
  });

  if (!result.ok || !result.parsed?.ok) {
    throw new Error(result.parsed?.error || 'Local TTS synthesis failed.');
  }

  return result;
}

function persistSynthesis(context, state, prepared, result) {
  const { generatedAudioCacheRoot, persistGeneratedAudioCache } = context;
  const { synthesisRequest, languageCode, normalizedSeed, text } = state;
  const { assetSelection, referenceText, cacheKey } = prepared;
  const mimeType = result.parsed.mime_type || 'audio/wav';
  const runnerAudioFilePath = resolveRunnerAudioFilePath(
    result.parsed.audio_file_path,
    generatedAudioCacheRoot,
    isPathInside,
  );
  const persistedAudio = persistGeneratedAudioCache(buildPersistGeneratedAudioInput({
    assetSelection,
    audioBase64: result.parsed.audio_base64,
    cacheKey,
    languageCode,
    mimeType,
    normalizedSeed,
    referenceText,
    requestId: synthesisRequest.id,
    runnerAudioFilePath,
    text,
  }));
  const output = buildSynthesisOutput({
    cacheKey,
    mimeType,
    parsed: result.parsed,
    persistedAudio,
  });

  return output;
}

function finishSynthesis(context, state, prepared, output) {
  const { activeSynthesisRequests, writeRuntimeLog } = context;
  const { synthesisRequest } = state;
  const { cacheKey } = prepared;
  writeRuntimeLog(
    'Local voice synthesis completed',
    buildSynthesisSuccessLogDetails({
      activeRequestCount: activeSynthesisRequests.size,
      cacheKey,
      elapsedMs: Date.now() - synthesisRequest.startedAt,
      output,
      requestId: synthesisRequest.id,
    }),
  );
  return output;
}

function failSynthesis(context, synthesisRequest, error) {
  const { activeSynthesisRequests, writeRuntimeLog } = context;
  if (isLocalVoiceCancelledError(error)) {
    writeRuntimeLog(
      'Local voice synthesis cancelled',
      buildSynthesisCancelledLogDetails({
        activeRequestCount: activeSynthesisRequests.size,
        elapsedMs: Date.now() - synthesisRequest.startedAt,
        reason: synthesisRequest.cancelReason,
        requestId: synthesisRequest.id,
      }),
    );
    throw createLocalVoiceCancelledError();
  }

  writeRuntimeLog(
    'Local voice synthesis failed',
    buildFailureLogDetails({
      activeRequestCount: activeSynthesisRequests.size,
      elapsedMs: Date.now() - synthesisRequest.startedAt,
      errorText: buildJsonError(error),
      requestId: synthesisRequest.id,
    }),
  );
  throw error;
}

async function synthesize(context, { text, settings, seed }) {
  const synthesisRequest = context.createSynthesisRequest();
  const state = startSynthesis(context, synthesisRequest, text, settings, seed);
  try {
    const prepared = await prepareSynthesis(context, state);
    if (prepared.cachedOutput) return prepared.cachedOutput;
    const result = await runSynthesis(context, state, prepared);
    const output = persistSynthesis(context, state, prepared, result);
    return finishSynthesis(context, state, prepared, output);
  } catch (error) {
    return failSynthesis(context, synthesisRequest, error);
  } finally {
    context.activeSynthesisRequests.delete(synthesisRequest.id);
  }
}

function createLocalVoiceSynthesis(context) {
  return { synthesize: (input) => synthesize(context, input) };
}

module.exports = { createLocalVoiceSynthesis };
