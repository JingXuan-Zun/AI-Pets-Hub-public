function buildModeWorkerSlotKey(baseWorkerKey, poolSize, slotIndex) {
  return poolSize > 1
    ? `${baseWorkerKey}::pool-${slotIndex + 1}`
    : baseWorkerKey;
}

function getModeWorkerLoad(worker) {
  return (worker.activeRequestCount || 0) + worker.pending.size;
}

function selectLeastBusyModeWorker(workers) {
  return workers
    .slice()
    .sort((left, right) => (
      getModeWorkerLoad(left) - getModeWorkerLoad(right)
      || left.slotIndex - right.slotIndex
    ))[0];
}

function releaseModeWorkerReservation(worker) {
  if (!worker) {
    return;
  }

  worker.activeRequestCount = Math.max(0, (worker.activeRequestCount || 0) - 1);
}

function createLocalVoiceWorkerPool({ modeWorkerPool, ttsPoolSize, defaultPoolSize }) {
  function getModeWorkerPoolSize(mode) {
    return mode === 'tts' ? ttsPoolSize : defaultPoolSize;
  }

  function getModeWorkers(baseWorkerKey) {
    return [...modeWorkerPool.values()]
      .filter((worker) => worker.baseKey === baseWorkerKey && !worker.destroyed);
  }

  function getNextModeWorkerSlotIndex(baseWorkerKey, poolSize) {
    for (let slotIndex = 0; slotIndex < poolSize; slotIndex += 1) {
      const slotKey = buildModeWorkerSlotKey(baseWorkerKey, poolSize, slotIndex);
      const worker = modeWorkerPool.get(slotKey);
      if (!worker || worker.destroyed) {
        return slotIndex;
      }
    }

    return Math.max(0, poolSize - 1);
  }

  return {
    getModeWorkerPoolSize,
    buildModeWorkerSlotKey,
    getModeWorkers,
    getNextModeWorkerSlotIndex,
    getModeWorkerLoad,
    selectLeastBusyModeWorker,
    releaseModeWorkerReservation,
  };
}

module.exports = { createLocalVoiceWorkerPool };
