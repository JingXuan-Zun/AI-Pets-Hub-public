const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const contextFile = path.resolve(__dirname, '../electron/capture/areaPickerContext.cjs');
const projectionFile = path.resolve(__dirname, '../electron/capture/displayProjection.cjs');
const { createAreaPickerContextBuilder } = require(contextFile);
const { createCaptureDisplayProjection } = require(projectionFile);
const geometry = require('../electron/capture/displayGeometry.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
let oldContext, oldProjection;
if (baseline) {
  const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  const declaration = name => root.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name).getText(ast);
  oldContext = new Function('dependencies', `const { getVirtualDisplayBounds, getDisplayListWithNativeBounds,
    getAreaPickerScreenSources, getAreaPickerThumbnailSize, screen } = dependencies;
    ${declaration('buildAreaPickerContext')}\nreturn buildAreaPickerContext;`);
  oldProjection = new Function('dependencies', `const { screen, getFullDisplayBounds, getDisplayScaleFactor,
    createFallbackNativeDisplayBounds, resolveNativeDisplayBounds } = dependencies;
    ${declaration('createDisplayListItem')}\n${declaration('createDisplayList')}\nreturn createDisplayList;`);
}

function contextFixture(scale, nativeKind, sourceKind, failure, original, deferred = false) {
  const trace = [], pending = [];
  const virtual = { x: -1920.4, y: -10.4, width: 3840.8, height: 1090.8 };
  const displays = [1, 2].map(id => ({ id, label: `Display ${id}`, x: id === 1 ? -1920 : 0, y: -10,
    width: 1920, height: 1080, scaleFactor: scale,
    ...(nativeKind === 'zero' ? { nativeX: 0, nativeY: 0, nativeWidth: 0, nativeHeight: 0 }
      : nativeKind === 'native' ? { nativeX: id === 1 ? -2560 : 0, nativeY: -20, nativeWidth: 2560, nativeHeight: 1440 } : {}) }));
  const source = (id, displayId, name = '', thumbnail = '') => ({ id, type: 'screen', displayId, name, thumbnail });
  const sources = sourceKind === 'empty' ? [] : sourceKind === 'null' ? [null]
    : sourceKind === 'single' ? [source('screen:1', '1')]
    : sourceKind === 'duplicates' ? [source('first', 1), source('last', '1', 'Last source', 'last:image'), source('screen:2', '2')]
    : [source('screen:1', '1', 'Primary', 'image'), source('screen:2', '2'), { id: 'window', type: 'window', displayId: '1' }];
  const thumbnailSize = { width: 2560, height: 1440 };
  const screen = { getAllDisplays() { assert.strictEqual(this, screen); trace.push(['screen']); return displays; } };
  const dependencies = { screen,
    getVirtualDisplayBounds() { trace.push(['virtual']); if (failure === 'virtual') throw Error(failure); return virtual; },
    getDisplayListWithNativeBounds(options) {
      trace.push(['displays', options]); if (failure === 'display-sync') throw Error(failure);
      if (failure === 'display-reject') return Promise.reject(Error(failure));
      return deferred ? new Promise(resolve => pending.push({ name: 'displays', resolve })) : Promise.resolve(displays);
    },
    getAreaPickerThumbnailSize(input) { assert.strictEqual(input, displays); trace.push(['size']); if (failure === 'size') throw Error(failure); return thumbnailSize; },
    getAreaPickerScreenSources(options) {
      assert.strictEqual(options.thumbnailSize, thumbnailSize); trace.push(['sources', options]);
      if (failure === 'sources') return Promise.reject(Error(failure));
      return deferred ? new Promise(resolve => pending.push({ name: 'sources', resolve })) : Promise.resolve(sources);
    },
  };
  const build = original ? oldContext(dependencies) : createAreaPickerContextBuilder(dependencies);
  assert.deepEqual(trace, [], 'Context construction does not query displays or sources');
  return { build, trace, pending, virtual, displays, sources };
}

async function runContext(scale, nativeKind, sourceKind, force, failure, original) {
  const f = contextFixture(scale, nativeKind, sourceKind, failure, original);
  let value, error;
  try { value = await f.build({ forceRefresh: force }); }
  catch (caught) { error = caught.message; }
  if (value) {
    assert.strictEqual(value.virtualBounds, f.virtual);
    if (sourceKind === 'duplicates') assert.equal(value.displays[0].sourceId, 'last');
    if (sourceKind === 'empty') assert.deepEqual(value.nativeVirtualBounds, { x: -1920, y: -10, width: 3840, height: 1090 });
    if (nativeKind === 'zero' && value.displays.length) assert.equal(value.displays[0].nativeWidth, 0);
  }
  return { value, error, trace: f.trace };
}

async function runDeferred(original) {
  const f = contextFixture(1.25, 'fallback', 'both', '', original, true);
  let reads = 0;
  const request = f.build({ get forceRefresh() { f.trace.push(['force-getter', ++reads]); return reads === 1; } });
  assert.deepEqual(f.pending.map(x => x.name), ['displays']); assert.equal(reads, 1);
  f.pending.shift().resolve(f.displays); await Promise.resolve();
  assert.deepEqual(f.pending.map(x => x.name), ['sources']); assert.equal(reads, 2);
  f.pending.shift().resolve(f.sources); return { value: await request, trace: f.trace };
}

function runProjection(scale, nativeKind, displayKind, original) {
  const trace = [];
  const displays = [1, 2].map(id => {
    const bounds = { x: id === 1 ? -1920 : 0, y: -10, width: 1920, height: 1080 };
    return { id, label: id === 1 ? '' : 'Secondary', scaleFactor: scale,
      bounds: displayKind === 'work-only' ? null : bounds, workArea: { ...bounds, height: 1040 } };
  });
  const list = displayKind === 'empty' ? [] : displays;
  const native = nativeKind === 'empty' ? [] : nativeKind === 'one' ? [{ isPrimary: true, x: -1920, y: -10, width: 1920, height: 1080 }]
    : [{ isPrimary: true, x: -2560, y: -20, width: 2560, height: 1440 }, { x: 0, y: -20, width: 2560, height: 1440 }];
  const screen = { getAllDisplays() { assert.strictEqual(this, screen); trace.push(['all']); return list; },
    getPrimaryDisplay() { assert.strictEqual(this, screen); trace.push(['primary']); return displays[0]; } };
  const dependencies = { ...geometry, screen,
    getFullDisplayBounds(display) { trace.push(['bounds', display.id]); return display.bounds || display.workArea; },
  };
  const project = original ? oldProjection(dependencies) : createCaptureDisplayProjection(dependencies);
  assert.deepEqual(trace, []); return { value: project(native), trace };
}

async function runRoot(mode, scale, original) {
  const trace = []; const displays = [1, 2].map(id => ({ id, scaleFactor: scale,
    bounds: { x: id === 1 ? -1920 : 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: id === 1 ? -1920 : 0, y: 0, width: 1920, height: 1040 } }));
  const electron = { app: {}, BrowserWindow: {}, screen: {
    getAllDisplays() { trace.push(['all']); return displays; }, getPrimaryDisplay() { trace.push(['primary']); return displays[0]; },
  }, desktopCapturer: { async getSources(options) {
    trace.push(['capture', options]); if (mode === 'error') throw Error('capture-error'); if (mode === 'empty') return [];
    return displays.map(display => ({ id: `screen:${display.id}`, display_id: mode === 'missing-id' ? '' : String(display.id), name: `Source ${display.id}`,
      thumbnail: { isEmpty: () => mode === 'empty-image', getSize: () => options.thumbnailSize, toDataURL: () => `image:${display.id}` } }));
  } } };
  const loaded = new Map();
  function load(file) {
    if (loaded.has(file)) return loaded.get(file).exports;
    const module = { exports: {} }; loaded.set(file, module);
    new Function('require', 'module', 'exports', 'process', 'Date', file === rootFile && original ? baseline : fs.readFileSync(file, 'utf8'))(id => {
      if (id === 'electron') return electron;
      if (id === 'child_process') return { execFile() { throw Error('Unexpected native call'); } };
      if (id === 'fs') return {}; if (id === 'path') return path;
      assert.ok(id.startsWith('./')); return load(path.resolve(path.dirname(file), id));
    }, module, module.exports, { platform: 'linux' }, { now: () => 100 });
    return module.exports;
  }
  const { createCaptureService } = load(rootFile); const first = createCaptureService(), second = createCaptureService();
  const output = [Object.keys(first), first.getDisplayList()];
  for (const [service, force] of [[first, false], [first, true], [second, false]]) {
    if (mode === 'error') await assert.rejects(service.buildAreaPickerContext({ forceRefresh: force }), /capture-error/);
    else output.push(await service.buildAreaPickerContext({ forceRefresh: force }));
  }
  first.dispose(); second.dispose(); return { output, trace };
}

function structure() {
  for (const file of [contextFile, projectionFile]) {
    const text = fs.readFileSync(file, 'utf8'), ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    assert.ok(text.split('\n').length <= 300);
    function visit(n) { if (ts.isFunctionLike(n) && n.body) assert.ok(ast.getLineAndCharacterOfPosition(n.end).line
      - ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1 <= 50); ts.forEachChild(n, visit); } visit(ast);
  }
  if (!baseline) return;
  function retained(source, original) {
    const ast = ts.createSourceFile(rootFile, source, ts.ScriptTarget.Latest, true);
    const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
    return root.body.statements.filter(n => original ? !(ts.isFunctionDeclaration(n) && ['createDisplayListItem', 'createDisplayList', 'buildAreaPickerContext'].includes(n.name.text))
      : !n.getText(ast).startsWith('const createDisplayList = createCaptureDisplayProjection(')
        && !n.getText(ast).startsWith('const buildAreaPickerContext = createAreaPickerContextBuilder(')).map(n => n.getText(ast));
  }
  assert.deepEqual(retained(fs.readFileSync(rootFile, 'utf8'), false), retained(baseline, true));
}

async function main() {
  structure(); let cases = 0;
  for (const scale of [0, 1, 1.25, 2, NaN, '1.5']) for (const native of ['fallback', 'native', 'zero'])
    for (const sources of ['both', 'single', 'duplicates', 'empty', 'null']) for (const force of [false, true])
      for (const failure of ['', 'virtual', 'display-sync', 'display-reject', 'size', 'sources']) {
        const actual = await runContext(scale, native, sources, force, failure, false);
        if (baseline) assert.deepEqual(actual, await runContext(scale, native, sources, force, failure, true)); cases++;
      }
  const deferred = await runDeferred(false); if (baseline) assert.deepEqual(deferred, await runDeferred(true)); cases++;
  for (const scale of [0, 1, 1.25, 2, NaN, '1.5']) for (const native of ['empty', 'one', 'two']) for (const kind of ['normal', 'empty', 'work-only']) {
    const actual = runProjection(scale, native, kind, false); if (baseline) assert.deepEqual(actual, runProjection(scale, native, kind, true)); cases++;
  }
  for (const mode of ['normal', 'empty-image', 'empty', 'missing-id', 'error']) for (const scale of [1, 1.25, 2]) {
    const actual = await runRoot(mode, scale, false); if (baseline) assert.deepEqual(actual, await runRoot(mode, scale, true)); cases++;
  }
  console.log(`Capture context/projection passed: ${cases} geometry/query/error/deferred/controlled-root scenarios.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
