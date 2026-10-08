const MAX_IMAGE_SIDE = 2560;
const MIN_IMAGE_SIDE = 320;

/**
 * A high-resolution still of one capture source, taken in the main process with
 * desktopCapturer. Used when the renderer's getUserMedia frame grab fails, which
 * happens for every source while the app runs as administrator.
 */
function createCaptureSourceImageReader({ desktopCapturer }) {
  return async function captureSourceImage(request) {
    const sourceId = String(request?.sourceId ?? '');
    const type = sourceId.startsWith('screen:') ? 'screen' : sourceId.startsWith('window:') ? 'window' : '';
    if (!type) return { ok: false, reason: 'invalid-source-id' };
    const side = Math.max(MIN_IMAGE_SIDE, Math.min(MAX_IMAGE_SIDE, Math.round(Number(request?.maxSide) || MAX_IMAGE_SIDE)));
    // The renderer passes the source's own size (already capped) so small windows are not enlarged.
    const width = Math.round(Number(request?.width)); const height = Math.round(Number(request?.height));
    const thumbnailSize = width > 0 && height > 0 && width <= MAX_IMAGE_SIDE && height <= MAX_IMAGE_SIDE
      ? { height, width }
      : { height: side, width: side };
    try {
      const sources = await desktopCapturer.getSources({
        fetchWindowIcons: false,
        thumbnailSize,
        types: [type],
      });
      const source = sources.find((item) => item.id === sourceId);
      if (!source || source.thumbnail.isEmpty()) return { ok: false, reason: 'source-not-found' };
      const size = source.thumbnail.getSize();
      return { height: size.height, imageDataUrl: source.thumbnail.toDataURL(), ok: true, width: size.width };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message.slice(0, 300) : String(error) };
    }
  };
}

function registerCaptureSourceImageIpc({ desktopCapturer, ipcMain }) {
  const captureSourceImage = createCaptureSourceImageReader({ desktopCapturer });
  ipcMain.handle('desktop-pet:capture-source-image', (_event, request) => captureSourceImage(request));
  return captureSourceImage;
}

module.exports = { createCaptureSourceImageReader, registerCaptureSourceImageIpc };
