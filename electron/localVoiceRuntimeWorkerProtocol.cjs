const PAYLOAD_STRING_FIELDS = [
  ['audio_path', 'audioPath'],
  ['output_audio_path', 'outputAudioPath'],
  ['tts_model_path', 'ttsModelPath'],
  ['stt_model_path', 'sttModelPath'],
  ['reference_path', 'referencePath'],
  ['reference_audio_path', 'referenceAudioPath'],
  ['reference_stt_model_path', 'referenceSttModelPath'],
  ['language_code', 'languageCode'],
];

const RESPONSE_STRING_FIELDS = [
  ['error', 'error'],
  ['mime_type', 'mimeType'],
  ['audio_file_path', 'audioFilePath'],
  ['runtime_device', 'runtimeDevice'],
  ['runtime_dtype', 'runtimeDtype'],
  ['attn_implementation', 'attnImplementation'],
  ['tts_model_size', 'ttsModelSize'],
  ['load_reason', 'loadReason'],
];

const RESPONSE_NUMBER_FIELDS = [
  ['sample_rate', 'sampleRate'],
  ['load_attempt_index', 'loadAttemptIndex'],
  ['load_attempt_total', 'loadAttemptTotal'],
];

const WORKER_READY_STRING_FIELDS = [
  ['runtime_device', 'runtimeDevice'],
  ['runtime_dtype', 'runtimeDtype'],
  ['attn_implementation', 'attnImplementation'],
  ['tts_model_size', 'ttsModelSize'],
  ['load_reason', 'loadReason'],
];

const WORKER_READY_NUMBER_FIELDS = [
  ['load_attempt_index', 'loadAttemptIndex'],
  ['load_attempt_total', 'loadAttemptTotal'],
];

function readTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function assignTrimmedString(summary, source, sourceKey, summaryKey) {
  const value = readTrimmedString(source?.[sourceKey]);
  if (value) {
    summary[summaryKey] = value;
  }
}

function assignStringLength(summary, source, sourceKey, summaryKey) {
  if (typeof source?.[sourceKey] === 'string') {
    summary[summaryKey] = source[sourceKey].length;
  }
}

function assignFiniteNumber(summary, source, sourceKey, summaryKey) {
  if (typeof source?.[sourceKey] === 'number' && Number.isFinite(source[sourceKey])) {
    summary[summaryKey] = source[sourceKey];
  }
}

function summarizeWorkerPayload(payload) {
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  const summary = {};

  assignStringLength(summary, safePayload, 'text', 'textLength');
  assignStringLength(summary, safePayload, 'reference_text', 'referenceTextLength');
  PAYLOAD_STRING_FIELDS.forEach(([sourceKey, summaryKey]) => {
    assignTrimmedString(summary, safePayload, sourceKey, summaryKey);
  });
  if (safePayload.prime_only === true) {
    summary.primeOnly = true;
  }

  return summary;
}

function summarizeWorkerResponse(parsed, splitOutputLines, takeTail) {
  const safeParsed = parsed && typeof parsed === 'object' ? parsed : {};
  const summary = {
    ok: Boolean(safeParsed.ok),
  };

  assignStringLength(summary, safeParsed, 'text', 'textLength');
  assignStringLength(summary, safeParsed, 'reference_text', 'referenceTextLength');
  RESPONSE_STRING_FIELDS.forEach(([sourceKey, summaryKey]) => {
    assignTrimmedString(summary, safeParsed, sourceKey, summaryKey);
  });
  RESPONSE_NUMBER_FIELDS.forEach(([sourceKey, summaryKey]) => {
    assignFiniteNumber(summary, safeParsed, sourceKey, summaryKey);
  });
  if (typeof safeParsed.prompt_cache_hit === 'boolean') {
    summary.promptCacheHit = safeParsed.prompt_cache_hit;
  }
  if (safeParsed.primed === true) {
    summary.primed = true;
  }
  if (typeof safeParsed.traceback === 'string' && safeParsed.traceback.trim()) {
    summary.traceback = takeTail(splitOutputLines(safeParsed.traceback), 4).join(' | ');
  }

  return summary;
}

function getWorkerModeModelPath(mode, payload) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  return mode === 'tts'
    ? readTrimmedString(payload.tts_model_path)
    : readTrimmedString(payload.stt_model_path);
}

function buildWorkerExitReason(exitCode, signal) {
  return `exit_${exitCode ?? 'unknown'}_${signal ?? 'nosignal'}`;
}

function getWorkerResponseRequestId(parsed) {
  return typeof parsed?.id === 'string' ? parsed.id : null;
}

function parseRunnerPayload(extraArgs) {
  const payload = {};
  const args = Array.isArray(extraArgs) ? extraArgs : [];

  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    if (typeof flag !== 'string' || !flag.startsWith('--')) {
      continue;
    }

    const value = args[index + 1];
    payload[flag.slice(2).replace(/-/g, '_')] = typeof value === 'string'
      ? value
      : String(value ?? '');
  }

  return payload;
}

function buildModeWorkerKey(describeRuntimeCandidate, candidate, mode, modelPath) {
  return `${mode}::${describeRuntimeCandidate(candidate)}::${modelPath}`;
}

function buildWorkerReadyLogDetails(parsed, modelPath) {
  const safeParsed = parsed && typeof parsed === 'object' ? parsed : {};
  const summary = {
    pid: safeParsed.pid ?? null,
    modelPath: readTrimmedString(safeParsed.model_path) || modelPath,
  };

  WORKER_READY_STRING_FIELDS.forEach(([sourceKey, summaryKey]) => {
    assignTrimmedString(summary, safeParsed, sourceKey, summaryKey);
  });
  WORKER_READY_NUMBER_FIELDS.forEach(([sourceKey, summaryKey]) => {
    assignFiniteNumber(summary, safeParsed, sourceKey, summaryKey);
  });

  return summary;
}

function buildWorkerRequestInput(requestId, payload) {
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  return `${JSON.stringify({ id: requestId, ...safePayload })}\n`;
}

function buildWorkerRequestResult(worker, parsed) {
  return {
    candidate: worker.candidate,
    parsed,
    stderr: '',
    ok: Boolean(parsed?.ok),
  };
}

function createWorkerUnavailableError(getModeLabel, mode, reason) {
  return new Error(`${getModeLabel(mode)} worker unavailable: ${reason}`);
}

function createLocalVoiceWorkerProtocol({ describeRuntimeCandidate, splitOutputLines, takeTail }) {
  return {
    buildModeWorkerKey: buildModeWorkerKey.bind(null, describeRuntimeCandidate),
    buildWorkerExitReason,
    buildWorkerReadyLogDetails: buildWorkerReadyLogDetails.bind(null),
    buildWorkerRequestInput: buildWorkerRequestInput.bind(null),
    buildWorkerRequestResult: buildWorkerRequestResult.bind(null),
    createWorkerUnavailableError: createWorkerUnavailableError.bind(null),
    getWorkerModeModelPath,
    getWorkerResponseRequestId,
    parseRunnerPayload,
    summarizeWorkerPayload,
    summarizeWorkerResponse(parsed) {
      return summarizeWorkerResponse(parsed, splitOutputLines, takeTail);
    },
  };
}

module.exports = { createLocalVoiceWorkerProtocol };
