const fs = require('fs');
const path = require('path');
const { pathExists } = require('./localVoiceRuntimePathUtils.cjs');

const DEFAULT_TORCH_VERSION = '2.6.0+cu124';
const DEFAULT_TORCHAUDIO_VERSION = '2.6.0+cu124';

function getModeLabel(mode) {
  return mode === 'tts' ? 'TTS' : 'STT';
}

function getTtsWarmupText(languageCode) {
  const normalized = typeof languageCode === 'string' ? languageCode.trim().toLowerCase() : '';

  if (normalized.startsWith('en')) {
    return 'Hello.';
  }

  if (normalized.startsWith('ja')) {
    return 'こんにちは。';
  }

  if (normalized.startsWith('ko')) {
    return '안녕하세요.';
  }

  return '你好。';
}

function getModePackages(mode) {
  return mode === 'tts'
    ? ['torch', 'torchaudio', 'qwen_tts', 'transformers', 'accelerate', 'librosa', 'soundfile', 'onnxruntime', 'einops']
    : ['torch', 'qwen_asr', 'transformers', 'accelerate', 'librosa', 'soundfile', 'nagisa', 'soynlp', 'qwen_omni_utils', 'flask', 'pytz'];
}

function getModeImportTarget(mode) {
  return mode === 'tts'
    ? { moduleName: 'qwen_tts', symbolName: 'Qwen3TTSModel' }
    : { moduleName: 'qwen_asr', symbolName: 'Qwen3ASRModel' };
}

function getModeEnvDirectory(runtimeRoot, mode) {
  return path.join(runtimeRoot, mode === 'tts' ? 'venv-tts' : 'venv-stt');
}

function getModeEnvPythonPath(runtimeRoot, mode) {
  return path.join(getModeEnvDirectory(runtimeRoot, mode), 'Scripts', 'python.exe');
}

function readPyvenvConfigValue(configPath, key) {
  let content = '';
  try {
    content = fs.readFileSync(configPath, 'utf8');
  } catch {
    return '';
  }

  const normalizedKey = String(key || '').trim().toLowerCase();
  for (const line of content.split(/\r?\n/)) {
    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    const currentKey = line.slice(0, separatorIndex).trim().toLowerCase();
    if (currentKey !== normalizedKey) {
      continue;
    }

    return line.slice(separatorIndex + 1).trim();
  }

  return '';
}

function isModeEnvPortable(runtimeRoot, mode) {
  const envDir = getModeEnvDirectory(runtimeRoot, mode);
  const configPath = path.join(envDir, 'pyvenv.cfg');
  if (!pathExists(configPath)) {
    return true;
  }

  const homePath = readPyvenvConfigValue(configPath, 'home');
  const executablePath = readPyvenvConfigValue(configPath, 'executable');
  return Boolean(
    (!homePath || pathExists(homePath))
    && (!executablePath || pathExists(executablePath))
  );
}

function getModeCandidate(runtimeRoot, mode) {
  const executable = getModeEnvPythonPath(runtimeRoot, mode);
  return pathExists(executable) && isModeEnvPortable(runtimeRoot, mode)
    ? {
        label: `venv-${mode}`,
        executable,
        args: [],
      }
    : null;
}

function getInstallSteps(mode, preferredTorchPackages) {
  const label = getModeLabel(mode);
  const torchInstallTarget = process.platform === 'win32' || process.platform === 'linux'
    ? {
        label: 'PyTorch CUDA 12.4',
        indexUrl: 'https://download.pytorch.org/whl/cu124',
      }
    : {
        label: 'PyTorch CPU',
        indexUrl: 'https://download.pytorch.org/whl/cpu',
      };
  const torchVersion = typeof preferredTorchPackages?.torchVersion === 'string' && preferredTorchPackages.torchVersion.trim()
    ? preferredTorchPackages.torchVersion.trim()
    : DEFAULT_TORCH_VERSION;
  const torchaudioVersion = typeof preferredTorchPackages?.torchaudioVersion === 'string' && preferredTorchPackages.torchaudioVersion.trim()
    ? preferredTorchPackages.torchaudioVersion.trim()
    : DEFAULT_TORCHAUDIO_VERSION;

  return [
    {
      label: `${label} 环境安装 ${torchInstallTarget.label}`,
      installArgs: [
        'install',
        '--upgrade',
        '--force-reinstall',
        '--no-cache-dir',
        `torch==${torchVersion}`,
        `torchaudio==${torchaudioVersion}`,
        '--index-url',
        torchInstallTarget.indexUrl,
      ],
    },
    {
      label: `${label} 环境安装语音依赖`,
      installArgs: mode === 'tts'
        ? ['install', '--upgrade', 'transformers==4.57.3', 'accelerate==1.12.0', 'librosa', 'soundfile', 'onnxruntime', 'einops', 'sox', 'scipy', 'sentencepiece']
        : ['install', '--upgrade', 'transformers==4.57.6', 'accelerate==1.12.0', 'librosa', 'soundfile', 'nagisa==0.2.11', 'soynlp==0.0.493', 'qwen-omni-utils', 'flask', 'pytz', 'sox', 'sentencepiece'],
    },
    {
      label: `${label} install voice package`,
      installArgs: mode === 'tts'
        ? ['install', '--upgrade', '--no-deps', 'qwen-tts']
        : ['install', '--upgrade', '--no-deps', 'qwen-asr'],
    },
  ];
}

function buildProbeScript(mode, packageNames) {
  const importTarget = getModeImportTarget(mode);

  return [
    'import importlib.util',
    'import json',
    'import sys',
    `packages = ${JSON.stringify(packageNames)}`,
    `target_module = ${JSON.stringify(importTarget.moduleName)}`,
    `target_symbol = ${JSON.stringify(importTarget.symbolName)}`,
    'detected = []',
    'missing = []',
    'for name in packages:',
    '    if importlib.util.find_spec(name) is None:',
    '        missing.append(name)',
    '    else:',
    '        detected.append(name)',
    'device = "unknown"',
    'import_error = None',
    'try:',
    '    module = __import__(target_module, fromlist=[target_symbol])',
    '    getattr(module, target_symbol)',
    'except Exception as error:',
    '    import_error = str(error)',
    'if importlib.util.find_spec("torch") is not None:',
    '    try:',
    '        import torch',
    '        device = "cuda" if torch.cuda.is_available() else "cpu"',
    '    except Exception:',
    '        device = "unknown"',
    'print(json.dumps({',
    '    "executable": sys.executable,',
    '    "python_version": sys.version.split()[0],',
    '    "detected_packages": detected,',
    '    "missing_packages": missing,',
    '    "device": device,',
    '    "import_error": import_error,',
    '}, ensure_ascii=False))',
  ].join('\n');
}

module.exports = {
  DEFAULT_TORCHAUDIO_VERSION,
  DEFAULT_TORCH_VERSION,
  buildProbeScript,
  getInstallSteps,
  getModeCandidate,
  getModeEnvDirectory,
  getModeEnvPythonPath,
  getModeImportTarget,
  getModeLabel,
  getModePackages,
  getTtsWarmupText,
};
