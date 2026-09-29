const {
  createLocalVoiceRuntimeReferenceTextUtils,
} = require('../electron/localVoiceRuntimeReferenceTextUtils.cjs');
const {
  resolveReferenceTextFromAudioFileName,
} = require('../electron/localVoiceRuntimePathUtils.cjs');
const {
  createLocalVoiceRuntimeSelectionUtils,
} = require('../electron/localVoiceRuntimeSelectionUtils.cjs');

async function main() {
  const logs = [];
  const cache = new Map();
  const namedReferenceText = '\u4e00\u76f4\u5bf9\u6211\u8fd9\u4e48\u597d';

  if (resolveReferenceTextFromAudioFileName(`C:\\voices\\${namedReferenceText}.wav`) !== namedReferenceText) {
    throw new Error('audio_filename_reference_text_failed');
  }
  if (resolveReferenceTextFromAudioFileName('C:\\voices\\ref-013.wav') !== '') {
    throw new Error('generic_audio_filename_reference_text_failed');
  }

  const selectionHelper = createLocalVoiceRuntimeSelectionUtils({
    localVoiceLibrary: {
      getCatalog: () => ({
        references: [{ id: 'named', path: 'named-reference-dir' }],
        sttModels: [],
        ttsModels: [],
      }),
    },
    readFirstExistingTextFile: () => '',
    resolveReferenceAudioPath: () => `C:\\voices\\${namedReferenceText}.wav`,
    resolveReferenceTextFromAudioFileName,
  });
  const configuredFromFileName = selectionHelper.getConfiguredReferenceText(
    {},
    selectionHelper.resolveAssetSelection({ localVoiceReferenceId: 'named' }),
  );
  if (configuredFromFileName.referenceText !== namedReferenceText || configuredFromFileName.source !== 'audio-filename') {
    throw new Error('selection_audio_filename_reference_text_failed');
  }

  const genericSelectionHelper = createLocalVoiceRuntimeSelectionUtils({
    localVoiceLibrary: {
      getCatalog: () => ({
        references: [{ id: 'xiaoling', label: 'xiaoling', path: 'xiaoling' }],
        sttModels: [],
        ttsModels: [],
      }),
    },
    readFirstExistingTextFile: () => '',
    resolveReferenceAudioPath: () => 'C:\\voices\\xiaoling\\ref-013.wav',
    resolveReferenceTextFromAudioFileName,
  });
  const xiaolingSelection = genericSelectionHelper.resolveAssetSelection({ localVoiceReferenceId: 'xiaoling' });
  if (xiaolingSelection.referenceTextFromAudioFileName !== '') {
    throw new Error('generic_selection_audio_filename_reference_text_failed');
  }

  const helper = createLocalVoiceRuntimeReferenceTextUtils({
    buildReferenceTextCacheKey: (audio, model, lang) => `${audio}|${model}|${lang}`,
    getConfiguredReferenceText: (settings) => settings?.configured || { referenceText: '', source: 'none' },
    persistReferenceText: () => {
      throw new Error('reference_text_should_not_be_persisted_without_auto_stt');
    },
    readPersistedReferenceText: (key) => (key === 'audio|model|zh-CN' ? '' : ''),
    referenceTextCache: cache,
    writeRuntimeLog: (message, details) => logs.push({ message, details }),
  });

  const configured = await helper.ensureReferenceTextPrepared({
    assetSelection: {},
    requestId: 'configured',
    runRunnerCommand: async () => ({ ok: false }),
    settings: { configured: { referenceText: 'preset', source: 'manual' } },
  });
  if (configured.referenceText !== 'preset' || configured.source !== 'manual') {
    throw new Error('configured_reference_text_failed');
  }

  cache.set('audio|model|zh-CN', 'cached text');
  const cached = await helper.ensureReferenceTextPrepared({
    assetSelection: { referenceAudioPath: 'audio', sttModel: { path: 'model' } },
    requestId: 'cached',
    runRunnerCommand: async () => ({ ok: false }),
    settings: {},
  });
  if (cached.referenceText !== 'cached text' || cached.source !== 'cache') {
    throw new Error('cache_hit_failed');
  }

  const speakerEmbeddingOnly = await helper.ensureReferenceTextPrepared({
    assetSelection: xiaolingSelection,
    requestId: 'speaker-embedding-only',
    runRunnerCommand: async () => {
      throw new Error('speaker_embedding_only_should_not_call_runner');
    },
    settings: {},
  });
  if (speakerEmbeddingOnly.source !== 'none' || speakerEmbeddingOnly.referenceText !== '') {
    throw new Error('speaker_embedding_only_reference_text_failed');
  }

  const speakerEmbeddingWithSttModel = await helper.ensureReferenceTextPrepared({
    assetSelection: { ...xiaolingSelection, sttModel: { path: 'model' } },
    requestId: 'speaker-embedding-with-stt-model',
    runRunnerCommand: async () => {
      throw new Error('speaker_embedding_only_should_skip_auto_stt');
    },
    settings: {},
  });
  if (speakerEmbeddingWithSttModel.source !== 'none' || speakerEmbeddingWithSttModel.referenceText !== '') {
    throw new Error('speaker_embedding_with_stt_model_failed');
  }

  console.log('localVoiceRuntime reference text utils smoke ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
