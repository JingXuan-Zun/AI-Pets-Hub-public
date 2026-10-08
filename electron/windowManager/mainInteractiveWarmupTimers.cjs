function createMainInteractiveWarmupTimers({
  getPlatform, PREWARM_MAIN_INTERACTIVE_LAYER, getWarmupCompleted,
  getWarmupTimer, setWarmupTimer, getRestoreTimer, setRestoreTimer,
  warmMainInteractiveLayer, MAIN_INTERACTIVE_LAYER_WARMUP_DELAY_MS, setTimeout, clearTimeout,
}) {
  function clearMainInteractiveLayerWarmupTimers() {
    if (getWarmupTimer()) {
      clearTimeout(getWarmupTimer());
      setWarmupTimer(null);
    }
    if (getRestoreTimer()) {
      clearTimeout(getRestoreTimer());
      setRestoreTimer(null);
    }
  }

  function scheduleMainInteractiveLayerWarmup() {
    if (
      getPlatform() !== 'win32'
      || !PREWARM_MAIN_INTERACTIVE_LAYER
      || getWarmupCompleted()
      || getWarmupTimer()
      || getRestoreTimer()
    ) {
      return;
    }

    setWarmupTimer(setTimeout(
      warmMainInteractiveLayer,
      MAIN_INTERACTIVE_LAYER_WARMUP_DELAY_MS,
    ));
    if (typeof getWarmupTimer().unref === 'function') {
      getWarmupTimer().unref();
    }
  }

  return { clearMainInteractiveLayerWarmupTimers, scheduleMainInteractiveLayerWarmup };
}

module.exports = { createMainInteractiveWarmupTimers };
