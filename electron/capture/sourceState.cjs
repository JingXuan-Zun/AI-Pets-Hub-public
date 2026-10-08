function createCaptureSourceState(dependencies) {
  let captureSourceCacheByKey = new Map();
  let captureSourceRequestByKey = new Map();
  const { invalidateAreaPickerScreenSourceCache, invalidateNativeDisplayBoundsCache } = dependencies;
  function invalidateCaptureSourceCache() {
    captureSourceCacheByKey = new Map();
    captureSourceRequestByKey = new Map();
    invalidateAreaPickerScreenSourceCache();
    invalidateNativeDisplayBoundsCache();
  }
  return {
    getCache: () => captureSourceCacheByKey,
    getRequests: () => captureSourceRequestByKey,
    invalidateCaptureSourceCache,
  };
}

module.exports = { createCaptureSourceState };
