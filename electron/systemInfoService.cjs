const {
  mergeCpuInfo,
  mergeMemoryInfo,
  mergeOsInfo,
  mergeGpuInfo,
} = require('./systemInfoMerge.cjs');
const { getWindowsSystemInfoPowerShellScript } = require('./systemInfoWindowsScript.cjs');
const { runWindowsSystemInfoPowerShell } = require('./systemInfoWindowsCollector.cjs');
const { normalizeCpuInfo, normalizeMemoryInfo, getUptimeSeconds } = require('./systemInfoNodeReadings.cjs');
const { getGpuInfo } = require('./systemInfoElectronGpu.cjs');
const { normalizeWindowsSystemInfo } = require('./systemInfoNativeResults.cjs');

function createSystemInfoService({ app } = {}) {
  return {
    async getSystemInfo() {
      const [nativeInfo, electronGpu] = await Promise.all([
        runWindowsSystemInfoPowerShell().then(normalizeWindowsSystemInfo),
        getGpuInfo(app),
      ]);
      const osInfo = mergeOsInfo(nativeInfo);

      return {
        arch: osInfo.arch,
        computer: nativeInfo?.computer ?? null,
        cpu: mergeCpuInfo(normalizeCpuInfo(), nativeInfo),
        dataSources: {
          native: nativeInfo?.source ?? null,
          nativeError: nativeInfo?.error ?? '',
          nativeWarnings: nativeInfo?.warnings ?? [],
        },
        gpu: mergeGpuInfo(electronGpu, nativeInfo),
        memory: mergeMemoryInfo(normalizeMemoryInfo(), nativeInfo),
        nodeVersion: process.versions?.node ?? '',
        chromeVersion: process.versions?.chrome ?? '',
        electronVersion: process.versions?.electron ?? '',
        osBuildNumber: osInfo.osBuildNumber,
        osCaption: osInfo.osCaption,
        osInstallDate: osInfo.osInstallDate,
        osLastBootUpTime: osInfo.osLastBootUpTime,
        osRelease: osInfo.osRelease,
        osType: osInfo.osType,
        osVersion: osInfo.osVersion,
        platform: osInfo.platform,
        updatedAt: Date.now(),
        uptimeSeconds: getUptimeSeconds(),
      };
    },
  };
}

module.exports = {
  createSystemInfoService,
  getWindowsSystemInfoPowerShellScript,
};
