import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const { desktopIconServiceSource, showcaseSource, typeSource } = readProjectSources({
  desktopIconServiceSource: 'electron/desktopIconService.cjs',
  showcaseSource: 'src/components/pet/useDesktopOrganizationShowcase.ts',
  typeSource: 'src/vite-env.d.ts',
});

assert.match(
  desktopIconServiceSource,
  /normalizeDesktopIconCoordinateSpaceOption[\s\S]*value === 'native-screen'/u,
  'desktop icon service should accept an explicit native-screen coordinate space',
);

assert.match(
  desktopIconServiceSource,
  /coordinateSpace === 'native-screen'[\s\S]*targetNativeScreenPoint/u,
  'moving a native-screen icon should avoid a second DIP-to-native-screen conversion',
);

assert.match(
  desktopIconServiceSource,
  /getDesktopIconFolderViewMovePowerShellScript[\s\S]*SelectAndPositionItems/u,
  'desktop icon moves should support the Shell IFolderView fallback mover',
);

assert.match(
  desktopIconServiceSource,
  /IShellBrowser[\s\S]*QueryActiveShellView[\s\S]*Marshal\.QueryInterface\(shellViewPtr, ref iidFolderView/u,
  'desktop icon Shell fallback reader should resolve IFolderView through IShellBrowser.QueryActiveShellView',
);

assert.match(
  desktopIconServiceSource,
  /IShellBrowserMove[\s\S]*QueryActiveShellView[\s\S]*Marshal\.QueryInterface\(shellViewPtr, ref iidFolderView/u,
  'desktop icon Shell fallback mover should resolve IFolderView through IShellBrowser.QueryActiveShellView',
);

assert.match(
  desktopIconServiceSource,
  /LVM_GETITEMSPACING[\s\S]*desktopGridCellWidth[\s\S]*desktopGridCellHeight/u,
  'desktop icon reads should expose the Windows ListView grid spacing used by Explorer',
);

assert.match(
  desktopIconServiceSource,
  /SetProcessDpiAwarenessContext[\s\S]*DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2[\s\S]*SetProcessDPIAware/u,
  'desktop icon Win32 scripts should opt into DPI awareness before reading or moving screen coordinates',
);

assert.match(
  desktopIconServiceSource,
  /public static DesktopPetDesktopIconInfo\[\] GetIcons\(\) \{[\s\S]*TryEnableDpiAwareness\(\);[\s\S]*FindDesktopListView/u,
  'desktop icon reads should enable DPI awareness before locating the desktop ListView',
);

assert.match(
  desktopIconServiceSource,
  /public static bool MoveIcon\(int index, int nativeScreenX, int nativeScreenY\) \{[\s\S]*TryEnableDpiAwareness\(\);[\s\S]*FindDesktopListView/u,
  'desktop icon moves should enable DPI awareness before converting native-screen coordinates to ListView coordinates',
);

assert.match(
  desktopIconServiceSource,
  /function createDesktopIconPowerShellError\([\s\S]*stderr[\s\S]*stdout[\s\S]*message/u,
  'desktop icon PowerShell failures should preserve stderr/stdout/message evidence',
);

assert.match(
  desktopIconServiceSource,
  /try \{[\s\S]*stdout = await runPowerShellScript\(moveScript\);[\s\S]*catch \(error\) \{[\s\S]*desktop icon move PowerShell failed[\s\S]*ok: false/u,
  'desktop icon move should return a structured tool failure instead of throwing an IPC error',
);

assert.match(
  desktopIconServiceSource,
  /coordinateSpace: 'dip'[\s\S]*dipX/u,
  'default desktop icon reads should stay DIP-compatible for pet interactions',
);

assert.match(
  showcaseSource,
  /listDesktopIcons\(\{[\s\S]*coordinateSpace: 'native-screen'[\s\S]*forceRefresh: true/u,
  'desktop organization should read icons in Windows native-screen coordinates',
);

assert.match(
  showcaseSource,
  /moveDesktopIcon\(\{[\s\S]*coordinateSpace: 'native-screen'/u,
  'desktop organization should move icons in the same native-screen coordinate space',
);

assert.match(
  typeSource,
  /coordinateSpace\?: 'dip' \| 'native-screen'/u,
  'renderer types should expose desktop icon coordinate-space selection',
);

console.log('desktop icon native-screen coordinate smoke ok');
