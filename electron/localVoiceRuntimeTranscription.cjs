const fs = require('fs');
const path = require('path');
const { buildFailureLogDetails, buildTranscriptionOutput, buildTranscriptionRunnerArgs,
  buildTranscriptionStartLogDetails, buildTranscriptionSuccessLogDetails,
  ensureTranscriptionAssetSelection, getLocalVoiceLanguageCode,
} = require('./localVoiceRuntimeRequestUtils.cjs');
const { buildJsonError } = require('./localVoiceRuntimeProcessUtils.cjs');

function prepareTranscription(context, audioBase64, settings, requestId) {
  const { writeRuntimeLog, resolveAssetSelection, ensureDir, runtimeRoot } = context;
  const safeSettings = settings ?? {};
  const languageCode = getLocalVoiceLanguageCode(safeSettings);
  writeRuntimeLog(
    'Starting local voice transcription',
    buildTranscriptionStartLogDetails({ audioBase64, requestId }),
  );
  const assetSelection = resolveAssetSelection(safeSettings);
  ensureTranscriptionAssetSelection(assetSelection);

  ensureDir(runtimeRoot);
  const audioPath = path.join(runtimeRoot, `stt-input-${requestId}.wav`);

  return { requestId, safeSettings, languageCode, assetSelection, audioPath, audioBase64 };
}

async function runTranscription(context, state) {
  const { runRunnerCommand } = context;
  const { audioPath, safeSettings, languageCode, assetSelection } = state;
  const result = await runRunnerCommand({
    settings: safeSettings,
    mode: 'stt',
    extraArgs: buildTranscriptionRunnerArgs({
      audioPath,
      languageCode,
      sttModelPath: assetSelection.sttModel.path,
    }),
  });

  if (!result.ok || !result.parsed?.ok) {
    throw new Error(result.parsed?.error || 'Local STT transcription failed.');
  }

  return result;
}

function finishTranscription(context, requestId, result) {
  const { writeRuntimeLog } = context;
  const output = buildTranscriptionOutput(result.parsed);

  writeRuntimeLog(
    'Local voice transcription completed',
    buildTranscriptionSuccessLogDetails({ output, requestId }),
  );
  return output;
}

function failTranscription(context, requestId, error) {
  const { writeRuntimeLog } = context;
  writeRuntimeLog(
    'Local voice transcription failed',
    buildFailureLogDetails({
      errorText: buildJsonError(error),
      requestId,
    }),
  );
  throw error;
}

function cleanupTranscriptionInput(context, audioPath) {
  try {
    context.fs.unlinkSync(audioPath);
  } catch {
    // Ignore temp cleanup failures.
  }
}

async function transcribe(context, { audioBase64, settings }) {
  const requestId = context.nextTranscriptionRequestId();
  const state = prepareTranscription(context, audioBase64, settings, requestId);
  try {
    context.fs.writeFileSync(state.audioPath, Buffer.from(audioBase64, 'base64'));
    const result = await runTranscription(context, state);
    return finishTranscription(context, requestId, result);
  } catch (error) {
    return failTranscription(context, requestId, error);
  } finally {
    cleanupTranscriptionInput(context, state.audioPath);
  }
}

function createLocalVoiceTranscription(context) {
  const capabilities = { fs, ...context };
  return { transcribe: (input) => transcribe(capabilities, input) };
}

module.exports = { createLocalVoiceTranscription };
