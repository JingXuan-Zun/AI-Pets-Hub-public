function createNativeShapeStateAdapter(managerState) {
  return {
    getRegions: () => managerState.interactiveWindowShapeRegions,
    getApplied: () => managerState.interactiveWindowShapeApplied, setApplied: (applied) => { managerState.interactiveWindowShapeApplied = applied; },
    getPointerPassthrough: () => managerState.isPointerPassthrough, setPointerPassthrough: (ignore) => { managerState.isPointerPassthrough = ignore; },
    getPointerPassthroughForwarding: () => managerState.isPointerPassthroughForwarding,
    setPointerPassthroughForwarding: (forward) => { managerState.isPointerPassthroughForwarding = forward; },
    getRequestedPointerPassthrough: () => managerState.requestedPointerPassthrough,
  };
}

function createPostDragInputProxyStateAdapter(managerState) {
  return {
    getWindow: () => managerState.postDragInputProxyWindow, setWindow: (win) => { managerState.postDragInputProxyWindow = win; },
    getReady: () => managerState.postDragInputProxyReady, setReady: (ready) => { managerState.postDragInputProxyReady = ready; },
    getPointerActive: () => managerState.postDragInputProxyPointerActive,
    setPointerActive: (active) => { managerState.postDragInputProxyPointerActive = active; },
    getRegions: () => managerState.postDragInputProxyRegions, setRegions: (regions) => { managerState.postDragInputProxyRegions = regions; },
    getPendingRegions: () => managerState.postDragInputProxyPendingRegions,
    setPendingRegions: (regions) => { managerState.postDragInputProxyPendingRegions = regions; },
    getShapeSignature: () => managerState.postDragInputProxyShapeSignature,
    setShapeSignature: (signature) => { managerState.postDragInputProxyShapeSignature = signature; },
    getIdleDestroyTimer: () => managerState.postDragInputProxyIdleDestroyTimer,
    setIdleDestroyTimer: (timer) => { managerState.postDragInputProxyIdleDestroyTimer = timer; },
  };
}

function createInteractiveShapeStateAdapter(managerState) {
  return {
    getRegions: () => managerState.interactiveWindowShapeRegions, setRegions: (regions) => { managerState.interactiveWindowShapeRegions = regions; },
    getSignature: () => managerState.interactiveWindowShapeSignature,
    setSignature: (signature) => { managerState.interactiveWindowShapeSignature = signature; },
    getApplied: () => managerState.interactiveWindowShapeApplied,
    getPendingRegions: () => managerState.pendingInteractiveWindowShapeRegionsAfterPetDragHold,
    setPendingRegions: (regions) => { managerState.pendingInteractiveWindowShapeRegionsAfterPetDragHold = regions; },
    setPendingSignature: (signature) => { managerState.pendingInteractiveWindowShapeSignatureAfterPetDragHold = signature; },
    getPendingReceivedAt: () => managerState.pendingInteractiveWindowShapeReceivedAtAfterPetDragHold,
    setPendingReceivedAt: (time) => { managerState.pendingInteractiveWindowShapeReceivedAtAfterPetDragHold = time; },
    getHoldTimer: () => managerState.petDragFullWindowShapeHoldTimer, setHoldTimer: (timer) => { managerState.petDragFullWindowShapeHoldTimer = timer; },
    getEndedAt: () => managerState.petDragFullWindowShapeEndedAt, setEndedAt: (time) => { managerState.petDragFullWindowShapeEndedAt = time; },
    getHoldUntil: () => managerState.petDragFullWindowShapeHoldUntil, setHoldUntil: (time) => { managerState.petDragFullWindowShapeHoldUntil = time; },
    getPetDragNativeShapeActive: () => managerState.petDragNativeShapeActive,
    setPetDragNativeShapeActive: (active) => { managerState.petDragNativeShapeActive = active; },
    getRequestedPointerPassthrough: () => managerState.requestedPointerPassthrough,
  };
}

module.exports = {
  createNativeShapeStateAdapter,
  createPostDragInputProxyStateAdapter,
  createInteractiveShapeStateAdapter,
};
