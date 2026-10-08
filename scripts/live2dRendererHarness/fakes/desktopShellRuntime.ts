import { record } from '../traceStore.ts';

export const shellRuntimeControl = {
  cursorPoint: { x: 0, y: 0 } as { x: number; y: number } | null,
  cursorFailure: false,
  refreshListeners: [] as Array<(payload: unknown) => void>,
};

export const desktopPetShellRuntime = {
  isDesktopMode: () => true,
  setSettingsOpen: (open: boolean) => record('shell.setSettingsOpen', open),
  setPointerPassthrough: (ignore: boolean) => record('shell.setPointerPassthrough', ignore),
  getCursorScreenPoint: () => {
    record('shell.getCursorScreenPoint');
    return shellRuntimeControl.cursorFailure
      ? Promise.reject(new Error('fake cursor failure'))
      : Promise.resolve(shellRuntimeControl.cursorPoint);
  },
  setInteractiveRegions: (regions: unknown, options?: unknown) => record('shell.setInteractiveRegions', regions, options ?? null),
  onRefreshNativeInteractiveRegions: (listener: (payload: unknown) => void) => {
    record('shell.onRefreshNativeInteractiveRegions');
    shellRuntimeControl.refreshListeners.push(listener);
    return () => {
      record('shell.unsubscribeRefreshNativeInteractiveRegions');
      shellRuntimeControl.refreshListeners = shellRuntimeControl.refreshListeners.filter((entry) => entry !== listener);
    };
  },
};
