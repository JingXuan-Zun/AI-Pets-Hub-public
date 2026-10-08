function createNativeDisplayCache({ getNativeDisplayBounds, NATIVE_DISPLAY_BOUNDS_CACHE_TTL_MS }) {
  let nativeDisplayBoundsCache = {
    displays: [],
    updatedAt: 0,
  };

  function isNativeDisplayBoundsCacheFresh() {
    return nativeDisplayBoundsCache.updatedAt > 0
      && (Date.now() - nativeDisplayBoundsCache.updatedAt) <= NATIVE_DISPLAY_BOUNDS_CACHE_TTL_MS;
  }

  function invalidateNativeDisplayBoundsCache() {
    nativeDisplayBoundsCache = {
      displays: [],
      updatedAt: 0,
    };
  }

  async function getNativeDisplayBoundsCached(options = {}) {
    if (!options.forceRefresh && isNativeDisplayBoundsCacheFresh()) {
      return nativeDisplayBoundsCache.displays;
    }

    const displays = await getNativeDisplayBounds();
    nativeDisplayBoundsCache = {
      displays,
      updatedAt: Date.now(),
    };

    return displays;
  }

  return { invalidateNativeDisplayBoundsCache, getNativeDisplayBoundsCached };
}

module.exports = { createNativeDisplayCache };
