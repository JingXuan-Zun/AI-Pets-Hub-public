const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const queryFile = path.resolve(__dirname, '../electron/capture/sourceQuery.cjs');
const { createCaptureSourceQuery } = require(queryFile);
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
let oldFactory;
if (baseline) {
  const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  const declaration = root.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'fetchCaptureSourceList').getText(ast);
  oldFactory = new Function('dependencies', `const { CAPTURE_SOURCE_TYPES, normalizeCaptureSourceTypes,
    CAPTURE_SOURCE_ANALYSIS_THUMBNAIL_SIZE, CAPTURE_SOURCE_THUMBNAIL_SIZE, CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE,
    CAPTURE_SOURCE_WINDOW_LIST_PLACEHOLDER_SIZE, CAPTURE_SOURCE_SCREEN_LIST_PLACEHOLDER_SIZE,
    getNativeWindowCaptureSources, desktopCapturer, getDisplayListWithNativeBounds, getDisplayList,
    mapCaptureSources, getNativeScreenPreviewMap, fetchAreaPickerScreenSourceList } = dependencies;
    ${declaration}\nreturn fetchCaptureSourceList;`);
}
const screenSource = (id, displayId, thumbnail = '', width = 0, height = 0) =>
  ({ id, type: 'screen', displayId, thumbnail, width, height });

function fixture(mappedMode, nativeMap, previewMode, displayMode, failure, original, deferred = false) {
  const trace = []; const pending = []; let displayReads = 0;
  const mapped = mappedMode === 'complete' ? [screenSource('screen:1', '1', 'existing', 100, 200)]
    : mappedMode === 'missing' ? [screenSource('screen:1', '1')]
    : mappedMode === 'none' ? []
    : mappedMode === 'mixed' ? [screenSource('screen:1', 1), screenSource('screen:no-display', ''),
      { id: 'mapped-window', type: 'window' }, { id: 'other', type: 'other' }]
    : [screenSource('screen:1', '1', 'existing', 0, 200), screenSource('screen:2', '2', '', 100, 0)];
  const nativeWindows = [{ id: 'native-window', type: 'window', thumbnail: 'window' }];
  const preview = previewMode === 'empty' ? []
    : previewMode === 'normal' ? [screenSource('screen:1', '1', 'preview:one', 960, 540), screenSource('new', '2', 'preview:two', 1920, 1080)]
    : previewMode === 'duplicates' ? [screenSource('last-match', '1', 'first', 10, 20), screenSource('last-match', '1', 'last', 30, 40),
      screenSource('new', '2', 'new-first'), screenSource('new', '2', 'new-last')]
    : [{ id: 'preview-window', type: 'window', displayId: '1', thumbnail: 'unexpected' }, screenSource('screen:unknown', '', 'unknown')];
  const displays = [{ id: 1 }], fallbackDisplays = [{ id: 2 }], desktopSources = [{ id: 'raw' }];
  function result(name, value) {
    if (failure === name + '-sync') throw Error(failure);
    if (failure === name + '-reject') return Promise.reject(Error(failure));
    if (deferred && ['window', 'desktop', 'displays'].includes(name)) {
      return new Promise(resolve => pending.push({ name, resolve, value }));
    }
    return Promise.resolve(value);
  }
  const desktopCapturer = { getSources(options) {
    assert.strictEqual(this, desktopCapturer); trace.push(['desktop', options]); return result('desktop', desktopSources);
  } };
  const dependencies = {
    CAPTURE_SOURCE_TYPES: ['screen', 'window'],
    CAPTURE_SOURCE_THUMBNAIL_SIZE: { width: 240, height: 135 },
    CAPTURE_SOURCE_ANALYSIS_THUMBNAIL_SIZE: { width: 960, height: 540 },
    CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE: { width: 0, height: 0 },
    CAPTURE_SOURCE_WINDOW_LIST_PLACEHOLDER_SIZE: { width: 320, height: 180 },
    CAPTURE_SOURCE_SCREEN_LIST_PLACEHOLDER_SIZE: { width: 320, height: 180 },
    normalizeCaptureSourceTypes(types) {
      trace.push(['normalize', types]);
      if (failure === 'normalize-sync') throw Error(failure);
      const normalized = Array.isArray(types) ? types.filter(type => ['screen', 'window'].includes(type)) : [];
      return normalized.length ? [...new Set(normalized)] : ['screen', 'window'];
    },
    getNativeWindowCaptureSources(options) { trace.push(['window', options]); return result('window', nativeWindows); },
    desktopCapturer,
    getDisplayListWithNativeBounds() {
      trace.push(['displays', ++displayReads]);
      if (displayMode === 'reject' || displayMode === 'second-reject' && displayReads === 2) return Promise.reject(Error('display-fallback'));
      return result('displays', displays);
    },
    getDisplayList() { trace.push(['fallback-displays']); if (failure === 'fallback-sync') throw Error(failure); return fallbackDisplays; },
    mapCaptureSources(sources, options) {
      trace.push(['map', sources, options]);
      if (failure === 'map-sync') throw Error(failure);
      return mapped;
    },
    getNativeScreenPreviewMap(input) {
      trace.push(['native-preview', input]);
      return result('native-preview', nativeMap ? new Map([['1', 'native:one'], ['2', 'native:two']]) : new Map());
    },
    fetchAreaPickerScreenSourceList() { trace.push(['area-preview']); return result('area-preview', preview); },
  };
  const execute = original ? oldFactory(dependencies) : createCaptureSourceQuery(dependencies);
  assert.deepEqual(trace, [], 'Query construction must not start any query');
  return { execute, trace, pending, mapped, nativeWindows, preview };
}

async function run(types, thumbnails, sourceId, mappedMode, nativeMap, previewMode, displayMode, failure, original) {
  const f = fixture(mappedMode, nativeMap, previewMode, displayMode, failure, original);
  let value, error;
  try { value = await f.execute(types, { includeThumbnails: thumbnails, sourceId }); }
  catch (caught) { error = caught.message; }
  const references = value?.map(source => ({ mapped: f.mapped.indexOf(source), window: f.nativeWindows.indexOf(source), preview: f.preview.indexOf(source) }));
  if (!failure) {
    const withScreens = !types || !types.length || types.includes('screen');
    const needsFallback = withScreens && thumbnails && mappedMode !== 'complete';
    assert.equal(f.trace.some(entry => entry[0] === 'native-preview'), needsFallback);
    assert.equal(f.trace.some(entry => entry[0] === 'area-preview'), needsFallback, 'Area fallback still runs after successful native filling');
    if (types?.length && !types.includes('screen')) assert.ok(!f.trace.some(entry => entry[0] === 'desktop'));
    assert.ok(value.every(source => source.type === 'screen' || source.type === 'window'));
  }
  return { value, error, references, trace: f.trace };
}

async function runDeferred(order, original) {
  const f = fixture('complete', false, 'empty', 'normal', '', original, true);
  const request = f.execute(['screen', 'window'], { includeThumbnails: true });
  assert.deepEqual(f.pending.map(x => x.name), ['window', 'desktop', 'displays']);
  assert.ok(!f.trace.some(entry => entry[0] === 'map'));
  for (const name of order) {
    const pending = f.pending.find(x => x.name === name); pending.resolve(pending.value);
    await Promise.resolve();
  }
  return { value: await request, trace: f.trace };
}

async function runGetters(original) {
  const f = fixture('complete', false, 'empty', 'normal', '', original);
  const options = {};
  Object.defineProperties(options, {
    includeThumbnails: { get() { f.trace.push(['thumbnail-getter']); return true; } },
    sourceId: { get() { f.trace.push(['source-getter']); return 'screen:1'; } },
  });
  return { value: await f.execute(undefined, options), trace: f.trace };
}

async function runRoot(types, thumbnails, mode, original) {
  const trace = [];
  const display = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 }, scaleFactor: 1 };
  const electron = { app: {}, BrowserWindow: {},
    screen: { getAllDisplays: () => [display], getPrimaryDisplay: () => display },
    desktopCapturer: { async getSources(options) {
      trace.push(['capture', options]);
      if (mode === 'none') return [];
      const preview = options.thumbnailSize.width === 960;
      const thumbnail = mode === 'missing' && !preview ? null : {
        isEmpty: () => mode === 'empty' && !preview,
        getSize: () => ({ width: preview ? 960 : 240, height: preview ? 540 : 135 }),
        toDataURL: () => preview ? 'preview:data' : 'screen:data',
      };
      return [{ id: 'screen:1', display_id: '1', name: 'Primary', thumbnail }];
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
  const { createCaptureService } = load(rootFile);
  const first = createCaptureService(), second = createCaptureService();
  const options = { captureSourceTypes: types, includeCaptureThumbnails: thumbnails };
  const value = await first.getCaptureSourceListWithOptions(options);
  const cached = await first.getCaptureSourceListWithOptions(options);
  const other = await second.getCaptureSourceListWithOptions(options);
  first.invalidateCaptureSourceCache(); const refreshed = await first.getCaptureSourceListWithOptions(options);
  if (types.includes('screen') && thumbnails && ['empty', 'missing'].includes(mode)) {
    assert.equal(value[0].thumbnail, 'preview:data'); assert.strictEqual(cached, value);
  }
  if (!types.includes('screen')) assert.deepEqual(trace, []);
  first.dispose(); second.dispose();
  return { keys: Object.keys(first), value, cached, other, refreshed, trace };
}

function checkStructure() {
  const text = fs.readFileSync(queryFile, 'utf8'); assert.ok(text.split('\n').length <= 300);
  const ast = ts.createSourceFile(queryFile, text, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) assert.ok(ast.getLineAndCharacterOfPosition(node.end).line
      - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50, node.name?.text);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!baseline) return;
  function retained(source, original) {
    const ast = ts.createSourceFile(rootFile, source, ts.ScriptTarget.Latest, true);
    const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
    return root.body.statements.filter(node => original
      ? !(ts.isFunctionDeclaration(node) && node.name.text === 'fetchCaptureSourceList')
      : !node.getText(ast).startsWith('const fetchCaptureSourceList = createCaptureSourceQuery(')).map(node => node.getText(ast));
  }
  assert.deepEqual(retained(fs.readFileSync(rootFile, 'utf8'), false), retained(baseline, true));
}

async function main() {
  checkStructure(); let cases = 0;
  for (const types of [undefined, ['screen'], ['window'], ['screen', 'window']])
    for (const thumbnails of [false, true]) for (const sourceId of ['', 'screen:1', null])
      for (const mappedMode of ['complete', 'missing', 'none', 'mixed', 'partial'])
        for (const nativeMap of [false, true]) for (const preview of ['empty', 'normal', 'duplicates', 'unexpected'])
          for (const displayMode of ['normal', 'reject', 'second-reject']) {
            const args = [types, thumbnails, sourceId, mappedMode, nativeMap, preview, displayMode, ''];
            const actual = await run(...args, false);
            if (baseline) assert.deepEqual(actual, await run(...args, true)); cases++;
          }
  for (const failure of ['normalize-sync', 'window-sync', 'window-reject', 'desktop-sync', 'desktop-reject', 'displays-sync',
    'displays-reject', 'fallback-sync', 'map-sync', 'native-preview-sync', 'native-preview-reject', 'area-preview-sync', 'area-preview-reject']) {
    const args = [['screen', 'window'], true, '', 'missing', true, 'normal', failure === 'fallback-sync' ? 'reject' : 'normal', failure];
    const actual = await run(...args, false);
    if (baseline) assert.deepEqual(actual, await run(...args, true)); cases++;
  }
  for (const order of [['window', 'desktop', 'displays'], ['displays', 'desktop', 'window'], ['desktop', 'window', 'displays']]) {
    const actual = await runDeferred(order, false);
    if (baseline) assert.deepEqual(actual, await runDeferred(order, true)); cases++;
  }
  const actual = await runGetters(false); if (baseline) assert.deepEqual(actual, await runGetters(true)); cases++;
  for (const types of [['screen'], ['window'], ['screen', 'window']]) for (const thumbnails of [false, true])
    for (const mode of ['normal', 'empty', 'missing', 'none']) {
      const actual = await runRoot(types, thumbnails, mode, false);
      if (baseline) assert.deepEqual(actual, await runRoot(types, thumbnails, mode, true)); cases++;
    }
  console.log(`Capture source query passed: ${cases} selection/merge/fallback/error/getter/deferred scenarios.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
