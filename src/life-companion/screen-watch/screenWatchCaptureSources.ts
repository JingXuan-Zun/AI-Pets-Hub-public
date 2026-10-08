import { desktopPetShellRuntime } from '../../desktopShellRuntime';

/** Windows and screens with geometry; thumbnails are skipped since frames are grabbed directly. */
export async function desktopShellRuntimeCaptureSources() {
  const sources = await desktopPetShellRuntime.listCaptureSources({
    captureSourceTypes: ['window', 'screen'],
    forceRefresh: true,
    includeCaptureThumbnails: false,
  }) as DesktopPetCaptureSourceLike[];
  return Array.isArray(sources) ? sources : [];
}
