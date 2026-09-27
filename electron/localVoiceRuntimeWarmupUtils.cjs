function buildWarmupStartLogDetails({ requestId, referenceTextInfo, safeSettings }) {
  return {
    requestId,
    ttsProvider: safeSettings.ttsProvider || null,
    sttProvider: safeSettings.sttProvider || null,
    ttsModelId: safeSettings.localTtsModelId || null,
    sttModelId: safeSettings.localSttModelId || null,
    referenceId: safeSettings.localVoiceReferenceId || null,
    referenceTextSource: referenceTextInfo.source,
  };
}

function resolveWarmupPlan({ assetSelection, referenceTextInfo, safeSettings }) {
  const shouldWarmTtsWorker = safeSettings.ttsProvider === 'local' && Boolean(assetSelection.ttsModel?.path);
  const shouldWarmSttWorker = Boolean(
    (safeSettings.sttProvider === 'local' && assetSelection.sttModel?.path)
    || (
      safeSettings.ttsProvider === 'local'
      && !referenceTextInfo.referenceText
      && assetSelection.referenceAudioPath
      && assetSelection.sttModel?.path
    ),
  );
  const shouldPrepareReferenceText = Boolean(
    safeSettings.ttsProvider === 'local'
    && !referenceTextInfo.referenceText
    && assetSelection.referenceAudioPath
    && assetSelection.sttModel?.path
  );

  return {
    referenceTextWarmupSkipReason: (
      safeSettings.ttsProvider === 'local'
      && !referenceTextInfo.referenceText
      && !shouldPrepareReferenceText
    )
      ? (assetSelection.referenceAudioPath ? 'missing_stt_model' : 'missing_reference_audio')
      : null,
    shouldPrepareReferenceText,
    shouldSkipSttWorker: Boolean(
      (safeSettings.sttProvider === 'local' || safeSettings.ttsProvider === 'local')
      && !assetSelection.sttModel?.path
      && !referenceTextInfo.referenceText
    ),
    shouldSkipTtsWorker: safeSettings.ttsProvider === 'local' && !assetSelection.ttsModel?.path,
    shouldWarmSttWorker,
    shouldWarmTtsWorker,
  };
}

function shouldWarmTtsInference({ assetSelection, referenceTextInfo, safeSettings, warmedTtsWorker }) {
  return Boolean(
    safeSettings.ttsProvider === 'local'
    && warmedTtsWorker
    && assetSelection.ttsModel?.path
    && assetSelection.reference?.path
    && assetSelection.referenceAudioPath
    && referenceTextInfo.referenceText
  );
}

function buildWarmupResult({ ok, referenceTextInfo, ttsInferenceReady, warmedModes }) {
  return {
    ok,
    referenceTextReady: Boolean(referenceTextInfo.referenceText),
    referenceTextSource: referenceTextInfo.source,
    ttsInferenceReady,
    warmedModes: Array.from(warmedModes),
  };
}

module.exports = {
  buildWarmupResult,
  buildWarmupStartLogDetails,
  resolveWarmupPlan,
  shouldWarmTtsInference,
};
