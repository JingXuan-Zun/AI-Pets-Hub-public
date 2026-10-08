import { desktopShellRuntimeCaptureSources } from './screenWatchCaptureSources';
import { grabCaptureSourceFrame } from '../../services/captureSourceFrameGrab';

export interface ScreenWatchFrame {
  imageDataUrl: string;
  sourceLabel: string;
}

/** What the shell reports about the window in front. */
export interface ScreenWatchActiveWindow {
  displayId?: string | null;
  hwnd?: number | null;
  title?: string | null;
}

type Source = DesktopPetCaptureSourceLike;
// A "window" much larger than its screen is a helper/overlay (e.g. one spanning every
// monitor); capturing it shows the whole desktop, so use the screen instead.
const OVERSIZED_WINDOW_RATIO = 1.05;

function screenFor(sources: Source[], displayId: string | null | undefined) {
  const screens = sources.filter((source) => source.type === 'screen');
  return screens.find((source) => displayId && source.displayId === displayId) ?? screens[0];
}

function isOversized(window: Source, screen: Source | undefined) {
  if (!window.bounds || !screen?.bounds) return false;
  return window.bounds.width > screen.bounds.width * OVERSIZED_WINDOW_RATIO
    || window.bounds.height > screen.bounds.height * OVERSIZED_WINDOW_RATIO;
}

/** The window in front, matched by handle (titles repeat), or the screen it is on. */
export function pickScreenWatchSource(sources: Source[], active: ScreenWatchActiveWindow) {
  const screen = screenFor(sources, active.displayId);
  const windows = sources.filter((source) => source.type === 'window');
  const title = (active.title ?? '').trim();
  const window = (active.hwnd ? windows.find((source) => source.id.split(':')[1] === String(active.hwnd)) : undefined)
    ?? (title ? windows.find((source) => source.name.trim() === title) : undefined);
  return window && !isOversized(window, screen) ? window : screen;
}

/** Captures what the user is looking at, at a resolution where text is readable. */
export async function captureScreenWatchFrame(active: ScreenWatchActiveWindow): Promise<ScreenWatchFrame | null> {
  const source = pickScreenWatchSource(await desktopShellRuntimeCaptureSources(), active);
  if (!source) return null;
  const frame = await grabCaptureSourceFrame(source.id, { nativeSize: source.bounds });
  return { imageDataUrl: frame.imageDataUrl, sourceLabel: source.name || (source.type === 'screen' ? '整个屏幕' : '当前窗口') };
}
