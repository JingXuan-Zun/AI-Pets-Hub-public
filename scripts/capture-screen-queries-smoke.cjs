const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const queryFile = path.resolve(__dirname, '../electron/capture/screenQueries.cjs');
const { createCaptureScreenQueries } = require(queryFile);
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['fetchScreenCaptureSourceListLite', 'fetchAreaPickerScreenSourceList'];
let oldFactory;
if (baseline) {
  const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  const declarations = names.map(name => root.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name).getText(ast)).join('\n');
  oldFactory = new Function('dependencies', `const { desktopCapturer, CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE,
    AREA_PICKER_PREVIEW_THUMBNAIL_SIZE, getDisplayListWithNativeBounds, getDisplayList, mapCaptureSources } = dependencies;
    ${declarations}\nreturn { ${names.join(',')} };`);
}

function fixture(captureMode, displayMode, mapFailure, original, deferred = false) {
  const trace = [], pending = [];
  const sources = captureMode === 'empty' ? [] : [{ id: 'screen:1' }];
  const displays = [{ id: 1 }], fallbackDisplays = [{ id: 2 }], mapped = [{ id: 'mapped' }];
  const emptySize = { width: 0, height: 0 }, defaultSize = { width: 960, height: 540 };
  const desktopCapturer = { getSources(options) {
    assert.strictEqual(this, desktopCapturer); trace.push(['capture', options]);
    if (captureMode === 'sync') throw Error('capture-sync');
    if (captureMode === 'reject') return Promise.reject(Error('capture-reject'));
    return deferred ? new Promise(resolve => pending.push({ name: 'capture', resolve })) : Promise.resolve(sources);
  } };
  const dependencies = {
    desktopCapturer, CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE: emptySize, AREA_PICKER_PREVIEW_THUMBNAIL_SIZE: defaultSize,
    getDisplayListWithNativeBounds() {
      trace.push(['displays']);
      if (displayMode === 'sync') throw Error('display-sync');
      if (displayMode === 'nonpromise') return displays;
      if (displayMode === 'reject' || displayMode === 'fallback-error') return Promise.reject(Error('display-reject'));
      return deferred ? new Promise(resolve => pending.push({ name: 'displays', resolve })) : Promise.resolve(displays);
    },
    getDisplayList() { trace.push(['fallback']); if (displayMode === 'fallback-error') throw Error('fallback-error'); return fallbackDisplays; },
    mapCaptureSources(input, options) {
      assert.strictEqual(input, sources); trace.push(['map', input, options]);
      if (mapFailure) throw Error('mapper-error'); return mapped;
    },
  };
  const api = original ? oldFactory(dependencies) : createCaptureScreenQueries(dependencies);
  assert.deepEqual(trace, [], 'Construction does not capture or query displays');
  return { api, trace, pending, sources, displays, mapped, emptySize, defaultSize };
}

async function run(query, captureMode, displayMode, mapFailure, original) {
  const f = fixture(captureMode, displayMode, mapFailure, original);
  const size = query === 'null' ? null : query === 'zero' ? { width: 0, height: -1 }
    : query === 'custom' ? { width: 1920, height: 1080 } : query === 'getter' ? {} : undefined;
  if (query === 'getter') Object.defineProperty(size, 'width', { get() { throw Error('Unexpected eager size inspection'); } });
  let value, error;
  try { value = await f.api[query === 'lite' ? names[0] : names[1]](size); }
  catch (caught) { error = caught.message; }
  const capture = f.trace[0][1];
  assert.strictEqual(capture.thumbnailSize, query === 'lite' ? f.emptySize : size === undefined ? f.defaultSize : size);
  assert.deepEqual(capture.types, ['screen']); assert.equal(capture.fetchWindowIcons, false);
  if (captureMode === 'sync' || captureMode === 'reject') assert.equal(f.trace.length, 1);
  if (value) {
    assert.strictEqual(value, f.mapped);
    const options = f.trace.at(-1)[2];
    assert.equal(options.includeThumbnail, query !== 'lite'); assert.equal(options.includeAppIcon, false);
    assert.strictEqual(options.fallbackThumbnailSize, capture.thumbnailSize);
  }
  return { value, error, trace: f.trace };
}

async function runDeferred(query, original) {
  const f = fixture('normal', 'normal', false, original, true);
  const request = f.api[query]();
  assert.deepEqual(f.pending.map(x => x.name), ['capture']); assert.equal(f.trace.length, 1);
  f.pending.shift().resolve(f.sources); await Promise.resolve();
  assert.deepEqual(f.pending.map(x => x.name), ['displays']); assert.equal(f.trace.length, 2);
  f.pending.shift().resolve(f.displays);
  assert.strictEqual(await request, f.mapped); return f.trace;
}

async function runRoot(mode, original) {
  const trace = [];
  const display = { id: '1', bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 }, scaleFactor: 1 };
  const electron = { app: {}, BrowserWindow: {}, screen: { getAllDisplays: () => [display], getPrimaryDisplay: () => display },
    desktopCapturer: { async getSources(options) {
      trace.push(['capture', options]);
      if (mode === 'error') throw Error('capture-error');
      if (mode === 'all-empty' || mode === 'preview-empty' && options.thumbnailSize.width !== 0) return [];
      return [{ id: 'screen:1', display_id: '1', name: 'Primary',
        thumbnail: { isEmpty: () => mode === 'empty-image', getSize: () => ({ width: 960, height: 540 }), toDataURL: () => 'screen:data' } }];
    } },
  };
  const loaded = new Map();
  function load(file) {
    if (loaded.has(file)) return loaded.get(file).exports;
    const module = { exports: {} }; loaded.set(file, module);
    new Function('require', 'module', 'exports', 'process', 'Date',
      file === rootFile && original ? baseline : fs.readFileSync(file, 'utf8'))(id => {
      if (id === 'electron') return electron;
      if (id === 'child_process') return { execFile() { throw Error('Unexpected native query'); } };
      if (id === 'fs') return {};
      if (id === 'path') return path;
      assert.ok(id.startsWith('./')); return load(path.resolve(path.dirname(file), id));
    }, module, module.exports, { platform: 'linux' }, { now: () => 100 });
    return module.exports;
  }
  const { createCaptureService } = load(rootFile); const first = createCaptureService(), second = createCaptureService();
  const values = [Object.keys(first)];
  for (const service of [first, first, second]) {
    if (mode === 'error') await assert.rejects(service.getAreaPickerScreenSources(), /capture-error/);
    else values.push(await service.getAreaPickerScreenSources());
  }
  if (mode === 'normal' || mode === 'empty-image') assert.strictEqual(values[1], values[2]);
  if (mode === 'preview-empty') assert.ok(trace.some(entry => entry[1].thumbnailSize.width === 0), 'Actual lite query follows the empty preview');
  first.invalidateCaptureSourceCache();
  if (mode === 'error') await assert.rejects(first.getAreaPickerScreenSources({ forceRefresh: true }), /capture-error/);
  else values.push(await first.getAreaPickerScreenSources({ forceRefresh: true, thumbnailSize: { width: 1920, height: 1080 } }));
  first.dispose(); second.dispose(); return { values, trace };
}

function checkStructure() {
  const text = fs.readFileSync(queryFile, 'utf8'); assert.ok(text.split('\n').length <= 300);
  const ast = ts.createSourceFile(queryFile, text, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) assert.ok(ast.getLineAndCharacterOfPosition(node.end).line
      - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!baseline) return;
  function retained(source, original) {
    const ast = ts.createSourceFile(rootFile, source, ts.ScriptTarget.Latest, true);
    const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
    return root.body.statements.filter(node => original ? !(ts.isFunctionDeclaration(node) && names.includes(node.name.text))
      : !node.getText(ast).startsWith('const { fetchScreenCaptureSourceListLite, fetchAreaPickerScreenSourceList } ='))
      .map(node => node.getText(ast));
  }
  assert.deepEqual(retained(fs.readFileSync(rootFile, 'utf8'), false), retained(baseline, true));
}

async function main() {
  checkStructure(); let cases = 0;
  for (const query of ['lite', 'default', 'custom', 'null', 'zero', 'getter'])
    for (const capture of ['normal', 'empty', 'sync', 'reject'])
      for (const display of ['normal', 'reject', 'sync', 'nonpromise', 'fallback-error']) for (const mapFailure of [false, true]) {
        const actual = await run(query, capture, display, mapFailure, false);
        if (baseline) assert.deepEqual(actual, await run(query, capture, display, mapFailure, true)); cases++;
      }
  for (const query of names) {
    const actual = await runDeferred(query, false); if (baseline) assert.deepEqual(actual, await runDeferred(query, true)); cases++;
  }
  for (const mode of ['normal', 'empty-image', 'preview-empty', 'all-empty', 'error']) {
    const actual = await runRoot(mode, false); if (baseline) assert.deepEqual(actual, await runRoot(mode, true)); cases++;
  }
  console.log(`Capture screen queries passed: ${cases} options/order/error/deferred and controlled root scenarios.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
