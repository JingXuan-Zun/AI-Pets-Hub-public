const { normalizeGpuDevice } = require('./systemInfoRules.cjs');

async function getGpuInfo(app) {
  const featureStatus = typeof app?.getGPUFeatureStatus === 'function'
    ? app.getGPUFeatureStatus()
    : null;

  if (typeof app?.getGPUInfo !== 'function') {
    return {
      devices: [],
      featureStatus,
    };
  }

  try {
    const rawInfo = await app.getGPUInfo('basic');
    const rawDevices = Array.isArray(rawInfo?.gpuDevice) ? rawInfo.gpuDevice : [];

    return {
      devices: rawDevices
        .map(normalizeGpuDevice)
        .filter(Boolean),
      featureStatus,
    };
  } catch (error) {
    return {
      devices: [],
      error: error instanceof Error ? error.message : String(error),
      featureStatus,
    };
  }
}

module.exports = { getGpuInfo };
