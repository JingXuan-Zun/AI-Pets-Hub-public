function resolveRuntimeSummary({ safeSettings, sttRuntime, ttsRuntime, uniqueStrings }) {
  const { activeModes, requireStt, requireTts } = resolveActiveModes(safeSettings);
  const runtimeMap = {
    tts: ttsRuntime,
    stt: sttRuntime,
  };
  const relevantRuntimes = activeModes.map((mode) => runtimeMap[mode]);
  const anyRuntimeAvailable = relevantRuntimes.some((runtime) => runtime.available);
  const missingPackages = uniqueStrings(relevantRuntimes.flatMap((runtime) => runtime.missingPackages));
  const detectedPackages = uniqueStrings(relevantRuntimes.flatMap((runtime) => runtime.detectedPackages));
  return { requireStt, requireTts, anyRuntimeAvailable, missingPackages, detectedPackages };
}

function resolveReferenceTextReady(assetSelection, persistedReferenceText, safeSettings) {
  return Boolean(
    (safeSettings.localVoiceReferenceText || '').trim()
    || assetSelection.referenceTextFromFiles.trim()
    || (assetSelection.referenceTextFromAudioFileName || '').trim()
    || assetSelection.referenceAudioPath
    || persistedReferenceText,
  );
}

function resolveActiveModes(safeSettings) {
  const requireTts = safeSettings.ttsProvider === 'local';
  const requireStt = safeSettings.sttProvider === 'local';
  const activeModes = requireTts || requireStt
    ? [requireTts ? 'tts' : null, requireStt ? 'stt' : null].filter(Boolean)
    : ['tts', 'stt'];

  return {
    activeModes,
    requireStt,
    requireTts,
  };
}

function resolveCombinedDevice(ttsRuntime, sttRuntime) {
  if (ttsRuntime.device === 'cuda' || sttRuntime.device === 'cuda') {
    return 'cuda';
  }

  return ttsRuntime.device === 'cpu' || sttRuntime.device === 'cpu'
    ? 'cpu'
    : 'unknown';
}

function resolveHealthMessages({
  assetSelection,
  anyRuntimeAvailable,
  describeRuntimeCandidate,
  getModeRuntimeCandidates,
  referenceTextReady,
  requireStt,
  requireTts,
  runtimeRoot,
  safeSettings,
  sttRuntime,
  ttsRuntime,
  uniqueStrings,
}) {
  const messages = uniqueStrings([
    ...ttsRuntime.messages,
    ...sttRuntime.messages,
  ]);

  if (!anyRuntimeAvailable) {
    messages.push(`当前本地语音环境目录：${runtimeRoot}`);
    messages.push(`TTS 已尝试：${getModeRuntimeCandidates(safeSettings, 'tts').map(describeRuntimeCandidate).join(' | ')}`);
    messages.push(`STT 已尝试：${getModeRuntimeCandidates(safeSettings, 'stt').map(describeRuntimeCandidate).join(' | ')}`);
  }

  if (!assetSelection.catalog.rootPath) {
    messages.push('local-models/voice directory was not found.');
  }
  if (requireTts && !assetSelection.ttsModel) {
    messages.push('Local TTS model is not selected yet.');
  }
  if (requireTts && !assetSelection.reference) {
    messages.push('Local TTS reference audio is not selected yet.');
  }
  if (requireTts && assetSelection.reference && !referenceTextReady) {
    messages.push('Local TTS reference audio is available, but no transcript was found. Qwen TTS will use speaker embedding only mode.');
  }
  if (requireStt && !assetSelection.sttModel) {
    messages.push('Local STT model is not selected yet.');
  }

  return messages;
}

function resolveHealthReadiness({ ttsRuntime, sttRuntime, assetSelection,
  referenceTextReady, anyRuntimeAvailable, missingPackages }) {
  const ttsReady = Boolean(
    ttsRuntime.available
    && ttsRuntime.missingPackages.length === 0
    && assetSelection.ttsModel
    && assetSelection.reference
    && referenceTextReady,
  );
  const sttReady = Boolean(
    sttRuntime.available
    && sttRuntime.missingPackages.length === 0
    && assetSelection.sttModel,
  );
  const status = !anyRuntimeAvailable
    ? 'missing-runtime'
    : missingPackages.length > 0
      ? 'missing-dependencies'
      : (ttsReady || sttReady ? 'ready' : 'missing-assets');
  const chosenRuntime = ttsRuntime.executable
    ? ttsRuntime
    : sttRuntime.executable
      ? sttRuntime
      : null;

  return { ttsReady, sttReady, status, chosenRuntime };
}

function buildLocalVoiceHealth(context, { assetSelection, safeSettings, sttRuntime, ttsRuntime }) {
  const { buildReferenceTextCacheKey, readPersistedReferenceText, uniqueStrings,
    describeRuntimeCandidate, getModeRuntimeCandidates, runtimeRoot } = context;
  const referenceCacheKey = buildReferenceTextCacheKey(
    assetSelection.referenceAudioPath,
    assetSelection.sttModel?.path || '',
    safeSettings.speechRecognitionLang || 'zh-CN',
  );
  const persistedReferenceText = readPersistedReferenceText(referenceCacheKey);
  const referenceTextReady = resolveReferenceTextReady(assetSelection, persistedReferenceText, safeSettings);
  const { requireStt, requireTts, anyRuntimeAvailable, missingPackages, detectedPackages } = resolveRuntimeSummary({
    safeSettings, sttRuntime, ttsRuntime, uniqueStrings,
  });
  const messages = resolveHealthMessages({
    assetSelection,
    anyRuntimeAvailable,
    describeRuntimeCandidate,
    getModeRuntimeCandidates,
    referenceTextReady,
    requireStt,
    requireTts,
    runtimeRoot,
    safeSettings,
    sttRuntime,
    ttsRuntime,
    uniqueStrings,
  });

  const { ttsReady, sttReady, status, chosenRuntime } = resolveHealthReadiness({
    ttsRuntime, sttRuntime, assetSelection, referenceTextReady, anyRuntimeAvailable, missingPackages,
  });

  return {
    available: anyRuntimeAvailable,
    status,
    runtimeLabel: chosenRuntime?.runtimeLabel ?? null,
    executable: chosenRuntime?.executable ?? null,
    pythonVersion: chosenRuntime?.pythonVersion ?? null,
    device: resolveCombinedDevice(ttsRuntime, sttRuntime),
    ttsReady,
    sttReady,
    referenceReady: referenceTextReady,
    missingPackages,
    detectedPackages,
    messages,
  };
}

function createLocalVoiceHealth(context) {
  return { buildLocalVoiceHealth: buildLocalVoiceHealth.bind(null, context) };
}

module.exports = { createLocalVoiceHealth };
