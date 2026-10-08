const {
  toFiniteNumber,
  normalizePositiveInteger,
  normalizeOptionalString,
  normalizeNativeGpuDevice,
} = require('./systemInfoRules.cjs');

function normalizeNativeComputer(computer) {
  return {
    manufacturer: normalizeOptionalString(computer.manufacturer),
    model: normalizeOptionalString(computer.model),
    totalPhysicalMemoryBytes: toFiniteNumber(computer.totalPhysicalMemoryBytes, 0),
  };
}

function normalizeNativeCpu(cpu) {
  return {
    logicalCores: normalizePositiveInteger(cpu.logicalCores, 0),
    manufacturer: normalizeOptionalString(cpu.manufacturer),
    maxClockMHz: normalizePositiveInteger(cpu.maxClockMHz, 0),
    model: normalizeOptionalString(cpu.model),
    physicalCores: normalizePositiveInteger(cpu.physicalCores, 0),
  };
}

function normalizeNativeMemory(memory) {
  return {
    freePhysicalBytes: toFiniteNumber(memory.freePhysicalBytes, 0),
    totalVisibleBytes: toFiniteNumber(memory.totalVisibleBytes, 0),
  };
}

function normalizeNativeOs(osInfo) {
  return {
    architecture: normalizeOptionalString(osInfo.architecture),
    buildNumber: normalizeOptionalString(osInfo.buildNumber),
    caption: normalizeOptionalString(osInfo.caption),
    displayVersion: normalizeOptionalString(osInfo.displayVersion),
    editionId: normalizeOptionalString(osInfo.editionId),
    installDate: normalizeOptionalString(osInfo.installDate),
    lastBootUpTime: normalizeOptionalString(osInfo.lastBootUpTime),
    version: normalizeOptionalString(osInfo.version),
  };
}

function normalizeWindowsSystemInfo(rawInfo) {
  if (!rawInfo || typeof rawInfo !== 'object' || rawInfo.error) {
    return {
      error: normalizeOptionalString(rawInfo?.error),
    };
  }

  const cpu = rawInfo.cpu && typeof rawInfo.cpu === 'object' ? rawInfo.cpu : {};
  const computer = rawInfo.computer && typeof rawInfo.computer === 'object' ? rawInfo.computer : {};
  const memory = rawInfo.memory && typeof rawInfo.memory === 'object' ? rawInfo.memory : {};
  const osInfo = rawInfo.os && typeof rawInfo.os === 'object' ? rawInfo.os : {};
  const gpuItems = Array.isArray(rawInfo.gpu) ? rawInfo.gpu : [rawInfo.gpu].filter(Boolean);
  const errors = Array.isArray(rawInfo.errors)
    ? rawInfo.errors.map(normalizeOptionalString).filter(Boolean)
    : [];

  return {
    computer: normalizeNativeComputer(computer),
    cpu: normalizeNativeCpu(cpu),
    gpu: gpuItems
      .map(normalizeNativeGpuDevice)
      .filter(Boolean),
    memory: normalizeNativeMemory(memory),
    os: normalizeNativeOs(osInfo),
    source: 'windows-native',
    warnings: errors,
  };
}

module.exports = { normalizeWindowsSystemInfo };
