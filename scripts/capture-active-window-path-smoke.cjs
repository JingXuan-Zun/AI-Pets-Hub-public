const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const current = fs.readFileSync(rootFile, 'utf8');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const digest = value => crypto.createHash('sha256').update(String(value)).digest('hex');
let cases = 0;
async function run(types, includeThumbnails, mode, original) {
  const trace = [];
  const display = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 }, scaleFactor: 1 };
  const nativeSources = [
    { id: 'window:normal', name: 'Normal app', type: 'window', width: 800, height: 600, thumbnail: 'window:data' },
    { id: 'window:own', name: 'Own app', type: 'window', width: 800, height: 600, thumbnail: 'own:data' },
    { id: 'window:system', name: 'Program Manager', type: 'window', width: 800, height: 600, thumbnail: 'system:data' },
    { id: 'window:small', name: 'Small app', type: 'window', width: 10, height: 10, thumbnail: 'small:data' },
    { id: 'window:empty', name: 'Empty preview', type: 'window', width: 800, height: 600, thumbnail: '' },
  ];
  const electron = { app: { getPath() { trace.push(['temp']); return 'C:\\temp'; } },
    screen: { getAllDisplays() { trace.push(['all']); return [display]; }, getPrimaryDisplay() { trace.push(['primary']); return display; } },
    BrowserWindow: { getAllWindows() { trace.push(['windows']); return [null, { isDestroyed: () => true },
      { isDestroyed: () => false, getTitle() { if (mode === 'own-error') throw Error('own title'); return 'Own app'; } }]; } },
    desktopCapturer: { async getSources(options) {
      trace.push(['screen-capture', options]);
      const thumbnail = { isEmpty: () => false, getSize: () => ({ width: 240, height: 135 }), toDataURL: () => 'screen:data' };
      return [{ id: 'screen:1:0', display_id: '1', name: 'Primary', thumbnail }];
    } },
  };
  const fakeFs = {
    writeFileSync(target, script, encoding) { trace.push(['write', target, digest(script), encoding]); },
    unlink(target, callback) { trace.push(['unlink', target]); callback(null); },
  };
  const child = { execFile(command, args, options, callback) {
    trace.push(['exec', command, args.map(digest), options]);
    const windowCommand = args.includes('-Command');
    callback(mode === 'process-error' && windowCommand ? Error('process') : null,
      windowCommand ? mode === 'invalid-json' ? '{invalid' : JSON.stringify(nativeSources) : '[]', '');
  } };
  const envMath = Object.create(Math); envMath.random = () => 0.25;
  const modules = new Map();
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    new Function('require', 'module', 'exports', 'process', 'Date', 'Math',
      file === rootFile && original ? baseline : fs.readFileSync(file, 'utf8'))(id => {
      if (id === 'electron') return electron;
      if (id === 'child_process') return child;
      if (id === 'fs') return fakeFs;
      if (id === 'path') return path.win32;
      assert.ok(id.startsWith('./')); return load(path.resolve(path.dirname(file), id));
    }, module, module.exports, { platform: 'win32', pid: 42 }, { now: () => 100 }, envMath);
    return module.exports;
  }
  const { createCaptureService } = load(rootFile);
  const first = createCaptureService(); const second = createCaptureService();
  const keys = Object.keys(first);
  const options = { captureSourceTypes: types, includeCaptureThumbnails: includeThumbnails };
  const value = await first.getCaptureSourceListWithOptions(options);
  const cached = await first.getCaptureSourceListWithOptions(options);
  const other = await second.getCaptureSourceListWithOptions(options);
  if (types.includes('window') && mode === 'normal') {
    assert.ok(value.some(source => source.id === 'window:normal'));
    assert.ok(value.some(source => source.id === 'window:empty'), 'Actual native path permits missing thumbnails');
    assert.ok(!value.some(source => ['window:own', 'window:system', 'window:small'].includes(source.id)));
  }
  if (types.includes('window') && mode !== 'normal') assert.ok(!value.some(source => source.type === 'window'));
  if (!types.includes('window')) assert.ok(!trace.some(event => event[0] === 'windows'));
  first.invalidateCaptureSourceCache();
  const refreshed = await first.getCaptureSourceListWithOptions(options);
  first.dispose(); second.dispose();
  return { keys, value, cached, other, refreshed, trace };
}
async function main() {
  for (const types of [['screen'], ['window'], ['screen', 'window']]) {
    for (const thumbnails of [false, true]) for (const mode of ['normal', 'process-error', 'invalid-json', 'own-error']) {
      const actual = await run(types, thumbnails, mode, false);
      if (baseline) assert.deepEqual(actual, await run(types, thumbnails, mode, true));
      cases++;
    }
  }
  for (const name of ['filterCaptureSourcesForDesktopWindows', 'getVisibleWindowTitleSet', 'isVisibleWindowTitlesCacheFresh', 'visibleWindowTitlesCache', 'parseVisibleWindowTitles']) {
    assert.ok(!current.includes(name), 'Retired private chain: ' + name);
  }
  console.log(`Active capture window path passed: ${cases} real root scenarios, two services; native filtering, empty thumbnails, cache/invalidation, failures and unchanged public keys.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
