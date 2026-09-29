import assert from 'node:assert/strict';
import {
  createDesktopOrganizationObservationEvidence,
  findDesktopOrganizationTargetDisplay,
  formatDisplayResolutionSummary,
  normalizeDesktopOrganizationDisplayRect,
} from '../src/agent/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  capturePowerShellScriptsSource,
  captureServiceSource,
  ipcHandlersSource,
  observationSource,
  runtimeSystemToolsSource,
  viteEnvSource,
} = readProjectSources({
  capturePowerShellScriptsSource: 'electron/capturePowerShellScripts.cjs',
  captureServiceSource: 'electron/captureService.cjs',
  ipcHandlersSource: 'electron/ipcHandlers.cjs',
  observationSource: 'src/agent/desktopOrganizationObservation.ts',
  runtimeSystemToolsSource: 'src/agent/agentRuntimeSystemTools.ts',
  viteEnvSource: 'src/vite-env.d.ts',
});

assert.match(
  viteEnvSource,
  /nativeWidth\?: number;[\s\S]*nativeHeight\?: number;/u,
  'display type should expose native physical pixel dimensions',
);

assert.match(
  captureServiceSource,
  /width: Math\.max\(1, Math\.round\(bounds\.width \* scaleFactor\)\)[\s\S]*nativeWidth: nativeBounds\?\.width \?\? fallbackNativeBounds\.width/u,
  'display list should include physical pixel dimensions derived from scale factor',
);

assert.match(
  captureServiceSource,
  /async function getDisplayListWithNativeBounds[\s\S]*getNativeDisplayBoundsCached/u,
  'display list should have an async Windows-native bounds path',
);

assert.match(
  ipcHandlersSource,
  /desktop-pet:list-displays'[\s\S]*getDisplayListWithNativeBounds\(\)/u,
  'Agent display reads should use native-enhanced display metrics through IPC',
);

assert.match(
  capturePowerShellScriptsSource,
  /display\.nativeWidth \?\? display\.width/u,
  'native screen preview fallback should prefer physical display bounds',
);

assert.match(
  runtimeSystemToolsSource,
  /formatDisplayResolutionSummary\(display\)/u,
  'Agent display info should use the shared physical/logical display formatter',
);

assert.match(
  observationSource,
  /桌面图标坐标[\s\S]*Desktop organization coordinate space: native-screen/u,
  'desktop organization evidence should use one native-screen coordinate space for icon planning',
);

assert.match(
  observationSource,
  /getDisplayDesktopIconCoordinateViewport/u,
  'desktop organization viewport should come from the screen coordinate formatter',
);

const displays: DesktopPetDisplayLike[] = [
  {
    height: 884,
    id: 'primary',
    isPrimary: true,
    label: 'Redmi 27 NQ',
    nativeHeight: 1440,
    nativeWidth: 2560,
    nativeX: 0,
    nativeY: 0,
    scaleFactor: 1.5625,
    width: 1639,
    workAreaHeight: 884,
    workAreaWidth: 1639,
    workAreaX: 0,
    workAreaY: 0,
    x: 0,
    y: 0,
  },
  {
    height: 884,
    id: 'secondary',
    isPrimary: false,
    label: 'LC34G55T',
    nativeHeight: 1440,
    nativeWidth: 3440,
    nativeX: 2560,
    nativeY: 0,
    scaleFactor: 1.5625,
    width: 2202,
    workAreaHeight: 884,
    workAreaWidth: 2202,
    workAreaX: 1639,
    workAreaY: 0,
    x: 1639,
    y: 0,
  },
];

assert.match(
  formatDisplayResolutionSummary(displays[1]),
  /物理分辨率 3440 x 1440，逻辑区域 2202 x 884，工作区 2202 x 884/u,
);

const secondaryOrganizationViewport = normalizeDesktopOrganizationDisplayRect(displays[1]);
assert.equal(
  secondaryOrganizationViewport.height,
  1381,
  'desktop organization should use the scaled Windows work-area height',
);
assert.equal(
  secondaryOrganizationViewport.width,
  3440,
  'desktop organization should use the physical display width when scaled work-area width is within rounding tolerance',
);
assert.equal(secondaryOrganizationViewport.y, 0);
assert.ok(
  Math.abs(secondaryOrganizationViewport.x - 2560) <= 1,
  'desktop organization should keep the secondary viewport within one pixel of the native display origin',
);

const evidence = createDesktopOrganizationObservationEvidence({
  displays,
  effectiveScope: 'display-icons',
  icons: [{
    centerX: 2660,
    centerY: 100,
    height: 64,
    id: 'secondary-icon',
    index: 0,
    name: '副屏图标',
    width: 64,
    x: 2628,
    y: 68,
  }],
  selectedIconCount: 1,
  targetDisplay: findDesktopOrganizationTargetDisplay(displays, 'secondary'),
  targetDisplayLabel: 'LC34G55T',
  targetViewport: normalizeDesktopOrganizationDisplayRect(displays[1]),
});

assert.equal(evidence.coordinateSpace, 'native-screen');
assert.match(evidence.displayLines.join('\n'), /LC34G55T（副屏）：物理分辨率 3440 x 1440，桌面图标坐标 3440 x 1381，起点 \(2560, 0\)/u);
assert.doesNotMatch(evidence.displayLines.join('\n'), /逻辑工作区|逻辑位置/u);

console.log('display physical metrics smoke ok');
