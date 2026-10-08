const os = require('os');
const { toFiniteNumber } = require('./systemInfoRules.cjs');

function normalizeCpuInfo() {
  const cpus = Array.isArray(os.cpus()) ? os.cpus() : [];
  const firstCpu = cpus[0] || null;

  return {
    logicalCores: cpus.length,
    model: typeof firstCpu?.model === 'string' ? firstCpu.model.trim() : '',
    speedMHz: toFiniteNumber(firstCpu?.speed, 0),
  };
}

function normalizeMemoryInfo() {
  return {
    freeBytes: toFiniteNumber(os.freemem(), 0),
    totalBytes: toFiniteNumber(os.totalmem(), 0),
  };
}

function getUptimeSeconds() {
  return Math.max(0, Math.round(toFiniteNumber(os.uptime(), 0)));
}

module.exports = { normalizeCpuInfo, normalizeMemoryInfo, getUptimeSeconds };
