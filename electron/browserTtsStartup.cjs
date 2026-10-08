const { normalizeApiBaseUrl } = require('./browserTtsRules.cjs');

function createBrowserTtsStartup(context) {
  const { getHealth, startProcess } = context;
  let startPromise = null;

  async function ensureStarted(settings) {
    const baseUrl = normalizeApiBaseUrl(settings?.browserTtsApiUrl);
    const existingHealth = await getHealth(settings);
    if (existingHealth.available) {
      return {
        ...existingHealth,
        started: false,
      };
    }
    if (existingHealth.status === 'missing-runtime' || existingHealth.status === 'missing-dependencies') {
      throw new Error(existingHealth.status === 'missing-dependencies'
        ? `Edge-TTS 依赖缺失：${existingHealth.missingPackages.join(', ')}。请先在语音设置里安装 Edge-TTS 依赖。`
        : existingHealth.error || '未找到可用的 Python 运行环境。');
    }

    if (startPromise) {
      await startPromise;
      const health = await getHealth(settings);
      return {
        ...health,
        started: false,
      };
    }

    startPromise = startProcess(baseUrl, settings);

    try {
      await startPromise;
      const health = await getHealth(settings);
      return {
        ...health,
        started: true,
      };
    } finally {
      startPromise = null;
    }
  }

  return ensureStarted;
}

module.exports = { createBrowserTtsStartup };
