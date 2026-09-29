function buildTorchVersionProbeScript() {
  return [
    'import importlib.metadata as metadata',
    'import json',
    'def read_version(name):',
    '    try:',
    '        return metadata.version(name)',
    '    except metadata.PackageNotFoundError:',
    "        return ''",
    'print(json.dumps({',
    '    "torch": read_version("torch"),',
    '    "torchaudio": read_version("torchaudio"),',
    '}, ensure_ascii=False))',
  ].join('\n');
}

async function resolvePreferredTorchPackages({
  baseRuntime,
  defaultTorchaudioVersion,
  defaultTorchVersion,
  getSharedOptions,
  parseJsonFromCommandOutput,
  runInlinePythonScript,
}) {
  const fallback = {
    torchVersion: defaultTorchVersion,
    torchaudioVersion: defaultTorchaudioVersion,
  };

  try {
    const result = await runInlinePythonScript(
      baseRuntime.candidate,
      buildTorchVersionProbeScript(),
      getSharedOptions(),
    );
    if (!result.ok) {
      return fallback;
    }

    const parsed = parseJsonFromCommandOutput(result.stdout);
    const torchVersion = typeof parsed.torch === 'string' && parsed.torch.trim()
      ? parsed.torch.trim()
      : fallback.torchVersion;
    const torchaudioVersion = typeof parsed.torchaudio === 'string' && parsed.torchaudio.trim()
      ? parsed.torchaudio.trim()
      : fallback.torchaudioVersion;

    return {
      torchVersion,
      torchaudioVersion,
    };
  } catch {
    return fallback;
  }
}

function buildInstallHealthCheckSettings(settings) {
  return {
    ...(settings ?? {}),
    ttsProvider: 'local',
    sttProvider: 'local',
  };
}

function getDefaultLocalVoiceMissingPackages(getModePackages, uniqueStrings) {
  return uniqueStrings([...getModePackages('tts'), ...getModePackages('stt')]);
}

function buildBaseRuntimeInstallFailureResult({ error, missingPackages }) {
  const messages = [
    error instanceof Error
      ? `No usable Python runtime found: ${error.message}`
      : 'No usable Python runtime found.',
  ];
  return {
    ok: false,
    executable: null,
    messages,
    error: 'Local voice dependency installation failed because no usable Python runtime was found.',
    missingPackages,
  };
}

function buildMissingPackagesInstallFailureResult({ executable, messages, missingPackages }) {
  return {
    ok: false,
    executable,
    messages,
    error: 'Dependencies finished installing but some packages are still missing.',
    missingPackages,
  };
}

function buildInstallExecutionFailureResult({ error, executable, messages, missingPackages }) {
  return {
    ok: false,
    executable,
    messages,
    error,
    missingPackages,
  };
}

function buildInstallSuccessResult({ executable, messages }) {
  return {
    ok: true,
    executable,
    messages,
    error: null,
    missingPackages: [],
  };
}

module.exports = {
  buildBaseRuntimeInstallFailureResult,
  buildInstallExecutionFailureResult,
  buildInstallHealthCheckSettings,
  buildInstallSuccessResult,
  buildMissingPackagesInstallFailureResult,
  getDefaultLocalVoiceMissingPackages,
  resolvePreferredTorchPackages,
};

