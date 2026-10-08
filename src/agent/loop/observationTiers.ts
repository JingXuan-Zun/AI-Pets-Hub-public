import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { grabCaptureSourceFrame } from '../../services/captureSourceFrameGrab';
import {
  buildElementMarks,
  mapOcrLinesToScreen,
  type LoopBox,
  type LoopElement,
  type LoopOcrLine,
  type LoopUiControl,
} from './elementMarks';

// Cheap tiers first: L0 window list (~0.5s), L1 UI Automation (1-2s) and L2 local OCR
// (0.5-1s) run without a model. The vision model (L3) lives in the loop, used only when needed.

export interface LoopWindow {
  box: LoopBox | null;
  hwnd: number;
  pid: number | null;
  processName: string;
  title: string;
}

export interface LoopWindowObservation {
  captureStatus: 'ok' | 'not-capturable' | 'failed';
  capturedAt: number;
  durationMs: number;
  elements: LoopElement[];
  observationId: string;
  ocrStatus: 'ok' | 'unavailable' | 'failed' | 'skipped';
  uiaCount: number;
  window: LoopWindow;
}

const UIA_TIMEOUT_MS = 4000;
const OCR_TIMEOUT_MS = 5000;
let observationCounter = 0;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => { globalThis.setTimeout(() => resolve(fallback), ms); }),
  ]);
}

function toLoopWindow(value: {
  bounds?: { height?: number | null; width?: number | null; x?: number | null; y?: number | null } | null;
  hwnd?: number | null;
  pid?: number | null;
  processName?: string | null;
  title?: string | null;
} | null | undefined): LoopWindow | null {
  const hwnd = Math.round(Number(value?.hwnd));
  if (!(hwnd > 0)) return null;
  const [x, y, width, height] = [value?.bounds?.x, value?.bounds?.y, value?.bounds?.width, value?.bounds?.height].map(Number);
  return {
    box: [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0 ? { height, width, x, y } : null,
    hwnd,
    pid: Number(value?.pid) > 0 ? Math.round(Number(value?.pid)) : null,
    processName: value?.processName?.trim() ?? '',
    title: value?.title?.trim() ?? '',
  };
}

function toNativeBox(bounds: DesktopPetCaptureSourceLike['bounds']): LoopBox | null {
  const [x, y, width, height] = [bounds?.x, bounds?.y, bounds?.width, bounds?.height].map(Number);
  return [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0 ? { height, width, x, y } : null;
}

/**
 * L0: top-level windows plus the foreground one. The running-app list reports logical (DIP)
 * bounds, so each window's box is replaced by its capture source's native-screen bounds;
 * windows without a capture source (minimized/hidden) get box=null.
 */
export async function observeLoopWindows(): Promise<{ active: LoopWindow | null; windows: LoopWindow[] }> {
  const [running, active, sources] = await Promise.all([
    withTimeout(desktopPetShellRuntime.listRunningApps({ includeWindows: true }) as Promise<{ apps?: unknown[] } | null>, UIA_TIMEOUT_MS, null),
    withTimeout(desktopPetShellRuntime.getActiveWindowInfo(), UIA_TIMEOUT_MS, null),
    withTimeout(desktopPetShellRuntime.listCaptureSources({
      captureSourceTypes: ['window'], forceRefresh: true, includeCaptureThumbnails: false,
    }), UIA_TIMEOUT_MS, [] as DesktopPetCaptureSourceLike[]),
  ]);
  const nativeBox = (hwnd: number) => toNativeBox(sources.find((source) => source.id.startsWith(`window:${hwnd}:`))?.bounds);
  const withNativeBox = (window: LoopWindow): LoopWindow => ({ ...window, box: nativeBox(window.hwnd) });
  const windows = (Array.isArray(running?.apps) ? running.apps : [])
    .map((app) => toLoopWindow(app as Parameters<typeof toLoopWindow>[0]))
    .filter((window): window is LoopWindow => Boolean(window))
    .map(withNativeBox);
  const activeWindow = active?.ok ? toLoopWindow(active) : null;
  return {
    active: activeWindow ? windows.find((window) => window.hwnd === activeWindow.hwnd) ?? withNativeBox(activeWindow) : null,
    windows,
  };
}

type WindowText = {
  captureStatus: LoopWindowObservation['captureStatus'];
  lines: LoopOcrLine[];
  ocrStatus: LoopWindowObservation['ocrStatus'];
  windowBox: LoopBox | null;
};

function isOnScreen(box: LoopBox | null): box is LoopBox {
  // box comes from the window's capture source; minimized windows have none.
  return Boolean(box && box.width > 1 && box.height > 1);
}

/**
 * L2 fast path: one PowerShell run copies the window's screen area and OCRs it (~0.5-1s).
 * It reads what is visible on screen, so the loop focuses a window before acting in it.
 */
async function captureWindowTextFromScreen(box: LoopBox): Promise<WindowText | null> {
  const result = await withTimeout(desktopPetShellRuntime.captureRegionText({ ...box }), OCR_TIMEOUT_MS, null);
  if (!result) return null;
  if (!result.ok) return result.reason === 'unavailable' ? null : { captureStatus: 'failed', lines: [], ocrStatus: 'failed', windowBox: box };
  return {
    captureStatus: 'ok',
    lines: result.lines.map((line) => ({ ...line, x: box.x + line.x, y: box.y + line.y })),
    ocrStatus: 'ok',
    windowBox: box,
  };
}

/** Fallback: desktopCapturer still (2-4s) + OCR, used before the app restarts with the fast path. */
async function captureWindowTextFromSource(window: LoopWindow, box: LoopBox): Promise<WindowText> {
  let frame: { height: number; imageDataUrl: string; width: number };
  try {
    frame = await grabCaptureSourceFrame(`window:${window.hwnd}:0`, { nativeSize: box });
  } catch {
    return { captureStatus: 'failed', lines: [], ocrStatus: 'skipped', windowBox: box };
  }
  const ocr = await withTimeout(desktopPetShellRuntime.recognizeScreenText({ imageDataUrl: frame.imageDataUrl }), OCR_TIMEOUT_MS, null);
  return {
    captureStatus: 'ok',
    lines: ocr?.ok ? mapOcrLinesToScreen(ocr.lines, { imageHeight: frame.height, imageWidth: frame.width, windowBox: box }) : [],
    ocrStatus: ocr?.ok ? 'ok' : ocr ? 'unavailable' : 'failed',
    windowBox: box,
  };
}

async function captureWindowText(window: LoopWindow): Promise<WindowText> {
  if (!isOnScreen(window.box)) return { captureStatus: 'not-capturable', lines: [], ocrStatus: 'skipped', windowBox: window.box };
  return await captureWindowTextFromScreen(window.box) ?? captureWindowTextFromSource(window, window.box);
}

/** The primary display as a pseudo-window (hwnd 0): OCR only, for when no app window fits. */
export async function observeLoopScreen(): Promise<LoopWindowObservation> {
  const started = Date.now();
  const displays = await withTimeout(desktopPetShellRuntime.listDisplays(), UIA_TIMEOUT_MS, [] as DesktopPetDisplayLike[]);
  const display = displays.find((item) => item.isPrimary) ?? displays[0];
  const box = display
    ? { height: display.nativeHeight ?? display.height, width: display.nativeWidth ?? display.width, x: display.nativeX ?? display.x, y: display.nativeY ?? display.y }
    : null;
  const text = box ? await captureWindowTextFromScreen(box) : null;
  observationCounter += 1;
  return {
    captureStatus: text?.captureStatus ?? 'failed',
    capturedAt: Date.now(),
    durationMs: Date.now() - started,
    elements: buildElementMarks({ ocrLines: text?.lines ?? [], windowBox: box }),
    observationId: `obs-${started}-${observationCounter}`,
    ocrStatus: text?.ocrStatus ?? 'failed',
    uiaCount: 0,
    window: { box, hwnd: 0, pid: null, processName: 'screen', title: '整个屏幕' },
  };
}

/** L1 + L2 for one window, in parallel, merged into one numbered element list. */
export async function observeLoopWindowElements(window: LoopWindow): Promise<LoopWindowObservation> {
  const started = Date.now();
  const [uia, text] = await Promise.all([
    withTimeout(desktopPetShellRuntime.inspectWindowUi({ hwnd: window.hwnd, limit: 150, maxDepth: 8 }) as Promise<{ controls?: LoopUiControl[] } | null>, UIA_TIMEOUT_MS, null),
    captureWindowText(window),
  ]);
  const controls = Array.isArray(uia?.controls) ? uia.controls : [];
  observationCounter += 1;
  return {
    captureStatus: text.captureStatus,
    capturedAt: Date.now(),
    durationMs: Date.now() - started,
    elements: buildElementMarks({ controls, ocrLines: text.lines, windowBox: text.windowBox }),
    observationId: `obs-${started}-${observationCounter}`,
    ocrStatus: text.ocrStatus,
    uiaCount: controls.length,
    window: { ...window, box: text.windowBox ?? window.box },
  };
}
