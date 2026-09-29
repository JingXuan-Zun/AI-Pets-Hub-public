const fs = require('fs');
const path = require('path');

const APP_RUNTIME_FILE_NAME = 'app-runtime-usage.v1.json';

function finiteNonNegativeInteger(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : fallback;
}

function readAccumulatedRuntimeMs(storagePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
    return finiteNonNegativeInteger(parsed?.accumulatedMs);
  } catch {
    return 0;
  }
}

/**
 * One main-process clock shared by all renderer windows.  Keeping it here
 * avoids counting the main, settings and chat renderers as separate app runs.
 */
function createAppUsageMetricsService({ storageDirectory, startedAt = Date.now() }) {
  const storagePath = path.join(storageDirectory, APP_RUNTIME_FILE_NAME);
  const accumulatedBeforeSessionMs = readAccumulatedRuntimeMs(storagePath);

  function getSnapshot() {
    const sessionMs = Math.max(0, Date.now() - startedAt);
    return {
      sessionMs,
      totalMs: accumulatedBeforeSessionMs + sessionMs,
    };
  }

  function persist() {
    const snapshot = getSnapshot();
    try {
      fs.mkdirSync(storageDirectory, { recursive: true });
      fs.writeFileSync(storagePath, JSON.stringify({
        accumulatedMs: snapshot.totalMs,
        updatedAt: new Date().toISOString(),
        version: 1,
      }), 'utf8');
      return true;
    } catch {
      return false;
    }
  }

  return {
    getSnapshot,
    persist,
  };
}

module.exports = {
  createAppUsageMetricsService,
};
