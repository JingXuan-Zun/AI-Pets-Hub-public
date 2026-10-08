const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const servicePath = path.join(projectRoot, 'electron', 'windowsDwmBorderService.cjs');

assert.equal(
  fs.existsSync(servicePath),
  true,
  'Windows DWM border service should exist',
);

async function main() {
  const { readModuleProjectFunction } = await import('./projectModuleSource.mjs');
  const {
    createDisableDwmBorderPowerShell,
    disableDwmSystemBorderForWindow,
    resolveNativeWindowHandleDecimal,
  } = require(servicePath);

  const nativeHandle = Buffer.alloc(8);
  nativeHandle.writeBigUInt64LE(0x1234n);
  assert.equal(resolveNativeWindowHandleDecimal(nativeHandle), '4660');

  const powerShell = createDisableDwmBorderPowerShell('4660');
  assert.match(powerShell, /DwmSetWindowAttribute/u);
  assert.match(powerShell, /DwmwaBorderColor = 34/u);
  assert.match(powerShell, /DwmwaColorNone = 0xFFFFFFFE/u);
  assert.match(powerShell, /new IntPtr\(nativeWindowHandle\)/u);
  assert.match(powerShell, /Disable\(\[Int64\]4660\)/u);

  let capturedExec = null;
  const result = await disableDwmSystemBorderForWindow({
    getNativeWindowHandle: () => nativeHandle,
    isDestroyed: () => false,
  }, {
    execFileImpl: (file, args, options, callback) => {
      capturedExec = { args, file, options };
      callback(null, '0\r\n', '');
    },
    platform: 'win32',
  });

  assert.equal(result.applied, true);
  assert.equal(capturedExec.file, 'powershell.exe');
  assert.equal(capturedExec.options.windowsHide, true);
  assert.ok(capturedExec.args.includes('-EncodedCommand'));

  const windowManagerSource = fs.readFileSync(
    path.join(projectRoot, 'electron', 'windowManager.cjs'),
    'utf8',
  );
  const settingsWindowAppSource = fs.readFileSync(
    path.join(projectRoot, 'src', 'SettingsWindowApp.tsx'),
    'utf8',
  );
  const settingsPanelSource = fs.readFileSync(
    path.join(projectRoot, 'src', 'components', 'SettingsPanel.tsx'),
    'utf8',
  );
  const inputProxyLifecycleSource = readModuleProjectFunction(
    'electron/windowManager/postDragInputProxyLifecycle.cjs', 'createPostDragInputProxyLifecycle',
  );
  assert.match(
    inputProxyLifecycleSource,
    /createInputProxyWindowCreator\(\{[\s\S]*disableDwmSystemBorderForWindow/u,
    'input proxy assembly must forward the native DWM operation',
  );
  const proxyCreatorSource = readModuleProjectFunction(
    'electron/windowManager/inputProxyWindowCreation.cjs', 'createInputProxyWindowCreator',
  );
  const proxyConfiguratorSource = readModuleProjectFunction(
    'electron/windowManager/inputProxyWindowCreation.cjs', 'createInputProxyWindowConfigurator',
  );
  assert.match(proxyCreatorSource,
    /proxyState\.setWindow\(new BrowserWindow\([\s\S]*const inputProxyWindow = proxyState\.getWindow\(\);\s*configurePostDragInputProxyWindow\(inputProxyWindow\);\s*attachPostDragInputProxyEvents\(inputProxyWindow\)/u,
    'native proxy configuration must precede event registration and loading');
  assert.match(
    proxyConfiguratorSource,
    /inputProxyWindow\.setOpacity\(0\.01\);\s*void disableDwmSystemBorderForWindow\(inputProxyWindow\)/u,
    'the shaped transparent input proxy should disable its DWM system border before it is shown',
  );
  const settingsCreatorSource = readModuleProjectFunction(
    'electron/windowManager/settingsWindowLifecycle.cjs', 'createSettingsWindowCreator',
  );
  const settingsAssemblySource = readModuleProjectFunction(
    'electron/windowManager/settingsWindowControllers.cjs', 'createSettingsWindowControllers',
  );
  assert.match(windowManagerSource, /createSettingsWindowControllers\(\{[\s\S]*?setSettingsWindow: \(win\) => \{ settingsWindow = win; \}/u);
  assert.match(settingsAssemblySource, /createSettingsWindowCreator\(\{[\s\S]*?getSettingsWindow, setSettingsWindow,[\s\S]*?disableDwmSystemBorderForWindow, logWindowEvent,/u);
  assert.match(
    settingsCreatorSource,
    /setSettingsWindow\(nextSettingsWindow\);[\s\S]*disableDwmSystemBorderForWindow\(nextSettingsWindow\)/u,
    'the settings window should remove the native DWM border so every CSS edge has the same color',
  );
  assert.match(
    windowManagerSource,
    /getBrowserWindowIconOptions, SETTINGS_PANEL_WINDOW_BOUNDS, path, baseDirectory: __dirname, sessionPartition,/u,
    'settings options should receive the original dependencies and preload directory',
  );
  assert.match(settingsAssemblySource, /createSettingsWindowOptionsBuilder\(\{\s*getBrowserWindowIconOptions, SETTINGS_PANEL_WINDOW_BOUNDS, path, baseDirectory, sessionPartition,/u);
  assert.match(
    settingsCreatorSource,
    /const nextSettingsWindow = new BrowserWindow\(buildSettingsWindowOptions\(initialBounds\)\)/u,
    'settings window should consume the extracted options',
  );
  const settingsOptionsSource = readModuleProjectFunction(
    'electron/windowManager/settingsWindowOptions.cjs', 'createSettingsWindowOptionsBuilder',
  );
  assert.match(
    settingsOptionsSource,
    /resizable: false/u,
    'the settings window should use custom resize handles without a competing native resize frame',
  );
  assert.match(
    settingsOptionsSource,
    /transparent: true[\s\S]*?backgroundColor: '#00000000'/u,
    'the settings window should use a transparent native surface so rounded CSS corners do not expose a square background',
  );
  assert.match(
    settingsWindowAppSource,
    /<div className="h-screen w-screen overflow-hidden bg-transparent">/u,
    'the settings renderer should not add an opaque full-window wrapper behind the rounded panel',
  );
  assert.match(
    settingsPanelSource,
    /aria-hidden="true"[\s\S]*pointer-events-none absolute z-max border border-border[\s\S]*style=\{\{ inset: 1 \}\}/u,
    'the settings panel frame should stay one pixel inside the transparent window edge during resize',
  );
  assert.doesNotMatch(
    settingsPanelSource,
    /rounded-(?:2xl|lg) border border-(?:\[#cbd5e1\]|border)/u,
    'the settings panel root should not keep a second competing border source',
  );
  assert.doesNotMatch(
    windowManagerSource,
    /setShape\(postDragInputProxyRegions\)[\s\S]{0,320}disableDwmSystemBorderForWindow/u,
    'DWM border removal should not spawn a PowerShell process for every native shape update',
  );

  console.log('windows DWM border smoke passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
