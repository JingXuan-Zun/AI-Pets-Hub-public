function createPetDragHoldTimerClearer({
  shapeState, clearTimeout,
}) {
  return function clearPetDragFullWindowShapeHoldTimer() {
    if (shapeState.getHoldTimer()) {
      clearTimeout(shapeState.getHoldTimer());
      shapeState.setHoldTimer(null);
    }
  };
}

function createDeferredPetDragShapeExpiryApplier({
  shapeState, getCurrentTime, hidePostDragInputProxy, takeDeferredShapeAfterPetDragHold,
  requestFreshShapeAfterPetDragHold, schedulePetDragFullWindowShapeHoldExpiry,
}) {
  return function applyDeferredInteractiveShapeAfterPetDragHold() {
    shapeState.setHoldTimer(null);

    if (shapeState.getPetDragNativeShapeActive()) {
      return;
    }

    const now = getCurrentTime();
    if (now < shapeState.getHoldUntil()) {
      schedulePetDragFullWindowShapeHoldExpiry();
      return;
    }

    hidePostDragInputProxy('post-drag-shape-hold-expired');

    const { deferredRegions, deferredReceivedAt } = takeDeferredShapeAfterPetDragHold();
    requestFreshShapeAfterPetDragHold(deferredRegions, deferredReceivedAt);
  };
}

function createPetDragHoldExpiryScheduler({
  shapeState, getCurrentTime, setTimeout, clearPetDragFullWindowShapeHoldTimer, applyDeferredInteractiveShapeAfterPetDragHold,
}) {
  return function schedulePetDragFullWindowShapeHoldExpiry() {
    clearPetDragFullWindowShapeHoldTimer();

    const delayMs = Math.max(0, shapeState.getHoldUntil() - getCurrentTime());
    if (delayMs <= 0) {
      applyDeferredInteractiveShapeAfterPetDragHold();
      return;
    }

    shapeState.setHoldTimer(setTimeout(
      applyDeferredInteractiveShapeAfterPetDragHold,
      delayMs,
    ));
    if (typeof shapeState.getHoldTimer().unref === 'function') {
      shapeState.getHoldTimer().unref();
    }
  };
}

function createPetDragShapeHoldTimers({
  shapeState, getCurrentTime, setTimeout, clearTimeout, hidePostDragInputProxy,
  takeDeferredShapeAfterPetDragHold, requestFreshShapeAfterPetDragHold,
}) {
  const clearPetDragFullWindowShapeHoldTimer = createPetDragHoldTimerClearer({ shapeState, clearTimeout });
  const applyDeferredInteractiveShapeAfterPetDragHold = createDeferredPetDragShapeExpiryApplier({
    shapeState, getCurrentTime, hidePostDragInputProxy, takeDeferredShapeAfterPetDragHold, requestFreshShapeAfterPetDragHold,
    schedulePetDragFullWindowShapeHoldExpiry: () => schedulePetDragFullWindowShapeHoldExpiry(),
  });
  const schedulePetDragFullWindowShapeHoldExpiry = createPetDragHoldExpiryScheduler({
    shapeState, getCurrentTime, setTimeout, clearPetDragFullWindowShapeHoldTimer, applyDeferredInteractiveShapeAfterPetDragHold,
  });
  return { clearPetDragFullWindowShapeHoldTimer, schedulePetDragFullWindowShapeHoldExpiry };
}

module.exports = { createPetDragShapeHoldTimers };
