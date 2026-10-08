// Ordered install steps for the GPT-SoVITS sidecar runtime. Versions match the 2026-10-06 verified setup
// (docs/voice-gpt-sovits-integration-plan-20261006.md); bump them together with a re-verification.
const GPT_SOVITS_COMMIT = 'a3035089c65ca63eb7777a4b0dafd198ebe36cda';
const TORCH_PACKAGES = ['torch==2.7.0', 'torchaudio==2.7.0'];
const TORCH_INDEX_URLS = {
  cuda: 'https://download.pytorch.org/whl/cu128',
  cpu: 'https://download.pytorch.org/whl/cpu',
};

// Upstream requirements.txt with Windows/Python 3.12 substitutions: jieba_fast (no wheel) is shimmed by the
// server, pyopenjtalk → pyopenjtalk-plus, opencc from binary wheels, onnxruntime instead of onnxruntime-gpu.
const RUNTIME_REQUIREMENTS = [
  'numpy<2.0', 'scipy', 'tensorboard', 'librosa==0.10.2', 'numba', 'pytorch-lightning>=2.4', 'gradio<5',
  'ffmpeg-python', 'tqdm', 'funasr>=1.3.7', 'cn2an', 'pypinyin', 'g2p_en', 'modelscope', 'sentencepiece',
  'transformers>=4.51,<5', 'peft<0.18.0', 'chardet', 'PyYAML', 'psutil', 'jieba', 'split-lang',
  'fast_langdetect>=0.3.1', 'wordsegment', 'rotary_embedding_torch', 'ToJyutping', 'g2pk2', 'ko_pron', 'opencc',
  'fastapi[standard]>=0.115.2', 'x_transformers', 'torchmetrics<=1.5', 'pydantic<=2.10.6', 'ctranslate2>=4.0,<5',
  'av>=11', 'pyopenjtalk-plus', 'onnxruntime', 'resampy', 'huggingface_hub',
];

const BASE_PYTHON_CHECK = 'import sys; sys.exit(0 if (3, 10) <= sys.version_info[:2] <= (3, 12) else 3)';

function buildGptSovitsInstallSteps({ paths, installScript, device, venvExists }) {
  const torchIndex = device === 'cpu' ? TORCH_INDEX_URLS.cpu : TORCH_INDEX_URLS.cuda;
  // No pip cache: the CUDA wheels alone are several GB and would pile up on the system drive.
  const pip = (...args) => ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-cache-dir', ...args];
  return [
    { id: 'check-python', runner: 'base', label: '检查 Python 版本（需 3.10–3.12）...', args: ['-c', BASE_PYTHON_CHECK] },
    ...(venvExists ? [] : [
      { id: 'venv', runner: 'base', label: '创建独立运行环境...', args: ['-m', 'venv', paths.venvDir] },
    ]),
    { id: 'pip', runner: 'venv', label: '升级 pip...', args: pip('--upgrade', 'pip') },
    {
      id: 'torch',
      runner: 'venv',
      label: device === 'cpu' ? '安装 PyTorch（CPU 版）...' : '安装 PyTorch 显卡版（约 3.3GB，耗时较长）...',
      args: pip(...TORCH_PACKAGES, '--index-url', torchIndex),
    },
    { id: 'requirements', runner: 'venv', label: '安装语音依赖...', args: pip(...RUNTIME_REQUIREMENTS) },
    {
      id: 'source', runner: 'venv', label: '下载推理代码...',
      args: [installScript, 'source', '--source-dir', paths.sourceDir, '--commit', GPT_SOVITS_COMMIT],
    },
    {
      id: 'models', runner: 'venv', label: '下载预训练模型（约 2GB）...',
      args: [installScript, 'models', '--source-dir', paths.sourceDir, '--venv-dir', paths.venvDir],
    },
  ];
}

module.exports = { GPT_SOVITS_COMMIT, RUNTIME_REQUIREMENTS, TORCH_INDEX_URLS, buildGptSovitsInstallSteps };
