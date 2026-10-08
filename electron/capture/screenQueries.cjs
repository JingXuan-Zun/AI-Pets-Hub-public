async function fetchScreenCaptureSourceListLite(dependencies) {
  const { desktopCapturer, CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE,
    getDisplayListWithNativeBounds, getDisplayList, mapCaptureSources } = dependencies;
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

async function fetchAreaPickerScreenSourceList(dependencies, thumbnailSize = dependencies.AREA_PICKER_PREVIEW_THUMBNAIL_SIZE) {
  const { desktopCapturer, getDisplayListWithNativeBounds, getDisplayList, mapCaptureSources } = dependencies;
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

function createCaptureScreenQueries(dependencies) {
  return {
    fetchScreenCaptureSourceListLite: fetchScreenCaptureSourceListLite.bind(null, dependencies),
    fetchAreaPickerScreenSourceList: fetchAreaPickerScreenSourceList.bind(null, dependencies),
  };
}

module.exports = { createCaptureScreenQueries };
