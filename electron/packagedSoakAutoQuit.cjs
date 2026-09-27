function parsePositiveMs(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function schedulePackagedSoakAutoQuit(options = {}) {
  const {
    app,
    env = process.env,
    isDev = false,
    isLocalTest = false,
    log = () => {},
    setTimeoutFn = setTimeout,
  } = options;
  const delayMs = parsePositiveMs(env.DESKTOP_PET_PACKAGED_SOAK_AUTO_QUIT_MS);
  if (!app || isDev || isLocalTest || delayMs <= 0) {
    return { delayMs, scheduled: false };
  }

  log('packaged soak auto quit scheduled', { delayMs });
  const timer = setTimeoutFn(() => {
    log('packaged soak auto quit triggered', { delayMs });
    app.quit();
  }, delayMs);
  timer?.unref?.();
  return { delayMs, scheduled: true };
}

module.exports = {
  parsePositiveMs,
  schedulePackagedSoakAutoQuit,
};
