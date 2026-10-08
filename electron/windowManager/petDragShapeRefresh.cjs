function createDeferredPetDragShapeTaker({
  shapeState,
}) {
  return function takeDeferredShapeAfterPetDragHold() {
    const deferredRegions = shapeState.getPendingRegions();
    const deferredReceivedAt = shapeState.getPendingReceivedAt();
    shapeState.setPendingRegions(null);
    shapeState.setPendingSignature('');
    shapeState.setPendingReceivedAt(0);
    return { deferredRegions, deferredReceivedAt };
  };
}

function createPetDragNativeShapeRefreshScheduler({
  getMainWindow, setTimeout,
}) {
  return function scheduleNativeShapeRefreshAfterPetDragHold(reason) {
    if (!getMainWindow() || getMainWindow().isDestroyed()) {
      return;
    }

    setTimeout(() => {
      if (!getMainWindow() || getMainWindow().isDestroyed()) {
        return;
      }

      getMainWindow().webContents.send('desktop-pet:refresh-native-interactive-regions', {
        reason,
      });
    }, 0);
  };
}

function createPetDragFreshShapeRequester({
  shapeState, pointerDiagnosticsEnabled, logWindowEvent, summarizeInteractiveRegion, scheduleNativeShapeRefreshAfterPetDragHold,
}) {
  return function requestFreshShapeAfterPetDragHold(deferredRegions, deferredReceivedAt) {
    if (!deferredRegions) {
      if (pointerDiagnosticsEnabled) {
        logWindowEvent('main-window: kept pet drag full-window shape after hold without deferred shape');
      }
      scheduleNativeShapeRefreshAfterPetDragHold('missing-deferred-shape');
      return;
    }

    if (
      deferredRegions.length === 0
      || (
        shapeState.getEndedAt() > 0
        && deferredReceivedAt <= shapeState.getEndedAt()
      )
    ) {
      if (pointerDiagnosticsEnabled) {
        logWindowEvent(
          `main-window: ignored stale deferred interactive shape after pet drag hold `
          + `count=${deferredRegions.length} `
          + `receivedAt=${deferredReceivedAt} endedAt=${shapeState.getEndedAt()}`,
        );
      }
      scheduleNativeShapeRefreshAfterPetDragHold('stale-deferred-shape');
      return;
    }

    if (pointerDiagnosticsEnabled) {
      logWindowEvent(
        `main-window: discarded deferred interactive shape after pet drag hold; requesting fresh shape `
        + `count=${deferredRegions.length} `
        + `first=${summarizeInteractiveRegion(deferredRegions[0])}`,
      );
    }
    scheduleNativeShapeRefreshAfterPetDragHold('post-drag-hold-expired');
  };
}

function createPetDragShapeRefresh(dependencies) {
  const takeDeferredShapeAfterPetDragHold = createDeferredPetDragShapeTaker(dependencies);
  const scheduleNativeShapeRefreshAfterPetDragHold = createPetDragNativeShapeRefreshScheduler(dependencies);
  const requestFreshShapeAfterPetDragHold = createPetDragFreshShapeRequester({ ...dependencies, scheduleNativeShapeRefreshAfterPetDragHold });
  return { takeDeferredShapeAfterPetDragHold, requestFreshShapeAfterPetDragHold, scheduleNativeShapeRefreshAfterPetDragHold };
}

module.exports = { createPetDragShapeRefresh };
