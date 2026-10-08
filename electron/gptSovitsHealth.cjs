const { buildEndpoint } = require('./browserTtsRules.cjs');
const { HEALTH_TIMEOUT_MS, requestJson } = require('./browserTtsHttp.cjs');
const {
  normalizeGptSovitsBaseUrl,
  normalizeGptSovitsDevice,
  normalizeGptSovitsModelId,
} = require('./gptSovitsRules.cjs');
const { listGptSovitsModels } = require('./gptSovitsModels.cjs');

// User-facing messages stay generic; details with paths or stderr only go to the runtime log.
const STATUS_MESSAGES = {
  'missing-runtime': 'GPT-SoVITS 运行环境尚未安装。',
  'missing-dependencies': 'GPT-SoVITS 依赖不完整，请重新安装运行环境。',
  'missing-source': 'GPT-SoVITS 推理组件或预训练资源缺失，请重新安装运行环境。',
  'missing-model': '未找到可用的角色音色模型。',
  'no-gpu': '未检测到可用的 NVIDIA 显卡，可在设置中改为 CPU 模式（速度较慢）。',
  stopped: 'GPT-SoVITS 服务未启动。',
  error: 'GPT-SoVITS 服务状态异常。',
};

function buildHealth(status, fields = {}) {
  return {
    available: status === 'ready',
    status,
    running: false,
    error: status === 'ready' ? null : STATUS_MESSAGES[status] ?? STATUS_MESSAGES.error,
    missingPackages: [],
    cudaAvailable: false,
    device: 'auto',
    modelId: null,
    models: [],
    ...fields,
  };
}

// No explicit choice: prefer a fine-tuned pack so adding lite packs never silently changes the voice.
function resolveSelection(settings, models) {
  const requestedId = normalizeGptSovitsModelId(settings?.gptSovitsModelId);
  const readyModels = models.filter((model) => model.ready);
  const fallback = readyModels.find((model) => model.kind !== 'lite') ?? readyModels[0];
  const selected = readyModels.find((model) => model.id === requestedId) ?? (requestedId ? null : fallback);
  return selected?.id ?? null;
}

async function probeServer(baseUrl, base, writeLog) {
  try {
    const result = await requestJson(buildEndpoint(baseUrl, '/health'), { timeoutMs: HEALTH_TIMEOUT_MS });
    const ready = Boolean(result.ok && result.body?.status === 'ok');
    if (!ready) writeLog('GPT-SoVITS health not ready', { statusCode: result.statusCode });
    return buildHealth(ready ? 'ready' : 'error', { ...base, running: Boolean(result.ok) });
  } catch {
    return buildHealth('stopped', base);
  }
}

function createGptSovitsHealth({ python, getModelsRoot, writeLog = () => undefined }) {
  async function getHealth(settings) {
    const device = normalizeGptSovitsDevice(settings?.gptSovitsDevice);
    const candidate = python.getCandidate();
    if (!candidate) return buildHealth('missing-runtime', { device });

    const runtime = await python.probeRuntime(candidate);
    if (!runtime.ok || runtime.missingPackages.length > 0) {
      writeLog('GPT-SoVITS runtime probe failed', { error: runtime.error, missing: runtime.missingPackages });
      return buildHealth('missing-dependencies', { device, missingPackages: runtime.missingPackages });
    }
    const base = { device, cudaAvailable: runtime.cudaAvailable };
    if (!python.hasSource()) return buildHealth('missing-source', base);

    const models = listGptSovitsModels(getModelsRoot());
    const modelId = resolveSelection(settings, models);
    const withModels = { ...base, models, modelId };
    if (!modelId) return buildHealth('missing-model', withModels);
    if (device !== 'cpu' && !runtime.cudaAvailable) return buildHealth('no-gpu', withModels);

    return probeServer(normalizeGptSovitsBaseUrl(settings?.gptSovitsApiUrl), withModels, writeLog);
  }

  return getHealth;
}

module.exports = { GPT_SOVITS_STATUS_MESSAGES: STATUS_MESSAGES, createGptSovitsHealth };
