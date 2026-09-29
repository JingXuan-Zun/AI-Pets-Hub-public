const DEFAULT_LANGUAGE_CODE = 'zh-CN';

function getLocalVoiceLanguageCode(settings) {
  const configuredCode = typeof settings?.speechRecognitionLang === 'string'
    ? settings.speechRecognitionLang.trim()
    : '';
  return configuredCode || DEFAULT_LANGUAGE_CODE;
}

function normalizeSynthesisSeed(seed) {
  const numericSeed = Number(seed);
  return Number.isFinite(numericSeed) ? Math.trunc(numericSeed) : null;
}

function buildSynthesisStartLogDetails({ activeRequestCount, normalizedSeed, requestId, text }) {
  return {
    requestId,
    textLength: typeof text === 'string' ? text.length : 0,
    seed: normalizedSeed,
    activeRequestCount,
  };
}

function ensureSynthesisAssetSelection(assetSelection) {
  if (!assetSelection?.ttsModel) {
    throw new Error('Local TTS model is not selected.');
  }
  if (!assetSelection.reference) {
    throw new Error('Local TTS reference is not selected.');
  }
  if (!assetSelection.referenceAudioPath) {
    throw new Error('No usable audio file was found in the selected reference set.');
  }
}

function pushOptionalArg(args, flag, value) {
  if (typeof value === 'string' && value.trim()) {
    args.push(flag, value);
  }
}

function buildTtsWarmupPayload({ assetSelection, languageCode, referenceText }) {
  ensureSynthesisAssetSelection(assetSelection);
  return {
    prime_only: true,
    tts_model_path: assetSelection.ttsModel.path,
    reference_path: assetSelection.reference.path,
    reference_audio_path: assetSelection.referenceAudioPath,
    reference_text: referenceText,
    reference_stt_model_path: assetSelection.sttModel?.path || '',
    language_code: languageCode,
  };
}

function buildSynthesisCacheKeyInput({
  assetSelection,
  languageCode,
  normalizedSeed,
  referenceText,
  text,
}) {
  ensureSynthesisAssetSelection(assetSelection);
  return {
    text,
    languageCode,
    seed: normalizedSeed,
    ttsModelPath: assetSelection.ttsModel.path,
    referencePath: assetSelection.reference.path,
    referenceAudioPath: assetSelection.referenceAudioPath,
    referenceText,
    referenceSttModelPath: assetSelection.sttModel?.path || '',
  };
}

function buildSynthesisRunnerArgs({
  assetSelection,
  languageCode,
  normalizedSeed,
  outputAudioPath,
  referenceText,
  text,
}) {
  ensureSynthesisAssetSelection(assetSelection);
  const args = [
    '--text', text,
    '--tts-model-path', assetSelection.ttsModel.path,
    '--reference-path', assetSelection.reference.path,
    '--reference-audio-path', assetSelection.referenceAudioPath,
    '--language-code', languageCode,
  ];
  pushOptionalArg(args, '--output-audio-path', outputAudioPath || '');
  pushOptionalArg(args, '--seed', normalizedSeed === null ? '' : String(normalizedSeed));
  pushOptionalArg(args, '--reference-text', referenceText);
  pushOptionalArg(args, '--reference-stt-model-path', assetSelection.sttModel?.path || '');
  return args;
}

function resolveRunnerAudioFilePath(audioFilePath, generatedAudioCacheRoot, isPathInside) {
  const normalizedAudioFilePath = typeof audioFilePath === 'string' ? audioFilePath.trim() : '';
  if (!normalizedAudioFilePath) {
    return null;
  }
  if (!isPathInside(normalizedAudioFilePath, generatedAudioCacheRoot)) {
    return null;
  }
  return normalizedAudioFilePath;
}

function buildPersistGeneratedAudioInput({
  assetSelection,
  audioBase64,
  cacheKey,
  languageCode,
  mimeType,
  normalizedSeed,
  referenceText,
  requestId,
  runnerAudioFilePath,
  text,
}) {
  ensureSynthesisAssetSelection(assetSelection);
  return {
    audioBase64,
    audioFilePath: runnerAudioFilePath,
    cacheKey,
    languageCode,
    mimeType,
    seed: normalizedSeed,
    referenceAudioPath: assetSelection.referenceAudioPath,
    referencePath: assetSelection.reference.path,
    referenceSttModelPath: assetSelection.sttModel?.path || '',
    referenceText,
    requestId,
    text,
    ttsModelPath: assetSelection.ttsModel.path,
  };
}

function buildSynthesisOutput({ cacheKey, mimeType, parsed, persistedAudio }) {
  return {
    audioBase64: persistedAudio.audioFileUrl ? '' : parsed.audio_base64,
    mimeType,
    audioFilePath: persistedAudio.audioFilePath,
    audioFileUrl: persistedAudio.audioFileUrl,
    cacheHit: false,
    cacheKey,
    promptCacheHit: Boolean(parsed.prompt_cache_hit),
  };
}

function buildSynthesisSuccessLogDetails({ activeRequestCount, cacheKey, elapsedMs, output, requestId }) {
  return {
    requestId,
    mimeType: output.mimeType,
    cacheKey,
    cacheStored: Boolean(output.audioFilePath),
    activeRequestCount,
    elapsedMs,
  };
}

function buildWarmupWorkerLogDetails({ modelPath, requestId }) {
  return {
    requestId,
    modelPath,
  };
}

function buildReferenceTextPreparedLogDetails({ referenceTextInfo, requestId }) {
  return {
    requestId,
    source: referenceTextInfo.source,
    textLength: referenceTextInfo.referenceText.length,
  };
}

function buildSkipReasonLogDetails({ reason, requestId }) {
  return {
    requestId,
    reason,
  };
}

function buildPromptWarmupSuccessLogDetails({ parsed, requestId }) {
  return {
    requestId,
    runtimeDevice: parsed?.runtime_device || null,
    runtimeDtype: parsed?.runtime_dtype || null,
    attnImplementation: parsed?.attn_implementation || null,
    promptCacheHit: Boolean(parsed?.prompt_cache_hit),
  };
}

function buildFailureLogDetails({ activeRequestCount, elapsedMs, errorText, requestId }) {
  return {
    requestId,
    error: errorText,
    ...(Number.isFinite(activeRequestCount) ? { activeRequestCount } : {}),
    ...(Number.isFinite(elapsedMs) ? { elapsedMs } : {}),
  };
}

function buildSynthesisCancelledLogDetails({ activeRequestCount, elapsedMs, reason, requestId }) {
  return {
    requestId,
    reason,
    activeRequestCount,
    elapsedMs,
  };
}

function buildTranscriptionStartLogDetails({ audioBase64, requestId }) {
  return {
    requestId,
    audioBytes: typeof audioBase64 === 'string' ? audioBase64.length : 0,
  };
}

function ensureTranscriptionAssetSelection(assetSelection) {
  if (!assetSelection?.sttModel) {
    throw new Error('Local STT model is not selected.');
  }
}

function buildTranscriptionRunnerArgs({ audioPath, languageCode, sttModelPath }) {
  return [
    '--audio-path', audioPath,
    '--stt-model-path', sttModelPath,
    '--language-code', languageCode,
  ];
}

function buildTranscriptionOutput(parsed) {
  return {
    text: String(parsed?.text || '').trim(),
  };
}

function buildTranscriptionSuccessLogDetails({ output, requestId }) {
  return {
    requestId,
    textLength: output.text.length,
  };
}

module.exports = {
  buildFailureLogDetails,
  buildPersistGeneratedAudioInput,
  buildPromptWarmupSuccessLogDetails,
  buildReferenceTextPreparedLogDetails,
  buildSkipReasonLogDetails,
  buildSynthesisCacheKeyInput,
  buildSynthesisCancelledLogDetails,
  buildSynthesisOutput,
  buildSynthesisRunnerArgs,
  buildSynthesisStartLogDetails,
  buildSynthesisSuccessLogDetails,
  buildTranscriptionOutput,
  buildTranscriptionRunnerArgs,
  buildTranscriptionStartLogDetails,
  buildTranscriptionSuccessLogDetails,
  buildTtsWarmupPayload,
  buildWarmupWorkerLogDetails,
  ensureSynthesisAssetSelection,
  ensureTranscriptionAssetSelection,
  getLocalVoiceLanguageCode,
  normalizeSynthesisSeed,
  resolveRunnerAudioFilePath,
};
