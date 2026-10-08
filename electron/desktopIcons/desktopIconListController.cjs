const DESKTOP_ICON_CACHE_TTL_MS = 5000;

function createDesktopIconCacheRefresher({ state, fetchDesktopIcons, logMessage }) {
  function refreshDesktopIcons() {
    return fetchDesktopIcons()
      .then((icons) => {
        state.cachedIcons = icons;
        state.cacheUpdatedAt = Date.now();
        logMessage('desktop icons refreshed', { count: icons.length });
        return icons;
      })
      .catch((error) => {
        logMessage('desktop icons refresh failed', error?.stack || error);
        return state.cachedIcons;
      })
      .finally(() => {
        state.pendingRequest = null;
      });
  }
  return refreshDesktopIcons;
}

function createDesktopIconRequestProjector({ resolveDesktopIconReadFallbacks, selectDesktopIconCoordinateSpace }) {
  function projectDesktopIconRequest(request, { includeFileSystemFallback, includeReadOnlyPositionFallback }, coordinateSpace) {
    return request.then(async (icons) => {
      const effectiveIcons = await resolveDesktopIconReadFallbacks(icons, {
        includeFileSystemFallback,
        includeReadOnlyPositionFallback,
      });
      return effectiveIcons.map((icon) => selectDesktopIconCoordinateSpace(icon, coordinateSpace));
    });
  }
  return projectDesktopIconRequest;
}

function createDesktopIconLister({ state, refreshDesktopIcons, projectDesktopIconRequest, normalizeDesktopIconCoordinateSpaceOption, selectDesktopIconCoordinateSpace }) {
  async function listDesktopIcons(options = {}) {
    const forceRefresh = Boolean(options?.forceRefresh);
    const includeFileSystemFallback = Boolean(options?.includeFileSystemFallback);
    const includeReadOnlyPositionFallback = Boolean(options?.includeReadOnlyPositionFallback);
    const wantsFallback = includeFileSystemFallback || includeReadOnlyPositionFallback;
    const coordinateSpace = normalizeDesktopIconCoordinateSpaceOption(options?.coordinateSpace);
    if (
      !forceRefresh
      && state.cacheUpdatedAt > 0
      && Date.now() - state.cacheUpdatedAt <= DESKTOP_ICON_CACHE_TTL_MS
      && (!wantsFallback || state.cachedIcons.length > 0)
    ) {
      return state.cachedIcons.map((icon) => selectDesktopIconCoordinateSpace(icon, coordinateSpace));
    }

    if (state.pendingRequest) {
      return projectDesktopIconRequest(state.pendingRequest, { includeFileSystemFallback, includeReadOnlyPositionFallback }, coordinateSpace);
    }

    state.pendingRequest = refreshDesktopIcons();
    return projectDesktopIconRequest(state.pendingRequest, { includeFileSystemFallback, includeReadOnlyPositionFallback }, coordinateSpace);
  }
  return listDesktopIcons;
}

function createDesktopIconListController(dependencies) {
  const refreshDesktopIcons = createDesktopIconCacheRefresher(dependencies);
  const projectDesktopIconRequest = createDesktopIconRequestProjector(dependencies);
  return createDesktopIconLister({
    state: dependencies.state, refreshDesktopIcons, projectDesktopIconRequest,
    normalizeDesktopIconCoordinateSpaceOption: dependencies.normalizeDesktopIconCoordinateSpaceOption,
    selectDesktopIconCoordinateSpace: dependencies.selectDesktopIconCoordinateSpace,
  });
}

module.exports = { createDesktopIconListController };
