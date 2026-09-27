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
  assert.match(
    windowManagerSource,
    /postDragInputProxyWindow = new BrowserWindow\([\s\S]*const inputProxyWindow = postDragInputProxyWindow;[\s\S]*disableDwmSystemBorderForWindow\(inputProxyWindow\)/u,
    'the shaped transparent input proxy should disable its DWM system border before it is shown',
  );
  assert.match(
    windowManagerSource,
    /settingsWindow = nextSettingsWindow;[\s\S]*disableDwmSystemBorderForWindow\(nextSettingsWindow\)/u,
    'the settings window should remove the native DWM border so every CSS edge has the same color',
  );
  assert.match(
    windowManagerSource,
    /const nextSettingsWindow = new BrowserWindow\([\s\S]*?resizable: false/u,
    'the settings window should use custom resize handles without a competing native resize frame',
  );
  assert.match(
    windowManagerSource,
    /const nextSettingsWindow = new BrowserWindow\([\s\S]*?transparent: true[\s\S]*?backgroundColor: '#00000000'/u,
    'the settings window should use a transparent native surface so rounded CSS corners do not expose a square background',
  );
  assert.match(
    settingsWindowAppSource,
    /<div className="h-screen w-screen overflow-hidden bg-transparent">/u,
    'the settings renderer should not add an opaque full-window wrapper behind the rounded panel',
  );
  assert.match(
    settingsPanelSource,
    /aria-hidden="true"[\s\S]*absolute inset-0 z-max border border-\[#cbd5e1\]/u,
    'the settings panel should use one explicit four-sided frame layer during resize',
  );
  assert.doesNotMatch(
    settingsPanelSource,
    /rounded-(?:2xl|lg) border border-\[#cbd5e1\]/u,
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
