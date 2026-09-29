const { app, BrowserWindow, desktopCapturer, screen } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  buildFilteredWindowCaptureSources,
  captureSourceTitleMatchesVisibleSet,
  mergeCaptureSourceLists,
  normalizeCaptureSourceTitle,
} = require('./captureSourceFilters.cjs');
const {
  getNativeDisplayBoundsPowerShellScript,
  getNativeScreenPreviewPowerShellScript,
  getNativeWindowCaptureSourcesPowerShellScript,
  getVisibleWindowTitlesPowerShellScript,
} = require('./capturePowerShellScripts.cjs');

const CAPTURE_SOURCE_TYPES = ['screen', 'window'];
const DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS = 120;
const CAPTURE_SOURCE_REFRESH_DELAY_MS = 420;
const CAPTURE_SOURCE_CACHE_TTL_MS = 300000;
const CAPTURE_SOURCE_THUMBNAIL_SIZE = { width: 240, height: 135 };
const CAPTURE_SOURCE_ANALYSIS_THUMBNAIL_SIZE = { width: 960, height: 540 };
const CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE = { width: 0, height: 0 };
const CAPTURE_SOURCE_SCREEN_LIST_PLACEHOLDER_SIZE = { width: 320, height: 180 };
const CAPTURE_SOURCE_WINDOW_LIST_PLACEHOLDER_SIZE = { width: 320, height: 180 };
const VISIBLE_WINDOW_TITLES_CACHE_TTL_MS = 4000;
const AREA_PICKER_PREVIEW_THUMBNAIL_SIZE = { width: 960, height: 540 };
const AREA_PICKER_MAX_PREVIEW_WIDTH = 5120;
const AREA_PICKER_MAX_PREVIEW_HEIGHT = 2880;
const AREA_PICKER_SCREEN_SOURCE_CACHE_TTL_MS = 15000;
const NATIVE_DISPLAY_BOUNDS_CACHE_TTL_MS = 15000;

function createCaptureService(options = {}) {
  const {
    getSettingsWindow = () => null,
    getShellRendererWindows: getShellRendererWindowsOption = () => [],
  } = options;

  let shellRendererWindowsProvider = getShellRendererWindowsOption;
  let settingsWindowProvider = getSettingsWindow;
  let displayEnvironmentBroadcastTimer = null;
  let captureSourceRefreshTimer = null;
  let captureSourceCacheByKey = new Map();
  let captureSourceRequestByKey = new Map();
  let visibleWindowTitlesCache = null;
  let visibleWindowTitlesCacheUpdatedAt = 0;
  let areaPickerScreenSourceCache = [];
  let areaPickerScreenSourceCacheUpdatedAt = 0;
  let areaPickerScreenSourceCacheKey = '';
  let nativeDisplayBoundsCache = {
    displays: [],
    updatedAt: 0,
  };
  let activityRegionConfig = {
    displayId: 'primary',
    areaScale: 55,
  };

function clampAreaScale(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 55;
  }

  return Math.max(30, Math.min(100, Math.round(numericValue)));
}

function getTargetDisplay() {
  if (activityRegionConfig.displayId !== 'primary') {
    const matchedDisplay = screen.getAllDisplays().find(
      (display) => String(display.id) === String(activityRegionConfig.displayId),
    );
    if (matchedDisplay) {
      return matchedDisplay;
    }
  }

  return screen.getPrimaryDisplay();
}

function getFullDisplayBounds(display) {
  return display.bounds || display.workArea;
}

function getDisplayScaleFactor(display) {
  return Number.isFinite(display?.scaleFactor) && display.scaleFactor > 0
    ? display.scaleFactor
    : 1;
}

function createFallbackNativeDisplayBounds(bounds, scaleFactor) {
  return {
    x: Math.round(bounds.x * scaleFactor),
    y: Math.round(bounds.y * scaleFactor),
    width: Math.max(1, Math.round(bounds.width * scaleFactor)),
    height: Math.max(1, Math.round(bounds.height * scaleFactor)),
  };
}

function createDisplayListItem(display, nativeBounds = null) {
  const bounds = getFullDisplayBounds(display);
  const scaleFactor = getDisplayScaleFactor(display);
  const fallbackNativeBounds = createFallbackNativeDisplayBounds(bounds, scaleFactor);

  return {
    id: String(display.id),
    label: display.label || `屏幕 ${display.id}`,
    isPrimary: display.id === screen.getPrimaryDisplay().id,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    nativeX: nativeBounds?.x ?? fallbackNativeBounds.x,
    nativeY: nativeBounds?.y ?? fallbackNativeBounds.y,
    nativeWidth: nativeBounds?.width ?? fallbackNativeBounds.width,
    nativeHeight: nativeBounds?.height ?? fallbackNativeBounds.height,
    nativeBoundsSource: nativeBounds ? 'windows' : 'electron-scale',
    workAreaX: display.workArea.x,
    workAreaY: display.workArea.y,
    workAreaWidth: display.workArea.width,
    workAreaHeight: display.workArea.height,
    scaleFactor,
  };
}

function getDisplayList() {
  return createDisplayList();
}

function createDisplayList(nativeDisplays = []) {
  const usedNativeDisplayIndexes = new Set();

  return screen.getAllDisplays().map((display) => {
    const fallbackItem = createDisplayListItem(display);
    const nativeBounds = resolveNativeDisplayBounds(
      fallbackItem,
      nativeDisplays,
      usedNativeDisplayIndexes,
    );

    return createDisplayListItem(display, nativeBounds);
  });
}

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

async function getDisplayListWithNativeBounds(options = {}) {
  const nativeDisplays = await getNativeDisplayBoundsCached(options);
  return createDisplayList(nativeDisplays);
}

async function getCaptureSourceList(options = {}) {
  return getCaptureSourceListWithOptions(options);
}

function normalizeCaptureSourceTypes(types) {
  const requestedTypes = Array.isArray(types)
    ? types
    : [];
  const normalizedTypes = CAPTURE_SOURCE_TYPES.filter((type) => requestedTypes.includes(type));
  return normalizedTypes.length
    ? normalizedTypes
    : [...CAPTURE_SOURCE_TYPES];
}

function getCaptureSourceCacheKey(types) {
  return normalizeCaptureSourceTypes(types).join(',');
}

function getCaptureSourceCacheEntry(types) {
  return captureSourceCacheByKey.get(getCaptureSourceCacheKey(types)) ?? {
    sources: [],
    updatedAt: 0,
  };
}

function getCachedCaptureSources(types) {
  return getCaptureSourceCacheEntry(types).sources;
}

function isCaptureSourceCacheFresh(types) {
  const cacheEntry = getCaptureSourceCacheEntry(types);
  return cacheEntry.updatedAt > 0
    && (Date.now() - cacheEntry.updatedAt) <= CAPTURE_SOURCE_CACHE_TTL_MS;
}

function hasCaptureSourceCacheEntries(types) {
  return getCachedCaptureSources(types).length > 0;
}

function hasCaptureSourceCacheThumbnails(types) {
  const cachedSources = getCachedCaptureSources(types);
  return cachedSources.length > 0
    && cachedSources.every((source) => source.thumbnail);
}

function primeCaptureSourceCache(types, sources) {
  const normalizedTypes = normalizeCaptureSourceTypes(types);
  const updatedAt = Date.now();
  captureSourceCacheByKey.set(getCaptureSourceCacheKey(normalizedTypes), {
    sources,
    updatedAt,
  });

  if (normalizedTypes.length <= 1) {
    return;
  }

  normalizedTypes.forEach((type) => {
    captureSourceCacheByKey.set(type, {
      sources: sources.filter((source) => source.type === type),
      updatedAt,
    });
  });
}

function getRendererWindows() {
  return BrowserWindow.getAllWindows();
}

function getShellRendererWindows() {
  return getLiveRendererWindows(shellRendererWindowsProvider());
}

function getLiveRendererWindows(windows) {
  return (Array.isArray(windows) ? windows : [])
    .filter((win) => win && !win.isDestroyed());
}

function isVisibleWindowTitlesCacheFresh() {
  return Array.isArray(visibleWindowTitlesCache)
    && visibleWindowTitlesCacheUpdatedAt > 0
    && (Date.now() - visibleWindowTitlesCacheUpdatedAt) <= VISIBLE_WINDOW_TITLES_CACHE_TTL_MS;
}

function isAreaPickerScreenSourceCacheFresh() {
  return areaPickerScreenSourceCacheUpdatedAt > 0
    && (Date.now() - areaPickerScreenSourceCacheUpdatedAt) <= AREA_PICKER_SCREEN_SOURCE_CACHE_TTL_MS;
}

function getAreaPickerThumbnailSizeKey(thumbnailSize) {
  return `${Math.max(1, Math.round(thumbnailSize?.width ?? 0))}x${Math.max(1, Math.round(thumbnailSize?.height ?? 0))}`;
}

function invalidateCaptureSourceCache() {
  captureSourceCacheByKey = new Map();
  captureSourceRequestByKey = new Map();
  visibleWindowTitlesCache = null;
  visibleWindowTitlesCacheUpdatedAt = 0;
  areaPickerScreenSourceCache = [];
  areaPickerScreenSourceCacheUpdatedAt = 0;
  areaPickerScreenSourceCacheKey = '';
  invalidateNativeDisplayBoundsCache();
}

function runTemporaryPowerShellScript(script, options = {}) {
  const {
    sta = false,
    timeout = 5000,
    maxBuffer = 1024 * 1024,
  } = options;
  const scriptPath = path.join(
    app.getPath('temp'),
    `desktop-pet-${process.pid}-${Date.now()}-${Math.round(Math.random() * 100000)}.ps1`,
  );

  fs.writeFileSync(scriptPath, script, 'utf8');

  return new Promise((resolve, reject) => {
    const args = [
      '-NoProfile',
      ...(sta ? ['-STA'] : []),
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
    ];

    execFile(
      'powershell.exe',
      args,
      {
        windowsHide: true,
        encoding: 'utf8',
        timeout,
        maxBuffer,
      },
      (error, stdout, stderr) => {
        fs.unlink(scriptPath, () => {});
        if (error) {
          error.stderr = stderr;
          reject(error);
          return;
        }

        resolve(stdout);
      },
    );
  });
}

async function getNativeDisplayBounds() {
  if (process.platform !== 'win32') {
    return [];
  }

  try {
    const stdout = await runTemporaryPowerShellScript(
      getNativeDisplayBoundsPowerShellScript(),
      {
        timeout: 1600,
        maxBuffer: 1024 * 1024,
      },
    );
    const parsed = JSON.parse(String(stdout || '[]').trim() || '[]');
    return (Array.isArray(parsed) ? parsed : [parsed])
      .map((display) => ({
        deviceName: String(display?.deviceName ?? ''),
        isPrimary: Boolean(display?.isPrimary),
        x: Math.round(Number(display?.x ?? 0)),
        y: Math.round(Number(display?.y ?? 0)),
        width: Math.max(1, Math.round(Number(display?.width ?? 1))),
        height: Math.max(1, Math.round(Number(display?.height ?? 1))),
      }))
      .filter((display) => display.width > 0 && display.height > 0);
  } catch (_error) {
    return [];
  }
}

function getNativeDisplayMatchScore(display, nativeDisplay) {
  const scaleFactor = Number.isFinite(display.scaleFactor) && display.scaleFactor > 0
    ? display.scaleFactor
    : 1;
  const scaledDisplay = {
    x: Math.round(display.x * scaleFactor),
    y: Math.round(display.y * scaleFactor),
    width: Math.round(display.width * scaleFactor),
    height: Math.round(display.height * scaleFactor),
  };
  const logicalDisplay = {
    x: Math.round(display.x),
    y: Math.round(display.y),
    width: Math.round(display.width),
    height: Math.round(display.height),
  };
  const logicalSizeScore = Math.abs(nativeDisplay.width - logicalDisplay.width)
    + Math.abs(nativeDisplay.height - logicalDisplay.height);
  const scaledSizeScore = Math.abs(nativeDisplay.width - scaledDisplay.width)
    + Math.abs(nativeDisplay.height - scaledDisplay.height);
  const logicalPositionScore = Math.abs(nativeDisplay.x - logicalDisplay.x)
    + Math.abs(nativeDisplay.y - logicalDisplay.y);
  const scaledPositionScore = Math.abs(nativeDisplay.x - scaledDisplay.x)
    + Math.abs(nativeDisplay.y - scaledDisplay.y);
  const primaryPenalty = display.isPrimary === nativeDisplay.isPrimary ? 0 : 100000;

  return primaryPenalty
    + Math.min(logicalSizeScore, scaledSizeScore) * 10
    + Math.min(logicalPositionScore, scaledPositionScore);
}

function resolveNativeDisplayBounds(display, nativeDisplays, usedNativeDisplayIndexes) {
  if (!Array.isArray(nativeDisplays) || !nativeDisplays.length) {
    return null;
  }

  let bestIndex = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  nativeDisplays.forEach((nativeDisplay, index) => {
    if (usedNativeDisplayIndexes.has(index)) {
      return;
    }

    const score = getNativeDisplayMatchScore(display, nativeDisplay);
    if (score < bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });

  if (bestIndex < 0) {
    return null;
  }

  usedNativeDisplayIndexes.add(bestIndex);
  return nativeDisplays[bestIndex];
}

function getAreaPickerContextSignature(context) {
  if (!context || !context.virtualBounds) {
    return '';
  }

  const displaySignature = Array.isArray(context.displays)
    ? context.displays.map((display) => [
        display.id,
        display.sourceId,
        display.x,
        display.y,
        display.width,
        display.height,
      ].join(':'))
      .join('|')
    : '';

  return [
    context.virtualBounds.x,
    context.virtualBounds.y,
    context.virtualBounds.width,
    context.virtualBounds.height,
    displaySignature,
  ].join('::');
}

function getOwnCaptureWindowTitleSet() {
  return new Set(
    BrowserWindow.getAllWindows()
      .filter((win) => win && !win.isDestroyed())
      .map((win) => normalizeCaptureSourceTitle(win.getTitle()))
      .filter(Boolean),
  );
}

async function getVisibleWindowTitleSet() {
  if (process.platform !== 'win32') {
    return null;
  }

  if (isVisibleWindowTitlesCacheFresh()) {
    return new Set(visibleWindowTitlesCache);
  }

  try {
    const stdout = await new Promise((resolve, reject) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', getVisibleWindowTitlesPowerShellScript()],
        {
          windowsHide: true,
          encoding: 'utf8',
          timeout: 1800,
          maxBuffer: 1024 * 1024,
        },
        (error, output) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(output);
        },
      );
    });

    const parsed = JSON.parse(String(stdout || '[]').trim() || '[]');
    const normalizedTitles = (Array.isArray(parsed) ? parsed : [parsed])
      .map((title) => normalizeCaptureSourceTitle(title))
      .filter(Boolean);
    visibleWindowTitlesCache = Array.from(new Set(normalizedTitles));
    visibleWindowTitlesCacheUpdatedAt = Date.now();
    return new Set(visibleWindowTitlesCache);
  } catch (error) {
    return null;
  }
}

async function getNativeWindowCaptureSources(options = {}) {
  if (process.platform !== 'win32') {
    return [];
  }

  try {
    const stdout = await new Promise((resolve, reject) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', getNativeWindowCaptureSourcesPowerShellScript(options)],
        {
          windowsHide: true,
          encoding: 'utf8',
          timeout: options.includeThumbnails === false ? 1800 : 4500,
          maxBuffer: 12 * 1024 * 1024,
        },
        (error, output) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(output);
        },
      );
    });

    const parsed = JSON.parse(String(stdout || '[]').trim() || '[]');
    const sourceList = Array.isArray(parsed) ? parsed : [parsed];
    const ownWindowTitleSet = getOwnCaptureWindowTitleSet();
    return buildFilteredWindowCaptureSources(sourceList, {
      ownWindowTitleSet,
      requireThumbnail: false,
    });
  } catch (error) {
    return [];
  }
}

async function getNativeScreenPreviewMap(displays = []) {
  if (process.platform !== 'win32' || !Array.isArray(displays) || !displays.length) {
    return new Map();
  }

  try {
    const stdout = await runTemporaryPowerShellScript(
      getNativeScreenPreviewPowerShellScript(displays),
      {
        timeout: 5000,
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    const parsed = JSON.parse(String(stdout || '[]').trim() || '[]');
    const previewList = Array.isArray(parsed) ? parsed : [parsed];
    return new Map(
      previewList
        .filter((entry) => entry?.displayId && entry?.thumbnail)
        .map((entry) => [String(entry.displayId), String(entry.thumbnail)]),
    );
  } catch (_error) {
    return new Map();
  }
}

async function filterCaptureSourcesForDesktopWindows(sources, options = {}) {
  const {
    allowMissingWindowThumbnails = false,
  } = options;
  const screenSources = sources.filter((source) => source.type === 'screen');
  const windowSources = sources.filter((source) => source.type === 'window');
  if (!windowSources.length) {
    return sources;
  }

  const ownWindowTitleSet = getOwnCaptureWindowTitleSet();
  const visibleWindowTitleSet = await getVisibleWindowTitleSet();

  if (allowMissingWindowThumbnails && visibleWindowTitleSet && visibleWindowTitleSet.size > 0) {
    const fallbackWindowSources = buildFilteredWindowCaptureSources(windowSources, {
      ownWindowTitleSet,
      requireThumbnail: false,
    });
    const visibleWindowSources = fallbackWindowSources.filter((source) =>
      captureSourceTitleMatchesVisibleSet(normalizeCaptureSourceTitle(source.name), visibleWindowTitleSet));
    if (visibleWindowSources.length >= Math.min(6, Math.max(1, fallbackWindowSources.length))) {
      return [...screenSources, ...visibleWindowSources];
    }
    if (fallbackWindowSources.length) {
      return [
        ...screenSources,
        ...mergeCaptureSourceLists(visibleWindowSources, fallbackWindowSources),
      ];
    }
  }

  const strictWindowSources = buildFilteredWindowCaptureSources(windowSources, {
    visibleWindowTitleSet,
    ownWindowTitleSet,
    requireThumbnail: true,
  });
  if (strictWindowSources.length) {
    return [...screenSources, ...strictWindowSources];
  }

  const relaxedWindowSources = buildFilteredWindowCaptureSources(windowSources, {
    ownWindowTitleSet,
    requireThumbnail: true,
  });
  if (relaxedWindowSources.length) {
    return [...screenSources, ...relaxedWindowSources];
  }

  const lastResortWindowSources = buildFilteredWindowCaptureSources(windowSources, {
    ownWindowTitleSet,
    requireThumbnail: false,
  });
  return [...screenSources, ...lastResortWindowSources];
}

function createCaptureDisplayBoundsMap(displays = getDisplayList()) {
  return new Map(displays.map((display) => {
    const logicalBounds = {
      x: Math.round(Number(display.x ?? 0)),
      y: Math.round(Number(display.y ?? 0)),
      width: Math.max(1, Math.round(Number(display.width ?? 1))),
      height: Math.max(1, Math.round(Number(display.height ?? 1))),
    };
    const scaleFactor = Number.isFinite(display.scaleFactor) && display.scaleFactor > 0
      ? display.scaleFactor
      : 1;
    const nativeBounds = {
      x: Number.isFinite(display.nativeX) ? Math.round(display.nativeX) : Math.round(logicalBounds.x * scaleFactor),
      y: Number.isFinite(display.nativeY) ? Math.round(display.nativeY) : Math.round(logicalBounds.y * scaleFactor),
      width: Number.isFinite(display.nativeWidth) && display.nativeWidth > 0
        ? Math.round(display.nativeWidth)
        : Math.max(1, Math.round(logicalBounds.width * scaleFactor)),
      height: Number.isFinite(display.nativeHeight) && display.nativeHeight > 0
        ? Math.round(display.nativeHeight)
        : Math.max(1, Math.round(logicalBounds.height * scaleFactor)),
    };

    return [String(display.id), {
      logicalBounds,
      nativeBounds,
      nativeBoundsSource: display.nativeBoundsSource ?? 'electron-scale',
      scaleFactor,
    }];
  }));
}

function normalizeCaptureSourceBounds(bounds) {
  if (
    bounds
    && Number.isFinite(Number(bounds.x))
    && Number.isFinite(Number(bounds.y))
    && Number.isFinite(Number(bounds.width))
    && Number.isFinite(Number(bounds.height))
    && Number(bounds.width) > 0
    && Number(bounds.height) > 0
  ) {
    return {
      x: Math.round(Number(bounds.x)),
      y: Math.round(Number(bounds.y)),
      width: Math.max(1, Math.round(Number(bounds.width))),
      height: Math.max(1, Math.round(Number(bounds.height))),
    };
  }

  return null;
}

function mapCaptureSources(sources, options = {}) {
  const {
    displays = getDisplayList(),
    includeThumbnail = true,
    includeAppIcon = true,
    fallbackThumbnailSize = CAPTURE_SOURCE_THUMBNAIL_SIZE,
  } = options;
  const displayBoundsById = createCaptureDisplayBoundsMap(displays);

  return sources.map((source) => {
    const sourceType = source.id.startsWith('screen:') ? 'screen' : 'window';
    const displayId = source.display_id ? String(source.display_id) : null;
    const displayBounds = displayId ? displayBoundsById.get(displayId) : null;
    const explicitBounds = normalizeCaptureSourceBounds(source.bounds);
    const resolvedBounds = sourceType === 'screen'
      ? displayBounds?.nativeBounds ?? explicitBounds ?? null
      : explicitBounds ?? displayBounds?.logicalBounds ?? null;
    const thumbnailSize = source.thumbnail && !source.thumbnail.isEmpty()
      ? source.thumbnail.getSize()
      : fallbackThumbnailSize;

    return {
      id: source.id,
      name: source.name,
      type: sourceType,
      bounds: resolvedBounds,
      boundsCoordinateSpace: 'native-screen',
      displayId,
      height: resolvedBounds?.height ?? thumbnailSize.height,
      logicalBounds: sourceType === 'screen' ? displayBounds?.logicalBounds ?? null : null,
      nativeBoundsSource: sourceType === 'screen' ? displayBounds?.nativeBoundsSource ?? null : null,
      scaleFactor: displayBounds?.scaleFactor ?? null,
      width: resolvedBounds?.width ?? thumbnailSize.width,
      thumbnail: includeThumbnail && source.thumbnail && !source.thumbnail.isEmpty()
        ? source.thumbnail.toDataURL()
        : '',
      appIcon: includeAppIcon && source.appIcon && !source.appIcon.isEmpty()
        ? source.appIcon.toDataURL()
        : '',
    };
  });
}

async function fetchCaptureSourceList(types = CAPTURE_SOURCE_TYPES, options = {}) {
  const { includeThumbnails = false, sourceId = '' } = options;
  const normalizedTypes = normalizeCaptureSourceTypes(types);
  const includeScreenSources = normalizedTypes.includes('screen');
  const includeWindowSources = normalizedTypes.includes('window');
  const isWindowOnlyRequest = includeWindowSources && !includeScreenSources;
  const thumbnailSize = includeThumbnails && includeScreenSources
    ? (sourceId ? CAPTURE_SOURCE_ANALYSIS_THUMBNAIL_SIZE : CAPTURE_SOURCE_THUMBNAIL_SIZE)
    : CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE;
  const fallbackThumbnailSize = isWindowOnlyRequest
    ? CAPTURE_SOURCE_WINDOW_LIST_PLACEHOLDER_SIZE
    : !includeThumbnails && includeScreenSources
      ? CAPTURE_SOURCE_SCREEN_LIST_PLACEHOLDER_SIZE
    : CAPTURE_SOURCE_THUMBNAIL_SIZE;
  const nativeWindowSourcesPromise = includeWindowSources
    ? getNativeWindowCaptureSources({ includeThumbnails, sourceId, thumbnailSize: sourceId ? CAPTURE_SOURCE_ANALYSIS_THUMBNAIL_SIZE : CAPTURE_SOURCE_THUMBNAIL_SIZE })
    : Promise.resolve([]);
  const desktopSourcesPromise = includeScreenSources
    ? desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize,
        fetchWindowIcons: false,
      })
    : Promise.resolve([]);
  const displayListPromise = includeScreenSources
    ? getDisplayListWithNativeBounds().catch(() => getDisplayList())
    : Promise.resolve(getDisplayList());
  const [desktopSources, nativeWindowSources, displays] = await Promise.all([
    desktopSourcesPromise,
    nativeWindowSourcesPromise,
    displayListPromise,
  ]);

  let resolvedSources = mapCaptureSources(desktopSources, {
    displays,
    includeThumbnail: includeThumbnails,
    includeAppIcon: false,
    fallbackThumbnailSize,
  }).concat(nativeWindowSources);

  if (includeScreenSources && includeThumbnails) {
    const needsScreenPreviewFallback = resolvedSources.some((source) =>
      source.type === 'screen' && !source.thumbnail)
      || !resolvedSources.some((source) => source.type === 'screen');

    if (needsScreenPreviewFallback) {
      const previewDisplays = await getDisplayListWithNativeBounds()
        .catch(() => getDisplayList());
      const nativeScreenPreviewMap = await getNativeScreenPreviewMap(previewDisplays)
        .catch(() => new Map());
      if (nativeScreenPreviewMap.size) {
        resolvedSources = resolvedSources.map((source) => (
          source.type === 'screen' && source.displayId && nativeScreenPreviewMap.has(String(source.displayId))
            ? { ...source, thumbnail: source.thumbnail || nativeScreenPreviewMap.get(String(source.displayId)) }
            : source
        ));
      }

      const previewScreenSources = await fetchAreaPickerScreenSourceList()
        .catch(() => []);
      if (previewScreenSources.length) {
        const previewScreenSourcesByDisplayId = new Map(
          previewScreenSources
            .filter((source) => source.type === 'screen' && source.displayId)
            .map((source) => [String(source.displayId), source]),
        );
        const mergedSources = resolvedSources.map((source) => {
          if (source.type !== 'screen') {
            return source;
          }

          const previewSource = source.displayId
            ? previewScreenSourcesByDisplayId.get(String(source.displayId))
            : null;
          if (!previewSource) {
            return source;
          }

          return {
            ...source,
            width: source.width || previewSource.width,
            height: source.height || previewSource.height,
            thumbnail: source.thumbnail || previewSource.thumbnail,
          };
        });
        const mergedSourceIds = new Set(mergedSources.map((source) => source.id));
        previewScreenSources.forEach((source) => {
          if (!mergedSourceIds.has(source.id)) {
            mergedSources.push(source);
          }
        });
        resolvedSources = mergedSources;
      }
    }
  }

  if (includeWindowSources) {
    return resolvedSources.filter((source) => (
      source.type === 'screen'
      || source.type === 'window'
    ));
  }

  return resolvedSources.filter((source) => source.type === 'screen');
}

async function fetchScreenCaptureSourceListLite() {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE,
    fetchWindowIcons: false,
  });
  const displays = await getDisplayListWithNativeBounds().catch(() => getDisplayList());

  return mapCaptureSources(sources, {
    displays,
    includeThumbnail: false,
    includeAppIcon: false,
    fallbackThumbnailSize: CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE,
  });
}

function getAreaPickerThumbnailSize(displays = screen.getAllDisplays()) {
  const safeDisplays = Array.isArray(displays) && displays.length ? displays : screen.getAllDisplays();
  const maxWidth = Math.max(
    1,
    ...safeDisplays.map((display) => {
      const bounds = getFullDisplayBounds(display);
      const scaleFactor = Number.isFinite(display.scaleFactor) && display.scaleFactor > 0
        ? display.scaleFactor
        : 1;
      return Math.round((bounds.width || 0) * scaleFactor);
    }),
  );
  const maxHeight = Math.max(
    1,
    ...safeDisplays.map((display) => {
      const bounds = getFullDisplayBounds(display);
      const scaleFactor = Number.isFinite(display.scaleFactor) && display.scaleFactor > 0
        ? display.scaleFactor
        : 1;
      return Math.round((bounds.height || 0) * scaleFactor);
    }),
  );

  return {
    width: Math.min(AREA_PICKER_MAX_PREVIEW_WIDTH, maxWidth),
    height: Math.min(AREA_PICKER_MAX_PREVIEW_HEIGHT, maxHeight),
  };
}

async function fetchAreaPickerScreenSourceList(thumbnailSize = AREA_PICKER_PREVIEW_THUMBNAIL_SIZE) {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize,
    fetchWindowIcons: false,
  });
  const displays = await getDisplayListWithNativeBounds().catch(() => getDisplayList());

  return mapCaptureSources(sources, {
    displays,
    includeThumbnail: true,
    includeAppIcon: false,
    fallbackThumbnailSize: thumbnailSize,
  });
}

async function getCaptureSourceListWithOptions(options = {}) {
  const {
    forceRefresh = false,
    preferCached = false,
    captureSourceTypes,
    includeCaptureThumbnails = false,
    sourceId = '',
  } = options;
  const normalizedTypes = normalizeCaptureSourceTypes(captureSourceTypes);
  const cacheKey = `${getCaptureSourceCacheKey(normalizedTypes)}|thumb:${includeCaptureThumbnails ? '1' : '0'}|source:${sourceId}`;

  if (
    !forceRefresh
    && isCaptureSourceCacheFresh(normalizedTypes)
    && hasCaptureSourceCacheEntries(normalizedTypes)
    && (!includeCaptureThumbnails || hasCaptureSourceCacheThumbnails(normalizedTypes))
  ) {
    return getCachedCaptureSources(normalizedTypes);
  }

  if (
    !forceRefresh
    && preferCached
    && hasCaptureSourceCacheEntries(normalizedTypes)
    && (!includeCaptureThumbnails || hasCaptureSourceCacheThumbnails(normalizedTypes))
  ) {
    return getCachedCaptureSources(normalizedTypes);
  }

  if (captureSourceRequestByKey.has(cacheKey)) {
    return captureSourceRequestByKey.get(cacheKey);
  }

  const captureSourceRequest = fetchCaptureSourceList(normalizedTypes, {
    includeThumbnails: includeCaptureThumbnails,
    sourceId,
  })
    .then((sources) => {
      if (!sourceId.trim()) {
        primeCaptureSourceCache(normalizedTypes, sources);
      }
      return sources;
    })
    .finally(() => {
      captureSourceRequestByKey.delete(cacheKey);
    });

  captureSourceRequestByKey.set(cacheKey, captureSourceRequest);
  return captureSourceRequest;
}

async function getAreaPickerScreenSources(options = {}) {
  const {
    forceRefresh = false,
    thumbnailSize = AREA_PICKER_PREVIEW_THUMBNAIL_SIZE,
  } = options;
  const thumbnailSizeKey = getAreaPickerThumbnailSizeKey(thumbnailSize);
  const baseThumbnailSizeKey = getAreaPickerThumbnailSizeKey(AREA_PICKER_PREVIEW_THUMBNAIL_SIZE);

  if (!forceRefresh && isAreaPickerScreenSourceCacheFresh() && areaPickerScreenSourceCacheKey === thumbnailSizeKey) {
    return areaPickerScreenSourceCache;
  }

  const cachedScreenSources = [
    ...getCachedCaptureSources(['screen']),
    ...getCachedCaptureSources()
      .filter((source) => source.type === 'screen' && source.displayId),
  ].filter((source, index, sources) =>
    source.type === 'screen'
    && source.displayId
    && sources.findIndex((entry) => entry.id === source.id) === index,
  );
  if (!forceRefresh && thumbnailSizeKey === baseThumbnailSizeKey && cachedScreenSources.length) {
    areaPickerScreenSourceCache = cachedScreenSources;
    areaPickerScreenSourceCacheUpdatedAt = Date.now();
    areaPickerScreenSourceCacheKey = thumbnailSizeKey;
    return cachedScreenSources;
  }

  const previewScreenSources = await fetchAreaPickerScreenSourceList(thumbnailSize);
  const resolvedPreviewScreenSources = previewScreenSources
    .filter((source) => source.type === 'screen' && source.displayId);
  if (resolvedPreviewScreenSources.length) {
    areaPickerScreenSourceCache = resolvedPreviewScreenSources;
    areaPickerScreenSourceCacheUpdatedAt = Date.now();
    areaPickerScreenSourceCacheKey = thumbnailSizeKey;
    return resolvedPreviewScreenSources;
  }

  const liteScreenSources = await fetchScreenCaptureSourceListLite();
  const resolvedLiteScreenSources = liteScreenSources
    .filter((source) => source.type === 'screen' && source.displayId);
  if (resolvedLiteScreenSources.length) {
    return resolvedLiteScreenSources;
  }

  return getCaptureSourceListWithOptions({ forceRefresh: true })
    .then((sources) => sources.filter((source) => source.type === 'screen' && source.displayId));
}

async function getDisplayEnvironment(options = {}) {
  const {
    includeCaptureSources = true,
    preferCachedCaptureSources = false,
    forceRefreshCaptureSources = false,
    captureSourceTypes,
    includeCaptureThumbnails = false,
  } = options;
  const normalizedCaptureSourceTypes = normalizeCaptureSourceTypes(captureSourceTypes);
  const displays = await getDisplayListWithNativeBounds();

  return {
    displays,
    captureSources: includeCaptureSources
      ? await getCaptureSourceListWithOptions({
          forceRefresh: forceRefreshCaptureSources,
          preferCached: preferCachedCaptureSources,
          captureSourceTypes: normalizedCaptureSourceTypes,
          includeCaptureThumbnails,
        })
      : [],
    captureSourceTypesIncluded: includeCaptureSources
      ? normalizedCaptureSourceTypes
      : [],
    captureSourcesIncluded: includeCaptureSources,
    captureSourcesPending: includeCaptureSources
      ? (preferCachedCaptureSources && !isCaptureSourceCacheFresh(normalizedCaptureSourceTypes))
      : false,
  };
}

async function broadcastDisplayEnvironment(options = {}) {
  const {
    windows = null,
    ...displayEnvironmentOptions
  } = options;
  const rendererWindows = Array.isArray(windows)
    ? getLiveRendererWindows(windows)
    : getRendererWindows();
  if (!rendererWindows.length) {
    return;
  }

  try {
    const displayEnvironment = await getDisplayEnvironment(displayEnvironmentOptions);
    rendererWindows.forEach((win) => {
      win.webContents.send('desktop-pet:display-environment-change', displayEnvironment);
    });
  } catch (error) {
    console.error('Failed to broadcast display environment:', error);
  }
}

function scheduleDisplayEnvironmentBroadcast(options = {}) {
  const {
    delayMs = DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS,
    ...broadcastOptions
  } = options;

  if (displayEnvironmentBroadcastTimer) {
    clearTimeout(displayEnvironmentBroadcastTimer);
  }

  displayEnvironmentBroadcastTimer = setTimeout(() => {
    displayEnvironmentBroadcastTimer = null;
    void broadcastDisplayEnvironment(broadcastOptions);
  }, delayMs);
}

function scheduleCaptureSourceRefreshBroadcast(delayMs = CAPTURE_SOURCE_REFRESH_DELAY_MS, options = {}) {
  const { force = false } = options;
  const settingsWindow = settingsWindowProvider();
  if (!settingsWindow || settingsWindow.isDestroyed() || !settingsWindow.isVisible()) {
    return;
  }

  if (!force && isCaptureSourceCacheFresh(['screen'])) {
    return;
  }

  if (captureSourceRefreshTimer) {
    clearTimeout(captureSourceRefreshTimer);
  }

  captureSourceRefreshTimer = setTimeout(() => {
    captureSourceRefreshTimer = null;
    const nextSettingsWindow = settingsWindowProvider();
    if (!nextSettingsWindow || nextSettingsWindow.isDestroyed() || !nextSettingsWindow.isVisible()) {
      return;
    }

    if (!force && isCaptureSourceCacheFresh(['screen'])) {
      return;
    }

    void broadcastDisplayEnvironment({
      captureSourceTypes: ['screen'],
      forceRefreshCaptureSources: true,
      windows: [nextSettingsWindow],
    });
  }, delayMs);
}

function getVirtualWorkAreaBounds() {
  const displays = screen.getAllDisplays();

  if (!displays.length) {
    const display = screen.getPrimaryDisplay();
    return {
      display,
      x: display.workArea.x,
      y: display.workArea.y,
      width: display.workArea.width,
      height: display.workArea.height,
    };
  }

  const left = Math.min(...displays.map((display) => display.workArea.x));
  const top = Math.min(...displays.map((display) => display.workArea.y));
  const right = Math.max(...displays.map((display) => display.workArea.x + display.workArea.width));
  const bottom = Math.max(...displays.map((display) => display.workArea.y + display.workArea.height));

  return {
    display: getTargetDisplay(),
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function getVirtualDisplayBounds() {
  const displays = screen.getAllDisplays();

  if (!displays.length) {
    const display = screen.getPrimaryDisplay();
    const bounds = getFullDisplayBounds(display);
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
  }

  const left = Math.min(...displays.map((display) => getFullDisplayBounds(display).x));
  const top = Math.min(...displays.map((display) => getFullDisplayBounds(display).y));
  const right = Math.max(...displays.map((display) => {
    const bounds = getFullDisplayBounds(display);
    return bounds.x + bounds.width;
  }));
  const bottom = Math.max(...displays.map((display) => {
    const bounds = getFullDisplayBounds(display);
    return bounds.y + bounds.height;
  }));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}


  async function buildAreaPickerContext(options = {}) {
    const virtualBounds = getVirtualDisplayBounds();
    const displays = await getDisplayListWithNativeBounds({
      forceRefresh: Boolean(options?.forceRefresh),
    });
    const captureSources = await getAreaPickerScreenSources({
      forceRefresh: Boolean(options?.forceRefresh),
      thumbnailSize: getAreaPickerThumbnailSize(screen.getAllDisplays()),
    });
    const screenSourcesByDisplayId = new Map(
      captureSources
        .filter((source) => source.type === 'screen' && source.displayId)
        .map((source) => [String(source.displayId), source]),
    );
    const selectableDisplays = displays
      .map((display) => {
        const source = screenSourcesByDisplayId.get(String(display.id));
        if (!source) {
          return null;
        }

        const scaleFactor = Number.isFinite(display.scaleFactor) && display.scaleFactor > 0
          ? display.scaleFactor
          : 1;
        return {
          ...display,
          sourceId: source.id,
          sourceName: source.name || display.label,
          sourceType: 'screen',
          previewThumbnail: source.thumbnail || '',
          nativeX: display.nativeX ?? Math.round(display.x * scaleFactor),
          nativeY: display.nativeY ?? Math.round(display.y * scaleFactor),
          nativeWidth: display.nativeWidth ?? Math.max(1, Math.round(display.width * scaleFactor)),
          nativeHeight: display.nativeHeight ?? Math.max(1, Math.round(display.height * scaleFactor)),
        };
      })
      .filter(Boolean);
    const nativeLeft = selectableDisplays.length
      ? Math.min(...selectableDisplays.map((display) => display.nativeX))
      : Math.round(virtualBounds.x);
    const nativeTop = selectableDisplays.length
      ? Math.min(...selectableDisplays.map((display) => display.nativeY))
      : Math.round(virtualBounds.y);
    const nativeRight = selectableDisplays.length
      ? Math.max(...selectableDisplays.map((display) => display.nativeX + display.nativeWidth))
      : Math.round(virtualBounds.x + virtualBounds.width);
    const nativeBottom = selectableDisplays.length
      ? Math.max(...selectableDisplays.map((display) => display.nativeY + display.nativeHeight))
      : Math.round(virtualBounds.y + virtualBounds.height);

    return {
      virtualBounds,
      nativeVirtualBounds: {
        x: nativeLeft,
        y: nativeTop,
        width: nativeRight - nativeLeft,
        height: nativeBottom - nativeTop,
      },
      displays: selectableDisplays,
    };
  }


  function setShellRendererWindowsProvider(nextProvider) {
    shellRendererWindowsProvider = typeof nextProvider === 'function'
      ? nextProvider
      : (() => []);
  }

  function setSettingsWindowProvider(nextProvider) {
    settingsWindowProvider = typeof nextProvider === 'function'
      ? nextProvider
      : (() => null);
  }

  function updateActivityRegion(config) {
    const previousDisplayId = activityRegionConfig.displayId;

    if (config && typeof config === 'object') {
      if (typeof config.displayId === 'string' && config.displayId.trim()) {
        activityRegionConfig.displayId = config.displayId;
      }

      if (typeof config.areaScale !== 'undefined') {
        activityRegionConfig.areaScale = clampAreaScale(config.areaScale);
      }
    }

    return {
      didDisplayChange: activityRegionConfig.displayId !== previousDisplayId,
      config: { ...activityRegionConfig },
    };
  }

  function dispose() {
    if (displayEnvironmentBroadcastTimer) {
      clearTimeout(displayEnvironmentBroadcastTimer);
      displayEnvironmentBroadcastTimer = null;
    }
    if (captureSourceRefreshTimer) {
      clearTimeout(captureSourceRefreshTimer);
      captureSourceRefreshTimer = null;
    }
    invalidateCaptureSourceCache();
  }

  return {
    AREA_PICKER_PREVIEW_THUMBNAIL_SIZE,
    CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE,
    broadcastDisplayEnvironment,
    buildAreaPickerContext,
    clampAreaScale,
    dispose,
    getAreaPickerScreenSources,
    getCaptureSourceList,
    getCaptureSourceListWithOptions,
    getDisplayEnvironment,
    getDisplayList,
    getDisplayListWithNativeBounds,
    getFullDisplayBounds,
    getTargetDisplay,
    getVirtualDisplayBounds,
    getVirtualWorkAreaBounds,
    invalidateCaptureSourceCache,
    runTemporaryPowerShellScript,
    scheduleCaptureSourceRefreshBroadcast,
    scheduleDisplayEnvironmentBroadcast,
    setShellRendererWindowsProvider,
    setSettingsWindowProvider,
    updateActivityRegion,
  };
}

module.exports = {
  CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE,
  createCaptureService,
};
