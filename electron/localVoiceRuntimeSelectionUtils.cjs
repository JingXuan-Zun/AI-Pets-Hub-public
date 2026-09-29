function findCatalogItemById(items, itemId) {
  if (!Array.isArray(items) || !itemId) {
    return null;
  }

  return items.find((item) => item?.id === itemId) ?? null;
}

function readConfiguredReferenceText(settings, assetSelection) {
  const manualReferenceText = typeof settings?.localVoiceReferenceText === 'string'
    ? settings.localVoiceReferenceText.trim()
    : '';
  if (manualReferenceText) {
    return {
      referenceText: manualReferenceText,
      source: 'settings',
    };
  }

  const fileReferenceText = typeof assetSelection?.referenceTextFromFiles === 'string'
    ? assetSelection.referenceTextFromFiles.trim()
    : '';
  if (fileReferenceText) {
    return {
      referenceText: fileReferenceText,
      source: 'file',
    };
  }

  const audioFileNameReferenceText = typeof assetSelection?.referenceTextFromAudioFileName === 'string'
    ? assetSelection.referenceTextFromAudioFileName.trim()
    : '';
  if (audioFileNameReferenceText) {
    return {
      referenceText: audioFileNameReferenceText,
      source: 'audio-filename',
    };
  }

  return {
    referenceText: '',
    source: 'missing',
  };
}

function createLocalVoiceRuntimeSelectionUtils({
  localVoiceLibrary,
  readFirstExistingTextFile,
  resolveReferenceTextFromAudioFileName,
  resolveReferenceAudioPath,
}) {
  function resolveAssetSelection(settings) {
    const catalog = localVoiceLibrary.getCatalog();
    const reference = findCatalogItemById(catalog.references, settings?.localVoiceReferenceId);
    const referenceAudioPath = reference ? resolveReferenceAudioPath(reference.path) : null;

    const assetSelection = {
      catalog,
      ttsModel: findCatalogItemById(catalog.ttsModels, settings?.localTtsModelId),
      sttModel: findCatalogItemById(catalog.sttModels, settings?.localSttModelId),
      reference,
      referenceAudioPath,
      referenceTextFromFiles: reference ? readFirstExistingTextFile(reference.path) : '',
      referenceTextFromAudioFileName: referenceAudioPath
        ? resolveReferenceTextFromAudioFileName(referenceAudioPath)
        : '',
    };
    return assetSelection;
  }

  return {
    getConfiguredReferenceText: readConfiguredReferenceText,
    resolveAssetSelection,
  };
}

module.exports = {
  createLocalVoiceRuntimeSelectionUtils,
};
