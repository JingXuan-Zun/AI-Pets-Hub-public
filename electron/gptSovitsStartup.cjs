const { normalizeGptSovitsBaseUrl, normalizeGptSovitsDevice } = require('./gptSovitsRules.cjs');

const STARTABLE_STATUSES = new Set(['ready', 'stopped', 'error']);

function createGptSovitsStartup({ getHealth, processControl }) {
  let startPromise = null;

  async function startOnce(settings) {
    if (!startPromise) {
      startPromise = processControl.start(normalizeGptSovitsBaseUrl(settings?.gptSovitsApiUrl), settings)
        .finally(() => {
          startPromise = null;
        });
    }
    await startPromise;
  }

  // Starts (or restarts on device change) the sidecar; concurrent callers share one start.
  async function ensureStarted(settings) {
    const health = await getHealth(settings);
    if (!STARTABLE_STATUSES.has(health.status)) {
      throw new Error(health.error);
    }
    const wantedDevice = normalizeGptSovitsDevice(settings?.gptSovitsDevice);
    const runningDevice = processControl.getRunningDevice();
    if (health.available && (runningDevice === null || runningDevice === wantedDevice)) {
      return { ...health, started: false };
    }
    if (runningDevice !== null && runningDevice !== wantedDevice) {
      processControl.stop();
    }
    await startOnce(settings);
    return { ...(await getHealth(settings)), started: true };
  }

  return ensureStarted;
}

module.exports = { createGptSovitsStartup };
