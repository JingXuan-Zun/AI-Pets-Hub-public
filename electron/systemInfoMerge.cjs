const os = require('os');

function mergeCpuInfo(nodeCpu, nativeInfo) {
  const nativeCpu = nativeInfo?.cpu ?? {};
  return {
    logicalCores: nativeCpu.logicalCores || nodeCpu.logicalCores,
    manufacturer: nativeCpu.manufacturer || '',
    maxClockMHz: nativeCpu.maxClockMHz || 0,
    model: nativeCpu.model || nodeCpu.model,
    physicalCores: nativeCpu.physicalCores || 0,
    speedMHz: nativeCpu.maxClockMHz || nodeCpu.speedMHz,
    source: nativeCpu.model ? 'windows-native' : 'node-os',
  };
}

function mergeMemoryInfo(nodeMemory, nativeInfo) {
  const nativeMemory = nativeInfo?.memory ?? {};
  const nativeComputer = nativeInfo?.computer ?? {};
  return {
    freeBytes: nativeMemory.freePhysicalBytes || nodeMemory.freeBytes,
    freePhysicalBytes: nativeMemory.freePhysicalBytes || 0,
    installedBytes: nativeComputer.totalPhysicalMemoryBytes || 0,
    source: nativeMemory.totalVisibleBytes || nativeComputer.totalPhysicalMemoryBytes ? 'windows-native' : 'node-os',
    totalBytes: nativeMemory.totalVisibleBytes || nativeComputer.totalPhysicalMemoryBytes || nodeMemory.totalBytes,
    totalVisibleBytes: nativeMemory.totalVisibleBytes || 0,
  };
}

function mergeOsInfo(nativeInfo) {
  const nativeOs = nativeInfo?.os ?? {};
  const captionParts = [
    nativeOs.caption || getOsVersion(),
    nativeOs.displayVersion,
  ].filter(Boolean);
  const caption = captionParts.join(' ');
  const versionParts = [
    nativeOs.version,
    nativeOs.buildNumber ? `Build ${nativeOs.buildNumber}` : '',
  ].filter(Boolean);

  return {
    arch: nativeOs.architecture || os.arch(),
    osBuildNumber: nativeOs.buildNumber || '',
    osCaption: caption,
    osInstallDate: nativeOs.installDate || '',
    osLastBootUpTime: nativeOs.lastBootUpTime || '',
    osRelease: os.release(),
    osType: os.type(),
    osVersion: versionParts.length ? versionParts.join(' ') : getOsVersion(),
    platform: process.platform,
    source: nativeOs.caption ? 'windows-native' : 'node-os',
  };
}

function mergeGpuInfo(electronGpu, nativeInfo) {
  const nativeDevices = Array.isArray(nativeInfo?.gpu) ? nativeInfo.gpu : [];
  const electronDevices = Array.isArray(electronGpu?.devices) ? electronGpu.devices : [];
  const devices = nativeDevices.length
    ? nativeDevices
    : electronDevices.map((device) => ({
        ...device,
        source: 'electron',
      }));

  return {
    ...electronGpu,
    devices,
    source: nativeDevices.length ? 'windows-native' : 'electron',
  };
}

function getOsVersion() {
  if (typeof os.version === 'function') {
    return os.version();
  }

  return '';
}

module.exports = {
  mergeCpuInfo,
  mergeMemoryInfo,
  mergeOsInfo,
  mergeGpuInfo,
};
