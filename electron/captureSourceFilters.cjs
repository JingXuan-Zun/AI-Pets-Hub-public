const CAPTURE_SOURCE_WINDOW_MIN_WIDTH = 160;
const CAPTURE_SOURCE_WINDOW_MIN_HEIGHT = 90;
const EXCLUDED_CAPTURE_WINDOW_TITLES = new Set([
  'program manager',
  'windows input experience',
  'task switching',
  'desktopwindowxamlsource',
  'msctfime ui',
]);
const EXCLUDED_CAPTURE_WINDOW_TITLE_PARTS = [
  'ai desktop pet',
  '??',
  'nvidia geforce overlay',
  'ashdrcontrol',
  'ashotplugctrl',
  'com.ccswitch.desktop-siw',
];

function normalizeCaptureSourceTitle(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function captureSourceTitleMatchesVisibleSet(normalizedTitle, visibleWindowTitleSet) {
  if (!visibleWindowTitleSet || !visibleWindowTitleSet.size || !normalizedTitle) {
    return false;
  }

  return Array.from(visibleWindowTitleSet).some((visibleTitle) => (
    visibleTitle === normalizedTitle
    || (normalizedTitle.length >= 4 && visibleTitle.includes(normalizedTitle))
    || (visibleTitle.length >= 4 && normalizedTitle.includes(visibleTitle))
  ));
}

function mergeCaptureSourceLists(...sourceLists) {
  const mergedSources = [];
  const seenKeys = new Set();

  sourceLists.flat().forEach((source) => {
    if (!source) {
      return;
    }

    const key = source.id || normalizeCaptureSourceTitle(source.name);
    if (!key || seenKeys.has(key)) {
      return;
    }

    seenKeys.add(key);
    mergedSources.push(source);
  });

  return mergedSources;
}

function buildFilteredWindowCaptureSources(windowSources, options = {}) {
  const {
    visibleWindowTitleSet = null,
    ownWindowTitleSet = new Set(),
    requireThumbnail = true,
  } = options;

  return (Array.isArray(windowSources) ? windowSources : []).filter((source) => {
    const normalizedTitle = normalizeCaptureSourceTitle(source.name);
    if (!normalizedTitle) {
      return false;
    }

    if (
      ownWindowTitleSet.has(normalizedTitle)
      || EXCLUDED_CAPTURE_WINDOW_TITLES.has(normalizedTitle)
      || EXCLUDED_CAPTURE_WINDOW_TITLE_PARTS.some((part) => normalizedTitle.includes(part))
    ) {
      return false;
    }

    if ((source.width ?? 0) < CAPTURE_SOURCE_WINDOW_MIN_WIDTH || (source.height ?? 0) < CAPTURE_SOURCE_WINDOW_MIN_HEIGHT) {
      return false;
    }

    if (requireThumbnail && !source.thumbnail) {
      return false;
    }

    if (visibleWindowTitleSet && visibleWindowTitleSet.size > 0) {
      return captureSourceTitleMatchesVisibleSet(normalizedTitle, visibleWindowTitleSet);
    }

    return true;
  });
}

module.exports = {
  buildFilteredWindowCaptureSources,
  captureSourceTitleMatchesVisibleSet,
  mergeCaptureSourceLists,
  normalizeCaptureSourceTitle,
};
