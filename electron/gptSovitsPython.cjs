const path = require('path');
const { pathExists } = require('./localVoiceRuntimePathUtils.cjs');
const { formatSpawnFailure } = require('./localVoiceRuntimeCommandUtils.cjs');
const { spawnCommand } = require('./browserTtsCommands.cjs');

const GPT_SOVITS_REQUIRED_PACKAGES = [
  'torch', 'torchaudio', 'transformers', 'librosa', 'soundfile', 'pypinyin',
  'jieba', 'cn2an', 'g2p_en', 'pytorch_lightning', 'peft', 'x_transformers',
];

// One JSON line: missing packages plus whether torch can see a CUDA device.
const PROBE_SCRIPT = [
  'import importlib.util, json',
  `packages = ${JSON.stringify(GPT_SOVITS_REQUIRED_PACKAGES)}`,
  'missing = [p for p in packages if importlib.util.find_spec(p) is None]',
  'cuda = False',
  'if "torch" not in missing:',
  '    import torch',
  '    cuda = bool(torch.cuda.is_available())',
  'print(json.dumps({"missing": missing, "cuda": cuda}))',
].join('\n');

function hasInferenceSource(sourceDir) {
  return pathExists(path.join(sourceDir, 'GPT_SoVITS', 'TTS_infer_pack', 'TTS.py'))
    && pathExists(path.join(sourceDir, 'GPT_SoVITS', 'pretrained_models', 'chinese-roberta-wwm-ext-large'))
    && pathExists(path.join(sourceDir, 'GPT_SoVITS', 'pretrained_models', 'chinese-hubert-base'));
}

function parseProbeOutput(stdout) {
  const line = String(stdout || '').trim().split(/\r?\n/u).pop() || '';
  try {
    const parsed = JSON.parse(line);
    return {
      missingPackages: Array.isArray(parsed.missing) ? parsed.missing.map(String) : GPT_SOVITS_REQUIRED_PACKAGES,
      cudaAvailable: parsed.cuda === true,
    };
  } catch {
    return null;
  }
}

function createGptSovitsPython({ paths, getSharedEnv, runCommand = spawnCommand }) {
  function getCandidate() {
    return pathExists(paths.venvPython) ? { label: 'gpt-sovits-venv', executable: paths.venvPython, args: [] } : null;
  }

  // Importing torch takes seconds, so a clean probe is reused; failures are re-probed every time.
  let cachedProbe = null;
  async function probeRuntime(candidate) {
    if (cachedProbe?.executable === candidate.executable) {
      return cachedProbe.result;
    }
    const result = await runCommand(candidate, ['-c', PROBE_SCRIPT], { cwd: paths.home, env: getSharedEnv() });
    const parsed = result.ok ? parseProbeOutput(result.stdout) : null;
    if (!parsed) {
      return {
        ok: false,
        missingPackages: GPT_SOVITS_REQUIRED_PACKAGES,
        cudaAvailable: false,
        error: result.ok ? 'GPT-SoVITS 运行环境检测结果无法解析。' : formatSpawnFailure(result),
      };
    }
    const probe = { ok: true, ...parsed, error: null };
    if (probe.missingPackages.length === 0) {
      cachedProbe = { executable: candidate.executable, result: probe };
    }
    return probe;
  }

  return {
    getCandidate,
    probeRuntime,
    hasSource: () => hasInferenceSource(paths.sourceDir),
    clearProbeCache: () => {
      cachedProbe = null;
    },
  };
}

module.exports = { GPT_SOVITS_REQUIRED_PACKAGES, createGptSovitsPython, parseProbeOutput };
