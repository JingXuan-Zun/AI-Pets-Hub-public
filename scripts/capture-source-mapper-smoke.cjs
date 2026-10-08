const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const mapperFile = path.resolve(__dirname, '../electron/capture/sourceMapper.cjs');
const mapper = require(mapperFile);
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
let cases = 0;
function oldDeclarations() {
  const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const factory = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  return ['createCaptureDisplayBoundsMap', 'normalizeCaptureSourceBounds', 'mapCaptureSources'].map(name =>
    factory.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name).getText(ast)).join('\n');
}
function image(trace, name, mode) {
  let reads = 0;
  const api = {
    isEmpty() { assert.equal(this, api); trace.push([name, 'empty']); return mode === 'empty' || mode === 'changing' && ++reads > 1; },
    getSize() { assert.equal(this, api); trace.push([name, 'size']); if (mode === 'error') throw Error(name + ' size'); return { width: 50, height: 30 }; },
    toDataURL() { assert.equal(this, api); trace.push([name, 'url']); return name + ':data'; },
  };
  return api;
}
function source(trace, kind, bounds, mode) {
  return { id: kind === 'screen' ? 'screen:1:0' : 'window:1:0', name: '中文来源', display_id: '1', bounds,
    thumbnail: mode === 'missing' ? null : image(trace, 'thumbnail', mode), appIcon: image(trace, 'icon', mode) };
}
function run(scaleFactor, native, kind, bounds, mode, includeThumbnail, includeAppIcon, explicitDisplays, original) {
  const trace = [];
  const display = { id: '1', x: -1920.5, y: 0.5, width: 1920.5, height: 1080.5, scaleFactor, ...native };
  const getDisplayList = () => { trace.push(['displays']); return [display]; };
  const size = { width: 240, height: 135 };
  const execute = original ? new Function('getDisplayList', 'CAPTURE_SOURCE_THUMBNAIL_SIZE',
    oldDeclarations() + '\nreturn mapCaptureSources;')(getDisplayList, size)
    : mapper.createCaptureSourceMapper({ getDisplayList, CAPTURE_SOURCE_THUMBNAIL_SIZE: size });
  assert.equal(trace.length, 0, 'Mapper creation must not query displays');
  const options = { includeThumbnail, includeAppIcon, ...(explicitDisplays ? { displays: [display] } : {}) };
  try {
    const value = execute([source(trace, kind, bounds, mode)], options);
    assert.equal(trace.some(event => event[0] === 'displays'), !explicitDisplays);
    if (!includeThumbnail) assert.ok(!trace.some(event => event[0] === 'thumbnail' && event[1] === 'url'));
    if (!includeAppIcon) assert.ok(!trace.some(event => event[0] === 'icon'));
    return { value, trace };
  } catch (error) { return { error: error.message, trace }; }
}
async function rootRun(includeThumbnail, mode, original) {
  const trace = [];
  const display = { id: '1', bounds: { x: -1920, y: 0, width: 1920, height: 1080 },
    workArea: { x: -1920, y: 0, width: 1920, height: 1040 }, scaleFactor: 1.25 };
  const electron = { app: {}, BrowserWindow: {},
    screen: { getAllDisplays() { trace.push(['all']); return [display]; }, getPrimaryDisplay() { trace.push(['primary']); return display; } },
    desktopCapturer: { async getSources(options) { trace.push(['capture', options]); return [source(trace, 'screen', null, mode)]; } },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'process', 'Date', original ? baseline : fs.readFileSync(rootFile, 'utf8'))(id => {
    if (id === 'electron') return electron;
    if (id === 'child_process') return { execFile() { throw Error('Unexpected native call'); } };
    if (id === 'fs') return {};
    if (id === 'path') return path;
    assert.ok(id.startsWith('./')); return require(path.resolve(path.dirname(rootFile), id));
  }, module, { platform: 'linux' }, { now: () => 100 });
  const first = module.exports.createCaptureService(); const second = module.exports.createCaptureService();
  const options = { captureSourceTypes: ['screen'], includeCaptureThumbnails: includeThumbnail };
  const value = await first.getCaptureSourceListWithOptions(options);
  const cached = await first.getCaptureSourceListWithOptions(options);
  const reusable = !includeThumbnail || mode === 'normal';
  assert.equal(cached === value, reusable, 'Thumbnail requests reuse only a cache with thumbnails');
  const other = await second.getCaptureSourceListWithOptions(options);
  assert.notEqual(value, other);
  assert.equal(trace.filter(event => event[0] === 'capture').length, reusable ? 2 : 6);
  const preview = await first.getAreaPickerScreenSources({ forceRefresh: true });
  assert.equal(trace.filter(event => event[0] === 'capture').length, reusable ? 3 : 7);
  assert.equal(value[0].bounds.x, -2400);
  assert.equal(value[0].logicalBounds.x, -1920);
  first.dispose(); second.dispose();
  return { value, other, preview, trace };
}
async function main() {
  for (const scale of [0, 1, 1.25, 2, '1.5', NaN]) {
    for (const native of [{}, { nativeX: -3000.5, nativeY: 0.5, nativeWidth: 2560.5, nativeHeight: 1440.5, nativeBoundsSource: 'windows' }]) {
      for (const kind of ['screen', 'window']) {
        for (const bounds of [null, { x: -100.5, y: 0.5, width: 100.5, height: 90.5 }, { x: 0, y: 0, width: 0, height: -1 }]) {
          for (const mode of ['normal', 'empty', 'missing', 'changing', 'error']) {
            for (const includeThumbnail of [false, true]) for (const includeAppIcon of [false, true]) for (const explicitDisplays of [false, true]) {
              const actual = run(scale, native, kind, bounds, mode, includeThumbnail, includeAppIcon, explicitDisplays, false);
              if (baseline) assert.deepEqual(actual, run(scale, native, kind, bounds, mode, includeThumbnail, includeAppIcon, explicitDisplays, true));
              if (mode === 'normal' && !includeThumbnail) assert.ok(actual.trace.some(event => event[0] === 'thumbnail' && event[1] === 'size'));
              cases++;
            }
          }
        }
      }
    }
  }
  for (const include of [false, true]) for (const mode of ['normal', 'empty', 'missing']) {
    const actual = await rootRun(include, mode, false);
    if (baseline) assert.deepEqual(actual, await rootRun(include, mode, true));
    cases++;
  }
  assert.deepEqual(mapper.normalizeCaptureSourceBounds({ x: '-1.5', y: '0.5', width: '0.2', height: '1' }), { x: -1, y: 1, width: 1, height: 1 });
  assert.equal(mapper.normalizeCaptureSourceBounds({ x: Infinity, y: 0, width: 1, height: 1 }), null);
  const text = fs.readFileSync(mapperFile, 'utf8'); assert.ok(text.split('\n').length <= 300);
  const ast = ts.createSourceFile(mapperFile, text, ts.ScriptTarget.Latest, true);
  for (const node of ast.statements.filter(ts.isFunctionDeclaration)) assert.ok(ast.getLineAndCharacterOfPosition(node.end).line
    - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50, node.name.text);
  console.log(`Capture source mapper passed: ${cases} scenarios; native/logical precedence, image method order/receivers, lazy displays and two real cached service instances.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
