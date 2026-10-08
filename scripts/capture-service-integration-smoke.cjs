const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const keys = ['AREA_PICKER_PREVIEW_THUMBNAIL_SIZE', 'CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE',
  'broadcastDisplayEnvironment', 'buildAreaPickerContext', 'clampAreaScale', 'dispose',
  'getAreaPickerScreenSources', 'getCaptureSourceList', 'getCaptureSourceListWithOptions',
  'getDisplayEnvironment', 'getDisplayList', 'getDisplayListWithNativeBounds', 'getFullDisplayBounds',
  'getTargetDisplay', 'getVirtualDisplayBounds', 'getVirtualWorkAreaBounds', 'invalidateCaptureSourceCache',
  'runTemporaryPowerShellScript', 'scheduleCaptureSourceRefreshBroadcast', 'scheduleDisplayEnvironmentBroadcast',
  'setShellRendererWindowsProvider', 'setSettingsWindowProvider', 'updateActivityRegion'];

async function run(platform, scale, fault, thumbnails, original) {
  const trace = [], timers = new Map(), temporary = new Set(), loaded = new Map();
  let now = 100, timerId = 0, captures = 0, failCapture = fault === 'capture-once';
  const displays = [
    { id: 1, label: 'Primary', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 }, scaleFactor: 1 },
    { id: 2, label: 'Left', bounds: { x: -1280, y: -100, width: 1280, height: 720 }, workArea: { x: -1280, y: -100, width: 1280, height: 680 }, scaleFactor: scale },
  ];
  const nativeDisplays = displays.map(d => ({ deviceName: 'DISPLAY' + d.id, isPrimary: d.id === 1,
    x: Math.round(d.bounds.x * d.scaleFactor), y: Math.round(d.bounds.y * d.scaleFactor),
    width: Math.round(d.bounds.width * d.scaleFactor), height: Math.round(d.bounds.height * d.scaleFactor) }));
  function window(id) {
    return { visible: true, destroyed: false, isVisible() { return this.visible; }, isDestroyed() { return this.destroyed; },
      getTitle() { return 'Pet'; }, webContents: { send(channel, value) {
        trace.push(['send', id, channel, value]); if (fault === 'send') throw Error('send');
      } } };
  }
  const initial = window('initial'), replacement = window('replacement');
  const electron = { app: { getPath: () => 'C:\\capture-test' }, BrowserWindow: { getAllWindows: () => [initial] },
    screen: { getAllDisplays: () => displays, getPrimaryDisplay: () => displays[0] },
    desktopCapturer: { async getSources(options) {
      captures++; trace.push(['capture', options]);
      if (failCapture) { failCapture = false; throw Error('capture'); }
      return displays.map(d => ({ id: 'screen:' + d.id, display_id: String(d.id), name: d.label,
        thumbnail: { isEmpty: () => false, getSize: () => options.thumbnailSize,
          toDataURL: () => 'data:screen:' + d.id } }));
    } },
  };
  const fakeFs = { writeFileSync(target, script, encoding) {
    assert.equal(encoding, 'utf8'); assert.ok(script.length > 100); temporary.add(target); trace.push(['write', target]);
  }, unlink(target, callback) { assert.ok(temporary.delete(target)); trace.push(['unlink', target]); callback(null); } };
  const child = { execFile(command, args, options, callback) {
    assert.equal(platform, 'win32'); assert.equal(command, 'powershell.exe');
    const kind = args.includes('-Command') ? 'windows' : options.timeout === 1600 ? 'displays' : 'previews';
    trace.push(['native', kind, options]);
    const output = kind === 'displays' ? nativeDisplays : kind === 'windows'
      ? [{ id: 'window:app', type: 'window', name: 'Editor', width: 800, height: 600, thumbnail: thumbnails ? 'data:window' : '' },
        { id: 'window:pet', type: 'window', name: 'Pet', width: 800, height: 600, thumbnail: 'data:pet' }]
      : displays.map(d => ({ displayId: String(d.id), thumbnail: 'data:native:' + d.id }));
    callback(fault === 'native' ? Error('native') : null, JSON.stringify(output), '');
  } };
  const fakeMath = Object.create(Math); fakeMath.random = () => 0.25;
  function load(file) {
    if (loaded.has(file)) return loaded.get(file).exports;
    const module = { exports: {} }; loaded.set(file, module);
    new Function('require', 'module', 'exports', 'process', 'Date', 'Math', 'setTimeout', 'clearTimeout', 'console',
      original && file === rootFile ? baseline : fs.readFileSync(file, 'utf8'))(id => {
      if (id === 'electron') return electron; if (id === 'child_process') return child;
      if (id === 'fs') return fakeFs; if (id === 'path') return path.win32;
      assert.ok(id.startsWith('./')); return load(path.resolve(path.dirname(file), id));
    }, module, module.exports, { platform, pid: 42 }, { now: () => now }, fakeMath,
    (callback, delay) => { trace.push(['set', ++timerId, delay]); timers.set(timerId, callback); return timerId; },
    id => { trace.push(['clear', id]); timers.delete(id); },
    { error(message, error) { trace.push(['logged', message, error.message]); } });
    return module.exports;
  }
  async function flush() { for (let i = 0; i < 100; i++) await Promise.resolve(); }
  async function fireTimers() {
    for (const [id, callback] of [...timers]) { timers.delete(id); callback(); }
    await flush();
  }
  const exports = load(rootFile), first = exports.createCaptureService({ getSettingsWindow: () => initial }), second = exports.createCaptureService();
  assert.equal(trace.length, 0, 'Root creation must not capture, enumerate, execute or schedule');
  assert.deepEqual(Object.keys(first), keys); assert.deepEqual(Object.keys(second), keys);
  assert.strictEqual(first.CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE, exports.CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE);
  for (const key of keys.filter(key => typeof first[key] === 'function')) assert.notStrictEqual(first[key], second[key]);
  const activity = first.updateActivityRegion({ displayId: '2', areaScale: 80 });
  assert.equal(activity.didDisplayChange, true); assert.strictEqual(first.getTargetDisplay(), displays[1]);
  assert.strictEqual(second.getTargetDisplay(), displays[0]);
  const displayList = await first.getDisplayListWithNativeBounds();
  assert.equal(displayList[1].nativeWidth, Math.round(1280 * scale));
  assert.equal(displayList[1].nativeBoundsSource, platform === 'win32' && fault !== 'native' ? 'windows' : 'electron-scale');
  const options = { captureSourceTypes: ['screen', 'window'], includeCaptureThumbnails: thumbnails };
  if (failCapture) await assert.rejects(first.getCaptureSourceList(options), /capture/);
  const [sources, concurrent] = await Promise.all([first.getCaptureSourceList(options), first.getCaptureSourceListWithOptions(options)]);
  assert.strictEqual(concurrent, sources, 'Shared in-flight request returns one array');
  const beforeCache = captures;
  assert.strictEqual(await first.getCaptureSourceList(options), sources); assert.equal(captures, beforeCache);
  const other = await second.getCaptureSourceList(options); assert.notStrictEqual(other, sources);
  assert.equal(sources.filter(source => source.type === 'screen').length, 2);
  assert.ok(!sources.some(source => source.id === 'window:pet'));
  assert.equal(sources.some(source => source.id === 'window:app'), platform === 'win32' && fault !== 'native');
  const context = await first.buildAreaPickerContext();
  assert.equal(context.displays.length, 2); assert.equal(context.virtualBounds.x, -1280);
  assert.equal(context.displays.find(d => d.id === '2').nativeWidth, Math.round(1280 * scale));
  assert.ok(context.displays.every(d => d.previewThumbnail));
  const environment = await first.getDisplayEnvironment({ captureSourceTypes: ['screen'], preferCachedCaptureSources: true });
  assert.equal(environment.captureSources.length, 2); assert.equal(environment.captureSourcesPending, false);
  first.invalidateCaptureSourceCache();
  const beforeRefresh = captures; const refreshed = await first.getCaptureSourceList(options);
  assert.ok(captures > beforeRefresh); assert.notStrictEqual(refreshed, sources);
  assert.strictEqual(await second.getCaptureSourceList(options), other, 'Invalidation is per instance');
  // Force a pending refresh, then replace its settings-window provider before firing it.
  first.scheduleCaptureSourceRefreshBroadcast(0, { force: true }); first.setSettingsWindowProvider(() => replacement);
  await fireTimers(); assert.ok(trace.some(row => row[0] === 'send' && row[1] === 'replacement'));
  replacement.visible = false; const beforeHidden = timers.size;
  first.scheduleCaptureSourceRefreshBroadcast(0, { force: true }); assert.equal(timers.size, beforeHidden);
  first.scheduleDisplayEnvironmentBroadcast({ includeCaptureSources: false });
  first.scheduleDisplayEnvironmentBroadcast({ includeCaptureSources: false });
  second.scheduleDisplayEnvironmentBroadcast({ includeCaptureSources: false });
  await fireTimers();
  await first.broadcastDisplayEnvironment({ windows: [replacement], includeCaptureSources: false });
  if (fault === 'send') assert.ok(trace.some(row => row[0] === 'logged'));
  first.scheduleDisplayEnvironmentBroadcast(); second.scheduleDisplayEnvironmentBroadcast();
  first.dispose(); assert.equal(timers.size, 1, 'One service must preserve the other timer');
  second.dispose(); first.dispose(); second.dispose(); assert.equal(timers.size, 0);
  assert.equal(temporary.size, 0, 'All temporary script files are cleaned');
  assert.equal(first.updateActivityRegion(null).config.areaScale, 80, 'Dispose retains activity settings');
  now += 300001;
  const afterDispose = await first.getCaptureSourceList(options); assert.notStrictEqual(afterDispose, refreshed);
  first.dispose(); second.dispose();
  return { sources, context, environment, displayList, trace };
}

function structure() {
  function parse(text) { return ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true); }
  const source = fs.readFileSync(rootFile, 'utf8'), ast = parse(source);
  const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  assert.deepEqual(root.body.statements.filter(ts.isFunctionDeclaration).map(n => n.name.text), ['setShellRendererWindowsProvider']);
  const calls = root.body.statements.filter(ts.isVariableStatement).flatMap(n => n.declarationList.declarations)
    .filter(n => n.initializer && ts.isCallExpression(n.initializer)).map(n => n.initializer.expression.getText(ast));
  assert.deepEqual(calls, ['createCaptureSourceState', 'createCaptureDisplaySession', 'createCaptureQuerySession']);
  if (baseline) assert.equal(ts.createPrinter().printFile(ast), ts.createPrinter().printFile(parse(baseline)), 'Only root indentation changed');
}
async function main() {
  structure(); let cases = 0;
  for (const platform of ['linux', 'win32']) for (const scale of [1, 1.5])
    for (const fault of ['normal', 'capture-once', 'native', 'send']) for (const thumbnails of [false, true]) {
      const actual = await run(platform, scale, fault, thumbnails, false);
      if (baseline) assert.deepEqual(actual, await run(platform, scale, fault, thumbnails, true)); cases++;
    }
  console.log('Capture service integration passed: ' + cases + ' platform/multiscreen/failure configurations; two real services, cache/context/broadcast/provider/disposal chain, controlled external APIs.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
